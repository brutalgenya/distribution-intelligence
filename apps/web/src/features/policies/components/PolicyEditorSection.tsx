import {
  getPolicyEditorModeLabel,
  isDraftPolicy,
} from "../selectors";
import type { Policy, PolicyActionFeedback, PolicyEditorState } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonClassName, uiInputClassName } from "../../../components/ui/classes";

interface PolicyEditorSectionProps {
  selectedPolicy: Policy | null;
  draft: PolicyEditorState;
  forceCreateMode: boolean;
  pending: boolean;
  feedback: PolicyActionFeedback | null;
  onFieldChange: <K extends keyof PolicyEditorState>(
    field: K,
    value: PolicyEditorState[K],
  ) => void;
  onSubmit: () => void;
  onSwitchToCreate: () => void;
}

export const PolicyEditorSection = ({
  selectedPolicy,
  draft,
  forceCreateMode,
  pending,
  feedback,
  onFieldChange,
  onSubmit,
  onSwitchToCreate,
}: PolicyEditorSectionProps): JSX.Element => {
  const isEditingDraft = isDraftPolicy(selectedPolicy) && !forceCreateMode;
  const mode = getPolicyEditorModeLabel(selectedPolicy, forceCreateMode);

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Draft editor"
        title={mode.title}
        description={mode.helper}
      >
        {selectedPolicy ? (
          <button
            type="button"
            onClick={onSwitchToCreate}
            className={`whitespace-nowrap ${uiButtonClassName} bg-white text-ink border border-slate-200/60 hover:bg-slate-50`}
          >
            Create new draft
          </button>
        ) : null}
      </PageHeader>

      <SectionCard>
        {feedback ? (
          <div className="mb-6 rounded-radius-md border border-slate-100 bg-slate-50 p-4 text-sm text-steel shadow-sm">
            <p className="font-semibold text-ink">{feedback.title}</p>
            <p className="mt-1.5 leading-relaxed">{feedback.message}</p>
          </div>
        ) : null}

        {selectedPolicy && !isEditingDraft ? (
           <div className="mb-6 rounded-radius-md border border-amber-100 bg-amber-50/50 p-4 text-sm text-steel shadow-sm">
            <p className="font-semibold text-ink">Selected policy is read-only</p>
            <p className="mt-1.5 leading-relaxed">
              Only draft policies can be updated. Use this form to create a new draft instead of editing the currently selected {selectedPolicy.status} policy.
            </p>
          </div>
        ) : null}

        <div className="mb-6 grid gap-6 lg:grid-cols-3 2xl:grid-cols-1">
          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Policy type</span>
            <select
              value={draft.policyType}
              disabled={isEditingDraft}
              onChange={(event) => onFieldChange("policyType", event.target.value as PolicyEditorState["policyType"])}
              className={`w-full ${uiInputClassName} disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed`}
            >
              <option value="replenishment">Replenishment</option>
              <option value="allocation">Allocation</option>
              <option value="exception">Exception</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Policy name</span>
            <input
              value={draft.name}
              onChange={(event) => onFieldChange("name", event.target.value)}
              placeholder="North region replenishment policy"
              className={`w-full ${uiInputClassName}`}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-ink">Version</span>
            <input
              type="number"
              min="1"
              value={draft.version}
              disabled={isEditingDraft}
              onChange={(event) => onFieldChange("version", event.target.value)}
              className={`w-full ${uiInputClassName} disabled:opacity-60 disabled:bg-slate-50 disabled:cursor-not-allowed`}
            />
          </label>
        </div>

        <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-6">
          <div className="mb-6 grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Automation tier</span>
              <select
                value={draft.automationTier}
                onChange={(event) =>
                  onFieldChange("automationTier", event.target.value as PolicyEditorState["automationTier"])
                }
                className={`w-full ${uiInputClassName}`}
              >
                <option value="observe">Observe</option>
                <option value="recommend">Recommend</option>
                <option value="draft_only">Draft only</option>
                <option value="auto_execute">Auto execute</option>
              </select>
            </label>

            {draft.policyType === "allocation" ? (
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Max affected orders</span>
                <input
                  type="number"
                  min="1"
                  value={draft.maxAffectedOrders}
                  onChange={(event) => onFieldChange("maxAffectedOrders", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
            ) : (
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Forecast horizon days</span>
                <input
                  type="number"
                  min="1"
                  value={draft.forecastHorizonDays}
                  onChange={(event) => onFieldChange("forecastHorizonDays", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
            )}
          </div>

          {draft.policyType === "replenishment" ? (
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
               <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Target days of cover</span>
                <input
                  type="number"
                  min="1"
                  value={draft.targetDaysOfCover}
                  onChange={(event) => onFieldChange("targetDaysOfCover", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Default lead time days</span>
                <input
                  type="number"
                  min="1"
                  value={draft.defaultLeadTimeDays}
                  onChange={(event) => onFieldChange("defaultLeadTimeDays", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Lead time buffer days</span>
                <input
                  type="number"
                  min="0"
                  value={draft.leadTimeBufferDays}
                  onChange={(event) => onFieldChange("leadTimeBufferDays", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Shortage buffer quantity</span>
                <input
                  type="number"
                  min="0"
                  value={draft.shortageBufferQty}
                  onChange={(event) => onFieldChange("shortageBufferQty", event.target.value)}
                   className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                 <span className="text-sm font-medium text-ink">Demand spike multiplier</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={draft.demandSpikeMultiplier}
                  onChange={(event) => onFieldChange("demandSpikeMultiplier", event.target.value)}
                   className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="flex items-center gap-3 rounded-radius-md border border-slate-200/60 bg-white px-4 py-3 shadow-sm mt-7">
                <input
                  type="checkbox"
                  checked={draft.useSafetyStock}
                  onChange={(event) => onFieldChange("useSafetyStock", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-ink focus:ring-ink transition"
                />
                <span className="text-sm font-semibold text-ink">Use safety stock</span>
              </label>
            </div>
          ) : null}

          {draft.policyType === "allocation" ? (
             <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
              <label className="space-y-2">
                 <span className="text-sm font-medium text-ink">Shortage threshold quantity</span>
                <input
                  type="number"
                  min="1"
                  value={draft.shortageThresholdQty}
                  onChange={(event) => onFieldChange("shortageThresholdQty", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                 <span className="text-sm font-medium text-ink">Prioritization mode</span>
                <select
                  value={draft.prioritizationMode}
                  onChange={(event) =>
                    onFieldChange("prioritizationMode", event.target.value as PolicyEditorState["prioritizationMode"])
                  }
                   className={`w-full ${uiInputClassName}`}
                >
                  <option value="oldest_order_first">Oldest order first</option>
                </select>
              </label>
            </div>
          ) : null}

          {draft.policyType === "exception" ? (
            <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
              <label className="space-y-2">
                 <span className="text-sm font-medium text-ink">Lead-time drift threshold days</span>
                <input
                  type="number"
                  min="1"
                  value={draft.leadTimeDriftThresholdDays}
                  onChange={(event) => onFieldChange("leadTimeDriftThresholdDays", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                 <span className="text-sm font-medium text-ink">Demand spike multiplier</span>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={draft.demandSpikeMultiplier}
                  onChange={(event) => onFieldChange("demandSpikeMultiplier", event.target.value)}
                 className={`w-full ${uiInputClassName}`}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-ink">Stockout risk cover days</span>
                <input
                  type="number"
                  min="1"
                  value={draft.stockoutRiskCoverDays}
                  onChange={(event) => onFieldChange("stockoutRiskCoverDays", event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                />
              </label>
            </div>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-slate-200/60 pt-6">
          <p className="max-w-2xl text-sm leading-relaxed text-steel">
            This form only sends fields already accepted by the backend decisioning schemas. Activation remains a separate explicit action so the server stays authoritative for active-policy swaps.
          </p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending}
            className={`${uiButtonClassName} justify-center whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {pending ? (isEditingDraft ? "Saving..." : "Creating...") : isEditingDraft ? "Save draft" : "Create draft"}
          </button>
        </div>
      </SectionCard>
    </section>
  );
};
