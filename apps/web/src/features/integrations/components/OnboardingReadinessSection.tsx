import { formatDateTime } from "../../../lib/utils/format";
import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import type { OnboardingReadinessSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";

const toneClasses: Record<OnboardingReadinessSummary["tone"], string> = {
  positive: "border-teal-200/50 bg-teal-50/30 text-teal-900",
  critical: "border-rose-200/50 bg-rose-50/30 text-rose-900",
  warning: "border-amber-200/50 bg-amber-50/30 text-amber-900",
  neutral: "border-slate-200/60 bg-white text-ink",
};

interface OnboardingReadinessSectionProps {
  summary: OnboardingReadinessSummary;
  freshnessAt: string | null;
}

export const OnboardingReadinessSection = ({
  summary,
  freshnessAt,
}: OnboardingReadinessSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Readiness"
      title="Onboarding readiness"
      description="See whether data connections are ready to onboard customer data into the platform, where sync health is drifting, and whether unresolved failed records are still blocking usable inventory intelligence."
    />

    <div className="grid gap-4 2xl:grid-cols-[0.85fr_1.15fr]">
      <div className={`rounded-radius-lg border px-6 py-5 shadow-sm transition-colors duration-300 ${toneClasses[summary.tone]}`}>
        <p className="text-[10px] uppercase tracking-wider opacity-70">Current posture</p>
        <h4 className="mt-1 text-2xl font-semibold tracking-tight">{summary.statusLabel}</h4>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{summary.helper}</p>

        <div className="mt-6 border-t border-current/10 pt-6">
          <p className="text-sm font-semibold">Latest integration activity</p>
          <p className="mt-1.5 text-sm tabular-nums opacity-90">{formatDateTime(freshnessAt)}</p>
        </div>
      </div>

      <MetricCardGrid items={summary.cards} />
    </div>
  </section>
);
