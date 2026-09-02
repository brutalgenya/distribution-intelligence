import { formatDateTime, formatLabel, formatNumber } from "../../lib/utils/format";
import { buildDataOpsHref } from "../data-ops/route";
import { buildIntegrationsHref } from "../integrations/route";
import { formatSyncStatus, formatSyncType } from "../integrations/selectors";
import { buildSupportActionsHref } from "../support-actions/route";
import type {
  ActivationChecklistItem,
  ActivationSummary,
  BillingPlan,
  BillingUsageMeter,
  CommercialReadiness,
  DataReadiness,
  IntelligenceReadiness,
  NextBestAction,
  PlanSubscription,
} from "./types";

const toTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const isCommerciallyActive = (subscription: PlanSubscription | null): boolean =>
  subscription?.status === "active" || subscription?.status === "trialing";

const getLatestSuccessfulSync = (syncRuns: DataReadiness["syncRuns"]) =>
  syncRuns
    .filter((syncRun) => syncRun.status === "completed")
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.startedAt) -
        toTimestamp(left.completedAt ?? left.startedAt),
    )[0] ?? null;

const getPendingSyncRun = (syncRuns: DataReadiness["syncRuns"]) =>
  syncRuns
    .filter((syncRun) => syncRun.status === "pending")
    .sort((left, right) => toTimestamp(right.startedAt) - toTimestamp(left.startedAt))[0] ?? null;

const getLatestProblemSync = (syncRuns: DataReadiness["syncRuns"]) =>
  syncRuns
    .filter((syncRun) => syncRun.status === "failed" || syncRun.status === "partial")
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.startedAt) -
        toTimestamp(left.completedAt ?? left.startedAt),
    )[0] ?? null;

const getLatestCompletedForecastJob = (forecastJobs: IntelligenceReadiness["forecastJobs"]) =>
  forecastJobs
    .filter((forecastJob) => forecastJob.status === "completed")
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.createdAt) -
        toTimestamp(left.completedAt ?? left.createdAt),
    )[0] ?? null;

const getLatestForecastIssue = (forecastJobs: IntelligenceReadiness["forecastJobs"]) =>
  forecastJobs
    .filter((forecastJob) => forecastJob.status === "failed" || forecastJob.status === "pending")
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.createdAt) -
        toTimestamp(left.completedAt ?? left.createdAt),
    )[0] ?? null;

const getLatestDecision = (decisions: IntelligenceReadiness["decisions"]) =>
  decisions
    .slice()
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))[0] ?? null;

const getLatestApproval = (approvals: IntelligenceReadiness["approvals"]) =>
  approvals
    .slice()
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))[0] ?? null;

const getLatestExecution = (executions: IntelligenceReadiness["executions"]) =>
  executions
    .slice()
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))[0] ?? null;

