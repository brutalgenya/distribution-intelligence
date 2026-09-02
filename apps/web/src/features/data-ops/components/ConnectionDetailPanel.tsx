import { formatDateTime } from "../../../lib/utils/format";
import { formatIntegrationType } from "../selectors";
import type { IntegrationConnection } from "../types";
import { DataField } from "../../../components/ui/DataField";
import { StatusChip } from "../../../components/ui/StatusChip";

interface ConnectionDetailPanelProps {
  connection: IntegrationConnection & {
    lastSuccessfulSyncAt?: string | null;
  };
}

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const ConnectionDetailPanel = ({
  connection,
}: ConnectionDetailPanelProps): JSX.Element => {
   let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
   if(connection.status === "active") mappedTone = "success";
   else if(connection.status === "error") mappedTone = "danger";

  return (
  <div className="rounded-radius-lg border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden mt-4">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/60 pb-5 mb-5">
      <div>
        <p className="ui-section-label mb-1">Connection detail</p>
        <h5 className="text-2xl font-semibold tracking-tight text-ink">{connection.name}</h5>
        <p className="mt-2 text-sm text-steel">{formatIntegrationType(connection.integrationType)}</p>
      </div>
      <StatusChip tone={mappedTone}>
        {connection.status}
      </StatusChip>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
          <DataField label="Last sync" value={formatDateTime(connection.lastSyncAt)} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
          <DataField label="Last successful sync" value={formatDateTime(connection.lastSuccessfulSyncAt) || "Never"} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
          <DataField label="Credentials ref" value={<span className="break-all">{connection.credentialsRef ?? "Not exposed"}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
          <DataField label="Updated" value={formatDateTime(connection.updatedAt)} />
       </div>
    </div>

    <details className="group rounded-radius-md border border-slate-200/60 bg-slate-50 shadow-sm overflow-hidden">
      <summary className="cursor-pointer list-none p-4 font-semibold text-ink transition-colors group-hover:bg-slate-100/50">Connection config representation</summary>
      <div className="px-5 pb-5">
          <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
            {renderJson(connection.configJson)}
          </pre>
      </div>
    </details>
  </div>
)};
