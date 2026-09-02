
import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { SyncRunDetailPanel } from "../../data-ops/components/SyncRunDetailPanel";
import {
  deriveSyncActionAvailability,
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
  getSyncInputInstructions,
} from "../selectors";
import type {
  ConnectionRow,
  IntegrationActionFeedback,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  SyncRunCreateDraft,
} from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonPrimaryClassName, uiButtonSecondaryClassName, uiInputClassName } from "../../../components/ui/classes";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";

interface SyncControlSectionProps {
  connections: ConnectionRow[];
  syncRuns: IntegrationSyncRun[];
  selectedConnection: ConnectionRow | null;
  selectedSyncRunId: string | null;
  selectedSyncRun: IntegrationSyncRun | null;
  selectedSyncRunFailedRecords: IntegrationFailedRecord[];
  draft: SyncRunCreateDraft;
  feedback: IntegrationActionFeedback | null;
  createPending: boolean;
  processPending: boolean;
  onDraftChange: <K extends keyof SyncRunCreateDraft>(
    field: K,
    value: SyncRunCreateDraft[K],
  ) => void;
  onSelectSyncRun: (syncRunId: string | null) => void;
  onCreateSyncRun: () => void;
  onRequestProcessSyncRun: (syncRun: IntegrationSyncRun) => void;
}

