import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { serializeEntitlementValue } from "../selectors";
import type { BillingEntitlements, OrganizationEntitlement } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";

interface OrganizationSettingsSectionProps {
  organizationEntitlements: OrganizationEntitlement[];
  billingEntitlements: BillingEntitlements | null;
}

export const OrganizationSettingsSection = ({
  organizationEntitlements,
  billingEntitlements,
}: OrganizationSettingsSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Entitlements"
      title="Organization metadata"
      description="A dedicated organization settings read or update API is not exposed in the current backend route surface. This section shows the org-scoped entitlement metadata and billing usage facts that are actually available."
    />

    <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
      <SectionCard>
        <p className="ui-section-label">Org metadata</p>
        <h4 className="mt-1 text-subheading text-ink">Exposed entitlement keys</h4>

        {organizationEntitlements.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="No entitlements" message="No organization entitlement rows were returned for this tenant." />
          </div>
        ) : (
          <div className={`mt-6 ${uiTableShellClassName} shadow-none border border-slate-200/60`}>
            <div className={uiTableWrapClassName}>
              <table className={uiTableClassName}>
                <thead className={uiTableHeadClassName}>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {organizationEntitlements.map((entitlement) => (
                    <tr key={entitlement.id} className={uiTableRowClassName}>
                      <td className="px-4 py-3 align-top text-sm font-semibold text-ink">{entitlement.key}</td>
                      <td className="px-4 py-3 align-top text-sm font-medium text-steel">
                        {serializeEntitlementValue(entitlement.value)}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-steel tabular-nums">
                        {formatDateTime(entitlement.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <p className="ui-section-label">Settings support</p>
        <h4 className="mt-1 text-subheading text-ink">Current API limitations</h4>

        <div className="mt-6 space-y-4">
          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-ink">Organization profile details</p>
            <p className="mt-1 text-sm leading-relaxed text-steel">
              There is no dedicated read endpoint for organization name, slug, or editable settings in the current route surface.
            </p>
          </div>

          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-ink">Settings updates</p>
            <p className="mt-1 text-sm leading-relaxed text-steel">
              No org settings update route is currently exposed, so this workspace stays read-only for configuration metadata.
            </p>
          </div>

          <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-ink">Billing-backed user capacity</p>
            <p className="mt-1 text-sm leading-relaxed text-steel">
              {billingEntitlements?.limits?.users
                ? `The current window allows ${formatNumber(
                    billingEntitlements.limits.users.limit,
                  )} users, with ${formatNumber(
                    billingEntitlements.limits.users.remaining,
                  )} seats remaining.`
                : "User-capacity visibility is unavailable for the current session."}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  </section>
);
