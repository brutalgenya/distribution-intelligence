import { formatDateTime } from "../../../lib/utils/format";
import {
  formatApprovalStatus,
  getApprovalQueueHelper,
  getApprovalStatusTone,
} from "../selectors";
import type { ApprovalGovernanceRouteParams, ApprovalRow } from "../types";
import { formatDecisionType } from "../../decisions/presentation";

interface ApprovalQueueSectionProps {
  rows: ApprovalRow[];
  filters: Pick<ApprovalGovernanceRouteParams, "status" | "decisionType">;
  selectedApprovalTaskId: string | null;
  onFiltersChange: (
    nextFilters: Pick<ApprovalGovernanceRouteParams, "status" | "decisionType">,
  ) => void;
  onSelectApproval: (approvalTaskId: string) => void;
}

const selectClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine/35";

export const ApprovalQueueSection = ({
  rows,
  filters,
  selectedApprovalTaskId,
  onFiltersChange,
  onSelectApproval,
}: ApprovalQueueSectionProps): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Approval queue</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Approval queue intelligence</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
          {getApprovalQueueHelper(filters)}
        </p>
      </div>

      <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-steel">
        <p className="text-xs uppercase tracking-[0.14em] text-steel">Rows in view</p>
        <p className="mt-2 text-xl font-semibold text-ink">{rows.length}</p>
      </div>
    </div>

    <div className="mt-5 grid gap-4 lg:grid-cols-2">
      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.14em] text-steel">Approval status</span>
        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              status: event.target.value as ApprovalGovernanceRouteParams["status"],
            })
          }
          className={selectClassName}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>

      <label className="space-y-2">
        <span className="text-xs uppercase tracking-[0.14em] text-steel">Decision type</span>
        <select
          value={filters.decisionType}
          onChange={(event) =>
            onFiltersChange({
              ...filters,
              decisionType: event.target.value as ApprovalGovernanceRouteParams["decisionType"],
            })
          }
          className={selectClassName}
        >
          <option value="all">All decision types</option>
          <option value="replenishment">Replenishment</option>
          <option value="allocation">Allocation</option>
          <option value="exception">Exception</option>
        </select>
      </label>
    </div>

    {rows.length > 0 ? (
      <div className="custom-scrollbar mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-cloud text-left text-xs uppercase tracking-[0.16em] text-steel">
            <tr>
              <th className="px-4 py-4 font-semibold">Approval</th>
              <th className="px-4 py-4 font-semibold">Decision</th>
              <th className="px-4 py-4 font-semibold">Policy</th>
              <th className="px-4 py-4 font-semibold">Wait</th>
              <th className="px-4 py-4 font-semibold">Requested</th>
              <th className="px-4 py-4 font-semibold">Overrides</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = getApprovalStatusTone(row.status);
              const isSelected = row.id === selectedApprovalTaskId;

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-t border-black/6 transition hover:bg-black/3 ${
                    isSelected ? "bg-sand/10" : ""
                  }`}
                  onClick={() => onSelectApproval(row.id)}
                >
                  <td className="px-4 py-4 align-top">
                    <p className="font-semibold text-ink">{row.purpose}</p>
                    <p className="mt-1 text-sm text-steel">{row.id}</p>
                    <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClassName}`}>
                      {formatApprovalStatus(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {row.decision ? (
                      <>
                        <p className="font-semibold text-ink">{formatDecisionType(row.decision.decisionType)}</p>
                        <p className="mt-1 text-sm text-steel">{row.decision.id}</p>
                      </>
                    ) : (
                      <p className="text-sm text-steel">Decision detail unavailable</p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {row.policy ? `${row.policy.name} v${row.policy.version}` : "Policy not exposed"}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p>{row.waitLabel}</p>
                    <p className="mt-1 text-xs text-steel">Updated {formatDateTime(row.updatedAt)}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {formatDateTime(row.requestedAt)}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {row.relatedOverrideCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="mt-5 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
        No approval tasks match the current queue filters. Clear the decision-type filter or select a broader backend status filter to widen the governance queue.
      </div>
    )}
  </section>
);
