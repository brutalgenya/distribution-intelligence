import { Link } from "react-router-dom";

import { formatDateTime } from "../../../lib/utils/format";
import { ForecastJobDetailPanel } from "../../data-ops/components/ForecastJobDetailPanel";
import { buildDataOpsHref } from "../../data-ops/route";
import {
  formatForecastScopeType,
  parseScopeReference,
} from "../../data-ops/selectors";
import { buildInvestigationHref } from "../../investigation/route";
import {
  canProcessForecastJob,
  canRequeueForecastJob,
} from "../selectors";
import type {
  ForecastJob,
  ForecastResult,
} from "../types";
import { UnsupportedActionNotice } from "./SupportActionsStates";
import { PageHeader } from "../../../components/ui/PageHeader";
import { SectionCard } from "../../../components/ui/SectionCard";
import { EmptyState } from "../../../components/ui/EmptyState";
import { uiButtonSecondaryClassName } from "../../../components/ui/classes";

interface ForecastRecoverySectionProps {
  forecastJobs: ForecastJob[];
  selectedForecastJobId: string | null;
  selectedForecastJob: ForecastJob | null;
  forecastResults: ForecastResult[];
  isDetailLoading: boolean;
  isResultsLoading: boolean;
  detailError: string | null;
  resultsError: string | null;
  isActionPending: boolean;
  onSelectForecastJob: (forecastJobId: string | null) => void;
  onRequestRequeue: (forecastJob: ForecastJob) => void;
  onRequestProcess: (forecastJob: ForecastJob) => void;
}

const buildScopeLabel = (forecastJob: ForecastJob): string => {
  const scopeReference = parseScopeReference(forecastJob.scopeReference);

  if (forecastJob.scopeType === "sku_location") {
    return `SKU ${scopeReference?.skuId ?? "unknown"} @ ${scopeReference?.locationId ?? "unknown"}`;
  }

  if (forecastJob.scopeType === "sku") {
    return `SKU ${scopeReference?.skuId ?? "unknown"}`;
  }

  return "Organization scope";
};

