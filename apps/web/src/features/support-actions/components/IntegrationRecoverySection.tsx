import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { SyncRunDetailPanel } from "../../data-ops/components/SyncRunDetailPanel";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildIntegrationsHref } from "../../integrations/route";
import {
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
} from "../../data-ops/selectors";
import {
  canProcessSyncRun,
  canTriggerReplacementSync,
} from "../selectors";
import type {
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
} from "../types";
import { UnsupportedActionNotice } from "./SupportActionsStates";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";

interface IntegrationRecoverySectionProps {
  connections: IntegrationConnection[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  selectedConnectionId: string | null;
  selectedSyncRunId: string | null;
  selectedSyncRun: IntegrationSyncRun | null;
  isDetailLoading: boolean;
  detailError: string | null;
  isActionPending: boolean;
  onSelectConnection: (integrationConnectionId: string | null) => void;
  onSelectSyncRun: (syncRunId: string | null) => void;
  onProcessSyncRun: (syncRun: IntegrationSyncRun) => void;
  onTriggerReplacementSync: (syncRun: IntegrationSyncRun) => void;
}

export const IntegrationRecoverySection = ({
  connections,
  syncRuns,
  failedRecords,
  selectedConnectionId,
  selectedSyncRunId,
  selectedSyncRun,
  isDetailLoading,
  detailError,
  isActionPending,
  onSelectConnection,
  onSelectSyncRun,
  onProcessSyncRun,
  onTriggerReplacementSync,
}: IntegrationRecoverySectionProps): JSX.Element => {
  const visibleSyncRuns =
    selectedSyncRunId === null
      ? syncRuns.slice(0, 10)
      : [
          ...syncRuns.filter((syncRun) => syncRun.id === selectedSyncRunId),
          ...syncRuns.filter((syncRun) => syncRun.id !== selectedSyncRunId).slice(0, 9),
        ];
  const selectedSyncFailedRecords = selectedSyncRun
    ? failedRecords.filter((record) => record.syncRunId === selectedSyncRun.id)
    : [];

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Data recovery"
        title="Integration recovery"
        description="Process pending syncs and trigger replacement sync runs where the backend exposes those controls. Failed records stay visible here, but replay and resolve actions are not exposed yet."
      />

      <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] 2xl:grid-cols-1">
        <SectionCard padding="none">
          <div className="border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
            <p className="ui-section-label mb-1">Connections</p>
            <h4 className="text-xl font-semibold tracking-tight text-ink">Integration connections</h4>
          </div>

