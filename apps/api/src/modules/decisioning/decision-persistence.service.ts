import { DecisionStatus, type AutomationTier, type DecisionType, type Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { decisionAuditEventTypes, decisionOutboxEventTypes } from "./decisioning.constants.js";
import {
  buildDecisionSignature,
  buildDecisionSignatureFromDecision,
} from "./decisioning-signature.js";
import { DecisionArtifactRepository } from "./decision-artifact.repository.js";
import { DecisionReasonRepository } from "./decision-reason.repository.js";
import { DecisionRepository, type DecisionWithDetails } from "./decision.repository.js";
import { DecisionScoreRepository } from "./decision-score.repository.js";

export interface PersistDecisionCandidateInput {
  organizationId: string;
  decisionType: DecisionType;
  automationTier: AutomationTier;
  policyId: string;
  policyVersion: number;
  skuId: string | null;
  locationId: string | null;
  supplierId: string | null;
  confidenceScore: number | null;
  proposedPayload: Prisma.InputJsonObject;
  rationale: Prisma.InputJsonObject;
  reasons: Array<{ code: string; message: string }>;
  scores: Array<{ metric: string; value: number }>;
  artifacts: Array<{ artifactType: string; payload: Prisma.InputJsonValue }>;
  actorUserId: string | null;
  correlationId: string;
}

export interface PersistDecisionCandidateResult {
  decision: DecisionWithDetails;
  created: boolean;
  deduplicated: boolean;
  supersededDecisionIds: string[];
}

export class DecisionPersistenceService {
  public constructor(
    private readonly decisionRepository: DecisionRepository,
    private readonly decisionReasonRepository: DecisionReasonRepository,
    private readonly decisionScoreRepository: DecisionScoreRepository,
    private readonly decisionArtifactRepository: DecisionArtifactRepository,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async persistDecisionCandidate(
    db: DbClient,
    input: PersistDecisionCandidateInput,
  ): Promise<PersistDecisionCandidateResult> {
    const existingProposedDecisions = await this.decisionRepository.listProposedByScope(db, {
      organizationId: input.organizationId,
      decisionType: input.decisionType,
      policyId: input.policyId,
      skuId: input.skuId,
      locationId: input.locationId,
      supplierId: input.supplierId,
    });

    const candidateSignature = buildDecisionSignature({
      automationTier: input.automationTier,
      confidenceScore: input.confidenceScore,
      proposedPayload: input.proposedPayload,
      rationale: input.rationale,
      reasons: input.reasons,
      scores: input.scores,
      artifacts: input.artifacts,
    });

    const identicalDecision = existingProposedDecisions.find(
      (decision) => buildDecisionSignatureFromDecision(decision) === candidateSignature,
    );
    if (identicalDecision) {
      return {
        decision: identicalDecision,
        created: false,
        deduplicated: true,
        supersededDecisionIds: [],
      };
    }

    const createdDecision = await this.decisionRepository.create(db, {
      organizationId: input.organizationId,
      decisionType: input.decisionType,
      status: DecisionStatus.proposed,
      automationTier: input.automationTier,
      policyId: input.policyId,
      policyVersion: input.policyVersion,
      ...(input.skuId ? { skuId: input.skuId } : {}),
      ...(input.locationId ? { locationId: input.locationId } : {}),
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      ...(input.confidenceScore !== null ? { confidenceScore: input.confidenceScore } : {}),
      proposedPayload: input.proposedPayload,
      rationale: input.rationale,
      ...(input.actorUserId ? { createdByUserId: input.actorUserId } : {}),
    });

    await this.decisionReasonRepository.createMany(
      db,
      input.reasons.map((reason) => ({
        decisionId: createdDecision.id,
        code: reason.code,
        message: reason.message,
      })),
    );

    await this.decisionScoreRepository.createMany(
      db,
      input.scores.map((score) => ({
        decisionId: createdDecision.id,
        metric: score.metric,
        value: score.value,
      })),
    );

    await this.decisionArtifactRepository.createMany(
      db,
      input.artifacts.map((artifact) => ({
        decisionId: createdDecision.id,
        artifactType: artifact.artifactType,
        payload: artifact.payload,
      })),
    );

    const persistedDecision = await this.decisionRepository.findByIdForOrganization(db, {
      organizationId: input.organizationId,
      id: createdDecision.id,
    });
    if (!persistedDecision) {
      throw new NotFoundError("Created decision could not be reloaded.");
    }

    const supersededDecisionIds: string[] = [];
    for (const existingDecision of existingProposedDecisions) {
      const supersededDecision = await this.decisionRepository.updateStatusById(db, {
        id: existingDecision.id,
        status: DecisionStatus.superseded,
      });
      supersededDecisionIds.push(supersededDecision.id);

      await this.auditEventRepository.create(db, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: "decision.proposal.superseded",
        entityType: "Decision",
        entityId: supersededDecision.id,
        payload: {
          supersededByDecisionId: persistedDecision.id,
          decisionType: supersededDecision.decisionType,
          policyId: supersededDecision.policyId,
        },
        correlationId: input.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: input.organizationId,
        eventType: "decision.proposal.superseded.v1",
        aggregateType: "Decision",
        aggregateId: supersededDecision.id,
        payload: {
          organizationId: input.organizationId,
          decisionId: supersededDecision.id,
          supersededByDecisionId: persistedDecision.id,
          decisionType: supersededDecision.decisionType,
          status: DecisionStatus.superseded,
        },
      });
    }

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: decisionAuditEventTypes[input.decisionType],
      entityType: "Decision",
      entityId: persistedDecision.id,
      payload: {
        decisionType: persistedDecision.decisionType,
        policyId: persistedDecision.policyId,
        policyVersion: persistedDecision.policyVersion,
        skuId: persistedDecision.skuId,
        locationId: persistedDecision.locationId,
        supplierId: persistedDecision.supplierId,
        reasonCodes: persistedDecision.reasons.map((reason) => reason.code),
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: decisionOutboxEventTypes[input.decisionType],
      aggregateType: "Decision",
      aggregateId: persistedDecision.id,
      payload: {
        organizationId: input.organizationId,
        decisionId: persistedDecision.id,
        decisionType: persistedDecision.decisionType,
        policyId: persistedDecision.policyId,
        policyVersion: persistedDecision.policyVersion,
        status: persistedDecision.status,
        skuId: persistedDecision.skuId,
        locationId: persistedDecision.locationId,
        supplierId: persistedDecision.supplierId,
      },
    });

    return {
      decision: persistedDecision,
      created: true,
      deduplicated: false,
      supersededDecisionIds,
    };
  }
}
