import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { ActionConfirmationDialog } from "../../support-actions/components/ActionConfirmationDialog";
import {
  uiButtonSecondaryClassName,
  uiPageStackClassName,
} from "../../../components/ui/classes";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SplitPanel } from "../../../components/ui/SplitPanel";
import { StatusChip } from "../../../components/ui/StatusChip";
import { ActivationChecklistSection } from "../components/ActivationChecklistSection";
import { ActivationFeedbackNotice, ActivationSectionSkeleton, ActivationEmptyState, ActivationErrorNotice } from "../components/ActivationStates";
import { ActivationSummarySection } from "../components/ActivationSummarySection";
import { CommercialReadinessSection } from "../components/CommercialReadinessSection";
import { DataReadinessSection } from "../components/DataReadinessSection";
import { IntelligenceReadinessSection } from "../components/IntelligenceReadinessSection";
import { NextBestActionSection } from "../components/NextBestActionSection";
import {
  useActivationApprovals,
  useActivationConnections,
  useActivationDecisions,
  useActivationExecutions,
  useActivationFailedRecords,
  useActivationForecastJobs,
  useActivationForecastResults,
  useActivationSyncRuns,
  useBillingEntitlements,
  useBillingPlans,
  useBillingUsageMeters,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
  useCurrentSubscription,
  useProcessActivationSyncMutation,
} from "../hooks";
import {
  deriveActivationChecklist,
  deriveActivationSummary,
  deriveNextBestAction,
} from "../selectors";
import type {
  ActivationActionFeedback,
  CommercialReadiness,
  DataReadiness,
  IntelligenceReadiness,
  IntegrationSyncRun,
} from "../types";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

const openExternalUrl = (url: string) => {
  if (typeof window === "undefined") {
    return;
  }

  const openedWindow = window.open(url, "_blank", "noopener,noreferrer");

  if (!openedWindow) {
    window.location.assign(url);
  }
};

