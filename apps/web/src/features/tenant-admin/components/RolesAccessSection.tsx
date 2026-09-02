import { formatNumber } from "../../../lib/utils/format";
import {
  canInviteMembers,
  formatOrganizationRole,
  organizationRoleOptions,
} from "../selectors";
import type {
  BillingEntitlements,
  InviteMemberDraft,
  OrganizationMembership,
  RoleCoverageItem,
} from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonClassName, uiInputClassName } from "../../../components/ui/classes";

interface RolesAccessSectionProps {
  roleCoverage: RoleCoverageItem[];
  currentMembership: OrganizationMembership | null;
  selectedMembership: OrganizationMembership | null;
  inviteDraft: InviteMemberDraft;
  billingEntitlements: BillingEntitlements | null;
  pending: boolean;
  onInviteFieldChange: <K extends keyof InviteMemberDraft>(
    field: K,
    value: InviteMemberDraft[K],
  ) => void;
  onInvite: () => void;
}

export const RolesAccessSection = ({
  roleCoverage,
  currentMembership,
  selectedMembership,
  inviteDraft,
  billingEntitlements,
  pending,
  onInviteFieldChange,
  onInvite,
}: RolesAccessSectionProps): JSX.Element => {
  const inviteAllowed = canInviteMembers(currentMembership);
  const userLimit = billingEntitlements?.limits?.users ?? null;

  return (
    <section className="space-y-4">
      <PageHeader
      label="Roles and access"
        title="Roles and access control"
        description="The backend exposes role codes through memberships and the invite contract. It does not expose a separate role catalog, permission descriptions, or role-reassignment mutation in this admin slice."
      />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="ui-section-label">Current role coverage</p>
              <h4 className="mt-1 text-subheading text-ink">Access distribution</h4>
            </div>
            {selectedMembership ? (
              <StatusChip tone="info">
                Selected member: {formatOrganizationRole(selectedMembership.role)}
              </StatusChip>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {roleCoverage.map((item) => (
              <article
                key={item.id}
                className="rounded-radius-lg border border-slate-100 bg-slate-50/50 p-5 shadow-sm"
              >
                <p className="text-[10px] uppercase tracking-wider text-steel">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{formatNumber(item.count)}</p>
                <p className="mt-2 text-sm leading-relaxed text-steel">{item.helper}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-radius-md border border-slate-100 bg-white p-4 shadow-sm text-sm">
              <p className="font-semibold text-ink">Role reassignment</p>
              <p className="mt-1 text-steel leading-relaxed">
                Not exposed by the current backend routes. This workspace only renders the current membership-to-role mapping.
              </p>
            </div>
            <div className="rounded-radius-md border border-slate-100 bg-white p-4 shadow-sm text-sm">
              <p className="font-semibold text-ink">Membership activation or deactivation</p>
              <p className="mt-1 text-steel leading-relaxed">
                Not exposed by the current backend routes. Existing membership rows are treated as current access only.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <p className="ui-section-label">Invite member</p>
          <h4 className="mt-1 text-subheading text-ink">Grant tenant access</h4>
          <p className="mt-2 text-sm leading-relaxed text-steel">
            This uses the real organization invitation route. The backend remains authoritative for billing seat enforcement, duplicate invites, and invite permission checks.
          </p>

          <div className="mt-6 rounded-radius-md border border-slate-200/60 bg-slate-50 p-4 text-sm leading-relaxed text-steel">
            <p className="font-medium text-ink">Current capability</p>
            <p className="mt-1">
              {inviteAllowed
                ? `Your current role is ${formatOrganizationRole(
                    currentMembership?.role ?? "viewer",
                  )}, which is eligible for invite creation in the current backend permission contract.`
                : currentMembership
                  ? `Your current role is ${formatOrganizationRole(
                      currentMembership.role,
                    )}. Invite requests may be rejected because the backend does not expose invite permission for this role.`
                  : "Your current membership could not be resolved from the memberships response."}
            </p>
            <p className="mt-2">
              {userLimit
                ? `User seats remaining in the current billing window: ${formatNumber(
                    userLimit.remaining,
                  )}.`
                : "Billing seat availability is not exposed for the current session."}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                value={inviteDraft.email}
                onChange={(event) => onInviteFieldChange("email", event.target.value)}
                placeholder="new.user@example.com"
                className={`mt-1.5 w-full ${uiInputClassName}`}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">Role code</span>
              <select
                value={inviteDraft.role}
                onChange={(event) =>
                  onInviteFieldChange("role", event.target.value as InviteMemberDraft["role"])
                }
                className={`mt-1.5 w-full ${uiInputClassName}`}
              >
                {organizationRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatOrganizationRole(role)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={onInvite}
            disabled={pending}
            className={`mt-6 ${uiButtonClassName} w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {pending ? "Sending invite..." : "Create invitation"}
          </button>
        </SectionCard>
      </div>
    </section>
  );
};
