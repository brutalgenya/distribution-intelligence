import { formatDateTime } from "../../../lib/utils/format";
import {
  formatOverrideType,
  getDecisionEvidenceLabel,
  getOverrideReasonPreview,
  getOverrideTone,
} from "../selectors";
import type { ApprovalGovernanceRouteParams, OverrideRow } from "../types";

interface HumanInterventionSectionProps {
  rows: OverrideRow[];
  overrideType: ApprovalGovernanceRouteParams["overrideType"];
  selectedDecisionId: string | null;
  onOverrideTypeChange: (overrideType: ApprovalGovernanceRouteParams["overrideType"]) => void;
  onSelectContext: (input: { decisionId?: string | null; policyId?: string | null }) => void;
}

const selectClassName =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-pine/35";

export const HumanInterventionSection = ({
  rows,
  overrideType,
  selectedDecisionId,
  onOverrideTypeChange,
  onSelectContext,
}: HumanInterventionSectionProps): JSX.Element => (
  <section className="rounded-[28px] border border-black/8 bg-white p-5 shadow-panel">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-steel">Operator overrides</p>
        <h3 className="mt-2 text-3xl font-semibold text-ink">Decision override and human intervention evidence</h3>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-steel">
          This section uses the dedicated operator override records the backend persists today. Where human intervention is only visible indirectly through approval or audit evidence, that limitation is kept explicit in the detail view instead of guessed in the client.
        </p>
      </div>

      <label className="w-full space-y-2 xl:w-auto xl:min-w-[18rem] 2xl:min-w-0">
        <span className="text-xs uppercase tracking-[0.14em] text-steel">Override type</span>
        <select
          value={overrideType}
          onChange={(event) =>
            onOverrideTypeChange(event.target.value as ApprovalGovernanceRouteParams["overrideType"])
          }
          className={selectClassName}
        >
          <option value="all">All override types</option>
          <option value="manual_approve">Manual approve</option>
          <option value="manual_reject">Manual reject</option>
          <option value="manual_cancel_execution">Manual cancel execution</option>
          <option value="manual_retry">Manual retry</option>
          <option value="manual_close_exception">Manual close exception</option>
          <option value="manual_request_execution">Manual request execution</option>
          <option value="manual_request_approval">Manual request approval</option>
        </select>
      </label>
    </div>

    {rows.length > 0 ? (
      <div className="custom-scrollbar mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-cloud text-left text-xs uppercase tracking-[0.16em] text-steel">
            <tr>
              <th className="px-4 py-4 font-semibold">Override</th>
              <th className="px-4 py-4 font-semibold">Decision context</th>
              <th className="px-4 py-4 font-semibold">Policy</th>
              <th className="px-4 py-4 font-semibold">Reason</th>
              <th className="px-4 py-4 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = getOverrideTone(row.overrideType);
              const isSelected = row.decision?.id !== null && row.decision?.id === selectedDecisionId;

              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-t border-black/6 transition hover:bg-black/3 ${
                    isSelected ? "bg-sand/10" : ""
                  }`}
                  onClick={() =>
                    onSelectContext({
                      decisionId: row.decision?.id ?? null,
                      policyId: row.policy?.id ?? null,
                    })
                  }
                >
                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone.badgeClassName}`}>
                      {formatOverrideType(row.overrideType)}
                    </span>
                    <p className="mt-3 font-semibold text-ink">{row.id}</p>
                    <p className="mt-1 text-sm text-steel">
                      {row.createdByUserId || "User id not exposed"}
                    </p>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {row.decision ? (
                      <>
                        <p className="font-semibold text-ink">{getDecisionEvidenceLabel(row.decision)}</p>
                        <p className="mt-1 text-sm text-steel">{row.decision.id}</p>
                      </>
                    ) : row.execution ? (
                      <>
                        <p className="font-semibold text-ink">Execution-linked intervention</p>
                        <p className="mt-1 text-sm text-steel">{row.execution.id}</p>
                      </>
                    ) : (
                      <p className="text-sm text-steel">No linked decision or execution is exposed.</p>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {row.policy ? `${row.policy.name} v${row.policy.version}` : "Policy not exposed"}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {getOverrideReasonPreview(row.reason)}
                  </td>
                  <td className="px-4 py-4 align-top text-sm text-ink">
                    {formatDateTime(row.createdAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="mt-5 rounded-2xl border border-dashed border-black/10 px-4 py-4 text-sm text-steel">
        No operator override records match the current view. Manual intervention may still exist through approval decisions or audit events, but the backend is not exposing separate override rows for this scope.
      </div>
    )}
  </section>
);
