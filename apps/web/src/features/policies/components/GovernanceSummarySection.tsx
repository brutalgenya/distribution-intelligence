import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import { formatDateTime } from "../../../lib/utils/format";
import type { GovernanceSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";

interface GovernanceSummarySectionProps {
  summary: GovernanceSummary;
  latestEvidenceAt: string | null;
}

export const GovernanceSummarySection = ({
  summary,
  latestEvidenceAt,
}: GovernanceSummarySectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Policy posture"
      title={summary.title}
      description={summary.helper}
      extra={latestEvidenceAt ? `Fresh as of ${formatDateTime(latestEvidenceAt)}` : "Freshness not available"}
    />

    <MetricCardGrid items={summary.cards} />
  </section>
);