const buildActivationReturnUrl = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/activation`;
};

export const TenantActivationPage = (): JSX.Element => {
  const session = useSession();

  const [selectedPlanCode, setSelectedPlanCode] = useState("");
  const [feedback, setFeedback] = useState<ActivationActionFeedback | null>(null);
  const [processTarget, setProcessTarget] = useState<IntegrationSyncRun | null>(null);

  const plansQuery = useBillingPlans();
  const subscriptionQuery = useCurrentSubscription();
  const entitlementsQuery = useBillingEntitlements();
  const usageQuery = useBillingUsageMeters();
  const connectionsQuery = useActivationConnections();
  const syncRunsQuery = useActivationSyncRuns();
  const failedRecordsQuery = useActivationFailedRecords();
  const forecastJobsQuery = useActivationForecastJobs();
  const decisionsQuery = useActivationDecisions();
  const approvalsQuery = useActivationApprovals();
  const executionsQuery = useActivationExecutions();

  const checkoutMutation = useCreateCheckoutSessionMutation();
  const portalMutation = useCreatePortalSessionMutation();
  const processSyncMutation = useProcessActivationSyncMutation();

  const plans = plansQuery.data ?? [];
  const subscription = subscriptionQuery.data ?? null;
  const entitlements = entitlementsQuery.data ?? null;
  const usageMeters = (usageQuery.data ?? [])
    .slice()
    .sort(
      (left, right) =>
        new Date(right.measurementWindowEnd).getTime() -
        new Date(left.measurementWindowEnd).getTime(),
    );
  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];
  const forecastJobs = forecastJobsQuery.data ?? [];
  const decisions = decisionsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];

  const activePlans = useMemo(
    () =>
      plans
        .filter((plan) => plan.status === "active")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [plans],
  );

  const latestCompletedForecastJob = useMemo(
    () =>
      forecastJobs
        .filter((forecastJob) => forecastJob.status === "completed")
        .sort(
          (left, right) =>
            new Date(right.completedAt ?? right.createdAt).getTime() -
            new Date(left.completedAt ?? left.createdAt).getTime(),
        )[0] ?? null,
    [forecastJobs],
  );

  const forecastResultsQuery = useActivationForecastResults(latestCompletedForecastJob?.id ?? null);
  const latestForecastResults = forecastResultsQuery.data ?? [];

  const commercial = useMemo(
    () =>
      ({
        currentPlan: subscription?.plan ?? null,
        subscription,
        entitlements,
        usageMeters,
        activePlans,
      }) satisfies CommercialReadiness,
    [activePlans, entitlements, subscription, usageMeters],
  );
  const data = useMemo(
    () =>
      ({
        connections,
        syncRuns,
        failedRecords,
      }) satisfies DataReadiness,
    [connections, failedRecords, syncRuns],
  );
  const intelligence = useMemo(
    () =>
      ({
        forecastJobs,
        latestForecastResults,
        decisions,
        approvals,
        executions,
      }) satisfies IntelligenceReadiness,
    [approvals, decisions, executions, forecastJobs, latestForecastResults],
  );

  const summary = useMemo(
    () =>
      deriveActivationSummary({
        commercial,
        data,
        intelligence,
        latestForecastResults,
      }),
    [commercial, data, intelligence, latestForecastResults],
  );
  const checklist = useMemo(
    () =>
      deriveActivationChecklist({
        commercial,
        data,
        intelligence,
        latestForecastResults,
      }),
    [commercial, data, intelligence, latestForecastResults],
  );
  const nextAction = useMemo(
    () =>
      deriveNextBestAction({
        commercial,
        data,
        intelligence,
        latestForecastResults,
      }),
    [commercial, data, intelligence, latestForecastResults],
  );

  const latestEvidenceAt = useMemo(() => {
    const timestamps = [
      subscription?.updatedAt,
      ...plans.map((plan) => plan.updatedAt),
      ...connections.map((connection) => connection.updatedAt),
      ...syncRuns.map((syncRun) => syncRun.completedAt ?? syncRun.updatedAt),
      ...failedRecords.map((record) => record.createdAt),
      ...forecastJobs.map((forecastJob) => forecastJob.completedAt ?? forecastJob.createdAt),
      ...decisions.map((decision) => decision.updatedAt),
      ...approvals.map((approval) => approval.updatedAt),
      ...executions.map((execution) => execution.updatedAt),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    return timestamps.sort(
      (left, right) => new Date(right).getTime() - new Date(left).getTime(),
    )[0] ?? null;
  }, [
    approvals,
    connections,
    decisions,
    executions,
    failedRecords,
    forecastJobs,
    plans,
    subscription?.updatedAt,
    syncRuns,
  ]);

  const pendingSyncRun = useMemo(
    () =>
      syncRuns
        .filter((syncRun) => syncRun.status === "pending")
        .sort((left, right) => new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime())[0] ??
      null,
    [syncRuns],
  );

  useEffect(() => {
    const defaultPlanCode =
      subscription?.plan.code ??
      activePlans[0]?.code ??
      "";

    if (!selectedPlanCode || !activePlans.some((plan) => plan.code === selectedPlanCode)) {
      setSelectedPlanCode(defaultPlanCode);
    }
  }, [activePlans, selectedPlanCode, subscription?.plan.code]);

  const handleCheckout = async (): Promise<void> => {
    if (!selectedPlanCode) {
      setFeedback({
        tone: "error",
        title: "Select a billing plan",
        message: "Choose one of the active backend billing plans before starting checkout.",
        createdAt: new Date().toISOString(),
      });
      return;
    }

    try {
      const returnUrl = buildActivationReturnUrl();
      const result = await checkoutMutation.mutateAsync({
        planCode: selectedPlanCode,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
      });

      setFeedback({
        tone: "success",
        title: "Checkout session created",
        message: `Opened checkout for plan ${result.planCode}. If a new tab did not open, the browser will redirect in this tab.`,
        createdAt: new Date().toISOString(),
      });
      openExternalUrl(result.url);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Checkout session failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the checkout-session request.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handlePortal = async (): Promise<void> => {
    try {
      const result = await portalMutation.mutateAsync({
        returnUrl: buildActivationReturnUrl(),
      });

      setFeedback({
        tone: "success",
        title: "Billing portal opened",
        message: "Opened the backend-managed billing portal session.",
        createdAt: new Date().toISOString(),
      });
      openExternalUrl(result.url);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "Billing portal failed",
        message: getApiErrorMessage(
          error,
          "The backend rejected the billing portal request.",
        ),
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleProcessSync = async (): Promise<void> => {
    if (!processTarget) {
      return;
    }

    try {
      const result = await processSyncMutation.mutateAsync({
        syncRunId: processTarget.id,
      });

      setFeedback({
        tone: "success",
        title: "Pending sync processed",
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

  const handleNextAction = () => {
    if (nextAction.kind === "checkout") {
      void handleCheckout();
      return;
    }

    if (nextAction.kind === "portal") {
      void handlePortal();
      return;
    }

    if (nextAction.kind === "process_sync" && pendingSyncRun) {
      setProcessTarget(pendingSyncRun);
    }
  };

  if (!session.isConfigured) {
    return (
      <ActivationEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. This workspace sends those values on every request to the real billing, integration, decision, forecast, and workflow APIs."
      />
    );
  }

  const initialLoading =
    plansQuery.isLoading &&
    subscriptionQuery.isLoading &&
    entitlementsQuery.isLoading &&
    connectionsQuery.isLoading &&
    syncRunsQuery.isLoading;

  return (
    <>
      <div className={uiPageStackClassName}>
        <PageIntro
          eyebrow="Activation"
          title="Commercial and operational readiness"
          description="Confirm that a tenant is subscribed, connected, and ready for policy-governed automation using only the billing, integration, forecast, and workflow evidence the backend exposes."
          actions={
            <>
              <Link to="/integrations" className={uiButtonSecondaryClassName}>
                Open integrations
              </Link>
              <Link to="/tenant-admin" className={uiButtonSecondaryClassName}>
                Open tenant admin
              </Link>
            </>
          }
          meta={
            <div className="flex flex-wrap gap-2">
              <StatusChip tone={subscription ? "success" : "warning"}>
                {subscription ? subscription.plan.name : "No active subscription"}
              </StatusChip>
              <StatusChip tone={connections.length > 0 ? "info" : "neutral"}>
                {connections.length} connections
              </StatusChip>
              <StatusChip tone={forecastJobs.length > 0 ? "info" : "neutral"}>
                {forecastJobs.length} forecast jobs
              </StatusChip>
            </div>
          }
        />

        {initialLoading ? (
          <ActivationSectionSkeleton rows={4} />
        ) : (
          <ActivationSummarySection summary={summary} latestEvidenceAt={latestEvidenceAt} />
        )}

        {feedback ? <ActivationFeedbackNotice feedback={feedback} /> : null}

        {plansQuery.isError ||
        subscriptionQuery.isError ||
        entitlementsQuery.isError ||
        usageQuery.isError ? (
          <ActivationErrorNotice
            title="Commercial readiness partially unavailable"
            message={getApiErrorMessage(
              plansQuery.error ??
                subscriptionQuery.error ??
                entitlementsQuery.error ??
                usageQuery.error,
              "One or more billing queries failed.",
            )}
          />
        ) : null}

        <SplitPanel
          collapseAt="2xl"
          secondarySticky={false}
          primary={
            <div className="space-y-6">
              <CommercialReadinessSection
                commercial={commercial}
                selectedPlanCode={selectedPlanCode}
                feedback={null}
                checkoutPending={checkoutMutation.isPending}
                portalPending={portalMutation.isPending}
                onSelectPlanCode={setSelectedPlanCode}
                onStartCheckout={() => {
                  void handleCheckout();
                }}
                onOpenPortal={() => {
                  void handlePortal();
                }}
              />

              {connectionsQuery.isError || syncRunsQuery.isError || failedRecordsQuery.isError ? (
                <ActivationErrorNotice
                  title="Data readiness partially unavailable"
                  message={getApiErrorMessage(
                    connectionsQuery.error ?? syncRunsQuery.error ?? failedRecordsQuery.error,
                    "One or more integration readiness queries failed.",
                  )}
                />
              ) : null}

              <DataReadinessSection data={data} />

              <ActivationChecklistSection items={checklist} />
            </div>
          }
          secondary={
            <div className="space-y-6">
              <NextBestActionSection
                action={nextAction}
                pending={
                  checkoutMutation.isPending ||
                  portalMutation.isPending ||
                  processSyncMutation.isPending
                }
                onTrigger={handleNextAction}
              />

              {forecastJobsQuery.isError ||
              forecastResultsQuery.isError ||
              decisionsQuery.isError ||
              approvalsQuery.isError ||
              executionsQuery.isError ? (
                <ActivationErrorNotice
                  title="Intelligence readiness partially unavailable"
                  message={getApiErrorMessage(
                    forecastJobsQuery.error ??
                      forecastResultsQuery.error ??
                      decisionsQuery.error ??
                      approvalsQuery.error ??
                      executionsQuery.error,
                    "One or more forecast, decision, or workflow queries failed.",
                  )}
                />
              ) : null}

              <IntelligenceReadinessSection
                intelligence={intelligence}
                latestForecastResultsCount={latestForecastResults.length}
              />
            </div>
          }
        />
      </div>

      <ActionConfirmationDialog
        open={processTarget !== null}
        eyebrow="Confirm activation step"
        title="Process pending sync"
        description="This calls the real pending-sync process endpoint. The backend remains authoritative for adapter execution, canonical mapping, replay safety, and failed-record persistence."
        confirmLabel="Process sync"
        pending={processSyncMutation.isPending}
        onClose={() => {
          if (!processSyncMutation.isPending) {
            setProcessTarget(null);
          }
        }}
        onConfirm={() => handleProcessSync()}
      />
    </>
  );
};