export const deriveActivationSummary = (input: {
  commercial: CommercialReadiness;
  data: DataReadiness;
  intelligence: IntelligenceReadiness;
  latestForecastResults: IntelligenceReadiness["latestForecastResults"];
}): ActivationSummary => {
  const commerciallyActive = isCommerciallyActive(input.commercial.subscription);
  const activeConnections = input.data.connections.filter((connection) => connection.status === "active");
  const latestSuccessfulSync = getLatestSuccessfulSync(input.data.syncRuns);
  const latestCompletedForecastJob = getLatestCompletedForecastJob(input.intelligence.forecastJobs);
  const forecastReady =
    latestCompletedForecastJob !== null && input.latestForecastResults.length > 0;
  const decisionReady = input.intelligence.decisions.length > 0;
  const workflowReady =
    input.intelligence.approvals.length > 0 || input.intelligence.executions.length > 0;

  const completedSteps = [
    commerciallyActive,
    activeConnections.length > 0,
    latestSuccessfulSync !== null,
    input.data.failedRecords.length === 0,
    forecastReady,
    decisionReady,
    workflowReady,
  ].filter(Boolean).length;

  const blockedSteps = [
    !commerciallyActive,
    activeConnections.length === 0,
    latestSuccessfulSync === null,
    !forecastReady,
    !decisionReady,
    !workflowReady,
  ].filter(Boolean).length;

  const attentionNeeded = input.data.failedRecords.length > 0 || getLatestProblemSync(input.data.syncRuns) !== null;

  const tone =
    commerciallyActive &&
    activeConnections.length > 0 &&
    latestSuccessfulSync !== null &&
    input.data.failedRecords.length === 0 &&
    forecastReady &&
    decisionReady &&
    workflowReady
      ? "positive"
      : !commerciallyActive || activeConnections.length === 0
        ? "critical"
        : attentionNeeded
          ? "critical"
          : "warning";

  const title =
    tone === "positive"
      ? "Ready for tenant activation"
      : tone === "critical"
        ? "Activation blocked or at risk"
        : "Activation in progress";

  const helper =
    tone === "positive"
      ? "Billing is commercially active and the platform already has persisted evidence for data onboarding, a successful sync, at least one forecast, at least one decision, and workflow activity."
      : "This summary is derived from persisted billing state, integration evidence, forecast milestones, decision records, and workflow activity. It does not invent hidden activation logic beyond those observed records.";

  return {
    title,
    tone,
    helper,
    cards: [
      {
        id: "completed-steps",
        label: "Completed activation steps",
        value: `${completedSteps} / 7`,
        helper: "Checklist completion derived from persisted commercial, data, and intelligence milestones.",
        tone,
      },
      {
        id: "current-plan",
        label: "Current plan",
        value: input.commercial.subscription?.plan.name ?? "No subscription",
        helper: commerciallyActive
          ? `Subscription status ${formatLabel(input.commercial.subscription?.status ?? "unknown")}.`
          : "No commercially active subscription is currently persisted.",
        tone: commerciallyActive ? "positive" : "critical",
      },
      {
        id: "blocked-steps",
        label: "Blocked steps",
        value: formatNumber(blockedSteps),
        helper: "Steps without sufficient backend evidence to count as complete.",
        tone: blockedSteps > 0 ? "warning" : "positive",
      },
      {
        id: "failed-records",
        label: "Unresolved failed records",
        value: formatNumber(input.data.failedRecords.length),
        helper: "Dead-lettered ingestion records that still require source correction or backend-supported remediation.",
        tone: input.data.failedRecords.length > 0 ? "critical" : "positive",
      },
    ],
  };
};

export const deriveCommercialFacts = (commercial: CommercialReadiness) => {
  const recentUsage = commercial.usageMeters
    .slice()
    .sort(
      (left, right) =>
        toTimestamp(right.measurementWindowEnd) - toTimestamp(left.measurementWindowEnd),
    )
    .slice(0, 5);

  return {
    commerciallyActive: isCommerciallyActive(commercial.subscription),
    recentUsage,
    activePlans: commercial.activePlans,
  };
};

export const deriveDataFacts = (data: DataReadiness) => {
  const latestSuccessfulSync = getLatestSuccessfulSync(data.syncRuns);
  const latestProblemSync = getLatestProblemSync(data.syncRuns);
  const pendingSyncRun = getPendingSyncRun(data.syncRuns);

  return {
    activeConnections: data.connections.filter((connection) => connection.status === "active"),
    errorConnections: data.connections.filter((connection) => connection.status === "error"),
    latestSuccessfulSync,
    latestProblemSync,
    pendingSyncRun,
  };
};

export const deriveIntelligenceFacts = (input: {
  intelligence: IntelligenceReadiness;
  latestForecastResults: IntelligenceReadiness["latestForecastResults"];
}) => {
  const latestCompletedForecastJob = getLatestCompletedForecastJob(input.intelligence.forecastJobs);
  const latestForecastIssue = getLatestForecastIssue(input.intelligence.forecastJobs);
  const latestDecision = getLatestDecision(input.intelligence.decisions);
  const latestApproval = getLatestApproval(input.intelligence.approvals);
  const latestExecution = getLatestExecution(input.intelligence.executions);

  return {
    latestCompletedForecastJob,
    latestForecastIssue,
    forecastReady:
      latestCompletedForecastJob !== null && input.latestForecastResults.length > 0,
    latestDecision,
    latestApproval,
    latestExecution,
    workflowReady:
      input.intelligence.approvals.length > 0 || input.intelligence.executions.length > 0,
  };
};

