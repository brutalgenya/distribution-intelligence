import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  formatBillingInterval,
  formatSubscriptionStatus,
  formatUsageMeterType,
} from "../selectors";
import type {
  ActivationActionFeedback,
  BillingPlan,
  BillingUsageMeter,
  CommercialReadiness,
} from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonClassName, uiButtonSecondaryClassName, uiInputClassName } from "../../../components/ui/classes";

interface CommercialReadinessSectionProps {
  commercial: CommercialReadiness;
  selectedPlanCode: string;
  feedback: ActivationActionFeedback | null;
  checkoutPending: boolean;
  portalPending: boolean;
  onSelectPlanCode: (planCode: string) => void;
  onStartCheckout: () => void;
  onOpenPortal: () => void;
}

export const CommercialReadinessSection = ({
  commercial,
  selectedPlanCode,
  feedback,
  checkoutPending,
  portalPending,
  onSelectPlanCode,
  onStartCheckout,
  onOpenPortal,
}: CommercialReadinessSectionProps): JSX.Element => {
  const currentPlan = commercial.subscription?.plan ?? null;
  const usageLimits = commercial.entitlements?.limits ?? null;
  const latestUsageMeters = commercial.usageMeters.slice(0, 5);
  const hasPortalAction = commercial.subscription?.stripeCustomerId !== null;
  const selectedPlan =
    commercial.activePlans.find((plan) => plan.code === selectedPlanCode) ??
    commercial.activePlans[0] ??
    null;

  return (
    <section className="space-y-4 flex flex-col items-stretch w-full">
      <PageHeader
      label="Commercial readiness"
        title="Commercial readiness"
        description="Review the current plan, subscription state, entitlements, and usage visibility before treating this tenant as commercially activated."
      />

      <div className="grid gap-4 2xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard>
          {feedback ? (
            <div className="mb-6 rounded-radius-md border border-slate-100 bg-slate-50 p-4 text-sm text-steel shadow-sm">
              <p className="font-semibold text-ink">{feedback.title}</p>
              <p className="mt-1.5 leading-relaxed">{feedback.message}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/60 pb-6 mb-6">
            <div>
              <p className="ui-section-label">Current subscription</p>
              <h4 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                {currentPlan?.name ?? "No subscription"}
              </h4>
              <p className="mt-2 text-sm text-steel">
                {commercial.subscription
                  ? `${formatSubscriptionStatus(commercial.subscription.status)} · ${formatBillingInterval(
                      commercial.subscription.plan.interval,
                    )}`
                  : "No billing state is currently persisted for this tenant."}
              </p>
            </div>
            {currentPlan ? (
              <StatusChip tone="neutral">
                Plan code {currentPlan.code}
              </StatusChip>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Current period end" value={formatDateTime(commercial.subscription?.currentPeriodEnd ?? null)} />
            </div>
            <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Support tier" value={commercial.entitlements?.entitlements?.supportTier ?? "Not available"} />
            </div>
            <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Automation tier" value={commercial.entitlements?.entitlements?.maxAutomationTier ?? "Not available"} />
            </div>
             <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
               <DataField label="Enabled integrations" value={commercial.entitlements?.entitlements?.integrationsEnabled.join(", ") || "Not available"} />
            </div>
          </div>

          <div className="mt-8 rounded-radius-md border border-slate-200/60 bg-slate-50 p-6 shadow-sm">
            <div className="mb-6">
               <p className="text-sm font-semibold uppercase tracking-wider text-ink">Billing actions</p>
               <p className="mt-1.5 text-sm leading-relaxed text-steel">
                 These actions are only shown because the backend already exposes checkout and portal session routes.
               </p>
            </div>

            <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto_auto] 2xl:items-end">
              <label className="min-w-0 space-y-2">
                <span className="text-sm font-medium text-ink">Checkout plan</span>
                <select
                  value={selectedPlanCode}
                  onChange={(event) => onSelectPlanCode(event.target.value)}
                  className={`w-full ${uiInputClassName}`}
                >
                  {commercial.activePlans.length === 0 ? (
                    <option value="">No active plans exposed</option>
                  ) : (
                    commercial.activePlans.map((plan: BillingPlan) => (
                      <option key={plan.id} value={plan.code}>
                        {plan.name} · {formatBillingInterval(plan.interval)}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <button
                type="button"
                onClick={onStartCheckout}
                disabled={checkoutPending || selectedPlan === null}
                className={`${uiButtonClassName} justify-center whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {checkoutPending ? "Creating..." : "Start checkout"}
              </button>

              <button
                type="button"
                onClick={onOpenPortal}
                disabled={portalPending || !hasPortalAction}
                className={`${uiButtonSecondaryClassName} justify-center whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {portalPending ? "Opening..." : "Open billing portal"}
              </button>
            </div>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard>
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-6">Entitlement limits</p>
            {usageLimits ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(usageLimits).map(([key, limit]) => (
                  <div key={key} className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
                    <DataField
                       label={key}
                       value={
                         <>
                           <span className="font-semibold text-ink">{formatNumber(limit.used)}</span> / {formatNumber(limit.limit)}
                         </>
                       }
                    />
                    <p className="mt-2 text-sm text-steel">
                      Remaining {formatNumber(limit.remaining)}
                      {limit.exceeded ? <span className="text-rose-600 font-medium ml-1">· Exceeded</span> : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
               <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm">
                  <EmptyState title="No limits" message="Entitlement limits are not available until the backend resolves an active subscription and plan." />
               </div>
            )}
          </SectionCard>

          <SectionCard>
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-6">Usage evidence</p>
            {latestUsageMeters.length > 0 ? (
              <div className="space-y-3">
                {latestUsageMeters.map((meter: BillingUsageMeter) => (
                  <div key={meter.id} className="rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{formatUsageMeterType(meter.meterType)}</p>
                        <p className="mt-1.5 text-xs text-steel">
                          Window {formatDateTime(meter.measurementWindowStart)} to {formatDateTime(meter.measurementWindowEnd)}
                        </p>
                      </div>
                      <span className="rounded-radius-sm bg-slate-50 border border-slate-200/50 px-3 py-1 text-sm font-medium tabular-nums text-ink">
                        {formatNumber(meter.usageValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm">
                  <EmptyState title="No usage data" message="No usage meter rows are currently exposed for this tenant." />
               </div>
            )}
          </SectionCard>
        </div>
      </div>
    </section>
  );
};
