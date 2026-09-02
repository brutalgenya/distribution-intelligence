import clsx from "clsx";

import { formatDateTime } from "../../../lib/utils/format";
import { StatusChip } from "../../../components/ui/StatusChip";
import {
  formatAutomationTier,
  formatConfidenceScore,
  formatDecisionStatus,
  formatDecisionType,
  getDecisionScopeLabel,
  getStatusTone,
  summarizeDecision,
} from "../presentation";
import type { Decision } from "../types";

interface DecisionListItemProps {
  decision: Decision;
  selected: boolean;
  onSelect: (decisionId: string) => void;
}

export const DecisionListItem = ({
  decision,
  selected,
  onSelect,
}: DecisionListItemProps): JSX.Element => {
  const presentationTone = getStatusTone(decision.status);

  let tone: "success" | "danger" | "warning" | "neutral" | "info" = "neutral";
  if (presentationTone.backgroundClassName.includes("emerald")) tone = "success";
  else if (presentationTone.backgroundClassName.includes("red")) tone = "danger";
  else if (presentationTone.backgroundClassName.includes("amber")) tone = "warning";
  else if (presentationTone.backgroundClassName.includes("indigo")) tone = "info";

  return (
    <button
      type="button"
      onClick={() => onSelect(decision.id)}
      className={clsx(
        "w-full rounded-radius-lg border px-5 py-4 text-left transition duration-150 animate-fade-in",
        selected
          ? "border-secondary/25 bg-secondary/[0.04] shadow-soft ring-1 ring-secondary/15"
          : "border-slate-200/80 bg-white/92 shadow-sm hover:border-slate-300 hover:bg-slate-50/70",
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip tone="info">{formatDecisionType(decision.decisionType)}</StatusChip>
              <StatusChip tone={tone}>{formatDecisionStatus(decision.status)}</StatusChip>
            </div>
            <h4 className="mt-3 text-subheading text-ink">{summarizeDecision(decision)}</h4>
            <p className="mt-1.5 text-sm text-steel">{getDecisionScopeLabel(decision)}</p>
          </div>

          <div className="rounded-radius-md bg-slate-50/80 px-4 py-3 text-left shadow-sm ring-1 ring-slate-200/60">
            <p className="ui-field-label">Updated</p>
            <p className="ui-field-value tabular-nums">{formatDateTime(decision.updatedAt)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-radius-md bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60">
            <p className="ui-field-label">Automation tier</p>
            <p className="ui-field-value">{formatAutomationTier(decision.automationTier)}</p>
          </div>
          <div className="rounded-radius-md bg-slate-50/80 px-4 py-3 ring-1 ring-slate-200/60">
            <p className="ui-field-label">Confidence</p>
            <p className="ui-field-value">{formatConfidenceScore(decision.confidenceScore)}</p>
          </div>
        </div>
      </div>
    </button>
  );
};