export const deriveActivationChecklist = (input: {
  commercial: CommercialReadiness;
  data: DataReadiness;
  intelligence: IntelligenceReadiness;
  latestForecastResults: IntelligenceReadiness["latestForecastResults"];
}): ActivationChecklistItem[] => {
  const commerciallyActive = isCommerciallyActive(input.commercial.subscription);
  const activeConnections = input.data.connections.filter((connection) => connection.status === "active");
  const latestSuccessfulSync = getLatestSuccessfulSync(input.data.syncRuns);
  const latestProblemSync = getLatestProblemSync(input.data.syncRuns);
  const latestCompletedForecastJob = getLatestCompletedForecastJob(input.intelligence.forecastJobs);
  const latestDecision = getLatestDecision(input.intelligence.decisions);
  const latestApproval = getLatestApproval(input.intelligence.approvals);
  const latestExecution = getLatestExecution(input.intelligence.executions);
  const workflowReady = latestApproval !== null || latestExecution !== null;

  return [
    {
      id: "commercial-readiness",
      title: "Commercial readiness",
      status: commerciallyActive ? "complete" : "blocked",
      evidence: commerciallyActive
        ? `${input.commercial.subscription?.plan.name ?? "Plan"} is ${formatLabel(
            input.commercial.subscription?.status ?? "active",
          )}.`
        : "No active or trialing subscription is currently persisted.",
      helper: input.commercial.entitlements
        ? `Usage window ${formatDateTime(input.commercial.entitlements.usageWindow.start)} to ${formatDateTime(input.commercial.entitlements.usageWindow.end)}.`
        : "Entitlement resolution is unavailable until a persisted subscription is present.",
      href: "/activation",
      linkLabel: "Review billing",
    },
    {
      id: "data-connection",
      title: "Connect a data source",
      status:
        activeConnections.length > 0
          ? "complete"
          : input.data.connections.length > 0
            ? "attention"
            : "blocked",
      evidence:
        activeConnections.length > 0
          ? `${formatNumber(activeConnections.length)} active connection(s) are persisted.`
          : input.data.connections.length > 0
            ? "Connections exist, but none are currently active."
            : "No integration connection is persisted yet.",
      helper: "Activation depends on tenant-scoped connection records from the integrations module.",
      href: buildIntegrationsHref(),
      linkLabel: "Open data connections",
    },
    {
      id: "first-sync",
      title: "Complete the first successful sync",
      status:
        latestSuccessfulSync !== null
          ? "complete"
          : input.data.syncRuns.length > 0
            ? "attention"
            : "blocked",
      evidence:
        latestSuccessfulSync !== null
          ? `${formatSyncType(latestSuccessfulSync.syncType)} completed ${formatDateTime(latestSuccessfulSync.completedAt)}.`
          : latestProblemSync
            ? `${formatSyncType(latestProblemSync.syncType)} is ${formatSyncStatus(latestProblemSync.status).toLowerCase()}.`
            : "No successful sync run is currently persisted.",
      helper: "The page treats a completed integration sync as the first durable inbound-data milestone.",
      href: buildIntegrationsHref(),
      linkLabel: "Open sync control",
    },
    {
      id: "failed-records",
      title: "Clear onboarding blockers",
      status: input.data.failedRecords.length === 0 ? "complete" : "attention",
      evidence:
        input.data.failedRecords.length === 0
          ? "No unresolved failed records are currently exposed."
          : `${formatNumber(input.data.failedRecords.length)} unresolved failed record(s) remain in the dead-letter queue.`,
      helper: "Failed-record replay is not exposed yet, so this step is about using the existing support and integration views to diagnose blockers.",
      href: buildSupportActionsHref(),
      linkLabel: "Open support actions",
    },
    {
      id: "first-forecast",
      title: "Generate the first usable forecast",
      status:
        latestCompletedForecastJob && input.latestForecastResults.length > 0
          ? "complete"
          : input.intelligence.forecastJobs.length > 0
            ? "attention"
            : "blocked",
      evidence:
        latestCompletedForecastJob && input.latestForecastResults.length > 0
          ? `${formatNumber(input.latestForecastResults.length)} result row(s) are persisted for forecast job ${latestCompletedForecastJob.id}.`
          : latestCompletedForecastJob
            ? `Completed forecast job ${latestCompletedForecastJob.id} is persisted, but no result rows were loaded for the latest completed job.`
            : "No forecast job evidence is currently persisted.",
      helper: "Forecast readiness is derived from recent forecast jobs plus result rows for the latest completed job.",
      href: buildDataOpsHref(
        latestCompletedForecastJob ? { forecastJobId: latestCompletedForecastJob.id } : {},
      ),
      linkLabel: "Open data & forecast ops",
    },
    {
      id: "first-decision",
      title: "Generate the first decision",
      status: latestDecision ? "complete" : "blocked",
      evidence: latestDecision
        ? `Latest decision ${latestDecision.id} is ${formatLabel(latestDecision.status)}.`
        : "No decision record is currently persisted.",
      helper: "Decision readiness is grounded in the real decision read model only.",
      href: "/decisions",
      linkLabel: "Open decision inbox",
    },
    {
      id: "first-workflow",
      title: "Move a decision into workflow",
      status: workflowReady ? "complete" : "blocked",
      evidence: latestExecution
        ? `Latest execution ${latestExecution.id} is ${formatLabel(latestExecution.status)}.`
        : latestApproval
          ? `Latest approval task ${latestApproval.id} is ${formatLabel(latestApproval.status)}.`
          : "No approval or execution record is currently persisted.",
      helper: "Workflow readiness is confirmed by approval or execution evidence rather than inferred from decision status alone.",
      href: "/workflow",
      linkLabel: "Open workflow operations",
    },
  ];
};

