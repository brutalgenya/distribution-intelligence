import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import type { IntegrationFailedRecord } from "../types";
import type { WorkerStatus } from "../../workflow/types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { DataField } from "../../../components/ui/DataField";

interface DiagnosticsSectionProps {
  workerStatuses: WorkerStatus[];
  unresolvedFailedRecords: IntegrationFailedRecord[];
}

export const DiagnosticsSection = ({
  workerStatuses,
  unresolvedFailedRecords,
}: DiagnosticsSectionProps): JSX.Element => {
  const focusWorkers = workerStatuses.filter(
    (worker) => worker.workerType === "forecast" || worker.workerType === "integration",
  );

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Diagnostics"
        title="Diagnostics and failure detail"
        description="Worker-level diagnostics plus unresolved failed records from replay-safe ingestion. Reprocess and replay-safe actions are not exposed by the current frontend because the backend does not provide them here."
      />

      <SectionCard>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-8">
          {focusWorkers.length > 0 ? (
            focusWorkers.map((worker) => (
              <div key={worker.workerType} className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
                <DataField
                  label={`${worker.workerType} worker`}
                  value={<span className="text-xl font-semibold tracking-tight text-ink">{worker.currentlyRunning ? "Running" : worker.lastStatus ?? "Unknown"}</span>}
                />

                <p className="mt-3 text-sm text-steel mb-1">
                  Last run <span className="font-medium text-ink">{formatDateTime(worker.lastRunAt)}</span>
                </p>
                <p className="text-sm font-medium text-steel">
                  Backlog <span className="font-semibold text-ink ml-1 mr-3">{formatNumber(worker.retryBacklog)}</span> Dead-letter <span className="font-semibold text-ink ml-1">{formatNumber(worker.deadLetterCount)}</span>
                </p>
              </div>
            ))
          ) : (
            <div className="sm:col-span-2 xl:col-span-4 bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                 <EmptyState title="No worker diagnostics" message="No forecast or integration worker diagnostics are currently exposed." />
            </div>
          )}
        </div>

        <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
          <h4 className="ui-section-label mb-4">Unresolved failed records</h4>
          <div className="space-y-3">
            {unresolvedFailedRecords.length > 0 ? (
              unresolvedFailedRecords.slice(0, 8).map((record) => (
                <details key={record.id} className="group rounded-radius-md border border-slate-200/60 bg-white shadow-sm overflow-hidden open:pb-4">
                   <summary className="cursor-pointer list-none p-4 transition-colors group-hover:bg-slate-50/50">
                    <p className="text-sm font-semibold text-ink">
                      {record.recordType} <span className="mx-1.5 opacity-40">·</span> {record.sourceReference ?? "No source reference"}
                    </p>
                   </summary>
                   <div className="px-4 border-t border-slate-100 pt-3 mt-1">
                     <p className="text-sm leading-relaxed text-ink bg-red-50 text-red-800 border border-red-200/60 rounded-radius-sm p-3 mb-3">{record.errorMessage}</p>
                     <p className="text-sm text-steel">
                       Created <span className="font-medium text-ink">{formatDateTime(record.createdAt)}</span> <span className="mx-1.5 opacity-40">·</span> Connection <span className="font-medium text-ink break-all max-w-xs">{record.integrationConnectionId}</span>
                     </p>
                   </div>
                </details>
              ))
            ) : (
               <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                   <EmptyState title="No failures" message="No unresolved integration failed records are currently exposed for this scope." />
               </div>
            )}
          </div>
        </div>
      </SectionCard>
    </section>
  );
};
