import { Link } from "react-router-dom";

import { formatDateTime, formatNumber } from "../../../lib/utils/format";
import { buildSupportActionsHref } from "../../support-actions/route";
import { formatForecastScopeType, parseScopeReference } from "../selectors";
import type { ForecastJob, ForecastResult } from "../types";
import { DataField } from "../../../components/ui/DataField";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";

interface ForecastJobDetailPanelProps {
  forecastJob: ForecastJob;
  results: ForecastResult[];
}

const renderJson = (value: unknown): string => JSON.stringify(value, null, 2);

export const ForecastJobDetailPanel = ({
  forecastJob,
  results,
}: ForecastJobDetailPanelProps): JSX.Element => (
  <div className="rounded-radius-lg border border-slate-200/60 bg-white p-6 shadow-sm overflow-hidden mt-4">
    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between border-b border-slate-200/60 pb-5 mb-5">
      <div>
        <p className="ui-section-label mb-1">Forecast job detail</p>
        <h5 className="text-2xl font-semibold tracking-tight text-ink font-mono">{forecastJob.id}</h5>
        <div className="mt-2 flex items-center gap-2">
           <span className="rounded-radius-sm bg-slate-100 px-2 py-0.5 text-xs font-semibold text-ink">{formatForecastScopeType(forecastJob.scopeType)}</span>
           <span className="text-sm text-steel opacity-40">·</span>
           <span className="text-sm font-medium text-ink">{forecastJob.status}</span>
        </div>
      </div>
      <div className="flex flex-col items-start md:items-end md:text-right text-sm text-steel gap-1">
        <p>Started <span className="font-medium text-ink">{formatDateTime(forecastJob.startedAt)}</span></p>
        <p>Completed <span className="font-medium text-ink">{formatDateTime(forecastJob.completedAt)}</span></p>
        <Link
          to={buildSupportActionsHref({
            forecastJobId: forecastJob.id,
            skuId: parseScopeReference(forecastJob.scopeReference)?.skuId ?? null,
            locationId: parseScopeReference(forecastJob.scopeReference)?.locationId ?? null,
          })}
          className={`mt-2 ${uiButtonSecondaryClassName}`}
        >
          Open support actions
        </Link>
      </div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Horizon" value={<><span className="text-xl font-bold tracking-tight text-ink mr-1">{formatNumber(forecastJob.horizonDays)}</span> days</>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Model" value={<span className="font-semibold text-ink">{forecastJob.modelType}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Requested by" value={<span className="font-semibold text-ink break-all">{forecastJob.requestedByUserId}</span>} />
       </div>
       <div className="rounded-radius-md bg-slate-50/50 p-4 border border-slate-100">
           <DataField label="Results" value={<span className="text-xl font-bold tracking-tight text-ink">{formatNumber(results.length)}</span>} />
       </div>
    </div>

    {forecastJob.errorMessage ? (
      <div className="mb-6 rounded-radius-md border border-rose-200/50 bg-rose-50/50 p-4 text-sm text-rose-800 shadow-sm">
        <p className="font-semibold">Forecast job error</p>
        <p className="mt-2 leading-relaxed opacity-90">{forecastJob.errorMessage}</p>
      </div>
    ) : null}

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-radius-md border border-slate-100 bg-slate-50/50 p-5 overflow-hidden">
        <h4 className="ui-section-label mb-4">Forecast results</h4>
        {results.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto rounded-radius-sm border border-slate-200/60 bg-white">
            <table className="min-w-full border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-[10px] uppercase font-bold tracking-widest text-steel">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Qty</th>
                  <th className="px-4 py-3 whitespace-nowrap">Low</th>
                  <th className="px-4 py-3 whitespace-nowrap">High</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.slice(0, 14).map((result) => (
                  <tr key={result.id} className="text-sm font-medium text-ink bg-white transition-colors duration-200 hover:bg-slate-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-steel">{formatDateTime(result.forecastDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatNumber(result.forecastQty)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatNumber(result.confidenceLow)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatNumber(result.confidenceHigh)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
             <div className="bg-white rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
                 <EmptyState title="No results" message="No forecast results are currently persisted for this job." />
             </div>
        )}
      </div>

      <details className="group rounded-radius-md border border-slate-200/60 bg-slate-50 shadow-sm overflow-hidden h-fit">
         <summary className="cursor-pointer list-none p-4 font-semibold text-ink transition-colors group-hover:bg-slate-100/50">Input snapshot payload</summary>
         <div className="px-5 pb-5">
            <pre className="overflow-x-auto rounded-radius-sm bg-slate-900 p-4 text-xs leading-relaxed text-slate-300 font-mono shadow-inner border border-slate-950">
              {renderJson(forecastJob.inputSnapshot)}
            </pre>
         </div>
      </details>
    </div>
  </div>
);
