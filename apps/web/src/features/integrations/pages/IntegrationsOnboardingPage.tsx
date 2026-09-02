import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  uiButtonSecondaryClassName,
  uiPageStackClassName,
} from "../../../components/ui/classes";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";

import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { ActionConfirmationDialog } from "../../support-actions/components/ActionConfirmationDialog";
import { ConnectionDetailPanel } from "../components/ConnectionDetailPanel";
import { ConnectionEditorSection } from "../components/ConnectionEditorSection";
import { ConnectionListSection } from "../components/ConnectionListSection";
import {
  IntegrationActionFeedbackNotice,
  IntegrationOnboardingEmptyState,
  IntegrationOnboardingErrorNotice,
  IntegrationOnboardingSectionSkeleton,
} from "../components/IntegrationOnboardingStates";
import { OnboardingIssuesSection } from "../components/OnboardingIssuesSection";
import { OnboardingReadinessSection } from "../components/OnboardingReadinessSection";
import { SyncControlSection } from "../components/SyncControlSection";
import {
  useCreateIntegrationConnectionMutation,
  useCreateIntegrationSyncRunMutation,
  useIntegrationConnectionDetail,
  useIntegrationConnections,
  useIntegrationFailedRecords,
  useIntegrationSyncRunDetail,
  useIntegrationSyncRuns,
  useProcessIntegrationSyncRunMutation,
  useUpdateIntegrationConnectionMutation,
} from "../hooks";
import { readIntegrationsRouteParams } from "../route";
import {
  buildConnectionEditorState,
  buildConnectionRows,
  buildCreateConnectionInput,
  buildCreateSyncRunInput,
  buildUpdateConnectionInput,
  createDefaultConnectionEditorState,
  createDefaultSyncRunDraft,
  deriveLatestOnboardingTimestamp,
  deriveOnboardingReadinessSummary,
  deriveVisibleFailedRecords,
  deriveVisibleSyncRuns,
  filterConnectionRows,
} from "../selectors";
import type {
  ConnectionEditorState,
  IntegrationActionFeedback,
  IntegrationConnectionFilters,
  IntegrationSyncRun,
  IntegrationsRouteParams,
  SyncRunCreateDraft,
} from "../types";

