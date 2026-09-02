import { AiModelType, AiRunStatus, AiRunType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DecisionRepository, type DecisionWithDetails } from "../decisioning/decision.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { aiAuditEventTypes, aiOutboxEventTypes, aiSubjectTypes } from "./ai.constants.js";
import { createPayloadChecksum } from "./ai-checksum.js";
import { toAiRunDto, toDecisionExplanationDto } from "./ai.mappers.js";
import { AiProviderRegistry } from "./ai-provider-registry.js";
import { AiRunService } from "./ai-run.service.js";
import { DecisionExplanationRepository } from "./decision-explanation.repository.js";
import type { DecisionExplanationDto, DecisionExplanationResponseDto } from "./ai.schemas.js";
import { decisionExplanationOutputSchema } from "./ai.schemas.js";
import { ModelRegistryService } from "./model-registry.service.js";

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Decision explanation generation failed.";
};

export class DecisionExplanationService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly decisionRepository: DecisionRepository,
    private readonly decisionExplanationRepository: DecisionExplanationRepository,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly aiRunService: AiRunService,
    private readonly aiProviderRegistry: AiProviderRegistry,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async generateExplanation(
    context: RequestContext,
    decisionId: string,
  ): Promise<DecisionExplanationResponseDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.write");

    return this.generateExplanationInternal({
      organizationId,
      decisionId,
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });
  }

  public async listExplanations(
    context: RequestContext,
    filters: { decisionId?: string },
  ): Promise<DecisionExplanationDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const explanations = await this.decisionExplanationRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
    });

    return explanations.map(toDecisionExplanationDto);
  }

  public async getExplanation(
    context: RequestContext,
    decisionExplanationId: string,
  ): Promise<DecisionExplanationDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const explanation = await this.decisionExplanationRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: decisionExplanationId,
    });
    if (!explanation) {
      throw new NotFoundError("Decision explanation was not found.");
    }

    return toDecisionExplanationDto(explanation);
  }

  private async generateExplanationInternal(input: {
    organizationId: string;
    decisionId: string;
    actorUserId: string | null;
    correlationId: string;
  }): Promise<DecisionExplanationResponseDto> {
    const decision = await this.requireDecision(this.db, input.organizationId, input.decisionId);
    const activeModel = await this.modelRegistryService.findActiveModelEntry(
      this.db,
      AiModelType.decision_explanation,
    );
    if (!activeModel) {
      return {
        status: "skipped_no_active_model",
        run: null,
        explanation: null,
      };
    }

    const providerInput = {
      model: activeModel,
      organizationId: input.organizationId,
      decision,
    };
    const inputChecksum = createPayloadChecksum({
      modelRegistryEntryId: activeModel.id,
      decision: {
        id: decision.id,
        status: decision.status,
        decisionType: decision.decisionType,
        automationTier: decision.automationTier,
        rationale: decision.rationale,
        reasons: decision.reasons,
        scores: decision.scores,
        artifacts: decision.artifacts,
      },
    });

    const existingExplanation = await this.decisionExplanationRepository.findByDecisionAndModel(this.db, {
      organizationId: input.organizationId,
      decisionId: decision.id,
      modelRegistryEntryId: activeModel.id,
    });
    if (
      existingExplanation &&
      existingExplanation.aiRun.status === AiRunStatus.succeeded &&
      existingExplanation.aiRun.inputChecksum === inputChecksum
    ) {
      return {
        status: "deduplicated",
        run: toAiRunDto(existingExplanation.aiRun),
        explanation: toDecisionExplanationDto(existingExplanation),
      };
    }

    const aiRun = await this.aiRunService.startRun({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      modelRegistryEntryId: activeModel.id,
      runType: AiRunType.decision_explanation,
      subjectType: aiSubjectTypes.decision,
      subjectReference: decision.id,
      inputChecksum,
      inputPayload: providerInput,
    });

    try {
      const provider = this.aiProviderRegistry.getProvider(activeModel.provider);
      const providerResult = await provider.explainDecision(providerInput);
      const parsedOutput = decisionExplanationOutputSchema.parse(providerResult.output);

      return this.transactionRunner.run(async (db) => {
        const explanation = await this.decisionExplanationRepository.upsert(db, {
          organizationId: input.organizationId,
          decisionId: decision.id,
          modelRegistryEntryId: activeModel.id,
          create: {
            organizationId: input.organizationId,
            decisionId: decision.id,
            aiRunId: aiRun.id,
            modelRegistryEntryId: activeModel.id,
            summary: parsedOutput.summary,
            explanationJson: parsedOutput,
          },
          update: {
            aiRunId: aiRun.id,
            summary: parsedOutput.summary,
            explanationJson: parsedOutput,
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
          eventType: aiAuditEventTypes.decisionExplanationGenerated,
          entityType: "DecisionExplanation",
          entityId: explanation.id,
          payload: {
            decisionId: decision.id,
            aiRunId: completedRun.id,
            modelRegistryEntryId: activeModel.id,
          },
          correlationId: input.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId: input.organizationId,
          eventType: aiOutboxEventTypes.decisionExplanationGenerated,
          aggregateType: "DecisionExplanation",
          aggregateId: explanation.id,
          payload: {
            organizationId: input.organizationId,
            decisionExplanationId: explanation.id,
            decisionId: decision.id,
            aiRunId: completedRun.id,
            modelRegistryEntryId: activeModel.id,
          },
        });

        return {
          status: "succeeded",
          run: toAiRunDto(completedRun),
          explanation: toDecisionExplanationDto(explanation),
        } satisfies DecisionExplanationResponseDto;
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
        explanation: null,
      };
    }
  }

  private async requireDecision(
    db: DbClient,
    organizationId: string,
    decisionId: string,
  ): Promise<DecisionWithDetails> {
    const decision = await this.decisionRepository.findByIdForOrganization(db, {
      organizationId,
      id: decisionId,
    });
    if (!decision) {
      throw new NotFoundError("Decision was not found.");
    }

    return decision;
  }
}
