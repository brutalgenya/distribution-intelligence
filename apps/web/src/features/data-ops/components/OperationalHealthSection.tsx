import { Link } from "react-router-dom";

import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import { formatDateTime } from "../../../lib/utils/format";
import type { DataOpsHealthSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { DataField } from "../../../components/ui/DataField";

interface OperationalHealthSectionProps {
  summary: DataOpsHealthSummary;
  contextSummary: string;
  freshnessAt: string | null;
  investigationHref: string;
}

export const OperationalHealthSection = ({
  summary,
  contextSummary,
  freshnessAt,
  investigationHref,
}: OperationalHealthSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Operational posture"
      title="Operational health summary"
      description={`Start with the upstream evidence that can explain risk: failed syncs, forecast job issues, degraded AI runs, and freshness signals that the backend already persists.\n\n${contextSummary}`}
      extra={freshnessAt ? `Fresh as of ${formatDateTime(freshnessAt)}` : "Freshness not available"}
    >
      <div className="flex flex-wrap gap-3">
        <Link to="/outcomes" className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
          Back to risk
        </Link>
        <Link to={investigationHref} className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
          Open investigation
        </Link>
      </div>
    </PageHeader>

    <MetricCardGrid items={summary.cards} />

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.freshness.map((item) => (
        <div key={item.id} className="rounded-radius-md border border-slate-100 bg-white p-5 shadow-sm">
           <DataField
              label={item.label}
              value={<span className="text-xl font-semibold tracking-tight text-ink">{item.value}</span>}
           />
          <p className="mt-2 text-sm leading-relaxed text-steel">{item.helper}</p>
        </div>
      ))}
    </div>
  </section>
);
