import { Prisma } from "@prisma/client";

import type { DecisionWithDetails } from "./decision.repository.js";

export interface DecisionSignatureInput {
  automationTier: string;
  confidenceScore: number | null;
  proposedPayload: Prisma.JsonValue | Prisma.InputJsonValue;
  rationale: Prisma.JsonValue | Prisma.InputJsonValue;
  reasons: Array<{ code: string; message: string }>;
  scores: Array<{ metric: string; value: number }>;
  artifacts: Array<{ artifactType: string; payload: Prisma.JsonValue | Prisma.InputJsonValue }>;
}

const stableStringify = (value: Prisma.JsonValue | Prisma.InputJsonValue): string => {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
};

const normalizeSignatureInput = (input: DecisionSignatureInput): Prisma.InputJsonObject => ({
  automationTier: input.automationTier,
  confidenceScore: input.confidenceScore,
  proposedPayload: input.proposedPayload,
  rationale: input.rationale,
  reasons: [...input.reasons].sort((left, right) =>
    `${left.code}:${left.message}`.localeCompare(`${right.code}:${right.message}`),
  ),
  scores: [...input.scores].sort((left, right) => left.metric.localeCompare(right.metric)),
  artifacts: [...input.artifacts].sort((left, right) => left.artifactType.localeCompare(right.artifactType)),
});

export const buildDecisionSignature = (input: DecisionSignatureInput): string =>
  stableStringify(normalizeSignatureInput(input));

export const buildDecisionSignatureFromDecision = (decision: DecisionWithDetails): string =>
  buildDecisionSignature({
    automationTier: decision.automationTier,
    confidenceScore: decision.confidenceScore,
    proposedPayload: decision.proposedPayload,
    rationale: decision.rationale,
    reasons: decision.reasons.map((reason) => ({
      code: reason.code,
      message: reason.message,
    })),
    scores: decision.scores.map((score) => ({
      metric: score.metric,
      value: score.value,
    })),
    artifacts: decision.artifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      payload: artifact.payload,
    })),
  });
