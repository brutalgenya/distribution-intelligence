import {
  DecisionOutcomeStatus,
  DecisionStatus,
  Prisma,
  type Decision,
  type ExecutionTask,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { HistoricalSaleRepository } from "../demand/historical-sale.repository.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { ExecutionTaskRepository } from "../execution/execution-task.repository.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  DECISION_OUTCOME_LINKAGE_RULE,
  outcomeAuditEventTypes,
  outcomeOutboxEventTypes,
} from "./outcomes.constants.js";
import {
  buildMeasurementWindow,
  calculateWindowDays,
  maxDate,
  subtractWindow,
  type MeasurementWindow,
} from "./outcomes-date-utils.js";
import { DecisionOutcomeRepository } from "./decision-outcome.repository.js";
import { FillRateService } from "./fill-rate.service.js";
import { ForecastErrorService } from "./forecast-error.service.js";
import { InventoryCostSnapshotService } from "./inventory-cost-snapshot.service.js";
import { InventoryHistoryService } from "./inventory-history.service.js";
import { toDecisionOutcomeDto } from "./outcomes.mappers.js";
import type {
  ComputeDecisionOutcomesInput,
  DecisionOutcomeComputationResultDto,
  DecisionOutcomeDto,
  FillRateMeasurementDto,
  ForecastErrorMeasurementDto,
} from "./outcomes.schemas.js";
import { StockoutDetectionService } from "./stockout-detection.service.js";

const roundMetric = (value: number): number => Math.round(value * 100) / 100;

const calculateDaysOfCover = (
  availableToPromiseQty: number,
  estimatedDailyDemandQty: number,
): number | null =>
  estimatedDailyDemandQty <= 0 ? null : roundMetric(availableToPromiseQty / estimatedDailyDemandQty);

const sumHistoricalSalesQty = async (
  db: DbClient,
  historicalSaleRepository: HistoricalSaleRepository,
  input: {
    organizationId: string;
    skuId: string;
    locationId: string;
    observedAtGte: Date;
    observedAtLte: Date;
  },
): Promise<number> => {
  const sales = await historicalSaleRepository.listByOrganization(db, input);
  return sales.reduce((sum, sale) => sum + sale.quantity, 0);
};

