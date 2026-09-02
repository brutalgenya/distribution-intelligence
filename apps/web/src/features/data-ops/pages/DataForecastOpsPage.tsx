import { useMemo } from "react";
import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";

import { uiButtonSecondaryClassName, uiPageStackClassName } from "../../../components/ui/classes";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { isApiError } from "../../../lib/api/errors";
import { buildIntegrationsHref } from "../../integrations/route";
import { buildInvestigationHref } from "../../investigation/route";
import { useSession } from "../../session/SessionProvider";
import { AnomalySignalsSection } from "../components/AnomalySignalsSection";
import { ConnectionDetailPanel } from "../components/ConnectionDetailPanel";
import { DataOpsEmptyState, DataOpsErrorNotice, DataOpsSectionSkeleton } from "../components/DataOpsStates";
import { DemandFreshnessSection } from "../components/DemandFreshnessSection";
import { DiagnosticsSection } from "../components/DiagnosticsSection";
import { ForecastJobDetailPanel } from "../components/ForecastJobDetailPanel";
import { ForecastOperationsSection } from "../components/ForecastOperationsSection";
import { IntegrationSyncSection } from "../components/IntegrationSyncSection";
import { OperationalHealthSection } from "../components/OperationalHealthSection";
import { SyncRunDetailPanel } from "../components/SyncRunDetailPanel";
import {
  useAnomalyScores,
  useDemandEvidence,
  useForecastJobDetail,
  useForecastJobs,
  useForecastResults,
  useIntegrationConnectionDetail,
  useIntegrationConnections,
  useIntegrationFailedRecords,
  useIntegrationSyncRunDetail,
  useIntegrationSyncRuns,
  useSalesImportRuns,
  useSupportAiRuns,
  useWorkerStatus,
} from "../hooks";
import {
  buildConnectionRows,
  buildForecastJobRows,
  deriveHealthSummary,
  deriveLatestDiagnosticTimestamp,
  getContextSummary,
  matchDemandEvidence,
  selectRelevantForecastJobRows,
  selectRelevantForecastResults,
} from "../selectors";
import type { DataOpsContextParams } from "../types";

const detailPlaceholderClassName =
  "rounded-radius-md border border-slate-200/60 bg-slate-50 px-6 py-6 text-center text-sm text-steel shadow-sm mt-4";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

const readContextParams = (searchParams: URLSearchParams): DataOpsContextParams => ({
  skuId: searchParams.get("skuId"),
  locationId: searchParams.get("locationId"),
  forecastJobId: searchParams.get("forecastJobId"),
  integrationConnectionId: searchParams.get("integrationConnectionId"),
  syncRunId: searchParams.get("syncRunId"),
});

const DetailPlaceholder = ({
  title,
  message,
}: {
  title: string;
  message: string;
}): JSX.Element => (
  <div className={detailPlaceholderClassName}>
    <p className="text-sm font-semibold text-ink">{title}</p>
    <p className="mt-2 leading-6 text-steel">{message}</p>
  </div>
);

