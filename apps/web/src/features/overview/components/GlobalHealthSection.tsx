import { formatDateTime } from "../../../lib/utils/format";
import { MetricCard } from "../../../components/ui/MetricCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import type { CommandCenterGlobalSummary } from "../types";

const toneMap: Record<
  CommandCenterGlobalSummary["tone"],
  { cardClassName: string; badgeTone: "success" | "danger" | "warning" | "neutral" }
> = {
  positive: {
    cardClassName: "bg-[rgba(237,246,240,0.58)]",
    badgeTone: "success",
  },
  critical: {
    cardClassName: "bg-[rgba(255,241,239,0.72)]",
    badgeTone: "danger",
  },
  warning: {
    cardClassName: "bg-[rgba(255,243,227,0.78)]",
    badgeTone: "warning",
  },
  neutral: {
    cardClassName: "bg-white",
    badgeTone: "neutral",
  },
};

interface GlobalHealthSectionProps {
  summary: CommandCenterGlobalSummary;
}

export const GlobalHealthSection = ({
  summary,
}: GlobalHealthSectionProps): JSX.Element => {
  const primaryCard = summary.cards[0] ?? null;
  const supportingCards = primaryCard ? summary.cards.slice(1) : summary.cards;
  const tones = toneMap[summary.tone];

  return (
    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <article className={`ui-panel animate-fade-in ${tones.cardClassName}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 max-w-2xl">
            <p className="ui-section-label">Operational Health</p>
            <h2 className="mt-2 text-heading text-ink">{summary.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-steel">{summary.helper}</p>
          </div>

          <StatusChip tone={tones.badgeTone}>
            {summary.tone}
          </StatusChip>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <p className="text-micro uppercase text-steel">System Health</p>
            <p className="mt-3 text-[3rem] font-semibold tracking-[-0.06em] text-ink">
              {primaryCard?.value ?? "Not available"}
            </p>
            <p className="mt-2 text-sm text-steel">
              {primaryCard?.helper ?? "No primary operating metric is currently available."}
            </p>
          </div>

          <div className="rounded-radius-md bg-white/82 px-4 py-3 shadow-sm ring-1 ring-slate-200/70">
            <p className="ui-field-label">Latest evidence</p>
            <p className="ui-field-value">
              {summary.freshnessAt ? formatDateTime(summary.freshnessAt) : "Not available"}
            </p>
          </div>
        </div>
      </article>

      <div className="grid gap-3 sm:grid-cols-2">
        {supportingCards.map((item) => (
          <MetricCard
            key={item.id}
            label={item.label}
            value={item.value}
            helper={item.helper}
            deltaLabel={item.deltaLabel}
            tone={item.tone}
          />
        ))}
      </div>
    </section>
  );
};
