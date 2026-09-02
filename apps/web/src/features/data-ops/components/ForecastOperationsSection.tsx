import clsx from "clsx";

import { formatDateTime } from "../../../lib/utils/format";
import { formatForecastScopeType } from "../selectors";
import type { ForecastJobRow } from "../types";
import { SectionCard } from "../../../components/ui/SectionCard";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";
import { EmptyState } from "../../../components/ui/EmptyState";
import { StatusChip } from "../../../components/ui/StatusChip";

interface ForecastOperationsSectionProps {
  forecastJobs: ForecastJobRow[];
  selectedForecastJobId: string | null;
  onSelectForecastJob: (forecastJobId: string | null) => void;
}

export const ForecastOperationsSection = ({
  forecastJobs,
  selectedForecastJobId,
  onSelectForecastJob,
}: ForecastOperationsSectionProps): JSX.Element => {
  const visibleForecastJobs =
    selectedForecastJobId === null
      ? forecastJobs.slice(0, 12)
      : [
          ...forecastJobs.filter((job) => job.id === selectedForecastJobId),
          ...forecastJobs.filter((job) => job.id !== selectedForecastJobId).slice(0, 11),
        ];

  return (
    <SectionCard padding="none">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
        <div>
        <p className="ui-section-label mb-1">Forecast jobs</p>
           <h4 className="text-xl font-semibold tracking-tight text-ink">Forecast operations</h4>
        </div>
        {selectedForecastJobId ? (
          <button
            type="button"
            onClick={() => onSelectForecastJob(null)}
            className={`${uiButtonSecondaryClassName}`}
          >
            Clear selected job
          </button>
        ) : null}
      </div>

      {forecastJobs.length > 0 ? (
        <div className="custom-scrollbar overflow-x-auto pb-4">
          <table className="min-w-full border-collapse">
             <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-xs uppercase tracking-wider text-steel">
              <tr>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Forecast job</th>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Status</th>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Scope</th>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Model</th>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Created</th>
                <th className="px-5 py-4 font-semibold whitespace-nowrap">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleForecastJobs.map((job) => {
                let mappedTone: "success"|"warning"|"danger"|"neutral" = "neutral";
                if(job.status === "completed") mappedTone = "success";
                else if(job.status === "failed") mappedTone = "danger";
                else mappedTone = "warning";

                return (
                <tr
                  key={job.id}
                  className={clsx(
                    "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                    selectedForecastJobId === job.id ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : "bg-white",
                  )}
                  onClick={() => onSelectForecastJob(job.id)}
                >
                  <td className="px-5 py-4 align-top">
                    <p className="font-semibold text-ink font-mono">{job.id}</p>
                    <p className="mt-1 text-sm text-steel">
                      {job.isContextMatch ? "Matches current context" : "Recent tenant job"}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                      <StatusChip tone={mappedTone}>{job.status}</StatusChip>
                  </td>
                  <td className="px-5 py-4 align-top text-sm">
                    <p className="font-medium text-ink">{formatForecastScopeType(job.scopeType)}</p>
                    <p className="mt-1 text-steel break-all max-w-xs">{job.scopeLabel}</p>
                  </td>
                  <td className="px-5 py-4 align-top text-sm font-medium text-ink">{job.modelType}</td>
                  <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">{formatDateTime(job.createdAt)}</td>
                  <td className="px-5 py-4 align-top text-sm text-ink whitespace-nowrap">{formatDateTime(job.completedAt)}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8">
           <div className="bg-slate-50 rounded-radius-md p-6 border border-slate-200/60 shadow-sm text-center">
               <EmptyState title="No forecast jobs" message="No forecast jobs are currently exposed for this tenant or selected context." />
           </div>
        </div>
      )}
    </SectionCard>
  );
};
