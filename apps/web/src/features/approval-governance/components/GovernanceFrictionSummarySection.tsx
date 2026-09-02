import { formatDateTime } from "../../../lib/utils/format";
import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import type { GovernanceFrictionSummary } from "../types";

interface GovernanceFrictionSummarySectionProps {
  summary: GovernanceFrictionSummary;
  latestEvidenceAt: string | null;
}

export const GovernanceFrictionSummarySection = ({
  summary,
  latestEvidenceAt,
}: GovernanceFrictionSummarySectionProps): JSX.Element => (
  <section className="space-y-4">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Approval posture</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">{summary.title}</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">{summary.helper}</p>
      </div>

      <p className="text-sm font-medium text-steel">
        {latestEvidenceAt ? `Fresh as of ${formatDateTime(latestEvidenceAt)}` : "Freshness not available"}
      </p>
    </div>

    <MetricCardGrid items={summary.cards} />
  </section>
);