export const deriveNextBestAction = (input: {
  commercial: CommercialReadiness;
  data: DataReadiness;
  intelligence: IntelligenceReadiness;
  latestForecastResults: IntelligenceReadiness["latestForecastResults"];
}): NextBestAction => {
  const activePlans = input.commercial.activePlans;
  const activeConnections = input.data.connections.filter((connection) => connection.status === "active");
  const pendingSyncRun = getPendingSyncRun(input.data.syncRuns);
  const latestSuccessfulSync = getLatestSuccessfulSync(input.data.syncRuns);
  const latestProblemSync = getLatestProblemSync(input.data.syncRuns);
  const latestForecastIssue = getLatestForecastIssue(input.intelligence.forecastJobs);
  const latestCompletedForecastJob = getLatestCompletedForecastJob(input.intelligence.forecastJobs);
  const forecastReady =
    latestCompletedForecastJob !== null && input.latestForecastResults.length > 0;
  const latestDecision = getLatestDecision(input.intelligence.decisions);
  const workflowReady =
    input.intelligence.approvals.length > 0 || input.intelligence.executions.length > 0;

  if (!input.commercial.subscription) {
    return {
      kind: activePlans.length > 0 ? "checkout" : "link",
      title: "Start commercial onboarding",
      description:
        "No current subscription is persisted. Start checkout on an active plan before treating this tenant as commercially activated.",
      buttonLabel: activePlans.length > 0 ? "Start checkout" : "Review billing",
      href: activePlans.length === 0 ? "/activation" : null,
      tone: "critical",
    };
  }

  if (!isCommerciallyActive(input.commercial.subscription)) {
    return {
      kind: input.commercial.subscription.stripeCustomerId ? "portal" : "checkout",
      title: "Resolve subscription state",
      description: `Subscription status is ${formatLabel(input.commercial.subscription.status)}. Use the real billing action the backend exposes to bring the tenant back into a commercially usable state.`,
      buttonLabel: input.commercial.subscription.stripeCustomerId
        ? "Open billing portal"
        : "Start checkout",
      href: null,
      tone: "critical",
    };
  }

  if (activeConnections.length === 0) {
    return {
      kind: "link",
      title: "Connect the first data source",
      description:
        "The tenant is commercially active but still has no active integration connection. Activation remains blocked until at least one data connection is live.",
      buttonLabel: "Open data connections",
      href: buildIntegrationsHref(),
      tone: "critical",
    };
  }

  if (input.data.failedRecords.length > 0) {
    return {
      kind: "link",
      title: "Resolve failed ingestion records",
      description:
        "Inbound data has dead-lettered records that can still block usable platform data. Review the support or integration views to diagnose the current blockers.",
      buttonLabel: "Open support actions",
      href: buildSupportActionsHref({
        integrationConnectionId: input.data.failedRecords[0]?.integrationConnectionId ?? null,
        syncRunId: input.data.failedRecords[0]?.syncRunId ?? null,
      }),
      tone: "critical",
    };
  }

  if (!latestSuccessfulSync) {
    if (pendingSyncRun) {
      return {
        kind: "process_sync",
        title: "Process the pending sync",
        description: `A pending ${formatSyncType(pendingSyncRun.syncType).toLowerCase()} run already exists and can be processed now through the real integration endpoint.`,
        buttonLabel: "Process pending sync",
        href: null,
        tone: "warning",
      };
    }

    return {
      kind: "link",
      title: "Run the first successful sync",
      description:
        latestProblemSync
          ? `The most recent sync is ${formatSyncStatus(latestProblemSync.status).toLowerCase()}. Create or process the next sync in the integrations workspace.`
          : "No successful sync run is persisted yet. Create the first sync in the integrations workspace.",
      buttonLabel: "Open data connections",
      href: buildIntegrationsHref(),
      tone: "warning",
    };
  }

  if (!forecastReady) {
    return {
      kind: "link",
      title: "Establish forecast readiness",
      description:
        latestForecastIssue
          ? `Recent forecast evidence is ${formatLabel(latestForecastIssue.status)}. Use the forecast operations workspace to inspect or process the current forecast flow.`
          : "No usable forecast results are currently persisted. Review forecast operations next.",
      buttonLabel: "Open data & forecast ops",
      href: buildDataOpsHref(
        latestForecastIssue ? { forecastJobId: latestForecastIssue.id } : {},
      ),
      tone: "warning",
    };
  }

  if (!latestDecision) {
    return {
      kind: "link",
      title: "Review the first decision",
      description:
        "The platform has data and forecast evidence, but no decision record is currently persisted. Move into the decision workspace next.",
      buttonLabel: "Open decision inbox",
      href: "/decisions",
      tone: "warning",
    };
  }

  if (!workflowReady) {
    return {
      kind: "link",
      title: "Move the first decision into workflow",
      description:
        "A decision exists, but the platform has not yet persisted approval or execution evidence. Review workflow operations next.",
      buttonLabel: "Open workflow operations",
      href: "/workflow",
      tone: "warning",
    };
  }

  return {
    kind: "link",
    title: "Activation evidence is in place",
    description:
      "The core commercial, data, forecast, decision, and workflow milestones are all represented in persisted backend state. Review outcomes next to confirm value delivery.",
    buttonLabel: "Open risk & outcomes",
    href: "/outcomes",
    tone: "positive",
  };
};

export const formatSubscriptionStatus = (value: PlanSubscription["status"]): string =>
  formatLabel(value);

export const formatBillingInterval = (value: BillingPlan["interval"]): string =>
  value === "monthly" ? "Monthly" : "Yearly";

export const formatUsageMeterType = (value: BillingUsageMeter["meterType"]): string =>
  formatLabel(value);
