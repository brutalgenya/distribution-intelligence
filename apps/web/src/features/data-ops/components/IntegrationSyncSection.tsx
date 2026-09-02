import clsx from "clsx";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import {
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
  getSyncStatusTone,
} from "../selectors";
import type { ConnectionRow, IntegrationSyncRun } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";

interface IntegrationSyncSectionProps {
  connections: ConnectionRow[];
  syncRuns: IntegrationSyncRun[];
  selectedConnectionId: string | null;
  selectedSyncRunId: string | null;
  onSelectConnection: (integrationConnectionId: string | null) => void;
  onSelectSyncRun: (syncRunId: string | null) => void;
}

export const IntegrationSyncSection = ({
  connections,
  syncRuns,
  selectedConnectionId,
  selectedSyncRunId,
  onSelectConnection,
  onSelectSyncRun,
}: IntegrationSyncSectionProps): JSX.Element => {
  const visibleSyncRuns =
    selectedSyncRunId === null
      ? syncRuns.slice(0, 12)
      : [
          ...syncRuns.filter((syncRun) => syncRun.id === selectedSyncRunId),
          ...syncRuns.filter((syncRun) => syncRun.id !== selectedSyncRunId).slice(0, 11),
        ];

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Integration throughput"
        title="Integration and sync runs"
        description="Inspect tenant integration connections, recent sync runs, processed counts, and failure summaries from the canonical ingestion layer."
      />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionCard>
          <div className="border-b border-slate-200/60 pb-4 mb-4">
             <p className="ui-section-label mb-1">Connections</p>
             <h4 className="text-xl font-semibold tracking-tight text-ink">Integration connections</h4>
          </div>

          <div className="space-y-3">
            {connections.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => onSelectConnection(null)}
                  className={clsx(
                    "w-full rounded-radius-md border px-4 py-3 text-left transition-colors duration-200",
                    selectedConnectionId === null
                      ? "border-sky-200/50 bg-sky-50/50 shadow-sm ring-1 ring-inset ring-sky-200/50"
                      : "border-slate-200/60 bg-white hover:bg-slate-50",
                  )}
                >
                  <p className="text-sm font-semibold text-ink">All connections</p>
                  <p className="mt-1 text-sm text-steel">Show the full recent sync queue.</p>
                </button>

                {connections.map((connection) => {
                   let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                   if(connection.status === "active") mappedTone = "success";
                   else if(connection.status === "error") mappedTone = "danger";

                  return (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => onSelectConnection(connection.id)}
                    className={clsx(
                      "w-full rounded-radius-md border px-4 py-3 text-left transition-colors duration-200",
                      selectedConnectionId === connection.id
                        ? "border-sky-200/50 bg-sky-50/50 shadow-sm ring-1 ring-inset ring-sky-200/50"
                        : "border-slate-200/60 bg-white hover:bg-slate-50",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{connection.name}</p>
                        <p className="mt-1 text-sm text-steel">{formatIntegrationType(connection.integrationType)}</p>
                      </div>
                      <StatusChip tone={mappedTone}>
                        {connection.status}
                      </StatusChip>
                    </div>
                    <p className="mt-3 text-sm text-steel">
                      Last successful sync <span className="font-medium text-ink">{formatDateTime(connection.lastSuccessfulSyncAt)}</span>
                    </p>
                  </button>
                )})}
              </>
            ) : (
                <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                   <EmptyState title="No connections" message="No integration connections are currently persisted for this tenant." />
                </div>
            )}
          </div>
        </SectionCard>

        <SectionCard padding="none">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
            <div>
               <p className="ui-section-label mb-1">Recent sync runs</p>
               <h4 className="text-xl font-semibold tracking-tight text-ink">Sync history</h4>
            </div>
            {selectedSyncRunId ? (
              <button
                type="button"
                onClick={() => onSelectSyncRun(null)}
                className={`${uiButtonSecondaryClassName}`}
              >
                Clear selected sync
              </button>
            ) : null}
          </div>

          {syncRuns.length > 0 ? (
            <div className="custom-scrollbar overflow-x-auto pb-4">
              <table className="min-w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-xs uppercase tracking-wider text-steel">
                  <tr>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Sync run</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Direction</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Type</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Processed</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Failures</th>
                    <th className="px-5 py-4 font-semibold whitespace-nowrap">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSyncRuns.map((syncRun) => {
                     const tone = getSyncStatusTone(syncRun.status);

                     let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                     if(tone === "success") mappedTone = "success";
                     else if(tone === "warning") mappedTone = "warning";
                     else if(tone === "danger") mappedTone = "danger";

                     return (
                      <tr
                        key={syncRun.id}
                        className={clsx(
                          "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                          selectedSyncRunId === syncRun.id ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : "bg-white",
                        )}
                        onClick={() => onSelectSyncRun(syncRun.id)}
                      >
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-ink break-all">{syncRun.id}</p>
                          <p className="mt-1 text-sm text-steel break-all">{syncRun.integrationConnectionId}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">{syncRun.direction}</td>
                        <td className="px-5 py-4 align-top text-sm text-ink">{formatSyncType(syncRun.syncType)}</td>
                        <td className="px-5 py-4 align-top">
                           <StatusChip tone={mappedTone}>
                             {formatSyncStatus(syncRun.status)}
                           </StatusChip>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">{formatNumber(syncRun.processedCount)}</td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">{formatNumber(syncRun.failureCount)}</td>
                        <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">{formatDateTime(syncRun.startedAt)}</td>
                      </tr>
                  )})}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8">
               <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                   <EmptyState title="No sync runs" message="No sync runs are currently exposed for the selected connection scope." />
               </div>
            </div>
          )}
        </SectionCard>
      </div>
    </section>
  );
};
