import { formatDateTime } from "../../../lib/utils/format";
import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import type { ActivationSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";

const toneClassNames: Record<ActivationSummary["tone"], string> = {
  positive: "border-teal-200/50 bg-teal-50/30 text-teal-900",
  critical: "border-rose-200/50 bg-rose-50/30 text-rose-900",
  warning: "border-amber-200/50 bg-amber-50/30 text-amber-900",
  neutral: "border-slate-200/60 bg-white text-ink",
};

interface ActivationSummarySectionProps {
  summary: ActivationSummary;
  latestEvidenceAt: string | null;
}

export const ActivationSummarySection = ({
  summary,
  latestEvidenceAt,
}: ActivationSummarySectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Activation posture"
      title="Activation summary"
      description="See whether this tenant is commercially active and operationally ready, using only persisted billing, integration, forecast, decision, and workflow evidence."
    />

    <div className="grid gap-4 2xl:grid-cols-[0.78fr_1.22fr]">
      <article className={`ui-panel transition-colors duration-300 ${toneClassNames[summary.tone]}`}>
        <p className="text-[10px] uppercase tracking-wider opacity-70">Current posture</p>
        <h4 className="mt-1 text-2xl font-semibold tracking-tight">{summary.title}</h4>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{summary.helper}</p>

        <div className="mt-6 border-t border-current/10 pt-6">
          <p className="text-sm font-semibold">Latest activation evidence</p>
          <p className="mt-1.5 text-sm tabular-nums opacity-90">{formatDateTime(latestEvidenceAt)}</p>
        </div>
      </article>

      <MetricCardGrid items={summary.cards} />
    </div>
  </section>
);
