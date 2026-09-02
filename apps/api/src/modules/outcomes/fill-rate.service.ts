import type { FillRateMeasurement } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { HistoricalSaleRepository } from "../demand/historical-sale.repository.js";
import { CustomerOrderRepository } from "../demand/customer-order.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  FILL_RATE_MEASUREMENT_RULE,
  outcomeAuditEventTypes,
  outcomeOutboxEventTypes,
} from "./outcomes.constants.js";
import { buildMeasurementWindow } from "./outcomes-date-utils.js";
import { FillRateMeasurementRepository } from "./fill-rate-measurement.repository.js";
import { toFillRateMeasurementDto } from "./outcomes.mappers.js";
import type {
  ComputeFillRateInput,
  FillRateComputationResultDto,
  FillRateMeasurementDto,
} from "./outcomes.schemas.js";

interface ScopeSummary {
  skuId: string;
  locationId: string;
  orderedQty: number;
  fulfilledQty: number;
}

export class FillRateService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly customerOrderRepository: CustomerOrderRepository,
    private readonly historicalSaleRepository: HistoricalSaleRepository,
    private readonly fillRateMeasurementRepository: FillRateMeasurementRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async computeFillRate(
    context: RequestContext,
    input: ComputeFillRateInput,
  ): Promise<FillRateComputationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "outcomes.write");
      return this.computeFillRateInTransaction(db, organizationId, input, {
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });
    });
  }

  public async computeFillRateAsSystem(
    organizationId: string,
    input: ComputeFillRateInput,
    correlationId: string,
  ): Promise<FillRateComputationResultDto> {
    return this.transactionRunner.run((db) =>
      this.computeFillRateInTransaction(db, organizationId, input, {
        actorUserId: null,
        correlationId,
      }),
    );
  }

  public async listMeasurements(
    context: RequestContext,
    filters: { skuId?: string; locationId?: string },
  ): Promise<FillRateMeasurementDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const measurements = await this.fillRateMeasurementRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
    });

    return measurements.map(toFillRateMeasurementDto);
  }

  public async getMeasurement(context: RequestContext, measurementId: string): Promise<FillRateMeasurementDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const measurement = await this.fillRateMeasurementRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: measurementId,
    });
    if (!measurement) {
      throw new NotFoundError("Fill-rate measurement was not found.");
    }

    return toFillRateMeasurementDto(measurement);
  }

  public async computeFillRateInTransaction(
    db: DbClient,
    organizationId: string,
    input: ComputeFillRateInput,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<FillRateComputationResultDto> {
    const window = buildMeasurementWindow(input.measurementWindowStart, input.measurementWindowEnd);
    const [orders, sales] = await Promise.all([
      this.customerOrderRepository.listByOrderedAtWindow(db, {
        organizationId,
        orderedAtGte: window.start,
        orderedAtLte: window.end,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      }),
      this.historicalSaleRepository.listByOrganization(db, {
        organizationId,
        observedAtGte: window.start,
        observedAtLte: window.end,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      }),
    ]);

    const orderedQtyByScope = new Map<string, number>();
    for (const order of orders) {
      const includeOrder = order.status === "open" || order.cancelledAt === null || order.cancelledAt > window.end;
      if (!includeOrder) {
        continue;
      }

      for (const line of order.lines) {
        if (input.skuId && line.skuId !== input.skuId) {
          continue;
        }
        if (input.locationId && line.locationId !== input.locationId) {
          continue;
        }

        const key = `${line.skuId}:${line.locationId}`;
        orderedQtyByScope.set(key, (orderedQtyByScope.get(key) ?? 0) + line.quantity);
      }
    }

    const realizedSalesByScope = new Map<string, number>();
    for (const sale of sales) {
      const key = `${sale.skuId}:${sale.locationId}`;
      realizedSalesByScope.set(key, (realizedSalesByScope.get(key) ?? 0) + sale.quantity);
    }

    const scopeSummaries: ScopeSummary[] = [...orderedQtyByScope.entries()]
      .flatMap(([key, orderedQty]) => {
        const [skuId, locationId] = key.split(":");
        if (!skuId || !locationId) {
          return [];
        }
        const realizedSalesQty = realizedSalesByScope.get(key) ?? 0;

        return [{
          skuId,
          locationId,
          orderedQty,
          fulfilledQty: Math.min(orderedQty, realizedSalesQty),
        }];
      })
      .filter((summary) => summary.orderedQty > 0)
      .sort((left, right) =>
        `${left.skuId}:${left.locationId}`.localeCompare(`${right.skuId}:${right.locationId}`),
      );

    const persistedMeasurements: FillRateMeasurement[] = [];
    for (const summary of scopeSummaries) {
      const fillRate = summary.fulfilledQty / summary.orderedQty;
      const measurement = await this.fillRateMeasurementRepository.upsert(db, {
        organizationId,
        skuId: summary.skuId,
        locationId: summary.locationId,
        measurementWindowStart: window.start,
        measurementWindowEnd: window.end,
        create: {
          organizationId,
          skuId: summary.skuId,
          locationId: summary.locationId,
          measurementWindowStart: window.start,
          measurementWindowEnd: window.end,
          orderedQty: summary.orderedQty,
          fulfilledQty: summary.fulfilledQty,
          fillRate,
        },
        update: {
          orderedQty: summary.orderedQty,
          fulfilledQty: summary.fulfilledQty,
          fillRate,
        },
      });

      persistedMeasurements.push(measurement);

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: options.actorUserId,
        eventType: outcomeAuditEventTypes.fillRateMeasured,
        entityType: "FillRateMeasurement",
        entityId: measurement.id,
        payload: {
          skuId: summary.skuId,
          locationId: summary.locationId,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          orderedQty: summary.orderedQty,
          fulfilledQty: summary.fulfilledQty,
          fillRate,
          formula: FILL_RATE_MEASUREMENT_RULE,
        },
        correlationId: options.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: outcomeOutboxEventTypes.fillRateMeasured,
        aggregateType: "FillRateMeasurement",
        aggregateId: measurement.id,
        payload: {
          organizationId,
          fillRateMeasurementId: measurement.id,
          skuId: summary.skuId,
          locationId: summary.locationId,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          orderedQty: summary.orderedQty,
          fulfilledQty: summary.fulfilledQty,
          fillRate,
        },
      });
    }

    return {
      measurementWindowStart: window.start.toISOString(),
      measurementWindowEnd: window.end.toISOString(),
      computedCount: persistedMeasurements.length,
      measurements: persistedMeasurements.map(toFillRateMeasurementDto),
    };
  }
}
