import { formatNumber } from "../../../lib/utils/format";
import { formatAutomationTier } from "../../decisions/presentation";
import {
  getAutomationPostureLabel,
  getPolicyAutomationTier,
  isActivatablePolicy,
} from "../selectors";
import type { ApprovalTask, Decision, Policy } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonClassName } from "../../../components/ui/classes";
import { DataField } from "../../../components/ui/DataField";
import { StatusChip } from "../../../components/ui/StatusChip";

interface AutomationControlsSectionProps {
  policy: Policy | null;
  relatedDecisions: Decision[];
  relatedApprovals: ApprovalTask[];
  activationPending: boolean;
  onRequestActivate: (policy: Policy) => void;
}

export const AutomationControlsSection = ({
  policy,
  relatedDecisions,
  relatedApprovals,
  activationPending,
  onRequestActivate,
}: AutomationControlsSectionProps): JSX.Element => {
  if (!policy) {
    return (
      <section className="space-y-4 w-full flex flex-col items-stretch">
        <PageHeader
      label="Automation controls"
          title="Automation and approval controls"
          description="Select a policy to review automation posture, approval evidence, and any real governance action the backend exposes for that policy."
        />
      </section>
    );
  }

  const automationTier = getPolicyAutomationTier(policy);
  const autoExecuteDecisionCount = relatedDecisions.filter(
    (decision) => decision.automationTier === "auto_execute",
  ).length;

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
       <PageHeader
      label="Automation controls"
          title="Automation and approval controls"
          description="This section stays grounded in persisted policy automation tiers plus observed workflow evidence. The backend does not expose a policy-level approval-setting mutation today."
        />

      <SectionCard>
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200/60 pb-6 xl:flex-row xl:items-end xl:justify-between 2xl:flex-col 2xl:items-start">
          <div className="max-w-3xl">
            <h4 className="text-xl font-semibold text-ink">Action controls</h4>
          </div>

          {isActivatablePolicy(policy) ? (
            <button
              type="button"
              onClick={() => onRequestActivate(policy)}
              disabled={activationPending}
              className={`${uiButtonClassName} justify-center disabled:opacity-60`}
            >
              {activationPending ? "Activating..." : "Activate policy"}
            </button>
          ) : (
            <StatusChip tone="neutral">
              {policy.status === "active" ? "Already active" : "Read-only status"}
            </StatusChip>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-1">
          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
             <DataField
                 label="Automation tier"
                 value={<span className="text-xl font-semibold tracking-tight text-ink">{formatAutomationTier(automationTier)}</span>}
             />
             <p className="mt-2 text-sm text-steel">The persisted automation tier on this policy's rulesJson payload.</p>
          </div>
          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
             <DataField
                 label="Governance posture"
                 value={<span className="text-xl font-semibold tracking-tight text-ink">{getAutomationPostureLabel(policy)}</span>}
             />
             <p className="mt-2 text-sm text-steel">Presented directly from the automation tier rather than guessed from hidden policy logic.</p>
          </div>
          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
              <DataField
                 label="Observed approval tasks"
                 value={<span className="text-xl font-semibold tracking-tight text-ink">{formatNumber(relatedApprovals.length)}</span>}
             />
             <p className="mt-2 text-sm text-steel">Approval tasks actually persisted for decisions referencing this policy.</p>
          </div>
          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
             <DataField
                 label="Observed auto-execute decisions"
                 value={<span className="text-xl font-semibold tracking-tight text-ink">{formatNumber(autoExecuteDecisionCount)}</span>}
             />
             <p className="mt-2 text-sm text-steel">Decisions persisted with auto_execute under this policy, if any exist.</p>
          </div>
        </div>

        <div className="mt-6 rounded-radius-md border border-slate-200/60 bg-slate-50 p-5 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-2">Backend control boundary</p>
          <p className="text-sm leading-relaxed text-steel">
            The current API surface allows draft creation, draft update, and policy activation. It does not expose separate approval-rule configuration, deactivate toggles, or policy history rollback controls, so this workspace keeps those areas explicitly read-only.
          </p>
        </div>
      </SectionCard>
    </section>
  );
};
