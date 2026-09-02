import { AiModelType, AiRunStatus, AiRunType, type ForecastJob, type ForecastResult } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { ForecastResultRepository } from "../forecasting/forecast-result.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { aiAuditEventTypes, aiOutboxEventTypes, aiSubjectTypes } from "./ai.constants.js";
import { createPayloadChecksum } from "./ai-checksum.js";
import { toAiRunDto, toEnhancedForecastResultDto } from "./ai.mappers.js";
import { AiProviderRegistry } from "./ai-provider-registry.js";
import { AiRunService } from "./ai-run.service.js";
import { EnhancedForecastResultRepository } from "./enhanced-forecast-result.repository.js";
import type { ForecastEnhancementResponseDto } from "./ai.schemas.js";
import { forecastEnhancementOutputSchema } from "./ai.schemas.js";
import { ModelRegistryService } from "./model-registry.service.js";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Forecast enhancement failed.";
};

const buildForecastPointKey = (point: { skuId: string; locationId: string | null; forecastDate: string }): string =>
  `${point.skuId}:${point.locationId ?? "all"}:${point.forecastDate}`;

export class ForecastEnhancementService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly forecastResultRepository: ForecastResultRepository,
    private readonly enhancedForecastResultRepository: EnhancedForecastResultRepository,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly aiRunService: AiRunService,
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async enhanceForecastJob(
    context: RequestContext,
    input: { forecastJobId: string },
  ): Promise<ForecastEnhancementResponseDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.write");

    return this.enhanceForecastJobInternal({
      organizationId,
      forecastJobId: input.forecastJobId,
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });
  }

  public enhanceForecastJobAsSystem(input: {
    organizationId: string;
    forecastJobId: string;
    correlationId: string;
    actorUserId?: string | null;
  }): Promise<ForecastEnhancementResponseDto> {
    return this.enhanceForecastJobInternal({
      organizationId: input.organizationId,
      forecastJobId: input.forecastJobId,
      actorUserId: input.actorUserId ?? null,
      correlationId: input.correlationId,
    });
  }

  public listRuns(context: RequestContext, filters: { status?: AiRunStatus }) {
    return this.aiRunService.listRuns(context, {
      runType: AiRunType.forecast_enhancement,
      ...(filters.status ? { status: filters.status } : {}),
    });
  }

  public getRun(context: RequestContext, aiRunId: string) {
    return this.aiRunService.getRun(context, aiRunId);
  }

  private async enhanceForecastJobInternal(input: {
    organizationId: string;
    forecastJobId: string;
    actorUserId: string | null;
    correlationId: string;
  }): Promise<ForecastEnhancementResponseDto> {
    const forecastJob = await this.requireCompletedForecastJob(
      this.db,
      input.organizationId,
      input.forecastJobId,
    );
    const baselineResults = await this.forecastResultRepository.listByJobIdForOrganization(this.db, {
      organizationId: input.organizationId,
      forecastJobId: forecastJob.id,
    });

    const activeModel = await this.modelRegistryService.findActiveModelEntry(
      this.db,
      AiModelType.forecast_enhancement,
    );
    if (!activeModel) {
      return {
        status: "skipped_no_active_model",
        baselineFallbackUsed: true,
        run: null,
        enhancedResults: [],
      };
    }

    const providerInput = {
      model: activeModel,
      forecastJobId: forecastJob.id,
      organizationId: input.organizationId,
      scopeType: forecastJob.scopeType,
      scopeReference: forecastJob.scopeReference,
      baselineForecasts: baselineResults.map((result) => ({
        skuId: result.skuId,
        locationId: result.locationId,
        forecastDate: result.forecastDate.toISOString(),
        forecastQty: result.forecastQty,
        confidenceLow: result.confidenceLow,
        confidenceHigh: result.confidenceHigh,
      })),
    };
    const inputChecksum = createPayloadChecksum(providerInput);

    const existingResults = await this.enhancedForecastResultRepository.listByJobIdAndModelRegistryEntryId(
      this.db,
      {
        organizationId: input.organizationId,
        forecastJobId: forecastJob.id,
        modelRegistryEntryId: activeModel.id,
      },
    );
    if (
      existingResults.length > 0 &&
      existingResults[0]?.aiRun.status === AiRunStatus.succeeded &&
      existingResults[0].aiRun.inputChecksum === inputChecksum
    ) {
      return {
        status: "deduplicated",
        baselineFallbackUsed: false,
        run: toAiRunDto(existingResults[0].aiRun),
        enhancedResults: existingResults.map(toEnhancedForecastResultDto),
      };
    }

    const aiRun = await this.aiRunService.startRun({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      modelRegistryEntryId: activeModel.id,
      runType: AiRunType.forecast_enhancement,
      subjectType: aiSubjectTypes.forecastJob,
      subjectReference: forecastJob.id,
      inputChecksum,
      inputPayload: providerInput,
    });

    try {
      const provider = this.aiProviderRegistry.getProvider(activeModel.provider);
      const providerResult = await provider.enhanceForecast(providerInput);
      const parsedOutput = forecastEnhancementOutputSchema.parse(providerResult.output);
      const enhancedPoints = this.matchEnhancedPointsToBaseline(
        parsedOutput.adjustedForecasts.map((point) => ({
          skuId: point.skuId,
          locationId: point.locationId ?? null,
          forecastDate: point.forecastDate,
          enhancedForecastQty: point.enhancedForecastQty,
          confidenceLow: point.confidenceLow ?? null,
          confidenceHigh: point.confidenceHigh ?? null,
        })),
        baselineResults,
      );

      return this.transactionRunner.run(async (db) => {
        await this.enhancedForecastResultRepository.deleteByJobIdAndModelRegistryEntryId(db, {
          forecastJobId: forecastJob.id,
          modelRegistryEntryId: activeModel.id,
        });
        await this.enhancedForecastResultRepository.createMany(
          db,
          enhancedPoints.map((point) => ({
            organizationId: input.organizationId,
            forecastJobId: forecastJob.id,
            aiRunId: aiRun.id,
            modelRegistryEntryId: activeModel.id,
            skuId: point.skuId,
            ...(point.locationId ? { locationId: point.locationId } : {}),
            forecastDate: point.forecastDate,
            baselineForecastQty: point.baselineForecastQty,
            enhancedForecastQty: point.enhancedForecastQty,
            ...(point.confidenceLow !== null ? { confidenceLow: point.confidenceLow } : {}),
            ...(point.confidenceHigh !== null ? { confidenceHigh: point.confidenceHigh } : {}),
          })),
        );

        const completedRun = await this.aiRunService.markSucceededInTransaction(db, {
          aiRunId: aiRun.id,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          outputPayload: parsedOutput,
          latencyMs: providerResult.latencyMs,
        });

        await this.auditEventRepository.create(db, {
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          eventType: aiAuditEventTypes.forecastEnhanced,
          entityType: "ForecastJob",
          entityId: forecastJob.id,
          payload: {
            aiRunId: completedRun.id,
            modelRegistryEntryId: activeModel.id,
            resultCount: enhancedPoints.length,
          },
          correlationId: input.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: input.organizationId,
          eventType: aiOutboxEventTypes.forecastEnhanced,
          aggregateType: "ForecastJob",
          aggregateId: forecastJob.id,
          payload: {
            organizationId: input.organizationId,
            forecastJobId: forecastJob.id,
            aiRunId: completedRun.id,
            modelRegistryEntryId: activeModel.id,
            resultCount: enhancedPoints.length,
          },
        });

        const persistedResults = await this.enhancedForecastResultRepository.listByJobIdAndModelRegistryEntryId(
          db,
          {
            organizationId: input.organizationId,
            forecastJobId: forecastJob.id,
            modelRegistryEntryId: activeModel.id,
          },
        );

        return {
          status: "succeeded",
          baselineFallbackUsed: false,
          run: toAiRunDto(completedRun),
          enhancedResults: persistedResults.map(toEnhancedForecastResultDto),
        } satisfies ForecastEnhancementResponseDto;
      });
    } catch (error) {
      const degradedRun = await this.transactionRunner.run((db) =>
        this.aiRunService.markDegradedInTransaction(db, {
          aiRunId: aiRun.id,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          errorMessage: toErrorMessage(error),
        }),
      );

      return {
        status: "degraded",
        baselineFallbackUsed: true,
        run: toAiRunDto(degradedRun),
        enhancedResults: [],
      };
    }
  }

  private async requireCompletedForecastJob(
    db: DbClient,
    organizationId: string,
    forecastJobId: string,
  ): Promise<ForecastJob> {
    const forecastJob = await this.forecastJobRepository.findByIdForOrganization(db, {
      organizationId,
      id: forecastJobId,
    });
    if (!forecastJob) {
      throw new NotFoundError("Forecast job was not found.");
    }

    if (forecastJob.status !== "completed") {
      throw new ConflictError("Forecast job must be completed before AI enhancement.");
    }

    return forecastJob;
  }

  private matchEnhancedPointsToBaseline(
    enhancedPoints: ReadonlyArray<{
      skuId: string;
      locationId: string | null;
      forecastDate: string;
      enhancedForecastQty: number;
      confidenceLow: number | null;
      confidenceHigh: number | null;
    }>,
    baselineResults: ForecastResult[],
  ) {
    const baselineByKey = new Map(
      baselineResults.map((result) => [
        buildForecastPointKey({
          skuId: result.skuId,
          locationId: result.locationId,
          forecastDate: result.forecastDate.toISOString(),
        }),
        result,
      ]),
    );

    if (enhancedPoints.length !== baselineResults.length) {
      throw new ConflictError("Forecast enhancement output must cover the same forecast points as the baseline.");
    }

    return enhancedPoints.map((point) => {
      const baseline = baselineByKey.get(
        buildForecastPointKey({
          skuId: point.skuId,
          locationId: point.locationId ?? null,
          forecastDate: point.forecastDate,
        }),
      );
      if (!baseline) {
        throw new ConflictError("Forecast enhancement output referenced an unexpected forecast point.");
      }

      return {
        skuId: baseline.skuId,
        locationId: baseline.locationId,
        forecastDate: baseline.forecastDate,
        baselineForecastQty: baseline.forecastQty,
        enhancedForecastQty: point.enhancedForecastQty,
        confidenceLow: point.confidenceLow ?? null,
        confidenceHigh: point.confidenceHigh ?? null,
      };
    });
  }
}
