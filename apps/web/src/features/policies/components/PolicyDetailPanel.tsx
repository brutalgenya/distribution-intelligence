import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildApprovalGovernanceHref } from "../../approval-governance/route";
import {
  buildPolicyRelatedLinks,
  buildPolicyRuleFactRows,
  formatPolicyStatus,
  formatPolicyType,
  getAutomationPostureLabel,
  getDecisionEvidenceLabel,
  getPolicyScopeLabel,
  getPolicyStatusTone,
} from "../selectors";
import type { ApprovalTask, Decision, Policy } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";
import { DataField } from "../../../components/ui/DataField";

interface PolicyDetailPanelProps {
  policy: Policy;
  relatedDecisions: Decision[];
  relatedApprovals: ApprovalTask[];
}

export const PolicyDetailPanel = ({
  policy,
  relatedDecisions,
  relatedApprovals,
}: PolicyDetailPanelProps): JSX.Element => {
  const tone = getPolicyStatusTone(policy.status);
  const factRows = buildPolicyRuleFactRows(policy);
  const links = buildPolicyRelatedLinks(policy);

  let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
  if(policy.status === "active") mappedTone = "success";
  else if(policy.status === "draft") mappedTone = "warning";

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Policy detail"
        title="Policy detail"
        description="Inspect the selected policy exactly as the backend stores it, including the policy type, active state, safe rules fields, and observed decision or workflow evidence."
      >
        <StatusChip tone={mappedTone}>
          {formatPolicyStatus(policy.status)}
        </StatusChip>
      </PageHeader>

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200/60 pb-6 mb-6">
           <div>
             <p className="ui-section-label">{formatPolicyType(policy.policyType)}</p>
             <h4 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{policy.name}</h4>
             <p className="mt-2 text-sm text-steel">
               {getPolicyScopeLabel(policy)} <span className="mx-1.5 opacity-40">·</span> <span className="font-medium text-ink">{getAutomationPostureLabel(policy)}</span> posture
             </p>
           </div>

           <div className="w-full rounded-radius-md bg-slate-50 border border-slate-200/60 px-4 py-3 shadow-sm text-center sm:w-auto sm:min-w-[7rem]">
             <p className="text-[10px] font-semibold uppercase tracking-wider text-steel mb-1">Version</p>
             <p className="text-xl font-bold font-mono tracking-tight text-ink">v{policy.version}</p>
           </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Created by" value={<span className="break-all">{policy.createdByUserId}</span>} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Created" value={formatDateTime(policy.createdAt)} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Updated" value={formatDateTime(policy.updatedAt)} />
           </div>
           <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Observed approvals" value={formatNumber(relatedApprovals.length)} />
           </div>
        </div>

        <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
          {factRows.map((fact) => (
             <div key={fact.label} className="rounded-radius-md bg-white border border-slate-200/60 shadow-sm p-4">
               <p className="text-xs font-semibold uppercase tracking-wider text-steel">{fact.label}</p>
               <p className="mt-1 text-lg font-semibold tracking-tight text-ink">{fact.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-8 grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
           <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
             <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-4">Decision evidence</p>
             {relatedDecisions.length > 0 ? (
                <div className="space-y-3">
                  {relatedDecisions.slice(0, 5).map((decision) => (
                    <div key={decision.id} className="rounded-radius-md bg-white border border-slate-200/60 shadow-sm p-4 flex flex-col gap-1.5">
                       <p className="text-sm font-semibold font-mono text-ink">{decision.id}</p>
                       <p className="text-sm text-steel">{getDecisionEvidenceLabel(decision)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-steel bg-white border border-slate-200/60 shadow-sm p-5 rounded-radius-md text-center">
                  No persisted decisions currently reference this policy id.
                </p>
              )}
           </div>

           <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5 flex flex-col">
              <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-2">Workflow evidence</p>
              <p className="text-sm leading-relaxed text-steel mb-4">
                The backend does not expose policy-scoped approval configuration. This panel shows only approval-task evidence already persisted for related decisions.
              </p>

              <div className="mt-auto rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                <DataField
                  label="Approval tasks observed"
                  value={<span className="text-2xl font-bold tracking-tight text-ink">{formatNumber(relatedApprovals.length)}</span>}
                />
                <p className="mt-2 text-sm font-medium text-steel">
                  Pending <span className="font-semibold text-ink ml-1">{formatNumber(relatedApprovals.filter((approval) => approval.status === "pending").length)}</span>
                </p>
              </div>
           </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-slate-200/60 pt-6">
          <Link
            to={buildApprovalGovernanceHref({ policyId: policy.id })}
            className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
          >
            Open approval governance
          </Link>
          <Link to={links.decisions} className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
            Open decision inbox
          </Link>
          <Link to={links.workflow} className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
            Open workflow
          </Link>
          <Link to={links.outcomes} className={`${uiButtonSecondaryClassName} whitespace-nowrap`}>
            Open outcomes
          </Link>
        </div>
      </SectionCard>
    </section>
  );
};