export class DecisionOutcomeService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly historicalSaleRepository: HistoricalSaleRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly fillRateService: FillRateService,
    private readonly forecastErrorService: ForecastErrorService,
    private readonly stockoutDetectionService: StockoutDetectionService,
    private readonly inventoryCostSnapshotService: InventoryCostSnapshotService,
    private readonly inventoryHistoryService: InventoryHistoryService,
    private readonly decisionOutcomeRepository: DecisionOutcomeRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async computeDecisionOutcomes(
    context: RequestContext,
    input: ComputeDecisionOutcomesInput,
  ): Promise<DecisionOutcomeComputationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "outcomes.write");
      return this.computeDecisionOutcomesInTransaction(db, organizationId, input, {
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });
    });
  }

  public async computeDecisionOutcomesAsSystem(
    organizationId: string,
    input: ComputeDecisionOutcomesInput,
    correlationId: string,
  ): Promise<DecisionOutcomeComputationResultDto> {
    return this.transactionRunner.run((db) =>
      this.computeDecisionOutcomesInTransaction(db, organizationId, input, {
        actorUserId: null,
        correlationId,
      }),
    );
  }

  public async listDecisionOutcomes(
    context: RequestContext,
    filters: { decisionId?: string; outcomeStatus?: DecisionOutcomeStatus },
  ): Promise<DecisionOutcomeDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const outcomes = await this.decisionOutcomeRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
      ...(filters.outcomeStatus ? { outcomeStatus: filters.outcomeStatus } : {}),
    });

    return outcomes.map(toDecisionOutcomeDto);
  }

  public async getDecisionOutcome(context: RequestContext, outcomeId: string): Promise<DecisionOutcomeDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const outcome = await this.decisionOutcomeRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: outcomeId,
    });
    if (!outcome) {
      throw new NotFoundError("Decision outcome was not found.");
    }

    return toDecisionOutcomeDto(outcome);
  }

  public async listOutcomesByDecision(
    context: RequestContext,
    decisionId: string,
  ): Promise<DecisionOutcomeDto[]> {
    return this.listDecisionOutcomes(context, { decisionId });
  }

  public async computeDecisionOutcomesInTransaction(
    db: DbClient,
    organizationId: string,
    input: ComputeDecisionOutcomesInput,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<DecisionOutcomeComputationResultDto> {
    const requestedWindow = buildMeasurementWindow(input.measurementWindowStart, input.measurementWindowEnd);
    const decisions = await this.loadDecisions(db, organizationId, input);
    const outcomes = [];

    for (const decision of decisions) {
      outcomes.push(
        await this.computeOutcomeForDecision(db, organizationId, decision, requestedWindow, options),
      );
    }

    return {
      measurementWindowStart: requestedWindow.start.toISOString(),
      measurementWindowEnd: requestedWindow.end.toISOString(),
      computedCount: outcomes.length,
      outcomes: outcomes.map(toDecisionOutcomeDto),
    };
  }

  private async loadDecisions(
    db: DbClient,
    organizationId: string,
    input: ComputeDecisionOutcomesInput,
  ): Promise<DecisionWithDetails[]> {
    if (input.decisionId) {
      const decision = await this.decisionRepository.findByIdForOrganization(db, {
        organizationId,
        id: input.decisionId,
      });
      if (!decision) {
        throw new NotFoundError("Decision was not found.");
      }
      return [decision];
    }

    if (input.decisionIds && input.decisionIds.length > 0) {
      const decisions: DecisionWithDetails[] = [];
      for (const decisionId of input.decisionIds) {
        const decision = await this.decisionRepository.findByIdForOrganization(db, {
          organizationId,
          id: decisionId,
        });
        if (!decision) {
          throw new NotFoundError(`Decision ${decisionId} was not found.`);
        }
        decisions.push(decision);
      }
      return decisions.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    }

    const decisions = await this.decisionRepository.listByOrganization(db, {
      organizationId,
    });
    return decisions
      .filter((decision) =>
        decision.status === DecisionStatus.executed ||
        decision.status === DecisionStatus.approved ||
        decision.status === DecisionStatus.execution_failed,
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  private async computeOutcomeForDecision(
    db: DbClient,
    organizationId: string,
    decision: DecisionWithDetails,
    requestedWindow: MeasurementWindow,
    options: { actorUserId: string | null; correlationId: string },
  ) {
    if (!decision.skuId || !decision.locationId) {
      return this.persistOutcome(
        db,
        organizationId,
        decision,
        null,
        requestedWindow,
        {
          outcomeStatus: DecisionOutcomeStatus.insufficient_data,
          stockoutAvoided: null,
          fillRateDelta: null,
          inventoryDaysDelta: null,
          holdingCostDelta: null,
          expediteCostDelta: null,
          summaryJson: {
            reason: "Decision scope must include skuId and locationId for outcome computation.",
            linkageRule: DECISION_OUTCOME_LINKAGE_RULE,
          } satisfies Prisma.InputJsonObject,
        },
        options,
      );
    }

    const executionTask = await this.executionTaskRepository.findLatestSucceededByDecisionId(db, {
      organizationId,
      decisionId: decision.id,
    });
    const anchorAt = executionTask?.completedAt ?? decision.updatedAt;
    const effectiveWindow: MeasurementWindow = {
      start: maxDate(requestedWindow.start, anchorAt),
      end: requestedWindow.end,
    };

    if (effectiveWindow.end.getTime() <= effectiveWindow.start.getTime()) {
      return this.persistOutcome(
        db,
        organizationId,
        decision,
        executionTask,
        requestedWindow,
        {
          outcomeStatus: DecisionOutcomeStatus.insufficient_data,
          stockoutAvoided: null,
          fillRateDelta: null,
          inventoryDaysDelta: null,
          holdingCostDelta: null,
          expediteCostDelta: null,
          summaryJson: {
            reason: "The measurement window ends before the decision execution anchor.",
            decisionAnchorAt: anchorAt.toISOString(),
            linkageRule: DECISION_OUTCOME_LINKAGE_RULE,
          } satisfies Prisma.InputJsonObject,
        },
        options,
      );
    }

    const baselineWindow = subtractWindow(effectiveWindow);
    const windowDays = calculateWindowDays(effectiveWindow);
    const [postFillResult, baselineFillResult, stockoutResult, postActualQty, startSnapshot, endSnapshot] =
      await Promise.all([
        this.fillRateService.computeFillRateInTransaction(
          db,
          organizationId,
          {
            measurementWindowStart: effectiveWindow.start.toISOString(),
            measurementWindowEnd: effectiveWindow.end.toISOString(),
            skuId: decision.skuId,
            locationId: decision.locationId,
          },
          options,
        ),
        this.fillRateService.computeFillRateInTransaction(
          db,
          organizationId,
          {
            measurementWindowStart: baselineWindow.start.toISOString(),
            measurementWindowEnd: baselineWindow.end.toISOString(),
            skuId: decision.skuId,
            locationId: decision.locationId,
          },
          options,
        ),
        this.stockoutDetectionService.computeStockoutsInTransaction(
          db,
          organizationId,
          {
            measurementWindowStart: effectiveWindow.start.toISOString(),
            measurementWindowEnd: effectiveWindow.end.toISOString(),
            skuId: decision.skuId,
            locationId: decision.locationId,
          },
          options,
        ),
        sumHistoricalSalesQty(db, this.historicalSaleRepository, {
          organizationId,
          skuId: decision.skuId,
          locationId: decision.locationId,
          observedAtGte: effectiveWindow.start,
          observedAtLte: effectiveWindow.end,
        }),
        this.inventoryHistoryService.calculateSnapshotAt(
          db,
          {
            organizationId,
            skuId: decision.skuId,
            locationId: decision.locationId,
          },
          effectiveWindow.start,
        ),
        this.inventoryHistoryService.calculateSnapshotAt(
          db,
          {
            organizationId,
            skuId: decision.skuId,
            locationId: decision.locationId,
          },
          effectiveWindow.end,
        ),
      ]);

    const postFillMeasurement = this.findScopeMeasurement(
      postFillResult.measurements,
      decision.skuId,
      decision.locationId,
    );
    const baselineFillMeasurement = this.findScopeMeasurement(
      baselineFillResult.measurements,
      decision.skuId,
      decision.locationId,
    );
    const forecastJob = await this.forecastJobRepository.findLatestCompletedSkuLocationJobBefore(db, {
      organizationId,
      skuId: decision.skuId,
      locationId: decision.locationId,
      completedAtLte: effectiveWindow.start,
    });

    const forecastErrorMeasurement = forecastJob
      ? this.findForecastMeasurement(
          (
            await this.forecastErrorService.computeForecastErrorInTransaction(
              db,
              organizationId,
              {
                measurementWindowStart: effectiveWindow.start.toISOString(),
                measurementWindowEnd: effectiveWindow.end.toISOString(),
                skuId: decision.skuId,
                locationId: decision.locationId,
                forecastJobId: forecastJob.id,
              },
              options,
            )
          ).measurements,
          forecastJob.id,
          decision.skuId,
          decision.locationId,
        )
      : null;

    const estimatedDailyDemandQty = roundMetric(
      Math.max(postFillMeasurement?.orderedQty ?? 0, postActualQty) / windowDays,
    );
    const startDaysOfCover = calculateDaysOfCover(
      startSnapshot.availableToPromiseQty,
      estimatedDailyDemandQty,
    );
    const endDaysOfCover = calculateDaysOfCover(
      endSnapshot.availableToPromiseQty,
      estimatedDailyDemandQty,
    );
    const inventoryDaysDelta =
      startDaysOfCover === null || endDaysOfCover === null
        ? null
        : roundMetric(endDaysOfCover - startDaysOfCover);

    const [startCostSnapshot, endCostSnapshot] = await Promise.all([
      this.inventoryCostSnapshotService.captureSnapshotInTransaction(
        db,
        {
          organizationId,
          skuId: decision.skuId,
          locationId: decision.locationId,
          snapshotAt: effectiveWindow.start,
          carryingDays: windowDays,
          estimatedDailyDemandQty,
        },
        options,
      ),
      this.inventoryCostSnapshotService.captureSnapshotInTransaction(
        db,
        {
          organizationId,
          skuId: decision.skuId,
          locationId: decision.locationId,
          snapshotAt: effectiveWindow.end,
          carryingDays: windowDays,
          estimatedDailyDemandQty,
        },
        options,
      ),
    ]);

    const holdingCostDelta =
      startCostSnapshot.holdingCostEstimate === null || endCostSnapshot.holdingCostEstimate === null
        ? null
        : roundMetric(endCostSnapshot.holdingCostEstimate - startCostSnapshot.holdingCostEstimate);
    const expediteCostDelta =
      startCostSnapshot.expediteCostEstimate === null || endCostSnapshot.expediteCostEstimate === null
        ? null
        : roundMetric(endCostSnapshot.expediteCostEstimate - startCostSnapshot.expediteCostEstimate);
    const fillRateDelta =
      baselineFillMeasurement === null || postFillMeasurement === null
        ? null
        : roundMetric(postFillMeasurement.fillRate - baselineFillMeasurement.fillRate);

    const hasSufficientData =
      (postFillMeasurement !== null || postActualQty > 0 || stockoutResult.incidents.length > 0) &&
      effectiveWindow.end.getTime() > effectiveWindow.start.getTime();

    return this.persistOutcome(
      db,
      organizationId,
      decision,
      executionTask,
      requestedWindow,
      {
        outcomeStatus: hasSufficientData ? DecisionOutcomeStatus.computed : DecisionOutcomeStatus.insufficient_data,
        stockoutAvoided: hasSufficientData ? stockoutResult.incidents.length === 0 : null,
        fillRateDelta,
        inventoryDaysDelta,
        holdingCostDelta,
        expediteCostDelta,
        summaryJson: {
          requestedMeasurementWindowStart: requestedWindow.start.toISOString(),
          requestedMeasurementWindowEnd: requestedWindow.end.toISOString(),
          effectiveMeasurementWindowStart: effectiveWindow.start.toISOString(),
          effectiveMeasurementWindowEnd: effectiveWindow.end.toISOString(),
          baselineMeasurementWindowStart: baselineWindow.start.toISOString(),
          baselineMeasurementWindowEnd: baselineWindow.end.toISOString(),
          decisionAnchorAt: anchorAt.toISOString(),
          linkageRule: DECISION_OUTCOME_LINKAGE_RULE,
          postFillRate: postFillMeasurement?.fillRate ?? null,
          baselineFillRate: baselineFillMeasurement?.fillRate ?? null,
          postOrderedQty: postFillMeasurement?.orderedQty ?? 0,
          postFulfilledQty: postFillMeasurement?.fulfilledQty ?? 0,
          postActualQty,
          estimatedDailyDemandQty,
          postStockoutIncidentIds: stockoutResult.incidents.map((incident) => incident.id),
          startAvailableToPromiseQty: startSnapshot.availableToPromiseQty,
          endAvailableToPromiseQty: endSnapshot.availableToPromiseQty,
          startDaysOfCover,
          endDaysOfCover,
          forecastJobId: forecastJob?.id ?? null,
          forecastAbsoluteError: forecastErrorMeasurement?.absoluteError ?? null,
          forecastPercentageError: forecastErrorMeasurement?.percentageError ?? null,
          startCostSnapshotId: startCostSnapshot.id,
          endCostSnapshotId: endCostSnapshot.id,
        } satisfies Prisma.InputJsonObject,
      },
      options,
    );
  }

  private async persistOutcome(
    db: DbClient,
    organizationId: string,
    decision: Decision,
    executionTask: ExecutionTask | null,
    requestedWindow: MeasurementWindow,
    values: {
      outcomeStatus: DecisionOutcomeStatus;
      stockoutAvoided: boolean | null;
      fillRateDelta: number | null;
      inventoryDaysDelta: number | null;
      holdingCostDelta: number | null;
      expediteCostDelta: number | null;
      summaryJson: Prisma.InputJsonObject;
    },
    options: { actorUserId: string | null; correlationId: string },
  ) {
    const computedAt = new Date();
    const outcome = await this.decisionOutcomeRepository.upsert(db, {
      organizationId,
      decisionId: decision.id,
      measurementWindowStart: requestedWindow.start,
      measurementWindowEnd: requestedWindow.end,
      create: {
        organizationId,
        decisionId: decision.id,
        ...(executionTask ? { executionTaskId: executionTask.id } : {}),
        measurementWindowStart: requestedWindow.start,
        measurementWindowEnd: requestedWindow.end,
        outcomeStatus: values.outcomeStatus,
        ...(values.stockoutAvoided !== null ? { stockoutAvoided: values.stockoutAvoided } : {}),
        ...(values.fillRateDelta !== null ? { fillRateDelta: values.fillRateDelta } : {}),
        ...(values.inventoryDaysDelta !== null ? { inventoryDaysDelta: values.inventoryDaysDelta } : {}),
        ...(values.holdingCostDelta !== null ? { holdingCostDelta: values.holdingCostDelta } : {}),
        ...(values.expediteCostDelta !== null ? { expediteCostDelta: values.expediteCostDelta } : {}),
        summaryJson: values.summaryJson,
        computedAt,
      },
      update: {
        executionTaskId: executionTask?.id ?? null,
        outcomeStatus: values.outcomeStatus,
        stockoutAvoided: values.stockoutAvoided,
        fillRateDelta: values.fillRateDelta,
        inventoryDaysDelta: values.inventoryDaysDelta,
        holdingCostDelta: values.holdingCostDelta,
        expediteCostDelta: values.expediteCostDelta,
        summaryJson: values.summaryJson,
        computedAt,
      },
    });

    await this.auditEventRepository.create(db, {
      organizationId,
      actorUserId: options.actorUserId,
      eventType: outcomeAuditEventTypes.decisionComputed,
      entityType: "DecisionOutcome",
      entityId: outcome.id,
      payload: {
        decisionId: decision.id,
        executionTaskId: executionTask?.id ?? null,
        measurementWindowStart: requestedWindow.start.toISOString(),
        measurementWindowEnd: requestedWindow.end.toISOString(),
        outcomeStatus: outcome.outcomeStatus,
      },
      correlationId: options.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId,
      eventType: outcomeOutboxEventTypes.decisionComputed,
      aggregateType: "DecisionOutcome",
      aggregateId: outcome.id,
      payload: {
        organizationId,
        decisionOutcomeId: outcome.id,
        decisionId: decision.id,
        executionTaskId: executionTask?.id ?? null,
        measurementWindowStart: requestedWindow.start.toISOString(),
        measurementWindowEnd: requestedWindow.end.toISOString(),
        outcomeStatus: outcome.outcomeStatus,
      },
    });

    return outcome;
  }

  private findScopeMeasurement(
    measurements: FillRateMeasurementDto[],
    skuId: string,
    locationId: string,
  ): FillRateMeasurementDto | null {
    return measurements.find(
      (measurement) => measurement.skuId === skuId && measurement.locationId === locationId,
    ) ?? null;
  }

  private findForecastMeasurement(
    measurements: ForecastErrorMeasurementDto[],
    forecastJobId: string,
    skuId: string,
    locationId: string,
  ): ForecastErrorMeasurementDto | null {
    return measurements.find(
      (measurement) =>
        measurement.forecastJobId === forecastJobId &&
        measurement.skuId === skuId &&
        measurement.locationId === locationId,
    ) ?? null;
  }
}
