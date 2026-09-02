import { UsageMeterType, type ForecastJobStatus, type ForecastScopeType } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { BASELINE_FORECAST_LOOKBACK_DAYS } from "./forecasting.constants.js";
import { getForecastAnchorDate } from "./forecasting-dates.js";
import { toForecastJobDto, toForecastResultDto } from "./forecasting.mappers.js";
import type {
  CreateForecastJobInput,
  ForecastJobDto,
  ForecastResultDto,
} from "./forecasting.schemas.js";
import type { ForecastScopeReference } from "./forecasting.types.js";
import { ForecastJobRepository } from "./forecast-job.repository.js";
import { ForecastResultRepository } from "./forecast-result.repository.js";

export class ForecastJobService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly forecastResultRepository: ForecastResultRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async createJob(context: RequestContext, input: CreateForecastJobInput): Promise<ForecastJobDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "forecasting.write");
      await this.billingEntitlementService.ensureForecastJobAllowedInTransaction(db, {
        organizationId,
      });
      await this.validateScope(db, organizationId, input.scopeType, this.buildScopeReference(input));

      const now = new Date();
      const anchorDate = getForecastAnchorDate(now);
      const scopeReference = this.buildScopeReference(input);
      const inputSnapshot = {
        anchorDate: anchorDate.toISOString(),
        demandSignalCreatedAtCutoff: now.toISOString(),
        lookbackDays: BASELINE_FORECAST_LOOKBACK_DAYS,
        horizonDays: input.horizonDays,
        modelType: input.modelType,
        scopeType: input.scopeType,
        scopeReference,
      } satisfies Prisma.InputJsonObject;

      const job = await this.forecastJobRepository.create(db, {
        organizationId,
        requestedByUserId: context.user.id,
        scopeType: input.scopeType,
        ...(scopeReference ? { scopeReference } : {}),
        horizonDays: input.horizonDays,
        modelType: input.modelType,
        inputSnapshot,
      });
      await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        meterTypes: [UsageMeterType.forecast_jobs],
        sourceType: "forecast_job_created",
        sourceReference: job.id,
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "forecast.job.created",
        entityType: "ForecastJob",
        entityId: job.id,
        payload: {
          scopeType: job.scopeType,
          scopeReference: job.scopeReference,
          horizonDays: job.horizonDays,
          modelType: job.modelType,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "forecast.job.created.v1",
        aggregateType: "ForecastJob",
        aggregateId: job.id,
        payload: {
          organizationId,
          forecastJobId: job.id,
          scopeType: job.scopeType,
          scopeReference: job.scopeReference,
          horizonDays: job.horizonDays,
          modelType: job.modelType,
          status: job.status,
        },
      });

      this.telemetryService.incrementCounter("forecast.job.created", 1, { organizationId, modelType: job.modelType });
      this.logger.info(
        "Forecast job created.",
        { forecastJobId: job.id, scopeType: job.scopeType, modelType: job.modelType },
        { module: "forecasting", operation: "createJob", organizationId, forecastJobId: job.id },
      );

      return toForecastJobDto(job);
    });
  }

  public async listJobs(
    context: RequestContext,
    filters: { status?: ForecastJobStatus },
  ): Promise<ForecastJobDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "forecasting.read");

    const jobs = await this.forecastJobRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return jobs.map(toForecastJobDto);
  }

  public async getJob(context: RequestContext, jobId: string): Promise<ForecastJobDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "forecasting.read");

    const job = await this.forecastJobRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: jobId,
    });
    if (!job) {
      throw new NotFoundError("Forecast job was not found.");
    }

    return toForecastJobDto(job);
  }

  public async listResults(context: RequestContext, jobId: string): Promise<ForecastResultDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "forecasting.read");

    const job = await this.forecastJobRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: jobId,
    });
    if (!job) {
      throw new NotFoundError("Forecast job was not found.");
    }

    const results = await this.forecastResultRepository.listByJobIdForOrganization(this.db, {
      organizationId,
      forecastJobId: job.id,
    });

    return results.map(toForecastResultDto);
  }

  private buildScopeReference(input: CreateForecastJobInput): ForecastScopeReference | null {
    if (input.scopeType === "organization") {
      return null;
    }

    if (input.scopeType === "sku") {
      return {
        skuId: input.skuId,
      };
    }

    return {
      skuId: input.skuId,
      locationId: input.locationId,
    };
  }

  private async validateScope(
    db: DbClient,
    organizationId: string,
    scopeType: ForecastScopeType,
    scopeReference: ForecastScopeReference | null,
  ): Promise<void> {
    if (scopeType === "organization") {
      return;
    }

    if (!scopeReference?.skuId) {
      throw new NotFoundError("Forecast scope SKU was not found.");
    }

    const sku = await this.skuRepository.findByIdForOrganization(db, {
      organizationId,
      id: scopeReference.skuId,
    });
    if (!sku) {
      throw new NotFoundError("Forecast scope SKU was not found.");
    }

    if (scopeType === "sku_location") {
      if (!scopeReference.locationId) {
        throw new NotFoundError("Forecast scope location was not found.");
      }

      const location = await this.locationRepository.findByIdForOrganization(db, {
        organizationId,
        id: scopeReference.locationId,
      });
      if (!location) {
        throw new NotFoundError("Forecast scope location was not found.");
      }
    }
  }
}
