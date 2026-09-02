import { randomUUID } from "node:crypto";

import type { ForecastJob } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DemandSignalService } from "../demand/demand-signal.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { ForecastEnhancementService } from "../ai/forecast-enhancement.service.js";
import { BaselineForecastService } from "./baseline-forecast.service.js";
import { addUtcDays, endOfUtcDay } from "./forecasting-dates.js";
import { toForecastJobDto, toForecastResultDto } from "./forecasting.mappers.js";
import {
  forecastJobInputSnapshotSchema,
  type ForecastJobProcessingResultDto,
} from "./forecasting.schemas.js";
import { ForecastJobRepository } from "./forecast-job.repository.js";
import { ForecastResultRepository } from "./forecast-result.repository.js";

type ClaimResult =
  | { kind: "completed"; job: ForecastJob }
  | { kind: "running"; job: ForecastJob }
  | { kind: "claimed"; job: ForecastJob };

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Forecast job processing failed.";
};

export class ForecastJobProcessorService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly forecastResultRepository: ForecastResultRepository,
    private readonly demandSignalService: DemandSignalService,
    private readonly baselineForecastService: BaselineForecastService,
    private readonly forecastEnhancementService: ForecastEnhancementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async processPendingJobs(limit = 10): Promise<number> {
    let processedCount = 0;

    while (processedCount < limit) {
      const pendingJob = await this.forecastJobRepository.findOldestPendingJob(this.db);
      if (!pendingJob) {
        break;
      }

      const result = await this.processJobInternal(pendingJob.id, {
        actorUserId: null,
        correlationId: randomUUID(),
      });

      if (result.processedNow) {
        processedCount += 1;
        continue;
      }

      continue;
    }

    return processedCount;
  }

  public async processJobForRequest(
    context: RequestContext,
    jobId: string,
  ): Promise<ForecastJobProcessingResultDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "forecasting.write");

    const job = await this.forecastJobRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: jobId,
    });
    if (!job) {
      throw new NotFoundError("Forecast job was not found.");
    }

    return this.processJobInternal(jobId, {
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });
  }

  private async processJobInternal(
    jobId: string,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<ForecastJobProcessingResultDto> {
    return this.telemetryService.measureAsync(
      "forecast.job.duration_ms",
      async () => {
        const claimResult = await this.claimJob(jobId, options);

        if (claimResult.kind === "completed") {
          const results = await this.forecastResultRepository.listByJobIdForOrganization(this.db, {
            organizationId: claimResult.job.organizationId,
            forecastJobId: claimResult.job.id,
          });
          const enhancementResult = await this.forecastEnhancementService.enhanceForecastJobAsSystem({
            organizationId: claimResult.job.organizationId,
            forecastJobId: claimResult.job.id,
            correlationId: options.correlationId,
            actorUserId: options.actorUserId,
          });

          return {
            job: toForecastJobDto(claimResult.job),
            results: results.map(toForecastResultDto),
            processedNow: false,
            enhancementStatus: enhancementResult.status,
            enhancementRun: enhancementResult.run,
            enhancedResults: enhancementResult.enhancedResults,
            baselineFallbackUsed: enhancementResult.baselineFallbackUsed,
          };
        }

        if (claimResult.kind === "running") {
          throw new ConflictError("Forecast job is already running.");
        }

        const claimedJob = claimResult.job;

        try {
          const snapshot = forecastJobInputSnapshotSchema.parse(claimedJob.inputSnapshot);
          const anchorDate = new Date(snapshot.anchorDate);
          const signals = await this.demandSignalService.listSignalsForForecast(this.db, {
            organizationId: claimedJob.organizationId,
            scopeType: claimedJob.scopeType,
            scopeReference: snapshot.scopeReference,
            observedAtGte: addUtcDays(anchorDate, -(snapshot.lookbackDays - 1)),
            observedAtLte: endOfUtcDay(anchorDate),
            createdAtLte: new Date(snapshot.demandSignalCreatedAtCutoff),
          });

          const forecastPoints = this.baselineForecastService.forecast({
            scopeType: claimedJob.scopeType,
            scopeReference: snapshot.scopeReference,
            horizonDays: claimedJob.horizonDays,
            lookbackDays: snapshot.lookbackDays,
            anchorDate,
            signals,
          });

          const baselineResult = await this.transactionRunner.run(async (db) => {
            await this.forecastResultRepository.deleteByJobId(db, claimedJob.id);
            await this.forecastResultRepository.createMany(
              db,
              forecastPoints.map((point) => ({
                organizationId: claimedJob.organizationId,
                forecastJobId: claimedJob.id,
                skuId: point.skuId,
                ...(point.locationId ? { locationId: point.locationId } : {}),
                forecastDate: point.forecastDate,
                forecastQty: point.forecastQty,
                ...(point.confidenceLow !== null ? { confidenceLow: point.confidenceLow } : {}),
                ...(point.confidenceHigh !== null ? { confidenceHigh: point.confidenceHigh } : {}),
                modelType: claimedJob.modelType,
              })),
            );

            const completedJob = await this.forecastJobRepository.markCompleted(db, {
              id: claimedJob.id,
              completedAt: new Date(),
            });

            await this.auditEventRepository.create(db, {
              organizationId: claimedJob.organizationId,
              actorUserId: options.actorUserId,
              eventType: "forecast.generated",
              entityType: "ForecastJob",
              entityId: claimedJob.id,
              payload: {
                modelType: claimedJob.modelType,
                resultCount: forecastPoints.length,
                scopeType: claimedJob.scopeType,
                scopeReference: claimedJob.scopeReference,
              },
              correlationId: options.correlationId,
            });

            await this.outboxEventRepository.create(db, {
              organizationId: claimedJob.organizationId,
              eventType: "forecast.generated.v1",
              aggregateType: "ForecastJob",
              aggregateId: claimedJob.id,
              payload: {
                organizationId: claimedJob.organizationId,
                forecastJobId: claimedJob.id,
                resultCount: forecastPoints.length,
                modelType: claimedJob.modelType,
                status: completedJob.status,
              },
            });

            const results = await this.forecastResultRepository.listByJobIdForOrganization(db, {
              organizationId: claimedJob.organizationId,
              forecastJobId: claimedJob.id,
            });

            return {
              job: toForecastJobDto(completedJob),
              results: results.map(toForecastResultDto),
              processedNow: true,
            };
          });
          const enhancementResult = await this.forecastEnhancementService.enhanceForecastJobAsSystem({
            organizationId: claimedJob.organizationId,
            forecastJobId: claimedJob.id,
            correlationId: options.correlationId,
            actorUserId: options.actorUserId,
          });

          this.telemetryService.incrementCounter("forecast.job.succeeded", 1, {
            organizationId: claimedJob.organizationId,
            modelType: claimedJob.modelType,
          });
          this.logger.info(
            "Forecast job processed successfully.",
            { forecastJobId: claimedJob.id, resultCount: baselineResult.results.length },
            { module: "forecasting", operation: "processJob", organizationId: claimedJob.organizationId, forecastJobId: claimedJob.id },
          );

          return {
            ...baselineResult,
            enhancementStatus: enhancementResult.status,
            enhancementRun: enhancementResult.run,
            enhancedResults: enhancementResult.enhancedResults,
            baselineFallbackUsed: enhancementResult.baselineFallbackUsed,
          };
        } catch (error) {
          await this.transactionRunner.run(async (db) => {
            await this.forecastResultRepository.deleteByJobId(db, claimedJob.id);

            const failedJob = await this.forecastJobRepository.markFailed(db, {
              id: claimedJob.id,
              completedAt: new Date(),
              errorMessage: toErrorMessage(error),
            });

            await this.auditEventRepository.create(db, {
              organizationId: claimedJob.organizationId,
              actorUserId: options.actorUserId,
              eventType: "forecast.job.failed",
              entityType: "ForecastJob",
              entityId: claimedJob.id,
              payload: {
                errorMessage: failedJob.errorMessage,
                modelType: claimedJob.modelType,
              },
              correlationId: options.correlationId,
            });

            await this.outboxEventRepository.create(db, {
              organizationId: claimedJob.organizationId,
              eventType: "forecast.job.failed.v1",
              aggregateType: "ForecastJob",
              aggregateId: claimedJob.id,
              payload: {
                organizationId: claimedJob.organizationId,
                forecastJobId: claimedJob.id,
                errorMessage: failedJob.errorMessage,
                status: failedJob.status,
              },
            });
          });

          this.telemetryService.incrementCounter("forecast.job.failed", 1, {
            organizationId: claimedJob.organizationId,
            modelType: claimedJob.modelType,
          });
          this.logger.error(
            "Forecast job processing failed.",
            { forecastJobId: claimedJob.id, error },
            { module: "forecasting", operation: "processJob", organizationId: claimedJob.organizationId, forecastJobId: claimedJob.id },
          );

          throw error;
        }
      },
      { forecastJobId: jobId },
    );
  }

  private async claimJob(
    jobId: string,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<ClaimResult> {
    return this.transactionRunner.run(async (db) => {
      const currentJob = await this.forecastJobRepository.findById(db, jobId);
      if (!currentJob) {
        throw new NotFoundError("Forecast job was not found.");
      }

      if (currentJob.status === "completed") {
        return { kind: "completed", job: currentJob };
      }

      if (currentJob.status === "running") {
        return { kind: "running", job: currentJob };
      }

      const runningJob = await this.forecastJobRepository.markRunningIfQueued(db, {
        id: jobId,
        startedAt: new Date(),
      });

      if (!runningJob) {
        const latestJob = await this.forecastJobRepository.findById(db, jobId);
        if (!latestJob) {
          throw new NotFoundError("Forecast job was not found.");
        }

        if (latestJob.status === "completed") {
          return { kind: "completed", job: latestJob };
        }

        return { kind: "running", job: latestJob };
      }

      await this.auditEventRepository.create(db, {
        organizationId: runningJob.organizationId,
        actorUserId: options.actorUserId,
        eventType: "forecast.job.started",
        entityType: "ForecastJob",
        entityId: runningJob.id,
        payload: {
          modelType: runningJob.modelType,
          scopeType: runningJob.scopeType,
          scopeReference: runningJob.scopeReference,
        },
        correlationId: options.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: runningJob.organizationId,
        eventType: "forecast.job.started.v1",
        aggregateType: "ForecastJob",
        aggregateId: runningJob.id,
        payload: {
          organizationId: runningJob.organizationId,
          forecastJobId: runningJob.id,
          status: runningJob.status,
        },
      });

      return { kind: "claimed", job: runningJob };
    });
  }
}
