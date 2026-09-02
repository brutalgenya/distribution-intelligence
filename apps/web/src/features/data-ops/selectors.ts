import { formatDateTime, formatLabel, formatNumber } from "../../lib/utils/format";
import type { MetricCardItem } from "../outcomes/types";
import type {
  AiRun,
  AnomalyScore,
  ConnectionRow,
  CustomerOrder,
  DataOpsContextParams,
  DataOpsHealthSummary,
  ForecastJob,
  ForecastJobRow,
  ForecastResult,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  MatchedDemandEvidence,
  SalesImportRun,
} from "./types";
import type { WorkerStatus } from "../workflow/types";

const maxTimestamp = (values: Array<string | null | undefined>): string | null =>
  values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

export const parseScopeReference = (
  value: unknown,
): { skuId?: string; locationId?: string } | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return {
    ...(typeof candidate.skuId === "string" ? { skuId: candidate.skuId } : {}),
    ...(typeof candidate.locationId === "string" ? { locationId: candidate.locationId } : {}),
  };
};

export const buildConnectionRows = (
  connections: IntegrationConnection[],
  syncRuns: IntegrationSyncRun[],
): ConnectionRow[] =>
  connections
    .map((connection) => {
      const connectionRuns = syncRuns
        .filter((syncRun) => syncRun.integrationConnectionId === connection.id)
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        );

      const latestSyncRun = connectionRuns[0] ?? null;
      const lastSuccessfulSyncAt =
        connectionRuns.find((syncRun) => syncRun.status === "completed")?.completedAt ?? null;

      return {
        ...connection,
        latestSyncRun,
        lastSuccessfulSyncAt,
      } satisfies ConnectionRow;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

export const isRelevantForecastJob = (
  job: ForecastJob,
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
): boolean => {
  if (!context.skuId) {
    return true;
  }

  const scopeReference = parseScopeReference(job.scopeReference);

  if (job.scopeType === "sku_location") {
    return (
      scopeReference?.skuId === context.skuId &&
      (!context.locationId || scopeReference.locationId === context.locationId)
    );
  }

  if (job.scopeType === "sku") {
    return scopeReference?.skuId === context.skuId;
  }

  return false;
};

export const buildForecastJobRows = (
  jobs: ForecastJob[],
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
): ForecastJobRow[] =>
  jobs
    .map((job) => {
      const scopeReference = parseScopeReference(job.scopeReference);
      const scopeLabel =
        job.scopeType === "sku_location"
          ? `SKU ${scopeReference?.skuId ?? "unknown"} @ Location ${scopeReference?.locationId ?? "unknown"}`
          : job.scopeType === "sku"
            ? `SKU ${scopeReference?.skuId ?? "unknown"}`
            : "Organization scope";

      return {
        ...job,
        scopeLabel,
        isContextMatch: isRelevantForecastJob(job, context),
      } satisfies ForecastJobRow;
    })
    .sort((left, right) => {
      const rightDate = right.completedAt ?? right.createdAt;
      const leftDate = left.completedAt ?? left.createdAt;
      return new Date(rightDate).getTime() - new Date(leftDate).getTime();
    });

export const selectRelevantForecastJobRows = (
  rows: ForecastJobRow[],
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
): ForecastJobRow[] => {
  if (!context.skuId) {
    return rows;
  }

  const matchingRows = rows.filter((row) => row.isContextMatch);
  return matchingRows.length > 0 ? matchingRows : rows;
};

export const selectRelevantForecastResults = (
  results: ForecastResult[],
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
): ForecastResult[] => {
  if (!context.skuId) {
    return results;
  }

  return results.filter(
    (result) =>
      result.skuId === context.skuId &&
      (!context.locationId || result.locationId === context.locationId || result.locationId === null),
  );
};

export const matchDemandEvidence = (
  orders: CustomerOrder[],
  context: Pick<DataOpsContextParams, "skuId" | "locationId">,
): MatchedDemandEvidence[] => {
  if (!context.skuId || !context.locationId) {
    return [];
  }

  return orders
    .flatMap((order) => {
      const matchingLines = order.lines.filter(
        (line) => line.skuId === context.skuId && line.locationId === context.locationId,
      );

      if (matchingLines.length === 0) {
        return [];
      }

      return [
        {
          order,
          matchedQuantity: matchingLines.reduce((sum, line) => sum + line.quantity, 0),
        } satisfies MatchedDemandEvidence,
      ];
    })
    .sort(
      (left, right) =>
        new Date(right.order.orderedAt).getTime() - new Date(left.order.orderedAt).getTime(),
    )
    .slice(0, 8);
};

export const deriveHealthSummary = (input: {
  connections: IntegrationConnection[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
  forecastJobs: ForecastJobRow[];
  aiRuns: AiRun[];
  salesImportRuns: SalesImportRun[];
  workerStatus: WorkerStatus[];
}): DataOpsHealthSummary => {
  const connectionErrors = input.connections.filter((connection) => connection.status === "error");
  const syncIssues = input.syncRuns.filter(
    (syncRun) => syncRun.status === "failed" || syncRun.status === "partial",
  );
  const forecastFailures = input.forecastJobs.filter((job) => job.status === "failed");
  const degradedAiRuns = input.aiRuns.filter(
    (run) => run.status === "failed" || run.status === "degraded",
  );
  const latestSuccessfulSyncAt =
    input.syncRuns
      .filter((syncRun) => syncRun.status === "completed")
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.startedAt).getTime() -
          new Date(left.completedAt ?? left.startedAt).getTime(),
      )[0]?.completedAt ?? null;
  const latestSalesImport =
    input.salesImportRuns
      .slice()
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? right.startedAt).getTime() -
          new Date(left.completedAt ?? left.startedAt).getTime(),
      )[0] ?? null;
  const forecastWorker =
    input.workerStatus.find((status) => status.workerType === "forecast") ?? null;
  const integrationWorker =
    input.workerStatus.find((status) => status.workerType === "integration") ?? null;

  const cards: MetricCardItem[] = [
    {
      id: "connection-errors",
      label: "Connections in error",
      value: formatNumber(connectionErrors.length),
      helper: "Integration connections whose persisted status is error.",
      tone: connectionErrors.length > 0 ? "critical" : "positive",
    },
    {
      id: "sync-issues",
      label: "Failed or partial syncs",
      value: formatNumber(syncIssues.length),
      helper: "Recent sync runs with failed or partial status from the integration layer.",
      tone: syncIssues.length > 0 ? "critical" : "positive",
    },
    {
      id: "forecast-failures",
      label: "Failed forecast jobs",
      value: formatNumber(forecastFailures.length),
      helper: "Forecast jobs in failed status from the support forecast queue.",
      tone: forecastFailures.length > 0 ? "warning" : "positive",
    },
    {
      id: "ai-issues",
      label: "Failed or degraded AI runs",
      value: formatNumber(degradedAiRuns.length),
      helper: "Recent AI runs with failed or degraded status across forecast and anomaly processing.",
      tone: degradedAiRuns.length > 0 ? "warning" : "neutral",
    },
  ];

  return {
    cards,
    freshness: [
      {
        id: "latest-sync",
        label: "Latest successful sync",
        value: latestSuccessfulSyncAt ? formatDateTime(latestSuccessfulSyncAt) : "Not available",
        helper: latestSuccessfulSyncAt
          ? "Most recent completed integration sync run."
          : "No completed sync run is currently persisted.",
      },
      {
        id: "latest-sales-import",
        label: "Latest sales import",
        value: latestSalesImport ? formatDateTime(latestSalesImport.completedAt ?? latestSalesImport.startedAt) : "Not available",
        helper: latestSalesImport
          ? `${formatLabel(latestSalesImport.status)} sales import run.`
          : "No sales import run is currently persisted.",
      },
      {
        id: "forecast-worker",
        label: "Forecast worker",
        value: forecastWorker?.lastRunAt ? formatDateTime(forecastWorker.lastRunAt) : "Not available",
        helper: forecastWorker
          ? `Last status ${forecastWorker.lastStatus ?? "unknown"}.`
          : "No forecast worker diagnostic record is available.",
      },
      {
        id: "integration-worker",
        label: "Integration worker",
        value: integrationWorker?.lastRunAt ? formatDateTime(integrationWorker.lastRunAt) : "Not available",
        helper: integrationWorker
          ? `Last status ${integrationWorker.lastStatus ?? "unknown"}.`
          : "No integration worker diagnostic record is available.",
      },
    ],
  };
};