export const SyncControlSection = ({
  connections,
  syncRuns,
  selectedConnection,
  selectedSyncRunId,
  selectedSyncRun,
  selectedSyncRunFailedRecords,
  draft,
  feedback,
  createPending,
  processPending,
  onDraftChange,
  onSelectSyncRun,
  onCreateSyncRun,
  onRequestProcessSyncRun,
}: SyncControlSectionProps): JSX.Element => {
  const draftConnection =
    connections.find((connection) => connection.id === draft.connectionId) ?? selectedConnection ?? null;
  const inputInstructions = draftConnection
    ? getSyncInputInstructions(draftConnection.integrationType)
    : null;

  return (
    <section className="space-y-4 flex flex-col items-stretch w-full">
      <PageHeader
      label="Sync control"
        title="Sync control"
        description="Create initial sync runs and process pending syncs only where the backend explicitly exposes those actions. Failed or partial runs remain replaceable only by creating a fresh sync run."
      />

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr] 2xl:grid-cols-1">
        <SectionCard>
          {feedback ? (
            <div className="mb-6 rounded-radius-md border border-slate-100 bg-slate-50 p-4 text-sm text-steel shadow-sm">
              <p className="font-semibold text-ink">{feedback.title}</p>
              <p className="mt-1.5 leading-relaxed">{feedback.message}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 pb-6 mb-6">
            <div>
              <h4 className="text-lg font-semibold text-ink">Create sync run</h4>
              <p className="mt-1 text-sm text-steel">
                Use the existing create sync endpoint to trigger initial onboarding or replacement syncs.
              </p>
            </div>
            {draftConnection ? (
              <StatusChip tone="neutral">
                {formatIntegrationType(draftConnection.integrationType)}
              </StatusChip>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-1">
            <label className="space-y-2 lg:col-span-2 2xl:col-span-1">
              <span className="text-sm font-medium text-ink">Connection</span>
              <select
                value={draft.connectionId}
                onChange={(event) => onDraftChange("connectionId", event.target.value)}
                className={`w-full ${uiInputClassName}`}
              >
                <option value="">Select a connection</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} · {formatIntegrationType(connection.integrationType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Direction</span>
              <select
                value={draft.direction}
                onChange={(event) =>
                  onDraftChange("direction", event.target.value as SyncRunCreateDraft["direction"])
                }
                className={`w-full ${uiInputClassName}`}
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-ink">Sync type</span>
              <select
                value={draft.syncType}
                onChange={(event) =>
                  onDraftChange("syncType", event.target.value as SyncRunCreateDraft["syncType"])
                }
                className={`w-full ${uiInputClassName}`}
              >
                <option value="catalog_import">Catalog import</option>
                <option value="demand_import">Demand import</option>
                <option value="inventory_import">Inventory import</option>
              </select>
            </label>
          </div>

          {inputInstructions ? (
            <label className="mt-6 block space-y-2">
              <span className="text-sm font-medium text-ink">
                {inputInstructions.label}
              </span>
              <textarea
                value={draft.inputPayloadText}
                onChange={(event) => onDraftChange("inputPayloadText", event.target.value)}
                rows={9}
                placeholder={inputInstructions.placeholder}
              className={`w-full min-h-[220px] font-mono text-xs ${uiInputClassName}`}
              />
              <p className="text-sm leading-relaxed text-steel pt-2">{inputInstructions.helper}</p>
            </label>
          ) : (
            <div className="mt-6 rounded-radius-md border border-slate-200/60 bg-slate-50 p-4 text-sm text-steel content-center text-center shadow-sm">
              <p>Select a connection before composing an initial sync input payload.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-slate-200/60 pt-6">
            <p className="max-w-md text-sm leading-relaxed text-steel">
              There is no separate connection test endpoint today. The most direct onboarding action is creating a sync run and then processing it if it stays pending.
            </p>
            <button
              type="button"
              onClick={onCreateSyncRun}
              disabled={createPending || draft.connectionId.length === 0}
              className={`${uiButtonPrimaryClassName} justify-center disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {createPending ? "Creating..." : "Create sync run"}
            </button>
          </div>
        </SectionCard>

        <div className={uiTableShellClassName}>
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sidebar-border px-6 py-5">
            <div>
               <p className="text-[10px] font-semibold uppercase tracking-wider text-steel">Recent syncs</p>
              <h4 className="mt-1 text-lg font-semibold text-ink">Current queue</h4>
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
            <div className={uiTableWrapClassName}>
              <table className={uiTableClassName}>
                <thead className={uiTableHeadClassName}>
                  <tr>
                    <th>Sync run</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Counts</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {syncRuns.slice(0, 12).map((syncRun) => {
                    const availability = deriveSyncActionAvailability(syncRun);
                    const isSelected = selectedSyncRunId === syncRun.id;

                    return (
                      <tr
                        key={syncRun.id}
                        className={[
                          uiTableRowClassName,
                          "cursor-pointer",
                          isSelected ? "bg-pine/5" : "hover:bg-slate-50/50",
                        ].join(" ")}
                        onClick={() => onSelectSyncRun(syncRun.id)}
                      >
                        <td className="px-5 py-4 align-top">
                            <p className="break-all text-sm font-semibold text-ink">{syncRun.id}</p>
                            <p className="mt-1.5 break-all text-xs font-mono text-steel" title={syncRun.integrationConnectionId}>{syncRun.integrationConnectionId}</p>
                            <p className="mt-1.5 text-xs text-steel">Started {formatDateTime(syncRun.startedAt)}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                          <p>{formatSyncType(syncRun.syncType)}</p>
                          <p className="mt-1.5 text-xs font-normal text-steel capitalize">{syncRun.direction}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-sm font-medium text-ink whitespace-nowrap">
                            <StatusChip tone={syncRun.status === "completed" ? "success" : syncRun.status === "failed" ? "danger" : syncRun.status === "pending" || syncRun.status === "running" ? "warning" : "neutral"}>
                                {formatSyncStatus(syncRun.status)}
                            </StatusChip>
                        </td>
                        <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">
                          <p>Processed <span className="font-medium ml-1 tabular-nums">{formatNumber(syncRun.processedCount)}</span></p>
                          <p className="mt-1.5 text-steel">Failed <span className="font-medium ml-1 tabular-nums">{formatNumber(syncRun.failureCount)}</span></p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {availability.canProcess ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRequestProcessSyncRun(syncRun);
                              }}
                              disabled={processPending}
                              className={`${uiButtonSecondaryClassName} text-xs py-1.5 px-3 whitespace-nowrap w-full justify-center disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              Process
                            </button>
                          ) : (
                            <span className="text-xs text-steel">{availability.reason}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10">
              <EmptyState title="No sync runs" message="No sync runs are currently exposed for the selected scope." />
            </div>
          )}
        </div>
      </div>

      {selectedSyncRun ? (
        <SyncRunDetailPanel
          syncRun={selectedSyncRun}
          failedRecords={selectedSyncRunFailedRecords}
        />
      ) : null}
    </section>
  );
};
