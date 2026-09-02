import { Link } from "react-router-dom";

import { EmptyState } from "../../../components/ui/EmptyState";
import { SectionBlock } from "../../../components/ui/SectionBlock";
import { StatusChip } from "../../../components/ui/StatusChip";
import type { CommandCenterActionItem } from "../types";

const toneMap: Record<CommandCenterActionItem["tone"], "success" | "danger" | "warning" | "neutral"> = {
  positive: "success",
  critical: "danger",
  warning: "warning",
  neutral: "neutral",
};

const audienceLabels: Record<CommandCenterActionItem["audience"], string> = {
  admin: "Admin",
  operator: "Operator",
  buyer: "Buyer",
  shared: "Shared",
};

interface NextBestActionsSectionProps {
  actions: CommandCenterActionItem[];
}

export const NextBestActionsSection = ({
  actions,
}: NextBestActionsSectionProps): JSX.Element => (
  <SectionBlock
    label="Recommended Actions"
    title="Prioritized operating queue"
    description="Policy-backed actions surfaced from persisted activation, governance, risk, and supply evidence."
  >
    {actions.length === 0 ? (
      <EmptyState
        title="No urgent actions"
        message="No higher-priority actions surfaced from the current backend evidence."
      />
    ) : (
      <div className="space-y-3">
        {actions.map((action, index) => (
          <article
            key={action.id}
            className="rounded-radius-md border border-slate-200/70 bg-white/92 px-4 py-4 shadow-sm transition hover:-translate-y-0.5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={toneMap[action.tone]}>#{index + 1}</StatusChip>
                  <StatusChip tone="neutral">{audienceLabels[action.audience]}</StatusChip>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-ink">{action.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-steel">{action.description}</p>
              </div>

              <Link to={action.href} className="ui-button ui-button-secondary flex-shrink-0 text-xs">
                {action.label}
              </Link>
            </div>
          </article>
        ))}
      </div>
    )}
  </SectionBlock>
);