export const formatIntegrationType = (value: string): string =>
  value === "csv_import" ? "CSV import" : value === "manual_bridge" ? "Manual bridge" : value.toUpperCase();

export const formatSyncStatus = (value: string): string =>
  value === "partial" ? "Partial" : formatLabel(value);

export const getSyncStatusTone = (status: IntegrationSyncRun["status"]): "success" | "warning" | "danger" | "neutral" => {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "partial":
      return "warning";
    default:
      return "neutral";
  }
};

export const formatSyncType = (value: string): string =>
  value === "catalog_import"
    ? "Catalog import"
    : value === "demand_import"
      ? "Demand import"
      : value === "inventory_import"
        ? "Inventory import"
        : formatLabel(value);

export const formatForecastScopeType = (value: ForecastJob["scopeType"]): string =>
  value === "sku_location" ? "SKU + location" : formatLabel(value);

export const formatAiRunType = (value: string): string =>
  value === "forecast_enhancement"
    ? "Forecast enhancement"
    : value === "anomaly_scoring"
      ? "Anomaly scoring"
      : value === "decision_explanation"
        ? "Decision explanation"
        : formatLabel(value);

export const parseSubjectScope = (
  anomaly: Pick<AnomalyScore, "subjectType" | "subjectReference">,
): { skuId: string | null; locationId: string | null } => {
  if (anomaly.subjectType === "sku_location") {
    const [skuId, locationId] = anomaly.subjectReference.split(":");
    return {
      skuId: skuId ?? null,
      locationId: locationId ?? null,
    };
  }

  if (anomaly.subjectType === "sku") {
    return {
      skuId: anomaly.subjectReference,
      locationId: null,
    };
  }

  return {
    skuId: null,
    locationId: null,
  };
};

