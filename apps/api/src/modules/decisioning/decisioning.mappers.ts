import type { Policy } from "@prisma/client";

import type {
  DecisionArtifactDto,
  DecisionDto,
  DecisionReasonDto,
  DecisionScoreDto,
  PolicyDto,
} from "./decisioning.schemas.js";
import { parsePolicyRules } from "./decisioning.schemas.js";
import type { DecisionWithDetails } from "./decision.repository.js";

const toDecisionReasonDto = (reason: DecisionWithDetails["reasons"][number]): DecisionReasonDto => ({
  id: reason.id,
  code: reason.code,
  message: reason.message,
  createdAt: reason.createdAt.toISOString(),
});

const toDecisionScoreDto = (score: DecisionWithDetails["scores"][number]): DecisionScoreDto => ({
  id: score.id,
  metric: score.metric,
  value: score.value,
  createdAt: score.createdAt.toISOString(),
});

const toDecisionArtifactDto = (artifact: DecisionWithDetails["artifacts"][number]): DecisionArtifactDto => ({
  id: artifact.id,
  artifactType: artifact.artifactType,
  payload: artifact.payload,
  createdAt: artifact.createdAt.toISOString(),
});

export const toPolicyDto = (policy: Policy): PolicyDto => ({
  id: policy.id,
  organizationId: policy.organizationId,
  policyType: policy.policyType,
  name: policy.name,
  version: policy.version,
  status: policy.status,
  rulesJson: parsePolicyRules(policy.policyType, policy.rulesJson),
  createdByUserId: policy.createdByUserId,
  createdAt: policy.createdAt.toISOString(),
  updatedAt: policy.updatedAt.toISOString(),
});

export const toDecisionDto = (decision: DecisionWithDetails): DecisionDto => ({
  id: decision.id,
  organizationId: decision.organizationId,
  decisionType: decision.decisionType,
  status: decision.status,
  automationTier: decision.automationTier,
  policyId: decision.policyId,
  policyVersion: decision.policyVersion,
  skuId: decision.skuId,
  locationId: decision.locationId,
  supplierId: decision.supplierId,
  confidenceScore: decision.confidenceScore,
  proposedPayload: decision.proposedPayload,
  rationale: decision.rationale,
  createdByUserId: decision.createdByUserId,
  createdAt: decision.createdAt.toISOString(),
  updatedAt: decision.updatedAt.toISOString(),
  reasons: decision.reasons.map(toDecisionReasonDto),
  scores: decision.scores.map(toDecisionScoreDto),
  artifacts: decision.artifacts.map(toDecisionArtifactDto),
});
