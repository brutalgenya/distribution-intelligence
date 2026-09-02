import { Link } from "react-router-dom";

import { buildDataOpsHref } from "../../data-ops/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import { UnsupportedIntegrationActionNotice } from "./IntegrationOnboardingStates";
import type { ConnectionRow, IntegrationFailedRecord, IntegrationSyncRun } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";

interface OnboardingIssuesSectionProps {
  failedRecords: IntegrationFailedRecord[];
  selectedConnection: ConnectionRow | null;
  selectedSyncRun: IntegrationSyncRun | null;
}

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const OnboardingIssuesSection = ({
  failedRecords,
  selectedConnection,
  selectedSyncRun,
}: OnboardingIssuesSectionProps): JSX.Element => (
  <section className="space-y-4">
    <PageHeader
      label="Blocking issues"
      title="Onboarding issues"
      description="Inspect unresolved ingestion failures and understand which backend capabilities are still read-only from the onboarding control center."
    />

    <div className="grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
          <div>
            <h4 className="text-lg font-semibold text-ink">Failed-record queue</h4>
            <p className="mt-1 text-sm text-steel">
              Showing unresolved failed records
               {selectedSyncRun ? ` for sync ${selectedSyncRun.id}` : selectedConnection ? ` for ${selectedConnection.name}` : " across all connections"}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to={buildDataOpsHref({
                ...(selectedConnection ? { integrationConnectionId: selectedConnection.id } : {}),
                ...(selectedSyncRun ? { syncRunId: selectedSyncRun.id } : {}),
              })}
              className={uiButtonSecondaryClassName}
            >
              Open data ops
            </Link>
             <Link
              to={buildSupportActionsHref({
                ...(selectedConnection ? { integrationConnectionId: selectedConnection.id } : {}),
                ...(selectedSyncRun ? { syncRunId: selectedSyncRun.id } : {}),
              })}
              className={uiButtonSecondaryClassName}
            >
              Open support actions
            </Link>
          </div>
        </div>

        <div className="space-y-4 mt-8">
           {failedRecords.length > 0 ? (
            failedRecords.slice(0, 10).map((record) => (
              <details key={record.id} className="group rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm overflow-hidden [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer font-semibold text-ink outline-none">
                   <div className="flex flex-wrap items-start justify-between gap-4">
                       <div className="min-w-0">
                         <span className="text-ink text-sm">{record.recordType}</span>
                         <span className="text-steel mx-2 select-none opacity-50">·</span>
                         <span className="mt-1 block text-sm font-normal text-steel break-all">{record.sourceReference ?? "No source reference"}</span>
                       </div>
                       <svg className="w-4 h-4 text-steel transform transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                   </div>
                </summary>

                <div className="mt-5 border-t border-slate-100 pt-5 space-y-4">
                  <div className="rounded-radius-sm bg-rose-50/30 p-4 border border-rose-100">
                    <p className="text-sm font-medium leading-relaxed text-rose-900">{record.errorMessage}</p>
                  </div>
                  <div className="rounded-radius-sm bg-slate-50 border border-slate-200/60 p-4">
                     <p className="text-[10px] font-semibold uppercase tracking-wider text-steel mb-3">Payload Preview</p>
                     <pre className="overflow-x-auto text-xs text-ink/80 font-mono scrollbar-hide">
                       {renderJson(record.payload)}
                     </pre>
                  </div>
                </div>
              </details>
            ))
          ) : (
            <div className="bg-slate-50 border border-slate-200/60 rounded-radius-md p-8 shadow-sm text-center">
              <EmptyState title="No failures" message="No unresolved failed records are currently exposed for this scope." />
             </div>
          )}
        </div>
      </SectionCard>

      <div className="space-y-4">
        <UnsupportedIntegrationActionNotice
          title="Failed-record recovery is not exposed"
          message="The backend currently exposes failed-record reads only. Replay, resolve, or reprocess actions are intentionally unavailable here until dedicated endpoints exist."
        />
        <UnsupportedIntegrationActionNotice
          title="Connection testing is not exposed"
          message="This workspace can create and update connections, then create or process sync runs. It cannot run a separate connection validation or secret verification step because no backend route exposes that workflow today."
        />
      </div>
    </div>
  </section>
);
