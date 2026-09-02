
import { formatDateTime } from "../../../lib/utils/format";
import {
  formatConnectionStatus,
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
} from "../selectors";
import type { ConnectionRow, IntegrationConnectionFilters } from "../types";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonPrimaryClassName, uiInputClassName } from "../../../components/ui/classes";
import {
  uiTableClassName,
  uiTableHeadClassName,
  uiTableRowClassName,
  uiTableShellClassName,
  uiTableWrapClassName,
} from "../../../components/ui/classes";
import { StatusChip } from "../../../components/ui/StatusChip";

interface ConnectionListSectionProps {
  rows: ConnectionRow[];
  filters: IntegrationConnectionFilters;
  selectedConnectionId: string | null;
  onFiltersChange: (filters: IntegrationConnectionFilters) => void;
  onSelectConnection: (integrationConnectionId: string | null) => void;
  onCreateNew: () => void;
}

export const ConnectionListSection = ({
  rows,
  filters,
  selectedConnectionId,
  onFiltersChange,
  onSelectConnection,
  onCreateNew,
}: ConnectionListSectionProps): JSX.Element => (
  <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <PageHeader
      label="Connections"
        title="Connections"
        description="Review tenant-scoped data connections, filter by the server-backed status and integration type contracts, and pick a connection to configure or onboard."
      />

      <button
        type="button"
        onClick={onCreateNew}
        className={`${uiButtonPrimaryClassName} whitespace-nowrap`}
      >
        Create connection
      </button>
    </div>

    <SectionCard className="p-0 overflow-hidden">
      <div className="grid gap-3 border-b border-slate-200/60 bg-slate-50/50 px-5 py-4 xl:grid-cols-[0.9fr_0.8fr_1.2fr]">
        <label className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-steel">Connection status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                status: event.target.value as IntegrationConnectionFilters["status"],
              })
            }
            className={`w-full ${uiInputClassName}`}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="error">Error</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-steel">Integration type</span>
          <select
            value={filters.integrationType}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                integrationType: event.target.value as IntegrationConnectionFilters["integrationType"],
              })
            }
            className={`w-full ${uiInputClassName}`}
          >
            <option value="all">All types</option>
            <option value="erp">ERP</option>
            <option value="wms">WMS</option>
            <option value="csv_import">CSV import</option>
            <option value="manual_bridge">Manual bridge</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-steel">Search</span>
          <input
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                search: event.target.value,
              })
            }
            placeholder="Filter by connection name, id, or credentials ref"
            className={`w-full ${uiInputClassName}`}
          />
        </label>
      </div>

      {rows.length > 0 ? (
        <div className={uiTableWrapClassName}>
          <table className={uiTableClassName}>
            <thead className={uiTableHeadClassName}>
              <tr>
                <th>Connection</th>
                <th>Status</th>
                <th>Latest sync</th>
                <th>Last successful sync</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = selectedConnectionId === row.id;

                return (
                  <tr
                    key={row.id}
                    className={[
                      uiTableRowClassName,
                      "cursor-pointer",
                      isSelected ? "bg-pine/5" : "hover:bg-slate-50/50",
                    ].join(" ")}
                    onClick={() => onSelectConnection(row.id)}
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-semibold text-ink">{row.name}</p>
                      <p className="mt-1 text-sm text-steel">{formatIntegrationType(row.integrationType)}</p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-steel">{row.id}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-sm font-medium text-ink">
                      <StatusChip tone={row.status === "active" ? "success" : row.status === "error" ? "danger" : "neutral"}>
                        {formatConnectionStatus(row.status)}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-ink">
                      {row.latestSyncRun ? (
                        <>
                          <p className="font-medium">{formatSyncType(row.latestSyncRun.syncType)}</p>
                          <p className="mt-1 text-steel">
                            {formatSyncStatus(row.latestSyncRun.status)} · {formatDateTime(row.latestSyncRun.startedAt)}
                          </p>
                        </>
                      ) : (
                        <span className="text-steel italic">No sync run yet</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top text-sm text-ink tabular-nums">
                      {formatDateTime(row.lastSuccessfulSyncAt)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {row.unresolvedFailedRecordCount > 0 ? (
                        <StatusChip tone="warning">
                          {row.unresolvedFailedRecordCount} unresolved
                        </StatusChip>
                      ) : (
                        <span className="text-sm text-steel">No unresolved records</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-10 border-t border-slate-200/60 bg-white">
          <EmptyState title="No connections found" message="No integration connections match the current filters. Search is client-side refinement over the loaded connection list." />
        </div>
      )}
    </SectionCard>
  </section>
);