          <div className="space-y-3 px-5 py-5">
            <button
              type="button"
              onClick={() => onSelectConnection(null)}
              className={[
                "w-full rounded-radius-md border px-4 py-3 text-left transition-colors duration-200",
                selectedConnectionId === null
                  ? "border-sky-200/50 bg-sky-50/50 shadow-sm ring-1 ring-inset ring-sky-200/50"
                  : "border-slate-200/60 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <p className="text-sm font-semibold text-ink">All connections</p>
              <p className="mt-1 text-sm text-steel">Show the full recoverable sync queue.</p>
            </button>

            {connections.length > 0 ? (
              connections.map((connection) => {
                 let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                 if(connection.status === "active") mappedTone = "success";
                 else if(connection.status === "error") mappedTone = "danger";

                 return (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => onSelectConnection(connection.id)}
                 className={[
                    "w-full rounded-radius-md border px-4 py-3 text-left transition-colors duration-200",
                    selectedConnectionId === connection.id
                      ? "border-sky-200/50 bg-sky-50/50 shadow-sm ring-1 ring-inset ring-sky-200/50"
                      : "border-slate-200/60 bg-white hover:bg-slate-50",
                  ].join(" ")}
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
                  <p className="mt-3 text-sm text-steel">Last sync <span className="font-medium text-ink">{formatDateTime(connection.lastSyncAt)}</span></p>
                </button>
              )})
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
              <p className="ui-section-label mb-1">Recoverable sync runs</p>
              <h4 className="text-xl font-semibold tracking-tight text-ink">Sync queue</h4>
            </div>
            {selectedSyncRunId ? (
              <button
                type="button"
                onClick={() => onSelectSyncRun(null)}
                className={uiButtonSecondaryClassName}
              >
                Clear selected sync
              </button>
            ) : null}
          </div>

          {syncRuns.length > 0 ? (
            <div className="custom-scrollbar overflow-x-auto pb-4">
              <table className="min-w-full border-collapse">
                 <thead className="bg-slate-50 text-left text-[10px] uppercase font-bold tracking-widest text-steel">
                  <tr>
                    <th className="px-5 py-4 whitespace-nowrap">Sync run</th>
                    <th className="px-5 py-4 whitespace-nowrap">Type</th>
                    <th className="px-5 py-4 whitespace-nowrap">Status</th>
                    <th className="px-5 py-4 whitespace-nowrap">Counts</th>
                    <th className="px-5 py-4 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleSyncRuns.map((syncRun) => {
                    const canProcess = canProcessSyncRun(syncRun);
                    const canReplace = canTriggerReplacementSync(syncRun);

                    return (
                      <tr
                        key={syncRun.id}
                        className={[
                          "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                          selectedSyncRunId === syncRun.id ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : "bg-white",
                        ].join(" ")}
                        onClick={() => onSelectSyncRun(syncRun.id)}
                      >
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-ink break-all font-mono">{syncRun.id}</p>
                          <p className="mt-1 text-sm text-steel break-all">{syncRun.integrationConnectionId}</p>
                          <p className="mt-1 text-sm text-steel whitespace-nowrap">Started {formatDateTime(syncRun.startedAt)}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                          <p>{formatSyncType(syncRun.syncType)}</p>
                          <p className="mt-1 text-steel font-normal">{syncRun.direction}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">{formatSyncStatus(syncRun.status)}</td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                          <p>Processed {formatNumber(syncRun.processedCount)}</p>
                          <p className="mt-1 text-rose-700">Failed {formatNumber(syncRun.failureCount)}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {canProcess ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onProcessSyncRun(syncRun);
                                }}
                                disabled={isActionPending}
                                className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                Process sync
                              </button>
                            ) : null}
                            {canReplace ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onTriggerReplacementSync(syncRun);
                                }}
                                disabled={isActionPending}
                                className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                Trigger replacement
                              </button>
                            ) : null}
                            {!canProcess && !canReplace ? <span className="text-sm text-steel opacity-80">No action</span> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
             <div className="p-8">
               <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                  <EmptyState title="No sync runs" message="No recoverable sync runs are currently exposed for this scope." />
               </div>
            </div>
          )}
        </SectionCard>
      </div>

      {selectedSyncRunId ? (
        isDetailLoading && selectedSyncRun === null ? (
          <div className="rounded-radius-md border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="h-6 w-56 animate-pulse rounded-radius-full bg-slate-200" />
            <div className="mt-5 h-36 animate-pulse rounded-radius-md bg-slate-100" />
          </div>
        ) : detailError ? (
          <UnsupportedActionNotice title="Sync run detail unavailable" message={detailError} />
        ) : selectedSyncRun ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 pt-4">
              <Link
                to={buildIntegrationsHref({
                  integrationConnectionId: selectedSyncRun.integrationConnectionId,
                  syncRunId: selectedSyncRun.id,
                })}
               className={uiButtonSecondaryClassName}
              >
                Open data connections
              </Link>
              <Link
                to={buildDataOpsHref({
                  integrationConnectionId: selectedSyncRun.integrationConnectionId,
                  syncRunId: selectedSyncRun.id,
                })}
               className={uiButtonSecondaryClassName}
              >
                Open data & forecast ops
              </Link>
            </div>
            <SyncRunDetailPanel syncRun={selectedSyncRun} failedRecords={selectedSyncFailedRecords} />
            {selectedSyncFailedRecords.length > 0 ? (
              <UnsupportedActionNotice
                title="Failed-record replay is not exposed"
                message="The backend exposes failed-record inspection today, but it does not yet expose replay, resolve, or reprocess mutations for those records."
              />
            ) : null}
          </div>
        ) : null
      ) : null}
    </section>
  );
};
