import { formatLabel, formatNumber } from "../../lib/utils/format";
import { formatForecastScopeType, parseScopeReference } from "../data-ops/selectors";
import { formatExecutionStatus, formatExecutionTaskType } from "../workflow/presentation";
import type {
  ForecastJob,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  SupportActionSummaryCard,
  SupportActionableItem,
  SupportActionsRouteParams,
  SupportExecutionTask,
} from "./types";

const toTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const summarizeUnknownError = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    const candidate = value as { message?: unknown };
    if (typeof candidate.message === "string" && candidate.message.trim().length > 0) {
      return candidate.message;
    }

    const serialized = JSON.stringify(value);
    return serialized === "{}" ? null : serialized;
  }

  return null;
};

const matchesSkuLocationExecution = (
  task: SupportExecutionTask,
  params: Pick<SupportActionsRouteParams, "skuId" | "locationId">,
): boolean => {
  if (!params.skuId) {
    return true;
  }

  if (task.decision.skuId !== params.skuId) {
    return false;
  }

  return !params.locationId || task.decision.locationId === params.locationId;
};

const matchesSkuLocationForecast = (
  job: ForecastJob,
  params: Pick<SupportActionsRouteParams, "skuId" | "locationId">,
): boolean => {
  if (!params.skuId) {
    return true;
  }

  const scopeReference = parseScopeReference(job.scopeReference);

  if (job.scopeType === "sku_location") {
    return (
      scopeReference?.skuId === params.skuId &&
      (!params.locationId || scopeReference.locationId === params.locationId)
    );
  }

  if (job.scopeType === "sku") {
    return scopeReference?.skuId === params.skuId;
  }

  return false;
};

const getExecutionActionLabel = (task: SupportExecutionTask): string | null => {
  if (task.status === "failed" || task.status === "dead_lettered") {
    return "Requeue execution";
  }

  if (task.status === "pending") {
    return "Cancel execution";
  }

  return null;
};

export const canRequeueExecution = (task: SupportExecutionTask): boolean =>
  task.status === "failed" || task.status === "dead_lettered";

export const canCancelExecution = (task: SupportExecutionTask): boolean => task.status === "pending";

export const canProcessForecastJob = (job: ForecastJob): boolean => job.status === "pending";

export const canRequeueForecastJob = (job: ForecastJob): boolean =>
  job.status === "failed" || job.status === "completed";

export const canProcessSyncRun = (syncRun: IntegrationSyncRun): boolean => syncRun.status === "pending";

export const canTriggerReplacementSync = (syncRun: IntegrationSyncRun): boolean =>
  syncRun.status === "failed" || syncRun.status === "partial";

export const deriveExecutionRecoveryTasks = (
  tasks: SupportExecutionTask[],
  params: Pick<SupportActionsRouteParams, "skuId" | "locationId">,
): SupportExecutionTask[] =>
  tasks
    .filter((task) => matchesSkuLocationExecution(task, params))
    .filter((task) => canRequeueExecution(task) || canCancelExecution(task))
    .sort(
      (left, right) =>
        toTimestamp(right.updatedAt ?? right.createdAt) - toTimestamp(left.updatedAt ?? left.createdAt),
    );

export const deriveForecastRecoveryJobs = (
  jobs: ForecastJob[],
  params: Pick<SupportActionsRouteParams, "skuId" | "locationId">,
): ForecastJob[] =>
  jobs
    .filter((job) => matchesSkuLocationForecast(job, params))
    .filter((job) => job.status === "failed" || job.status === "pending")
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.createdAt) - toTimestamp(left.completedAt ?? left.createdAt),
    );

export const deriveSyncRecoveryRuns = (syncRuns: IntegrationSyncRun[]): IntegrationSyncRun[] =>
  syncRuns
    .filter((syncRun) => canProcessSyncRun(syncRun) || canTriggerReplacementSync(syncRun))
    .sort(
      (left, right) =>
        toTimestamp(right.updatedAt ?? right.startedAt) - toTimestamp(left.updatedAt ?? left.startedAt),
    );

