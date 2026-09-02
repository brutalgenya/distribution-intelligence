import { AiModelType, AiRunStatus, AiRunType, type Location, type Sku } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { DemandSignalRepository } from "../demand/demand-signal.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { buildMeasurementWindow, subtractWindow } from "../outcomes/outcomes-date-utils.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { aiAuditEventTypes, aiOutboxEventTypes, aiSubjectTypes } from "./ai.constants.js";
import { createPayloadChecksum } from "./ai-checksum.js";
import { toAiRunDto, toAnomalyScoreDto } from "./ai.mappers.js";
import { AiProviderRegistry } from "./ai-provider-registry.js";
import { AiRunService } from "./ai-run.service.js";
import { AnomalyScoreRepository } from "./anomaly-score.repository.js";
import type { AnomalyScoreDto, AnomalyScoringResponseDto, ScoreAnomalyInput } from "./ai.schemas.js";
import { anomalyScoringOutputSchema } from "./ai.schemas.js";
import { ModelRegistryService } from "./model-registry.service.js";

const sumSignalQuantity = (signals: ReadonlyArray<{ quantity: number }>): number =>
  signals.reduce((total, signal) => total + signal.quantity, 0);

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Anomaly scoring failed.";
};

const buildSubject = (skuId: string, locationId?: string): { subjectType: string; subjectReference: string } =>
  locationId
    ? {
        subjectType: "sku_location",
        subjectReference: `${skuId}:${locationId}`,
      }
    : {
        subjectType: "sku",
        subjectReference: skuId,
      };

