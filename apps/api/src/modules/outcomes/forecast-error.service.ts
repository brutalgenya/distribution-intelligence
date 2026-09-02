import type { ForecastErrorMeasurement } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { HistoricalSaleRepository } from "../demand/historical-sale.repository.js";
import { ForecastResultRepository } from "../forecasting/forecast-result.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  FORECAST_ERROR_MEASUREMENT_RULE,
  outcomeAuditEventTypes,
  outcomeOutboxEventTypes,
} from "./outcomes.constants.js";
import { buildMeasurementWindow } from "./outcomes-date-utils.js";
import { ForecastErrorMeasurementRepository } from "./forecast-error-measurement.repository.js";
import { toForecastErrorMeasurementDto } from "./outcomes.mappers.js";
import type {
  ComputeForecastErrorInput,
  ForecastErrorComputationResultDto,
  ForecastErrorMeasurementDto,
} from "./outcomes.schemas.js";

interface ForecastScopeSummary {
  forecastJobId: string;
  skuId: string;
  locationId: string | null;
  forecastQty: number;
}

export class ForecastErrorService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly forecastResultRepository: ForecastResultRepository,
    private readonly historicalSaleRepository: HistoricalSaleRepository,
    private readonly forecastErrorMeasurementRepository: ForecastErrorMeasurementRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async computeForecastError(
    context: RequestContext,
    input: ComputeForecastErrorInput,
  ): Promise<ForecastErrorComputationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "outcomes.write");
      return this.computeForecastErrorInTransaction(db, organizationId, input, {
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });
    });
  }

  public async computeForecastErrorAsSystem(
    organizationId: string,
    input: ComputeForecastErrorInput,
    correlationId: string,
  ): Promise<ForecastErrorComputationResultDto> {
    return this.transactionRunner.run((db) =>
      this.computeForecastErrorInTransaction(db, organizationId, input, {
        actorUserId: null,
        correlationId,
      }),
    );
  }

  public async listMeasurements(
    context: RequestContext,
    filters: { skuId?: string; locationId?: string; forecastJobId?: string },
  ): Promise<ForecastErrorMeasurementDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const measurements = await this.forecastErrorMeasurementRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.forecastJobId ? { forecastJobId: filters.forecastJobId } : {}),
    });

    return measurements.map(toForecastErrorMeasurementDto);
  }

  public async getMeasurement(
    context: RequestContext,
    measurementId: string,
  ): Promise<ForecastErrorMeasurementDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const measurement = await this.forecastErrorMeasurementRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: measurementId,
    });
    if (!measurement) {
      throw new NotFoundError("Forecast-error measurement was not found.");
    }

    return toForecastErrorMeasurementDto(measurement);
  }

  public async computeForecastErrorInTransaction(
    db: DbClient,
    organizationId: string,
    input: ComputeForecastErrorInput,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<ForecastErrorComputationResultDto> {
    const window = buildMeasurementWindow(input.measurementWindowStart, input.measurementWindowEnd);
    const [forecastResults, sales] = await Promise.all([
      this.forecastResultRepository.listByOrganizationWindow(db, {
        organizationId,
        forecastDateGte: window.start,
        forecastDateLte: window.end,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.forecastJobId ? { forecastJobId: input.forecastJobId } : {}),
      }),
      this.historicalSaleRepository.listByOrganization(db, {
        organizationId,
        observedAtGte: window.start,
        observedAtLte: window.end,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      }),
    ]);

    const forecastByScope = new Map<string, ForecastScopeSummary>();
    for (const result of forecastResults) {
      const key = `${result.forecastJobId}:${result.skuId}:${result.locationId ?? "none"}`;
      const current = forecastByScope.get(key);
      forecastByScope.set(key, {
        forecastJobId: result.forecastJobId,
        skuId: result.skuId,
        locationId: result.locationId,
        forecastQty: (current?.forecastQty ?? 0) + result.forecastQty,
      });
    }

    const actualQtyByScope = new Map<string, number>();
    for (const sale of sales) {
      const key = `${sale.skuId}:${sale.locationId}`;
      actualQtyByScope.set(key, (actualQtyByScope.get(key) ?? 0) + sale.quantity);
    }

    const persistedMeasurements: ForecastErrorMeasurement[] = [];
    for (const summary of [...forecastByScope.values()].sort((left, right) =>
      `${left.forecastJobId}:${left.skuId}:${left.locationId ?? "none"}`.localeCompare(
        `${right.forecastJobId}:${right.skuId}:${right.locationId ?? "none"}`,
      ),
    )) {
      if (!summary.locationId) {
        continue;
      }

      const actualQty = actualQtyByScope.get(`${summary.skuId}:${summary.locationId ?? ""}`) ?? 0;
      const absoluteError = Math.abs(summary.forecastQty - actualQty);
      const percentageError = actualQty === 0 ? null : absoluteError / actualQty;

      const measurement = await this.forecastErrorMeasurementRepository.upsert(db, {
          organizationId,
          forecastJobId: summary.forecastJobId,
          skuId: summary.skuId,
          locationId: summary.locationId,
        measurementWindowStart: window.start,
        measurementWindowEnd: window.end,
        create: {
          organizationId,
          forecastJobId: summary.forecastJobId,
          skuId: summary.skuId,
          ...(summary.locationId ? { locationId: summary.locationId } : {}),
          measurementWindowStart: window.start,
          measurementWindowEnd: window.end,
          actualQty,
          forecastQty: summary.forecastQty,
          absoluteError,
          ...(percentageError !== null ? { percentageError } : {}),
        },
        update: {
          actualQty,
          forecastQty: summary.forecastQty,
          absoluteError,
          percentageError,
        },
      });

      persistedMeasurements.push(measurement);

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: options.actorUserId,
        eventType: outcomeAuditEventTypes.forecastErrorComputed,
        entityType: "ForecastErrorMeasurement",
        entityId: measurement.id,
        payload: {
          forecastJobId: summary.forecastJobId,
          skuId: summary.skuId,
          locationId: summary.locationId,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          actualQty,
          forecastQty: summary.forecastQty,
          absoluteError,
          percentageError,
          formula: FORECAST_ERROR_MEASUREMENT_RULE,
        },
        correlationId: options.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: outcomeOutboxEventTypes.forecastErrorComputed,
        aggregateType: "ForecastErrorMeasurement",
        aggregateId: measurement.id,
        payload: {
          organizationId,
          forecastErrorMeasurementId: measurement.id,
          forecastJobId: summary.forecastJobId,
          skuId: summary.skuId,
          locationId: summary.locationId,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          actualQty,
          forecastQty: summary.forecastQty,
          absoluteError,
          percentageError,
        },
      });
    }

    return {
      measurementWindowStart: window.start.toISOString(),
      measurementWindowEnd: window.end.toISOString(),
      computedCount: persistedMeasurements.length,
      measurements: persistedMeasurements.map(toForecastErrorMeasurementDto),
    };
  }
}
