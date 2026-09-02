import type { Decision } from "./types";
import { formatLabel, formatNumber, formatPercent } from "../../lib/utils/format";

const tryGetString = (value: unknown, key: string): string | null => {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate : null;
};

export const formatDecisionType = (value: string): string => formatLabel(value);

export const formatDecisionStatus = (value: string): string => formatLabel(value);

export const formatAutomationTier = (value: string): string => formatLabel(value);

export const formatConfidenceScore = (value: number | null): string =>
  value === null ? "Not available" : formatPercent(value);

export const summarizeDecision = (decision: Decision): string => {
  const rationaleSummary = tryGetString(decision.rationale, "summary");
  if (rationaleSummary) {
    return rationaleSummary;
  }

  const recommendationSummary = tryGetString(decision.proposedPayload, "recommendationSummary");
  if (recommendationSummary) {
    return recommendationSummary;
  }

  const recommendationType = tryGetString(decision.proposedPayload, "recommendationType");
  if (recommendationType) {
    return `${formatDecisionType(decision.decisionType)} recommendation: ${recommendationType}.`;
  }

  return `Policy-governed ${formatDecisionType(decision.decisionType).toLowerCase()} decision persisted for review.`;
};

export const getDecisionScopeLabel = (decision: Decision): string => {
  const scope = [
    decision.skuId ? `SKU ${decision.skuId}` : null,
    decision.locationId ? `Location ${decision.locationId}` : null,
    decision.supplierId ? `Supplier ${decision.supplierId}` : null,
  ].filter(Boolean);

  return scope.length > 0 ? scope.join(" | ") : "Organization-scoped decision";
};

export const getStatusTone = (
  status: string,
): { backgroundClassName: string; textClassName: string } => {
  switch (status) {
    case "proposed":
      return { backgroundClassName: "bg-sand/15", textClassName: "text-amber-700" };
    case "awaiting_approval":
      return { backgroundClassName: "bg-ember/15", textClassName: "text-ember" };
    case "approved":
    case "executed":
      return { backgroundClassName: "bg-pine/15", textClassName: "text-pine" };
    case "execution_failed":
    case "rejected":
      return { backgroundClassName: "bg-red-100", textClassName: "text-red-700" };
    default:
      return { backgroundClassName: "bg-black/5", textClassName: "text-steel" };
  }
};

export const getPayloadFactRows = (decision: Decision): Array<{ label: string; value: string }> => {
  if (typeof decision.proposedPayload !== "object" || decision.proposedPayload === null) {
    return [];
  }

  const payload = decision.proposedPayload as Record<string, unknown>;
  const preferredKeys = [
    "recommendedOrderQty",
    "projectedShortfallQty",
    "projectedDaysOfCover",
    "allocatableQty",
    "demandQty",
    "shortageQty",
    "expectedLeadTimeDays",
    "recommendationType",
  ];

  return preferredKeys.flatMap((key) => {
    const value = payload[key];
    if (value === undefined || value === null) {
      return [];
    }

    return [
      {
        label: formatLabel(key),
        value: typeof value === "number" ? formatNumber(value) : String(value),
      },
    ];
  });
};
