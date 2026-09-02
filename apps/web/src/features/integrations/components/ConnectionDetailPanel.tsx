import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildDataOpsHref } from "../../data-ops/route";
import { buildSupportActionsHref } from "../../support-actions/route";
import {
  deriveConnectionAttentionNotes,
  formatConnectionStatus,
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
  getSafeConfigFields,
} from "../selectors";
import type { ConnectionRow, IntegrationFailedRecord, IntegrationSyncRun } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { StatusChip } from "../../../components/ui/StatusChip";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";

interface ConnectionDetailPanelProps {
  connection: ConnectionRow;
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  selectedSyncRunId: string | null;
  onSelectSyncRun: (syncRunId: string | null) => void;
}

export const ConnectionDetailPanel = ({
  connection,
  syncRuns,
  failedRecords,
  selectedSyncRunId,
  onSelectSyncRun,
}: ConnectionDetailPanelProps): JSX.Element => {
  const safeConfigFields = getSafeConfigFields(connection);
  const attentionNotes = deriveConnectionAttentionNotes(connection);
  const recentSyncRuns = syncRuns.slice(0, 6);
  const unresolvedFailedRecords = failedRecords.filter((record) => record.resolvedAt === null);

  return (
    <section className="space-y-4">
      <PageHeader
      label="Connection detail"
        title="Connection detail"
        description="Review safe metadata for the selected connection, recent sync history, and the onboarding implications already persisted by the backend."
      />

      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="ui-section-label">Selected connection</p>
            <h4 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{connection.name}</h4>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-steel">
                {formatIntegrationType(connection.integrationType)}
              </span>
              <StatusChip tone={connection.status === "active" ? "success" : connection.status === "error" ? "danger" : "neutral"}>
                {formatConnectionStatus(connection.status)}
              </StatusChip>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to={buildDataOpsHref({
                integrationConnectionId: connection.id,
                ...(selectedSyncRunId ? { syncRunId: selectedSyncRunId } : {}),
              })}
              className={uiButtonSecondaryClassName}
            >
              Open data & forecast ops
            </Link>
            <Link
              to={buildSupportActionsHref({
                integrationConnectionId: connection.id,
                ...(selectedSyncRunId ? { syncRunId: selectedSyncRunId } : {}),
              })}
              className={uiButtonSecondaryClassName}
            >
              Open support actions
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
          <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
            <DataField label="Last sync" value={formatDateTime(connection.lastSyncAt)} />
          </div>
          <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
             <DataField label="Last successful sync" value={formatDateTime(connection.lastSuccessfulSyncAt)} />
          </div>
          <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
             <DataField label="Credentials ref" value={<span className="break-all">{connection.credentialsRef ?? "Not set"}</span>} />
          </div>
          <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
             <DataField label="Unresolved failed records" value={formatNumber(connection.unresolvedFailedRecordCount)} />
          </div>
        </div>

        <div className="mt-6 grid gap-6 2xl:grid-cols-2">
          <div className="rounded-radius-lg bg-slate-50 p-6 border border-slate-200/60 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-4">Safe config summary</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {safeConfigFields.map((field) => (
                <div key={field.label} className="rounded-radius-md border border-slate-200 bg-white p-4 shadow-sm">
                  <DataField label={field.label} value={field.value} />
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm leading-relaxed text-steel">
              Secret values are not managed here. The backend currently persists only a safe `credentialsRef` pointer plus the validated config metadata shown above.
            </p>
          </div>

          <div className="rounded-radius-lg bg-slate-50 p-6 border border-slate-200/60 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-4">Onboarding warnings</p>
            {attentionNotes.length > 0 ? (
              <ul className="space-y-4 text-sm text-ink">
                {attentionNotes.map((note) => (
                  <li key={note} className="rounded-radius-md border border-amber-200/50 bg-amber-50/30 p-4 shadow-sm text-amber-900 font-medium">
                    {note}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-radius-md border border-slate-200/60 bg-white p-4 shadow-sm text-sm text-steel">
                No direct onboarding warning is exposed for this connection in the current read models.
              </div>
            )}
             <p className="mt-6 text-sm leading-relaxed text-steel">
              Connection test or credential validation endpoints are not exposed by the backend today, so onboarding readiness is limited to persisted connection status, sync history, and failed-record evidence.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-radius-lg bg-slate-50 p-6 border border-slate-200/60 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-ink">Recent sync runs</p>
                <p className="mt-1 text-sm text-steel">Select a sync run to inspect or process in the control section below.</p>
              </div>
              {selectedSyncRunId ? (
                <button
                  type="button"
                  onClick={() => onSelectSyncRun(null)}
                  className={uiButtonSecondaryClassName}
                >
                  Clear sync focus
                </button>
              ) : null}
            </div>

            <div className="space-y-3">
              {recentSyncRuns.length > 0 ? (
                recentSyncRuns.map((syncRun) => {
                  const isSelected = selectedSyncRunId === syncRun.id;
                  return (
                    <button
                      key={syncRun.id}
                      type="button"
                      onClick={() => onSelectSyncRun(syncRun.id)}
                      className={`w-full rounded-radius-md border px-5 py-4 text-left transition ${
                        isSelected
                          ? "border-pine/40 bg-pine/5 shadow-sm"
                          : "border-slate-200/60 bg-white hover:border-pine/30 hover:bg-slate-50/50 shadow-sm"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{formatSyncType(syncRun.syncType)}</p>
                          <p className="mt-1 text-xs font-mono text-steel">{syncRun.id}</p>
                        </div>
                        <StatusChip tone={syncRun.status === "completed" ? "success" : syncRun.status === "failed" ? "danger" : syncRun.status === "pending" || syncRun.status === "running" ? "warning" : "neutral"}>
                          {formatSyncStatus(syncRun.status)}
                        </StatusChip>
                      </div>
                      <p className="mt-4 text-sm text-steel font-medium">
                        Started {formatDateTime(syncRun.startedAt)} <span className="mx-2 opacity-50">·</span> Failures {formatNumber(syncRun.failureCount)}
                      </p>
                    </button>
                  );
                })
              ) : (
                 <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm">
                    <EmptyState title="No sync runs" message="No sync run is currently persisted for this connection." />
                </div>
              )}
            </div>
          </div>

          <div className="rounded-radius-lg bg-slate-50 p-6 border border-slate-200/60 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-6">Failed-record snapshot</p>
            <div className="space-y-4">
              {unresolvedFailedRecords.length > 0 ? (
                unresolvedFailedRecords.slice(0, 4).map((record) => (
                  <div key={record.id} className="rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                    <p className="font-semibold text-ink">{record.recordType}</p>
                    <p className="mt-1 text-xs font-mono text-steel break-all">{record.sourceReference ?? "No source reference"}</p>
                    <div className="mt-4 rounded-radius-sm bg-rose-50/30 p-3 border border-rose-100">
                      <p className="text-sm leading-relaxed text-rose-900">{record.errorMessage}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm">
                  <EmptyState title="All clear" message="No unresolved failed records are currently linked to this connection." />
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </section>
  );
};
