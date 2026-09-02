import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  formatPolicyStatus,
  formatPolicyType,
  getPolicyAutomationTier,
  getPolicyStatusTone,
} from "../selectors";
import type { PoliciesRouteParams, PolicyRow } from "../types";
import { formatAutomationTier } from "../../decisions/presentation";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonClassName, uiInputClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";

interface PolicyListSectionProps {
  rows: PolicyRow[];
  filters: Pick<PoliciesRouteParams, "policyType" | "status">;
  selectedPolicyId: string | null;
  onFiltersChange: (nextFilters: Pick<PoliciesRouteParams, "policyType" | "status">) => void;
  onSelectPolicy: (policyId: string) => void;
  onCreateDraft: () => void;
}

export const PolicyListSection = ({
  rows,
  filters,
  selectedPolicyId,
  onFiltersChange,
  onSelectPolicy,
  onCreateDraft,
}: PolicyListSectionProps): JSX.Element => (
  <section className="space-y-4 w-full flex flex-col items-stretch">
    <PageHeader
      label="Policy library"
      title="Policy list"
      description="Review the current policy inventory from the real decisioning API. Type and status filters map directly to the server contract."
    >
      <button
        type="button"
        onClick={onCreateDraft}
        className={uiButtonClassName}
      >
        Create draft policy
      </button>
    </PageHeader>

    <SectionCard>
      <div className="grid gap-4 sm:grid-cols-2 mb-6 max-w-2xl">
        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Policy type</span>
          <select
            value={filters.policyType}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                policyType: event.target.value as PoliciesRouteParams["policyType"],
              })
            }
            className={`w-full ${uiInputClassName}`}
          >
            <option value="all">All policy types</option>
            <option value="replenishment">Replenishment</option>
            <option value="allocation">Allocation</option>
            <option value="exception">Exception</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-ink">Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as PoliciesRouteParams["status"],
              })
            }
             className={`w-full ${uiInputClassName}`}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {rows.length > 0 ? (
        <div className="rounded-radius-md border border-slate-200/60 bg-white overflow-hidden shadow-sm">
           <div className="custom-scrollbar overflow-x-auto">
             <table className="min-w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-xs uppercase tracking-wider text-steel">
                  <tr>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Policy</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Type</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Automation tier</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Observed decisions</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Latest effectiveness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const tone = getPolicyStatusTone(row.status);
                    const isSelected = row.id === selectedPolicyId;

                    // Note: original badgeClassName does not match our StatusChip prop, mapped here
                    let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                    if(row.status === "active") mappedTone = "success";
                    else if(row.status === "draft") mappedTone = "warning";

                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer transition-colors duration-200 hover:bg-slate-50 ${
                          isSelected ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : ""
                        }`}
                        onClick={() => onSelectPolicy(row.id)}
                      >
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-ink">{row.name}</p>
                          <p className="mt-1 text-sm text-steel">
                            v{row.version} <span className="mx-1.5 opacity-40">·</span> Updated {formatDateTime(row.updatedAt)}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                          {formatPolicyType(row.policyType)}
                        </td>
                        <td className="px-5 py-4 align-top">
                           <StatusChip tone={mappedTone}>
                              {formatPolicyStatus(row.status)}
                           </StatusChip>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-ink font-medium">
                          {formatAutomationTier(getPolicyAutomationTier(row))}
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-steel">
                          <span className="font-semibold text-ink mr-1">{formatNumber(row.relatedDecisionCount)}</span> decisions <span className="mx-1.5 opacity-40">·</span> <span className="font-semibold text-ink mr-1">{formatNumber(row.observedApprovalCount)}</span> approvals
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-steel">
                          {row.latestSummary
                            ? <>Window <span className="font-medium text-ink">{formatDateTime(row.latestSummary.measurementWindowEnd)}</span></>
                            : "No summary yet"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
             </table>
           </div>
        </div>
      ) : (
        <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
             <EmptyState title="No policies Found" message="No policies match the current server-backed filters. Clear the filter or create a new draft policy." />
        </div>
      )}
    </SectionCard>
  </section>
);