export const ForecastRecoverySection = ({
  forecastJobs,
  selectedForecastJobId,
  selectedForecastJob,
  forecastResults,
  isDetailLoading,
  isResultsLoading,
  detailError,
  resultsError,
  isActionPending,
  onSelectForecastJob,
  onRequestRequeue,
  onRequestProcess,
}: ForecastRecoverySectionProps): JSX.Element => {
  const visibleForecastJobs =
    selectedForecastJobId === null
      ? forecastJobs.slice(0, 10)
      : [
          ...forecastJobs.filter((forecastJob) => forecastJob.id === selectedForecastJobId),
          ...forecastJobs.filter((forecastJob) => forecastJob.id !== selectedForecastJobId).slice(0, 9),
        ];
  const selectedScope = selectedForecastJob ? parseScopeReference(selectedForecastJob.scopeReference) : null;

  return (
    <section className="space-y-4 w-full flex flex-col items-stretch">
      <PageHeader
      label="Forecast recovery"
        title="Forecast recovery"
        description="Requeue failed forecast jobs and process queued jobs where the backend exposes those controls. Running jobs stay read-only until the worker finishes."
      />

      <SectionCard padding="none">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/60 px-6 py-5 bg-slate-50/50">
          <div>
            <p className="ui-section-label mb-1">Recoverable forecast jobs</p>
            <h4 className="text-xl font-semibold tracking-tight text-ink">Forecast queue</h4>
          </div>
          {selectedForecastJobId ? (
            <button
              type="button"
              onClick={() => onSelectForecastJob(null)}
              className={uiButtonSecondaryClassName}
            >
              Clear selected forecast job
            </button>
          ) : null}
        </div>

        {forecastJobs.length > 0 ? (
          <div className="custom-scrollbar overflow-x-auto pb-4">
            <table className="min-w-full border-collapse">
               <thead className="bg-slate-50 border-b border-slate-200/60 text-left text-[10px] uppercase font-bold tracking-widest text-steel">
                <tr>
                  <th className="px-5 py-4 whitespace-nowrap">Forecast job</th>
                  <th className="px-5 py-4 whitespace-nowrap">Status</th>
                  <th className="px-5 py-4 whitespace-nowrap">Scope</th>
                  <th className="px-5 py-4 whitespace-nowrap">Error</th>
                  <th className="px-5 py-4 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleForecastJobs.map((forecastJob) => {
                  const canProcess = canProcessForecastJob(forecastJob);
                  const canRequeue = canRequeueForecastJob(forecastJob);

                  return (
                    <tr
                      key={forecastJob.id}
                      className={[
                        "cursor-pointer transition-colors duration-200 hover:bg-slate-50",
                        selectedForecastJobId === forecastJob.id ? "bg-slate-50/80 ring-1 ring-inset ring-slate-200/60" : "bg-white",
                      ].join(" ")}
                      onClick={() => onSelectForecastJob(forecastJob.id)}
                    >
                      <td className="px-5 py-4 align-top">
                        <p className="font-semibold text-ink font-mono">{forecastJob.id}</p>
                        <p className="mt-1 text-sm text-steel whitespace-nowrap">Created {formatDateTime(forecastJob.createdAt)}</p>
                      </td>
                      <td className="px-5 py-4 align-top text-sm font-medium text-ink">{forecastJob.status}</td>
                      <td className="px-5 py-4 align-top text-sm text-ink break-all max-w-xs">
                        <p className="font-medium text-ink">{formatForecastScopeType(forecastJob.scopeType)}</p>
                        <p className="mt-1 text-steel">{buildScopeLabel(forecastJob)}</p>
                      </td>
                      <td className="max-w-sm px-5 py-4 align-top text-sm leading-relaxed text-steel">
                        {forecastJob.errorMessage ?? "No failure reason persisted."}
                      </td>
                      <td className="px-5 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {canProcess ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRequestProcess(forecastJob);
                              }}
                              disabled={isActionPending}
                              className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              Process now
                            </button>
                          ) : null}
                          {canRequeue ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onRequestRequeue(forecastJob);
                              }}
                              disabled={isActionPending}
                              className={`${uiButtonSecondaryClassName} disabled:opacity-60 disabled:cursor-not-allowed`}
                            >
                              Requeue
                            </button>
                          ) : null}
                          {!canProcess && !canRequeue ? <span className="text-sm text-steel opacity-80">No action</span> : null}
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
                 <EmptyState title="No forecast jobs" message="No forecast jobs currently require support intervention." />
             </div>
          </div>
        )}
      </SectionCard>

      {selectedForecastJobId ? (
        isDetailLoading && selectedForecastJob === null ? (
          <div className="rounded-radius-md border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="h-6 w-56 animate-pulse rounded-radius-full bg-slate-200" />
            <div className="mt-5 h-36 animate-pulse rounded-radius-md bg-slate-100" />
          </div>
        ) : detailError ? (
          <UnsupportedActionNotice title="Forecast job detail unavailable" message={detailError} />
        ) : resultsError ? (
          <UnsupportedActionNotice title="Forecast results unavailable" message={resultsError} />
        ) : selectedForecastJob ? (
          <div className="space-y-4">
             <div className="flex flex-wrap gap-3 mt-4">
              <Link
                to={buildDataOpsHref({
                  forecastJobId: selectedForecastJob.id,
                  ...(selectedScope?.skuId ? { skuId: selectedScope.skuId } : {}),
                  ...(selectedScope?.locationId ? { locationId: selectedScope.locationId } : {}),
                })}
                className={uiButtonSecondaryClassName}
              >
                Open data & forecast ops
              </Link>
              {selectedScope?.skuId && selectedScope?.locationId ? (
                <Link
                  to={buildInvestigationHref(selectedScope.skuId, selectedScope.locationId)}
                  className={uiButtonSecondaryClassName}
                >
                  Investigate SKU/location
                </Link>
              ) : null}
            </div>

            {isResultsLoading ? (
               <div className="rounded-radius-md border border-slate-200/60 bg-white p-6 shadow-sm">
                 <div className="h-6 w-56 animate-pulse rounded-radius-full bg-slate-200" />
                 <div className="mt-5 h-36 animate-pulse rounded-radius-md bg-slate-100" />
               </div>
            ) : (
              <ForecastJobDetailPanel forecastJob={selectedForecastJob} results={forecastResults} />
            )}
          </div>
        ) : null
      ) : null}
    </section>
  );
};
