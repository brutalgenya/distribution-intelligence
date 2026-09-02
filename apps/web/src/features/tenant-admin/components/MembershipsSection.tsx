import clsx from "clsx";

import { formatDateTime } from "../../../lib/utils/format";
import { formatOrganizationRole } from "../selectors";
import type { OrganizationMembership } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";

interface MembershipsSectionProps {
  memberships: OrganizationMembership[];
  selectedMembershipId: string | null;
  currentUserId: string;
  onSelectMembership: (membershipId: string) => void;
}

export const MembershipsSection = ({
  memberships,
  selectedMembershipId,
  currentUserId,
  onSelectMembership,
}: MembershipsSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Memberships"
      title="Memberships and users"
      description="The current org API exposes current memberships only. There is no separate user directory or membership lifecycle status endpoint in this slice, so each row represents current tenant access."
    />

    <div className={uiTableShellClassName}>
      {memberships.length === 0 ? (
        <div className="p-10">
          <EmptyState title="No memberships" message="No membership rows were returned for this organization." />
        </div>
      ) : (
        <div className={uiTableWrapClassName}>
          <table className={uiTableClassName}>
            <thead className={uiTableHeadClassName}>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((membership) => {
                const isSelected = selectedMembershipId === membership.id;
                const isCurrentUser = membership.user.id === currentUserId;

                return (
                  <tr
                    key={membership.id}
                    className={clsx(
                      uiTableRowClassName,
                      "cursor-pointer",
                      isSelected ? "bg-pine/5" : "hover:bg-slate-50/50",
                    )}
                    onClick={() => onSelectMembership(membership.id)}
                  >
                    <td className="px-5 py-4 align-top">
                      <div>
                        <p className="text-sm font-semibold text-ink">{membership.user.displayName}</p>
                        <p className="mt-0.5 text-xs text-steel">{membership.user.email}</p>
                        <p className="mt-1.5 text-[10px] uppercase tracking-wider text-steel">{membership.user.id}</p>
                        {isCurrentUser ? (
                          <div className="mt-2 text-xs font-semibold text-pine">
                            (Current session user)
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                      {formatOrganizationRole(membership.role)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <StatusChip tone="info">Current membership</StatusChip>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-steel tabular-nums">
                      {formatDateTime(membership.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
);
