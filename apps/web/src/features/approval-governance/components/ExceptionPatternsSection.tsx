import { Link } from "react-router-dom";

import { formatDateTime, formatNumber, formatPercent } from "../../../lib/utils/format";
import { buildPoliciesHref } from "../../policies/route";
import { buildApprovalGovernanceHref } from "../route";
import { getPolicyPatternHelper } from "../selectors";
import type { InterventionPatternRow } from "../types";

interface ExceptionPatternsSectionProps {
  rows: InterventionPatternRow[];
  selectedPolicyId: string | null;
  onSelectPolicy: (policyId: string | null) => void;
}

export const ExceptionPatternsSection = ({
  rows,
  selectedPolicyId,
  onSelectPolicy,
}: ExceptionPatternsSectionProps): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Exception patterns</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Governance cost and exception patterns</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
          These clusters show where approvals, manual approvals or rejections, and backend-computed override-rate evidence are concentrating. This is operational friction evidence, not a fabricated cost model.
        </p>
      </div>
    </div>

    {rows.length > 0 ? (
      <div className="custom-scrollbar mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-cloud text-left text-xs uppercase tracking-[0.16em] text-steel">
            <tr>
              <th className="px-4 py-4 font-semibold">Policy cluster</th>
              <th className="px-4 py-4 font-semibold">Decision evidence</th>
              <th className="px-4 py-4 font-semibold">Approval friction</th>
              <th className="px-4 py-4 font-semibold">Override evidence</th>
              <th className="px-4 py-4 font-semibold">Backend effectiveness</th>
              <th className="px-4 py-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.policyId !== null && row.policyId === selectedPolicyId;

              return (
                <tr
                  key={row.key}
                  className={`border-t border-black/6 transition hover:bg-black/3 ${
                    isSelected ? "bg-sand/10" : ""
                  }`}
                >
                  <td className="px-4 py-4 align-top">
                    <button
                      type="button"
                      onClick={() => onSelectPolicy(row.policyId)}
                      className="text-left"
                    >
                      <p className="font-semibold text-ink">{row.policyName}</p>
                      <p className="mt-1 text-sm text-steel">{row.policyTypeLabel}</p>
                    </button>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p>{formatNumber(row.decisionCount)} decisions</p>
                    <p className="mt-1 text-steel">{getPolicyPatternHelper(row)}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p>{formatNumber(row.approvalCount)} approvals</p>
                    <p className="mt-1 text-steel">
                      {formatNumber(row.pendingApprovalCount)} pending | {formatNumber(row.rejectedApprovalCount)} rejected
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p>{formatNumber(row.overrideCount)} overrides</p>
                    <p className="mt-1 text-steel">
                      {formatNumber(row.manualApproveCount)} manual approve | {formatNumber(row.manualRejectCount)} manual reject
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    <p>{formatPercent(row.overrideRate)}</p>
                    <p className="mt-1 text-steel">
                      {row.latestEffectivenessAt
                        ? `Window ended ${formatDateTime(row.latestEffectivenessAt)}`
                        : "No policy summary yet"}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex flex-wrap gap-2">
                      {row.policyId ? (
                        <>
                          <Link
                            to={buildPoliciesHref({ policyId: row.policyId })}
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
                          >
                            Policy
                          </Link>
                          <Link
                            to={buildApprovalGovernanceHref({ policyId: row.policyId })}
                            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-black/20 hover:bg-black/5"
                          >
                            Focus here
                          </Link>
                        </>
                      ) : (
                        <span className="rounded-xl border border-dashed border-black/10 px-3 py-2 text-sm text-steel">
                          No linked policy
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="mt-5 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
        No policy-level governance patterns are available yet. This usually means the tenant has not persisted enough decisions, approvals, or overrides to cluster policy friction.
      </div>
    )}
  </section>
);
