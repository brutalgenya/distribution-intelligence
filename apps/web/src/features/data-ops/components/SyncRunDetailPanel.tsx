import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildSupportActionsHref } from "../../support-actions/route";
import { formatSyncStatus, formatSyncType, getSyncStatusTone } from "../selectors";
import type { IntegrationFailedRecord, IntegrationSyncRun } from "../types";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { DataField } from "../../../components/ui/DataField";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";

interface SyncRunDetailPanelProps {
  syncRun: IntegrationSyncRun;
  failedRecords: IntegrationFailedRecord[];
}

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const SyncRunDetailPanel = ({
  syncRun,
  failedRecords,
}: SyncRunDetailPanelProps): JSX.Element => {
   const tone = getSyncStatusTone(syncRun.status);
   let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
   if(tone === "success") mappedTone = "success";
   else if(tone === "warning") mappedTone = "warning";
   else if(tone === "danger") mappedTone = "danger";

  return (
  <div className="rounded-radius-lg border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden mt-4">
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between border-b border-slate-200/60 pb-5 mb-5">
      <div>
        <p className="ui-section-label mb-1">Sync run detail</p>
        <h5 className="text-2xl font-semibold tracking-tight text-ink font-mono break-all">{syncRun.id}</h5>
        <div className="mt-2 flex items-center gap-2">
           <span className="rounded-radius-sm bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">{formatSyncType(syncRun.syncType)}</span>
           <span className="text-sm text-steel opacity-40">·</span>
           <StatusChip tone={mappedTone}>{formatSyncStatus(syncRun.status)}</StatusChip>
        </div>
      </div>
      <div className="flex flex-col items-start md:items-end md:text-right text-sm text-steel gap-1">
        <p>Started <span className="font-medium text-ink">{formatDateTime(syncRun.startedAt)}</span></p>
        <p>Completed <span className="font-medium text-ink">{formatDateTime(syncRun.completedAt)}</span></p>
        <Link
          to={buildSupportActionsHref({
            integrationConnectionId: syncRun.integrationConnectionId,
            syncRunId: syncRun.id,
          })}
          className={`mt-2 ${uiButtonSecondaryClassName}`}
        >
          Open support actions
        </Link>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Processed" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(syncRun.processedCount)}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Succeeded" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(syncRun.successCount)}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Failed" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(syncRun.failureCount)}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Requested by" value={<span className="font-semibold text-ink break-all">{syncRun.requestedByUserId ?? "System-managed"}</span>} />
       </div>
    </div>

    <div className="grid gap-6 xl:grid-cols-2 mb-6">
      <details className="group rounded-radius-md border border-slate-200/60 bg-slate-50 shadow-sm overflow-hidden h-fit" open>
         <summary className="cursor-pointer list-none p-4 font-semibold text-ink transition-colors group-hover:bg-slate-100/50">Error summary</summary>
         <div className="px-5 pb-5">
            <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
              {renderJson(syncRun.errorSummary)}
            </pre>
         </div>
      </details>
      <details className="group rounded-radius-md border border-slate-200/60 bg-slate-50 shadow-sm overflow-hidden h-fit">
         <summary className="cursor-pointer list-none p-4 font-semibold text-ink transition-colors group-hover:bg-slate-100/50">Checkpoint data</summary>
         <div className="px-5 pb-5">
            <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
               {renderJson(syncRun.checkpoint)}
            </pre>
         </div>
      </details>
    </div>

    <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5">
      <h4 className="ui-section-label mb-4">Failed records</h4>
      <div className="space-y-3">
        {failedRecords.length > 0 ? (
          failedRecords.map((record) => (
            <details key={record.id} className="group rounded-radius-md border border-slate-200/60 bg-white shadow-sm overflow-hidden open:pb-4">
               <summary className="cursor-pointer list-none p-4 transition-colors group-hover:bg-slate-50/50">
                <p className="text-sm font-semibold text-ink">
                  {record.recordType} <span className="mx-1.5 opacity-40">·</span> {record.sourceReference ?? "No source reference"}
                </p>
               </summary>
               <div className="px-4 border-t border-slate-100 pt-3 mt-1">
                 <p className="text-sm leading-relaxed text-ink bg-red-50 text-red-800 border border-red-200/60 rounded-radius-sm p-3 mb-3">{record.errorMessage}</p>
                 <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
                    {renderJson(record.payload)}
                 </pre>
               </div>
            </details>
          ))
        ) : (
            <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                <EmptyState title="No failures" message="No failed records are currently linked to this sync run." />
            </div>
        )}
      </div>
    </div>
  </div>
)};
