import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildIntegrationsHref } from "../../integrations/route";
import {
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
} from "../../integrations/selectors";
import type { DataReadiness } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";
import { DataField } from "../../../components/ui/DataField";
import { EmptyState } from "../../../components/ui/EmptyState";

interface DataReadinessSectionProps {
  data: DataReadiness;
}

export const DataReadinessSection = ({ data }: DataReadinessSectionProps): JSX.Element => {
  const activeConnections = data.connections.filter((connection) => connection.status === "active");
  const latestSuccessfulSync =
    data.syncRuns
      .filter((syncRun) => syncRun.status === "completed")
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.startedAt).getTime() -
          new Date(left.completedAt ?? left.startedAt).getTime(),
      )[0] ?? null;
  const latestSyncIssue =
    data.syncRuns
      .filter((syncRun) => syncRun.status === "failed" || syncRun.status === "partial")
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.startedAt).getTime() -
          new Date(left.completedAt ?? left.startedAt).getTime(),
      )[0] ?? null;

  return (
    <section className="space-y-4 w-full">
      <PageHeader
      label="Data readiness"
        title="Data readiness"
        description="Confirm whether the tenant has enough inbound data evidence to treat the platform as activated, using connection state, sync history, and unresolved failed-record blockers."
      />

      <div className="grid gap-4 2xl:grid-cols-[0.88fr_1.12fr]">
        <SectionCard>
          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <div className="rounded-radius-md bg-slate-50/50 p-5 border border-slate-100">
               <DataField
                 label="Connections"
                 value={
                   <div>
                     <span className="text-2xl font-semibold tracking-tight text-ink mr-2">{formatNumber(data.connections.length)}</span>
                     <span className="text-sm font-medium text-steel">{formatNumber(activeConnections.length)} active</span>
                   </div>
                 }
               />
            </div>
             <div className="rounded-radius-md bg-slate-50/50 p-5 border border-slate-100">
               <DataField
                 label="Failed records"
                 value={
                   <div>
                     <span className="text-2xl font-semibold tracking-tight text-ink mr-2">{formatNumber(data.failedRecords.length)}</span>
                     <span className="text-sm font-medium text-steel">Unresolved blocks</span>
                   </div>
                 }
               />
            </div>
          </div>

          <div className="rounded-radius-lg bg-slate-50 p-6 border border-slate-200/60 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wider text-ink mb-6">Latest sync evidence</p>
            <div className="space-y-4">
              <div className="rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                <DataField
                   label="Latest successful sync"
                   value={latestSuccessfulSync
                        ? `${formatSyncType(latestSuccessfulSync.syncType)} · ${formatDateTime(latestSuccessfulSync.completedAt)}`
                        : "No completed sync run is currently persisted."}
                />
              </div>
              <div className="rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                <DataField
                   label="Latest sync issue"
                   value={latestSyncIssue
                        ? `${formatSyncType(latestSyncIssue.syncType)} · ${formatSyncStatus(latestSyncIssue.status)}`
                        : "No failed or partial sync issue is currently exposed."}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-ink">Connection evidence</p>
              <p className="mt-1.5 text-sm text-steel">
                The activation workspace does not invent readiness outside the persisted integration records.
              </p>
            </div>
            <Link
              to={buildIntegrationsHref()}
              className={`${uiButtonSecondaryClassName} whitespace-nowrap`}
            >
              Open data connections
            </Link>
          </div>

          <div className="mt-2 space-y-3">
            {data.connections.length > 0 ? (
              data.connections.slice(0, 6).map((connection) => (
                <div key={connection.id} className="rounded-radius-md border border-slate-200/60 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-ink">{connection.name}</p>
                      <p className="mt-1 text-sm text-steel">{formatIntegrationType(connection.integrationType)}</p>
                    </div>
                    <StatusChip tone={connection.status === "active" ? "success" : connection.status === "error" ? "danger" : "neutral"}>
                      {connection.status}
                    </StatusChip>
                  </div>
                  <p className="text-sm text-steel font-medium">
                    Last sync {formatDateTime(connection.lastSyncAt)}
                  </p>
                </div>
              ))
            ) : (
                <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                    <EmptyState title="No connections" message="No integration connections are currently persisted for this tenant." />
                </div>
            )}
          </div>
        </SectionCard>
      </div>
    </section>
  );
};