export const deriveActionableSummaryCards = (input: {
  executionTasks: SupportExecutionTask[];
  forecastJobs: ForecastJob[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
}): SupportActionSummaryCard[] => [
  {
    id: "execution-recovery",
    label: "Execution tasks ready for action",
    value: formatNumber(input.executionTasks.length),
    helper: "Failed, dead-lettered, or still-pending execution tasks that expose a safe support action.",
    tone: input.executionTasks.length > 0 ? "critical" : "positive",
  },
  {
    id: "forecast-recovery",
    label: "Forecast jobs ready for action",
    value: formatNumber(input.forecastJobs.length),
    helper: "Failed or queued forecast jobs that can be requeued or processed now.",
    tone: input.forecastJobs.length > 0 ? "warning" : "positive",
  },
  {
    id: "sync-recovery",
    label: "Sync runs ready for action",
    value: formatNumber(input.syncRuns.length),
    helper: "Pending syncs that can be processed now, plus failed or partial runs that can be replaced.",
    tone: input.syncRuns.length > 0 ? "warning" : "positive",
  },
  {
    id: "failed-records",
    label: "Failed records awaiting backend recovery",
    value: formatNumber(input.failedRecords.length),
    helper: "The backend exposes failed-record inspection today, but not replay or resolve actions.",
    tone: input.failedRecords.length > 0 ? "neutral" : "positive",
  },
];

const getQueueRank = (item: SupportActionableItem): number => {
  if (item.sourceType === "execution" && item.statusLabel === "Failed") {
    return 0;
  }

  if (item.sourceType === "execution" && item.statusLabel === "Dead-lettered") {
    return 1;
  }

  if (item.sourceType === "forecast") {
    return 2;
  }

  if (item.sourceType === "sync") {
    return 3;
  }

  if (item.sourceType === "failed_record") {
    return 4;
  }

  return 5;
};

export const deriveActionableQueue = (input: {
  executionTasks: SupportExecutionTask[];
  forecastJobs: ForecastJob[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  connections: IntegrationConnection[];
}): SupportActionableItem[] => {
  const connectionNameById = new Map(input.connections.map((connection) => [connection.id, connection.name]));

  const executionItems = input.executionTasks.map(
    (task) =>
      ({
        key: `execution-${task.id}`,
        sourceType: "execution",
        entityId: task.id,
        title: formatExecutionTaskType(task.taskType),
        statusLabel: formatExecutionStatus(task.status),
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        errorSummary: task.lastError,
        primaryReference: `Decision ${task.decisionId}`,
        secondaryReference:
          task.decision.skuId && task.decision.locationId
            ? `SKU ${task.decision.skuId} @ ${task.decision.locationId}`
            : formatLabel(task.targetSystem),
        availableActionLabel: getExecutionActionLabel(task),
        unsupportedReason: null,
        executionId: task.id,
        forecastJobId: null,
        integrationConnectionId: null,
        syncRunId: null,
        skuId: task.decision.skuId,
        locationId: task.decision.locationId,
      }) satisfies SupportActionableItem,
  );

  const forecastItems = input.forecastJobs.map(
    (job) =>
      ({
        key: `forecast-${job.id}`,
        sourceType: "forecast",
        entityId: job.id,
        title: "Forecast job",
        statusLabel: formatLabel(job.status),
        createdAt: job.createdAt,
        updatedAt: job.completedAt ?? job.startedAt ?? job.createdAt,
        errorSummary: job.errorMessage,
        primaryReference: formatForecastScopeType(job.scopeType),
        secondaryReference: job.id,
        availableActionLabel: canProcessForecastJob(job) ? "Process pending job" : "Requeue forecast",
        unsupportedReason: null,
        executionId: null,
        forecastJobId: job.id,
        integrationConnectionId: null,
        syncRunId: null,
        skuId: parseScopeReference(job.scopeReference)?.skuId ?? null,
        locationId: parseScopeReference(job.scopeReference)?.locationId ?? null,
      }) satisfies SupportActionableItem,
  );

  const syncItems = input.syncRuns.map(
    (syncRun) =>
      ({
        key: `sync-${syncRun.id}`,
        sourceType: "sync",
        entityId: syncRun.id,
        title: formatLabel(syncRun.syncType),
        statusLabel: formatLabel(syncRun.status),
        createdAt: syncRun.createdAt,
        updatedAt: syncRun.updatedAt,
        errorSummary: summarizeUnknownError(syncRun.errorSummary),
        primaryReference:
          connectionNameById.get(syncRun.integrationConnectionId) ?? syncRun.integrationConnectionId,
        secondaryReference: syncRun.id,
        availableActionLabel: canProcessSyncRun(syncRun) ? "Process pending sync" : "Trigger replacement sync",
        unsupportedReason: null,
        executionId: null,
        forecastJobId: null,
        integrationConnectionId: syncRun.integrationConnectionId,
        syncRunId: syncRun.id,
        skuId: null,
        locationId: null,
      }) satisfies SupportActionableItem,
  );

  const failedRecordItems = input.failedRecords
    .slice()
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, 10)
    .map(
      (record) =>
        ({
          key: `failed-record-${record.id}`,
          sourceType: "failed_record",
          entityId: record.id,
          title: record.recordType,
          statusLabel: record.resolvedAt ? "Resolved" : "Unresolved",
          createdAt: record.createdAt,
          updatedAt: record.resolvedAt,
          errorSummary: record.errorMessage,
          primaryReference:
            connectionNameById.get(record.integrationConnectionId) ?? record.integrationConnectionId,
          secondaryReference: record.sourceReference,
          availableActionLabel: null,
          unsupportedReason: "The backend currently exposes failed-record inspection, but not replay or resolve actions.",
          executionId: null,
          forecastJobId: null,
          integrationConnectionId: record.integrationConnectionId,
          syncRunId: record.syncRunId,
          skuId: null,
          locationId: null,
        }) satisfies SupportActionableItem,
    );

  return [...executionItems, ...forecastItems, ...syncItems, ...failedRecordItems].sort((left, right) => {
    const rankDelta = getQueueRank(left) - getQueueRank(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return toTimestamp(right.updatedAt ?? right.createdAt) - toTimestamp(left.updatedAt ?? left.createdAt);
  });
};