export const DataForecastOpsPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useMemo(() => readContextParams(searchParams), [searchParams]);

  const connectionsQuery = useIntegrationConnections();
  const connectionDetailQuery = useIntegrationConnectionDetail(context.integrationConnectionId);
  const syncRunsQuery = useIntegrationSyncRuns({
    integrationConnectionId: context.integrationConnectionId,
  });
  const syncRunDetailQuery = useIntegrationSyncRunDetail(context.syncRunId);
  const failedRecordsQuery = useIntegrationFailedRecords({ resolved: false });
  const forecastJobsQuery = useForecastJobs();
  const forecastJobDetailQuery = useForecastJobDetail(context.forecastJobId);
  const forecastResultsQuery = useForecastResults(context.forecastJobId, context.forecastJobId !== null);
  const salesImportRunsQuery = useSalesImportRuns();
  const demandEvidenceQuery = useDemandEvidence(context);
  const aiRunsQuery = useSupportAiRuns();
  const anomaliesQuery = useAnomalyScores(context);
  const workerStatusQuery = useWorkerStatus();

  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];
  const forecastJobs = forecastJobsQuery.data ?? [];
  const salesImportRuns = salesImportRunsQuery.data ?? [];
  const customerOrders = demandEvidenceQuery.data ?? [];
  const workerStatuses = workerStatusQuery.data ?? [];
  const anomalies = anomaliesQuery.data ?? [];
  const aiRuns = useMemo(
    () =>
      [...(aiRunsQuery.data ?? [])]
        .filter((run) => run.runType !== "decision_explanation")
        .sort(
          (left, right) =>
            new Date(right.completedAt ?? right.createdAt).getTime() -
            new Date(left.completedAt ?? left.createdAt).getTime(),
        ),
    [aiRunsQuery.data],
  );

  const connectionRows = useMemo(
    () => buildConnectionRows(connections, syncRuns),
    [connections, syncRuns],
  );
  const forecastJobRows = useMemo(
    () => buildForecastJobRows(forecastJobs, context),
    [context, forecastJobs],
  );
  const visibleForecastJobs = useMemo(
    () =>
      context.forecastJobId
        ? forecastJobRows
        : selectRelevantForecastJobRows(forecastJobRows, context),
    [context, forecastJobRows],
  );
  const matchedDemandEvidence = useMemo(
    () => matchDemandEvidence(customerOrders, context),
    [context, customerOrders],
  );

  const selectedConnection =
    connectionDetailQuery.data ??
    connectionRows.find((connection) => connection.id === context.integrationConnectionId) ??
    null;
  const selectedSyncRun =
    syncRunDetailQuery.data ?? syncRuns.find((syncRun) => syncRun.id === context.syncRunId) ?? null;
  const selectedSyncRunFailedRecords = selectedSyncRun
    ? failedRecords.filter((record) => record.syncRunId === selectedSyncRun.id)
    : [];
  const selectedForecastJob =
    forecastJobDetailQuery.data ??
    forecastJobs.find((forecastJob) => forecastJob.id === context.forecastJobId) ??
    null;
  const selectedForecastResults = useMemo(
    () => selectRelevantForecastResults(forecastResultsQuery.data ?? [], context),
    [context, forecastResultsQuery.data],
  );

  const diagnosticsFailedRecords = useMemo(() => {
    if (context.syncRunId) {
      return failedRecords.filter((record) => record.syncRunId === context.syncRunId);
    }

    if (context.integrationConnectionId) {
      return failedRecords.filter(
        (record) => record.integrationConnectionId === context.integrationConnectionId,
      );
    }

    return failedRecords;
  }, [context.integrationConnectionId, context.syncRunId, failedRecords]);

  const healthSummary = useMemo(
    () =>
      deriveHealthSummary({
        connections,
        syncRuns,
        failedRecords,
        forecastJobs: forecastJobRows,
        aiRuns,
        salesImportRuns,
        workerStatus: workerStatuses,
      }),
    [aiRuns, connections, failedRecords, forecastJobRows, salesImportRuns, syncRuns, workerStatuses],
  );

  const freshnessAt = useMemo(
    () =>
      deriveLatestDiagnosticTimestamp({
        syncRuns,
        forecastJobs,
        aiRuns,
        failedRecords,
      }),
    [aiRuns, failedRecords, forecastJobs, syncRuns],
  );

  const contextSummary = getContextSummary(context);
  const investigationHref =
    context.skuId && context.locationId
      ? buildInvestigationHref(context.skuId, context.locationId)
      : "/investigation";

  const showSummarySkeleton =
    connections.length === 0 &&
    syncRuns.length === 0 &&
    forecastJobs.length === 0 &&
    aiRuns.length === 0 &&
    salesImportRuns.length === 0 &&
    workerStatuses.length === 0 &&
    (connectionsQuery.isLoading ||
      syncRunsQuery.isLoading ||
      forecastJobsQuery.isLoading ||
      aiRunsQuery.isLoading ||
      salesImportRunsQuery.isLoading ||
      workerStatusQuery.isLoading);

  const updateParams = (updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  };

  const handleSelectConnection = (integrationConnectionId: string | null) => {
    updateParams((params) => {
      if (integrationConnectionId) {
        params.set("integrationConnectionId", integrationConnectionId);
      } else {
        params.delete("integrationConnectionId");
      }

      params.delete("syncRunId");
    });
  };

  const handleSelectSyncRun = (syncRunId: string | null) => {
    updateParams((params) => {
      if (syncRunId) {
        params.set("syncRunId", syncRunId);
      } else {
        params.delete("syncRunId");
      }
    });
  };

  const handleSelectForecastJob = (forecastJobId: string | null) => {
    updateParams((params) => {
      if (forecastJobId) {
        params.set("forecastJobId", forecastJobId);
      } else {
        params.delete("forecastJobId");
      }
    });
  };

  if (!session.isConfigured) {
    return (
      <DataOpsEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace uses those values on every request to the real API."
      />
    );
  }

  return (
    <div className={uiPageStackClassName}>
      <PageIntro
        eyebrow="Data Ops"
        title="Data and forecast operations"
        description="Supervise ingestion reliability, sync health, forecast runtimes, and freshness evidence without recreating backend pipeline logic in the client."
        meta={<p className="max-w-4xl text-sm leading-6 text-steel">{contextSummary}</p>}
        actions={
          <>
            <Link
              to={buildIntegrationsHref({
                integrationConnectionId: context.integrationConnectionId,
                syncRunId: context.syncRunId,
              })}
              className={uiButtonSecondaryClassName}
            >
              Open integrations
            </Link>
            <Link to="/workflow" className={uiButtonSecondaryClassName}>
              Open workflow
            </Link>
            <StatusChip tone={failedRecords.length > 0 ? "danger" : "neutral"}>
              {failedRecords.length} unresolved records
            </StatusChip>
          </>
        }
      />

      {showSummarySkeleton ? (
        <DataOpsSectionSkeleton rows={4} />
      ) : (
        <OperationalHealthSection
          summary={healthSummary}
          contextSummary={contextSummary}
          freshnessAt={freshnessAt}
          investigationHref={investigationHref}
        />
      )}

      {connectionsQuery.isError ||
      syncRunsQuery.isError ||
      forecastJobsQuery.isError ||
      aiRunsQuery.isError ||
      salesImportRunsQuery.isError ||
      workerStatusQuery.isError ? (
        <DataOpsErrorNotice
          title="Some operational health inputs could not be loaded"
          message={getApiErrorMessage(
            connectionsQuery.error ??
              syncRunsQuery.error ??
              forecastJobsQuery.error ??
              aiRunsQuery.error ??
              salesImportRunsQuery.error ??
              workerStatusQuery.error,
            "One or more upstream health queries failed.",
          )}
        />
      ) : null}

      <SplitPanel
        collapseAt="2xl"
        secondarySticky={false}
        primary={
          <div className="space-y-6">
            {connectionsQuery.isLoading && syncRunsQuery.isLoading && connectionRows.length === 0 && syncRuns.length === 0 ? (
              <DataOpsSectionSkeleton rows={5} />
            ) : (
              <>
                {(connectionsQuery.isError || syncRunsQuery.isError) && (
                  <DataOpsErrorNotice
                    title="Integration and sync data partially unavailable"
                    message={getApiErrorMessage(
                      connectionsQuery.error ?? syncRunsQuery.error,
                      "Integration connections or sync runs could not be loaded.",
                    )}
                  />
                )}

                <IntegrationSyncSection
                  connections={connectionRows}
                  syncRuns={syncRuns}
                  selectedConnectionId={context.integrationConnectionId}
                  selectedSyncRunId={context.syncRunId}
                  onSelectConnection={handleSelectConnection}
                  onSelectSyncRun={handleSelectSyncRun}
                />

                {context.integrationConnectionId ? (
                  connectionDetailQuery.isLoading && selectedConnection === null ? (
                    <DataOpsSectionSkeleton rows={3} />
                  ) : connectionDetailQuery.isError ? (
                    <DataOpsErrorNotice
                      title="Connection detail unavailable"
                      message={getApiErrorMessage(
                        connectionDetailQuery.error,
                        "The selected integration connection could not be loaded.",
                      )}
                    />
                  ) : selectedConnection ? (
                    <ConnectionDetailPanel connection={selectedConnection} />
                  ) : (
                    <DetailPlaceholder
                      title="Selected connection unavailable"
                      message="The selected integration connection is not exposed in the current tenant-scoped read model."
                    />
                  )
                ) : null}

                {context.syncRunId ? (
                  syncRunDetailQuery.isLoading && selectedSyncRun === null ? (
                    <DataOpsSectionSkeleton rows={4} />
                  ) : syncRunDetailQuery.isError ? (
                    <DataOpsErrorNotice
                      title="Sync run detail unavailable"
                      message={getApiErrorMessage(
                        syncRunDetailQuery.error,
                        "The selected sync run could not be loaded.",
                      )}
                    />
                  ) : selectedSyncRun ? (
                    <SyncRunDetailPanel
                      syncRun={selectedSyncRun}
                      failedRecords={selectedSyncRunFailedRecords}
                    />
                  ) : (
                    <DetailPlaceholder
                      title="Select a sync run"
                      message="Choose a sync run from the table above to inspect checkpoint, error summary, and failed records."
                    />
                  )
                ) : null}
              </>
            )}
          </div>
        }
        secondary={
          <div className="space-y-6">
            {forecastJobsQuery.isLoading && forecastJobs.length === 0 ? (
              <DataOpsSectionSkeleton rows={5} />
            ) : (
              <>
                {forecastJobsQuery.isError ? (
                  <DataOpsErrorNotice
                    title="Forecast operations unavailable"
                    message={getApiErrorMessage(
                      forecastJobsQuery.error,
                      "Forecast jobs could not be loaded from the support read model.",
                    )}
                  />
                ) : null}

                <ForecastOperationsSection
                  forecastJobs={visibleForecastJobs}
                  selectedForecastJobId={context.forecastJobId}
                  onSelectForecastJob={handleSelectForecastJob}
                />

                {context.forecastJobId ? (
                  forecastJobDetailQuery.isLoading && selectedForecastJob === null ? (
                    <DataOpsSectionSkeleton rows={4} />
                  ) : forecastJobDetailQuery.isError ? (
                    <DataOpsErrorNotice
                      title="Forecast job detail unavailable"
                      message={getApiErrorMessage(
                        forecastJobDetailQuery.error,
                        "The selected forecast job could not be loaded.",
                      )}
                    />
                  ) : selectedForecastJob ? (
                    forecastResultsQuery.isError ? (
                      <DataOpsErrorNotice
                        title="Forecast results unavailable"
                        message={getApiErrorMessage(
                          forecastResultsQuery.error,
                          "The selected forecast job results could not be loaded.",
                        )}
                      />
                    ) : forecastResultsQuery.isLoading ? (
                      <DataOpsSectionSkeleton rows={4} />
                    ) : (
                      <ForecastJobDetailPanel
                        forecastJob={selectedForecastJob}
                        results={selectedForecastResults}
                      />
                    )
                  ) : (
                    <DetailPlaceholder
                      title="Select a forecast job"
                      message="Choose a forecast job from the list above to inspect its inputs and persisted results."
                    />
                  )
                ) : null}
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {salesImportRunsQuery.isLoading && salesImportRuns.length === 0 ? (
          <DataOpsSectionSkeleton rows={4} />
        ) : (
          <div className="space-y-6">
            {(salesImportRunsQuery.isError || demandEvidenceQuery.isError) && (
              <DataOpsErrorNotice
                title="Demand freshness data partially unavailable"
                message={getApiErrorMessage(
                  salesImportRunsQuery.error ?? demandEvidenceQuery.error,
                  "Sales import runs or matching customer orders could not be loaded.",
                )}
              />
            )}
            <DemandFreshnessSection
              salesImportRuns={salesImportRuns}
              matchedDemandEvidence={matchedDemandEvidence}
              hasScopeContext={context.skuId !== null && context.locationId !== null}
            />
          </div>
        )}

        {anomaliesQuery.isLoading && aiRunsQuery.isLoading && anomalies.length === 0 && aiRuns.length === 0 ? (
          <DataOpsSectionSkeleton rows={4} />
        ) : (
          <div className="space-y-6">
            {(anomaliesQuery.isError || aiRunsQuery.isError) && (
              <DataOpsErrorNotice
                title="Anomaly and AI signal data partially unavailable"
                message={getApiErrorMessage(
                  anomaliesQuery.error ?? aiRunsQuery.error,
                  "Anomaly scores or recent AI runs could not be loaded.",
                )}
              />
            )}
            <AnomalySignalsSection anomalies={anomalies} aiRuns={aiRuns} />
          </div>
        )}
      </div>

      {workerStatusQuery.isLoading && failedRecordsQuery.isLoading && workerStatuses.length === 0 && diagnosticsFailedRecords.length === 0 ? (
        <DataOpsSectionSkeleton rows={4} />
      ) : (
        <>
          {(workerStatusQuery.isError || failedRecordsQuery.isError) && (
            <DataOpsErrorNotice
              title="Diagnostics partially unavailable"
              message={getApiErrorMessage(
                workerStatusQuery.error ?? failedRecordsQuery.error,
                "Worker diagnostics or unresolved failed records could not be loaded.",
              )}
            />
          )}
          <DiagnosticsSection
            workerStatuses={workerStatuses}
            unresolvedFailedRecords={diagnosticsFailedRecords}
          />
        </>
      )}

    </div>
  );
};