export class AnomalyScoringService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly demandSignalRepository: DemandSignalRepository,
    private readonly anomalyScoreRepository: AnomalyScoreRepository,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly aiRunService: AiRunService,
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async scoreAnomaly(
    context: RequestContext,
    input: ScoreAnomalyInput,
  ): Promise<AnomalyScoringResponseDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.write");

    return this.scoreAnomalyInternal({
      organizationId,
      actorUserId: context.user.id,
      correlationId: context.correlationId,
      input,
    });
  }

  public async listScores(
    context: RequestContext,
    filters: { skuId?: string; locationId?: string },
  ): Promise<AnomalyScoreDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const subjectFilter =
      filters.skuId !== undefined
        ? buildSubject(filters.skuId, filters.locationId)
        : null;

    const scores = await this.anomalyScoreRepository.listByOrganization(this.db, {
      organizationId,
      ...(subjectFilter ? { subjectType: subjectFilter.subjectType, subjectReference: subjectFilter.subjectReference } : {}),
    });

    return scores.map(toAnomalyScoreDto);
  }

  public async getScore(context: RequestContext, anomalyScoreId: string): Promise<AnomalyScoreDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const score = await this.anomalyScoreRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: anomalyScoreId,
    });
    if (!score) {
      throw new NotFoundError("Anomaly score was not found.");
    }

    return toAnomalyScoreDto(score);
  }

  private async scoreAnomalyInternal(input: {
    organizationId: string;
    actorUserId: string | null;
    correlationId: string;
    input: ScoreAnomalyInput;
  }): Promise<AnomalyScoringResponseDto> {
    await this.requireSku(this.db, input.organizationId, input.input.skuId);
    if (input.input.locationId) {
      await this.requireLocation(this.db, input.organizationId, input.input.locationId);
    }

    const activeModel = await this.modelRegistryService.findActiveModelEntry(this.db, AiModelType.anomaly_scoring);
    if (!activeModel) {
      return {
        status: "skipped_no_active_model",
        run: null,
        anomalyScore: null,
      };
    }

    const measurementWindow = buildMeasurementWindow(
      input.input.measurementWindowStart,
      input.input.measurementWindowEnd,
    );
    const previousWindow = subtractWindow(measurementWindow);
    const subject = buildSubject(input.input.skuId, input.input.locationId);

    const currentSignals = await this.demandSignalRepository.listByOrganization(this.db, {
      organizationId: input.organizationId,
      skuId: input.input.skuId,
      ...(input.input.locationId ? { locationId: input.input.locationId } : {}),
      observedAtGte: measurementWindow.start,
      observedAtLte: measurementWindow.end,
    });
    const previousSignals = await this.demandSignalRepository.listByOrganization(this.db, {
      organizationId: input.organizationId,
      skuId: input.input.skuId,
      ...(input.input.locationId ? { locationId: input.input.locationId } : {}),
      observedAtGte: previousWindow.start,
      observedAtLte: previousWindow.end,
    });

    const providerInput = {
      model: activeModel,
      organizationId: input.organizationId,
      subjectType: subject.subjectType,
      subjectReference: subject.subjectReference,
      measurementWindowStart: measurementWindow.start.toISOString(),
      measurementWindowEnd: measurementWindow.end.toISOString(),
      currentDemandQty: sumSignalQuantity(currentSignals),
      previousWindowDemandQty: sumSignalQuantity(previousSignals),
      signalCount: currentSignals.length,
    };
    const inputChecksum = createPayloadChecksum(providerInput);

    const existingScore = await this.anomalyScoreRepository.findByScope(this.db, {
      organizationId: input.organizationId,
      modelRegistryEntryId: activeModel.id,
      subjectType: subject.subjectType,
      subjectReference: subject.subjectReference,
      measurementWindowStart: measurementWindow.start,
      measurementWindowEnd: measurementWindow.end,
    });
    if (
      existingScore &&
      existingScore.aiRun.status === AiRunStatus.succeeded &&
      existingScore.aiRun.inputChecksum === inputChecksum
    ) {
      return {
        status: "deduplicated",
        run: toAiRunDto(existingScore.aiRun),
        anomalyScore: toAnomalyScoreDto(existingScore),
      };
    }

    const aiRun = await this.aiRunService.startRun({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      modelRegistryEntryId: activeModel.id,
      runType: AiRunType.anomaly_scoring,
      subjectType: aiSubjectTypes.anomalyScope,
      subjectReference: `${subject.subjectType}:${subject.subjectReference}:${measurementWindow.start.toISOString()}:${measurementWindow.end.toISOString()}`,
      inputChecksum,
      inputPayload: providerInput,
    });

    try {
      const provider = this.aiProviderRegistry.getProvider(activeModel.provider);
      const providerResult = await provider.scoreAnomaly(providerInput);
      const parsedOutput = anomalyScoringOutputSchema.parse(providerResult.output);

      return this.transactionRunner.run(async (db) => {
        const persistedScore = await this.anomalyScoreRepository.upsert(db, {
          organizationId: input.organizationId,
          modelRegistryEntryId: activeModel.id,
          subjectType: subject.subjectType,
          subjectReference: subject.subjectReference,
          measurementWindowStart: measurementWindow.start,
          measurementWindowEnd: measurementWindow.end,
          create: {
            organizationId: input.organizationId,
            aiRunId: aiRun.id,
            modelRegistryEntryId: activeModel.id,
            subjectType: subject.subjectType,
            subjectReference: subject.subjectReference,
            measurementWindowStart: measurementWindow.start,
            measurementWindowEnd: measurementWindow.end,
            anomalyScore: parsedOutput.anomalyScore,
            severity: parsedOutput.severity,
            ...(parsedOutput.explanationSummary ? { explanationSummary: parsedOutput.explanationSummary } : {}),
            payload: {
              factors: parsedOutput.factors ?? [],
            },
          },
          update: {
            aiRunId: aiRun.id,
            anomalyScore: parsedOutput.anomalyScore,
            severity: parsedOutput.severity,
            explanationSummary: parsedOutput.explanationSummary ?? null,
            payload: {
              factors: parsedOutput.factors ?? [],
            },
          },
        });

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
          eventType: aiAuditEventTypes.anomalyScored,
          entityType: "AnomalyScore",
          entityId: persistedScore.id,
          payload: {
            aiRunId: completedRun.id,
            subjectType: persistedScore.subjectType,
            subjectReference: persistedScore.subjectReference,
            anomalyScore: persistedScore.anomalyScore,
            severity: persistedScore.severity,
          },
          correlationId: input.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: input.organizationId,
          eventType: aiOutboxEventTypes.anomalyScored,
          aggregateType: "AnomalyScore",
          aggregateId: persistedScore.id,
          payload: {
            organizationId: input.organizationId,
            anomalyScoreId: persistedScore.id,
            aiRunId: completedRun.id,
            subjectType: persistedScore.subjectType,
            subjectReference: persistedScore.subjectReference,
            severity: persistedScore.severity,
          },
        });

        return {
          status: "succeeded",
          run: toAiRunDto(completedRun),
          anomalyScore: toAnomalyScoreDto(persistedScore),
        } satisfies AnomalyScoringResponseDto;
      });
    } catch (error) {
      const failedRun = await this.transactionRunner.run((db) =>
        this.aiRunService.markFailedInTransaction(db, {
          aiRunId: aiRun.id,
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          correlationId: input.correlationId,
          errorMessage: toErrorMessage(error),
        }),
      );

      return {
        status: "failed",
        run: toAiRunDto(failedRun),
        anomalyScore: null,
      };
    }
  }

  private async requireSku(db: DbClient, organizationId: string, skuId: string): Promise<Sku> {
    const sku = await this.skuRepository.findByIdForOrganization(db, {
      organizationId,
      id: skuId,
    });
    if (!sku) {
      throw new NotFoundError("SKU was not found.");
    }

    return sku;
  }

  private async requireLocation(db: DbClient, organizationId: string, locationId: string): Promise<Location> {
    const location = await this.locationRepository.findByIdForOrganization(db, {
      organizationId,
      id: locationId,
    });
    if (!location) {
      throw new NotFoundError("Location was not found.");
    }

    return location;
  }
}