const knownParams = [
  "integrationConnectionId",
  "syncRunId",
  "status",
  "integrationType",
  "search",
] as const;

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const IntegrationsOnboardingPage = (): JSX.Element => {
  const session = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeParams = useMemo(() => readIntegrationsRouteParams(searchParams), [searchParams]);

  const [editorState, setEditorState] = useState<ConnectionEditorState>(
    createDefaultConnectionEditorState(),
  );
  const [syncDraft, setSyncDraft] = useState<SyncRunCreateDraft>(createDefaultSyncRunDraft());
  const [feedback, setFeedback] = useState<IntegrationActionFeedback | null>(null);
  const [processTarget, setProcessTarget] = useState<IntegrationSyncRun | null>(null);

  const connectionFilters = useMemo(
    () => ({
      status: routeParams.status,
      integrationType: routeParams.integrationType,
    }),
    [routeParams.integrationType, routeParams.status],
  );

  const connectionsQuery = useIntegrationConnections(connectionFilters);
  const connectionDetailQuery = useIntegrationConnectionDetail(routeParams.integrationConnectionId);
  const syncRunsQuery = useIntegrationSyncRuns();
  const syncRunDetailQuery = useIntegrationSyncRunDetail(routeParams.syncRunId);
  const failedRecordsQuery = useIntegrationFailedRecords({ resolved: false });

  const createConnectionMutation = useCreateIntegrationConnectionMutation();
  const updateConnectionMutation = useUpdateIntegrationConnectionMutation();
  const createSyncMutation = useCreateIntegrationSyncRunMutation();
  const processSyncMutation = useProcessIntegrationSyncRunMutation();

  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];

  const connectionRows = useMemo(
    () => buildConnectionRows(connections, syncRuns, failedRecords),
    [connections, failedRecords, syncRuns],
  );
  const filteredConnectionRows = useMemo(
    () =>
      filterConnectionRows(connectionRows, {
        status: routeParams.status,
        integrationType: routeParams.integrationType,
        search: routeParams.search,
      }),
    [connectionRows, routeParams.integrationType, routeParams.search, routeParams.status],
  );

  const selectedConnection = useMemo(() => {
    const detailedConnection = connectionDetailQuery.data;

    if (detailedConnection) {
      return (
        connectionRows.find((connection) => connection.id === detailedConnection.id) ??
        buildConnectionRows([detailedConnection], syncRuns, failedRecords)[0] ??
        null
      );
    }

    return (
      connectionRows.find((connection) => connection.id === routeParams.integrationConnectionId) ??
      null
    );
  }, [
    connectionDetailQuery.data,
    connectionRows,
    failedRecords,
    routeParams.integrationConnectionId,
    syncRuns,
  ]);
  const visibleSyncRuns = useMemo(
    () => deriveVisibleSyncRuns(syncRuns, routeParams.integrationConnectionId),
    [routeParams.integrationConnectionId, syncRuns],
  );
  const selectedSyncRun =
    syncRunDetailQuery.data ??
    syncRuns.find((syncRun) => syncRun.id === routeParams.syncRunId) ??
    null;
  const visibleFailedRecords = useMemo(
    () =>
      deriveVisibleFailedRecords(failedRecords, {
        integrationConnectionId: routeParams.integrationConnectionId,
        syncRunId: routeParams.syncRunId,
      }),
    [failedRecords, routeParams.integrationConnectionId, routeParams.syncRunId],
  );
  const selectedSyncRunFailedRecords = selectedSyncRun
    ? failedRecords.filter((record) => record.syncRunId === selectedSyncRun.id)
    : [];

  const summary = useMemo(
    () =>
      deriveOnboardingReadinessSummary({
        rows: selectedConnection ? [selectedConnection] : filteredConnectionRows,
        syncRuns: visibleSyncRuns,
        failedRecords: visibleFailedRecords,
      }),
    [filteredConnectionRows, selectedConnection, visibleFailedRecords, visibleSyncRuns],
  );
  const freshnessAt = useMemo(
    () =>
      deriveLatestOnboardingTimestamp({
        rows: selectedConnection ? [selectedConnection] : filteredConnectionRows,
        syncRuns: visibleSyncRuns,
        failedRecords: visibleFailedRecords,
      }),
    [filteredConnectionRows, selectedConnection, visibleFailedRecords, visibleSyncRuns],
  );

  useEffect(() => {
    if (selectedConnection) {
      setEditorState(buildConnectionEditorState(selectedConnection));
      setSyncDraft((current) => ({
        ...current,
        connectionId: selectedConnection.id,
      }));
      return;
    }

    setEditorState(
      createDefaultConnectionEditorState(
        routeParams.integrationType !== "all" ? routeParams.integrationType : "erp",
      ),
    );
  }, [routeParams.integrationType, selectedConnection]);

  useEffect(() => {
    if (!selectedConnection && syncDraft.connectionId.length === 0 && filteredConnectionRows[0]) {
      setSyncDraft((current) => ({
        ...current,
        connectionId: filteredConnectionRows[0]?.id ?? current.connectionId,
      }));
    }
  }, [filteredConnectionRows, selectedConnection, syncDraft.connectionId.length]);

  const applyRouteParams = (nextParams: Partial<IntegrationsRouteParams>) => {
    const mergedParams: IntegrationsRouteParams = {
      integrationConnectionId: routeParams.integrationConnectionId,
      syncRunId: routeParams.syncRunId,
      status: routeParams.status,
      integrationType: routeParams.integrationType,
      search: routeParams.search,
      ...nextParams,
    };

    const nextSearchParams = new URLSearchParams(searchParams);
    knownParams.forEach((key) => {
      nextSearchParams.delete(key);
    });

    if (mergedParams.integrationConnectionId) {
      nextSearchParams.set("integrationConnectionId", mergedParams.integrationConnectionId);
    }
    if (mergedParams.syncRunId) {
      nextSearchParams.set("syncRunId", mergedParams.syncRunId);
    }
    if (mergedParams.status !== "all") {
      nextSearchParams.set("status", mergedParams.status);
    }
    if (mergedParams.integrationType !== "all") {
      nextSearchParams.set("integrationType", mergedParams.integrationType);
    }
    if (mergedParams.search.trim().length > 0) {
      nextSearchParams.set("search", mergedParams.search.trim());
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleFieldChange = <K extends keyof ConnectionEditorState>(
    field: K,
    value: ConnectionEditorState[K],
  ) => {
    if (field === "integrationType") {
      setEditorState(
        createDefaultConnectionEditorState(value as ConnectionEditorState["integrationType"]),
      );
      return;
    }

    setEditorState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSyncDraftChange = <K extends keyof SyncRunCreateDraft>(
    field: K,
    value: SyncRunCreateDraft[K],
  ) => {
    setSyncDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleConnectionSubmit = async (): Promise<void> => {
    if (editorState.name.trim().length === 0) {
      setFeedback({
        tone: "error",
        title: "Connection name required",
        message: "Provide a connection name before submitting the real backend create or update route.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    if (editorState.integrationType === "csv_import" && editorState.delimiter.length !== 1) {
      setFeedback({
        tone: "error",
        title: "Delimiter must be one character",
        message: "The CSV import schema accepts a single-character delimiter only.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      if (selectedConnection) {
        const result = await updateConnectionMutation.mutateAsync({
          integrationConnectionId: selectedConnection.id,
          values: buildUpdateConnectionInput(editorState),
        });

        applyRouteParams({
          integrationConnectionId: result.id,
        });
        setFeedback({
          tone: "success",
          title: "Connection updated",
          message: `Saved ${result.name} with persisted status ${result.status}.`,
          createdAt: new Date().toISOString(),
        });
        return;
      }

      const result = await createConnectionMutation.mutateAsync(
        buildCreateConnectionInput(editorState),
      );

      applyRouteParams({
        integrationConnectionId: result.id,
        syncRunId: null,
      });
      setFeedback({
        tone: "success",
        title: "Connection created",
        message: `Created ${result.name}. You can now create the first sync run for onboarding.`,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        title: selectedConnection ? "Connection update failed" : "Connection create failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the connection mutation.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleCreateSyncRun = async (): Promise<void> => {
    const connection =
      connectionRows.find((row) => row.id === syncDraft.connectionId) ?? selectedConnection;

    if (!connection) {
      setFeedback({
        tone: "error",
        title: "Select a connection",
        message: "Choose a connection before creating a sync run.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const input = buildCreateSyncRunInput(syncDraft, connection.integrationType);
      const result = await createSyncMutation.mutateAsync(input);
      applyRouteParams({
        integrationConnectionId: result.integrationConnectionId,
        syncRunId: result.id,
      });
      setFeedback({
        tone: "success",
        title: "Sync run created",
        message: `Created ${result.syncType} as ${result.status}. Process it if it remains pending.`,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Sync creation failed",
        message:
          error instanceof Error && !isApiError(error)
            ? error.message
            : getApiErrorMessage(error, "The backend rejected the sync creation request."),
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleConfirmProcess = async (): Promise<void> => {
    if (!processTarget) {
      return;
    }

    try {
      const result = await processSyncMutation.mutateAsync({
        syncRunId: processTarget.id,
      });
      applyRouteParams({
        integrationConnectionId: result.integrationConnectionId,
        syncRunId: result.id,
      });
      setFeedback({
        tone: "success",
        title: "Sync processing triggered",
        message: `Backend returned sync status ${result.status} for ${result.id}.`,
        createdAt: new Date().toISOString(),
      });
      setProcessTarget(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Sync processing failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the sync processing request.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  if (!session.isConfigured) {
    return (
      <IntegrationOnboardingEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real backend integration APIs."
      />
    );
  }

  const initialLoading =
    connectionsQuery.isLoading && syncRunsQuery.isLoading && failedRecordsQuery.isLoading;

  return (
    <>
      <div className={uiPageStackClassName}>
        <PageIntro
          eyebrow="Integrations"
          title="Connection onboarding and sync control"
          description="Configure production data feeds, inspect onboarding blockers, and trigger the real sync mutations that establish reliable operational data flow."
          actions={
            <>
              <Link to="/activation" className={uiButtonSecondaryClassName}>
                Open activation
              </Link>
              <Link to="/data-ops" className={uiButtonSecondaryClassName}>
                Open data ops
              </Link>
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone="info">{filteredConnectionRows.length} scoped connections</StatusChip>
              <StatusChip tone={visibleFailedRecords.length > 0 ? "danger" : "neutral"}>
                {visibleFailedRecords.length} unresolved failed records
              </StatusChip>
              <StatusChip tone={visibleSyncRuns.length > 0 ? "warning" : "neutral"}>
                {visibleSyncRuns.length} visible sync runs
              </StatusChip>
            </div>
          }
        />

        {initialLoading ? (
          <IntegrationOnboardingSectionSkeleton rows={4} />
        ) : (
          <OnboardingReadinessSection summary={summary} freshnessAt={freshnessAt} />
        )}

        {feedback ? <IntegrationActionFeedbackNotice feedback={feedback} /> : null}

        {connectionsQuery.isError || syncRunsQuery.isError || failedRecordsQuery.isError ? (
          <IntegrationOnboardingErrorNotice
            title="Some onboarding inputs could not be loaded"
            message={getApiErrorMessage(
              connectionsQuery.error ?? syncRunsQuery.error ?? failedRecordsQuery.error,
              "One or more integration onboarding queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <div className="space-y-6">
              {connectionsQuery.isLoading && filteredConnectionRows.length === 0 ? (
                <IntegrationOnboardingSectionSkeleton rows={5} />
              ) : (
                <ConnectionListSection
                  rows={filteredConnectionRows}
                  filters={{
                    status: routeParams.status,
                    integrationType: routeParams.integrationType,
                    search: routeParams.search,
                  }}
                  selectedConnectionId={routeParams.integrationConnectionId}
                  onFiltersChange={(nextFilters: IntegrationConnectionFilters) =>
                    applyRouteParams({
                      status: nextFilters.status,
                      integrationType: nextFilters.integrationType,
                      search: nextFilters.search,
                      integrationConnectionId: null,
                      syncRunId: null,
                    })
                  }
                  onSelectConnection={(integrationConnectionId) =>
                    applyRouteParams({
                      integrationConnectionId,
                      syncRunId: null,
                    })
                  }
                  onCreateNew={() =>
                    applyRouteParams({
                      integrationConnectionId: null,
                      syncRunId: null,
                    })
                  }
                />
              )}

              {routeParams.integrationConnectionId ? (
                connectionDetailQuery.isLoading && selectedConnection === null ? (
                  <IntegrationOnboardingSectionSkeleton rows={4} />
                ) : connectionDetailQuery.isError ? (
                  <IntegrationOnboardingErrorNotice
                    title="Connection detail unavailable"
                    message={getApiErrorMessage(
                      connectionDetailQuery.error,
                      "The selected integration connection could not be loaded.",
                    )}
                  />
                ) : selectedConnection ? (
                  <ConnectionDetailPanel
                    connection={selectedConnection}
                    syncRuns={visibleSyncRuns}
                    failedRecords={visibleFailedRecords}
                    selectedSyncRunId={routeParams.syncRunId}
                    onSelectSyncRun={(syncRunId) => applyRouteParams({ syncRunId })}
                  />
                ) : null
              ) : null}
            </div>
          }
          secondary={
            <div className="space-y-6">
              <ConnectionEditorSection
                selectedConnection={selectedConnection}
                draft={editorState}
                pending={createConnectionMutation.isPending || updateConnectionMutation.isPending}
                feedback={null}
                onFieldChange={handleFieldChange}
                onSubmit={() => {
                  void handleConnectionSubmit();
                }}
                onResetToCreate={() =>
                  applyRouteParams({
                    integrationConnectionId: null,
                    syncRunId: null,
                  })
                }
              />

              <SyncControlSection
                connections={filteredConnectionRows.length > 0 ? filteredConnectionRows : connectionRows}
                syncRuns={visibleSyncRuns}
                selectedConnection={selectedConnection}
                selectedSyncRunId={routeParams.syncRunId}
                selectedSyncRun={selectedSyncRun}
                selectedSyncRunFailedRecords={selectedSyncRunFailedRecords}
                draft={syncDraft}
                feedback={null}
                createPending={createSyncMutation.isPending}
                processPending={processSyncMutation.isPending}
                onDraftChange={handleSyncDraftChange}
                onSelectSyncRun={(syncRunId) => applyRouteParams({ syncRunId })}
                onCreateSyncRun={() => {
                  void handleCreateSyncRun();
                }}
                onRequestProcessSyncRun={(syncRun) => setProcessTarget(syncRun)}
              />
            </div>
          }
        />

        <OnboardingIssuesSection
          failedRecords={visibleFailedRecords}
          selectedConnection={selectedConnection}
          selectedSyncRun={selectedSyncRun}
        />
      </div>

      <ActionConfirmationDialog
        open={processTarget !== null}
        eyebrow="Confirm sync processing"
        title="Process pending sync"
        description="This calls the real sync processing endpoint for the selected pending sync run. The backend remains authoritative for adapter execution, canonical mapping, replay safety, and failed-record persistence."
        confirmLabel="Process sync"
        pending={processSyncMutation.isPending}
        onClose={() => {
          if (!processSyncMutation.isPending) {
            setProcessTarget(null);
          }
        }}
        onConfirm={() => handleConfirmProcess()}
      />
    </>
  );
};