export const getContextSummary = (context: Pick<DataOpsContextParams, "skuId" | "locationId">): string => {
  const details: string[] = [];

  if (context.skuId && context.locationId) {
    details.push(`Scoped to SKU ${context.skuId} at location ${context.locationId}.`);
  } else if (context.skuId) {
    details.push(`Scoped to SKU ${context.skuId}.`);
  } else {
    details.push("Showing tenant-level data and forecast operations health.");
  }

  if ("integrationConnectionId" in context && typeof context.integrationConnectionId === "string") {
    details.push(`Focused connection ${context.integrationConnectionId}.`);
  }

  if ("syncRunId" in context && typeof context.syncRunId === "string") {
    details.push(`Focused sync run ${context.syncRunId}.`);
  }

  if ("forecastJobId" in context && typeof context.forecastJobId === "string") {
    details.push(`Focused forecast job ${context.forecastJobId}.`);
  }

  return details.join(" ");
};

export const deriveLatestDiagnosticTimestamp = (input: {
  syncRuns: IntegrationSyncRun[];
  forecastJobs: ForecastJob[];
  aiRuns: AiRun[];
  failedRecords: IntegrationFailedRecord[];
}): string | null =>
  maxTimestamp([
    ...input.syncRuns.map((syncRun) => syncRun.updatedAt),
    ...input.forecastJobs.map((job) => job.completedAt ?? job.startedAt ?? job.createdAt),
    ...input.aiRuns.map((run) => run.completedAt ?? run.createdAt),
    ...input.failedRecords.map((record) => record.createdAt),
  ]);
