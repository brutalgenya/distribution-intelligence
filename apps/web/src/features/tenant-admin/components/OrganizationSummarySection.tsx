import { formatDateTime } from "../../../lib/utils/format";
import { MetricCardGrid } from "../../outcomes/components/MetricCardGrid";
import { formatOrganizationRole } from "../selectors";
import type { OrganizationMembership, TenantAdminSummary } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataField } from "../../../components/ui/DataField";

const toneClassNames: Record<TenantAdminSummary["tone"], string> = {
  positive: "border-teal-200/50 bg-teal-50/30 text-teal-900",
  critical: "border-rose-200/50 bg-rose-50/30 text-rose-900",
  warning: "border-amber-200/50 bg-amber-50/30 text-amber-900",
  neutral: "border-slate-200/60 bg-white text-ink",
};

interface OrganizationSummarySectionProps {
  summary: TenantAdminSummary;
  organizationId: string;
  currentMembership: OrganizationMembership | null;
  latestEvidenceAt: string | null;
}

export const OrganizationSummarySection = ({
  summary,
  organizationId,
  currentMembership,
  latestEvidenceAt,
}: OrganizationSummarySectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Organization posture"
      title="Organization summary"
      description="This workspace focuses on access readiness, not a generic profile page. It uses the real org membership, entitlement, billing, and audit surfaces that the backend exposes today."
    />

    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <article className={`ui-panel transition-colors duration-300 ${toneClassNames[summary.tone]}`}>
        <p className="text-[10px] uppercase tracking-wider opacity-70">Current posture</p>
        <h4 className="mt-1 text-2xl font-semibold tracking-tight">{summary.title}</h4>
        <p className="mt-2 text-sm leading-relaxed opacity-80">{summary.helper}</p>

        <div className="mt-6 grid gap-4 grid-cols-2 pt-6 border-t border-current/10">
          <DataField label="Active org id" value={<span className="break-all">{organizationId}</span>} />
          <DataField
            label="Current session role"
            value={currentMembership ? formatOrganizationRole(currentMembership.role) : "Not exposed"}
          />
          <div className="col-span-2">
            <DataField label="Latest admin evidence" value={formatDateTime(latestEvidenceAt)} />
          </div>
        </div>
      </article>

      <MetricCardGrid items={summary.cards} />
    </div>
  </section>
);
