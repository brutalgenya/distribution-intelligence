import { formatDateTime, formatLabel, formatNumber } from "../../lib/utils/format";
import {
  formatIntegrationType,
  formatSyncStatus,
  formatSyncType,
} from "../data-ops/selectors";
import type { MetricCardItem } from "../outcomes/types";
import type {
  ConnectionEditorState,
  ConnectionRow,
  CreateIntegrationConnectionInput,
  CreateIntegrationSyncRunInput,
  IntegrationConnection,
  IntegrationConnectionFilters,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  IntegrationsRouteParams,
  OnboardingReadinessSummary,
  SafeConfigField,
  SyncRunCreateDraft,
  UpdateIntegrationConnectionInput,
} from "./types";

const toTimestamp = (value: string | null | undefined): number =>
  value ? new Date(value).getTime() : 0;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const getString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const getBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

export const buildConnectionRows = (
  connections: IntegrationConnection[],
  syncRuns: IntegrationSyncRun[],
  failedRecords: IntegrationFailedRecord[],
): ConnectionRow[] =>
  connections
    .map((connection) => {
      const connectionRuns = syncRuns
        .filter((syncRun) => syncRun.integrationConnectionId === connection.id)
        .sort((left, right) => toTimestamp(right.startedAt) - toTimestamp(left.startedAt));

      return {
        ...connection,
        latestSyncRun: connectionRuns[0] ?? null,
        lastSuccessfulSyncAt:
          connectionRuns.find((syncRun) => syncRun.status === "completed")?.completedAt ?? null,
        unresolvedFailedRecordCount: failedRecords.filter(
          (record) =>
            record.integrationConnectionId === connection.id && record.resolvedAt === null,
        ).length,
      } satisfies ConnectionRow;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

export const filterConnectionRows = (
  rows: ConnectionRow[],
  filters: IntegrationConnectionFilters,
): ConnectionRow[] => {
  const searchText = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.integrationType !== "all" && row.integrationType !== filters.integrationType) {
      return false;
    }

    if (filters.status !== "all" && row.status !== filters.status) {
      return false;
    }

    if (searchText.length === 0) {
      return true;
    }

    const haystack = `${row.name} ${row.id} ${row.credentialsRef ?? ""}`.toLowerCase();
    return haystack.includes(searchText);
  });
};

export const deriveConnectionAttentionNotes = (connection: ConnectionRow): string[] => {
  const notes: string[] = [];

  if (connection.status === "error") {
    notes.push("Persisted connection status is error.");
  }

  if (connection.status === "inactive") {
    notes.push("Connection is inactive and will not process syncs until reactivated.");
  }

  if (!connection.lastSuccessfulSyncAt) {
    notes.push("No completed sync run is currently persisted for this connection.");
  }

  if (
    connection.latestSyncRun &&
    (connection.latestSyncRun.status === "failed" || connection.latestSyncRun.status === "partial")
  ) {
    notes.push(
      `Latest sync run ended as ${formatSyncStatus(connection.latestSyncRun.status).toLowerCase()}.`,
    );
  }

  if (connection.unresolvedFailedRecordCount > 0) {
    notes.push(
      `${formatNumber(connection.unresolvedFailedRecordCount)} unresolved failed record(s) remain in the ingestion dead-letter queue.`,
    );
  }

  return notes;
};

export const deriveOnboardingReadinessSummary = (input: {
  rows: ConnectionRow[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
}): OnboardingReadinessSummary => {
  const activeConnections = input.rows.filter((row) => row.status === "active");
  const attentionConnections = input.rows.filter(
    (row) => deriveConnectionAttentionNotes(row).length > 0,
  );
  const problematicSyncRuns = input.syncRuns.filter(
    (syncRun) => syncRun.status === "failed" || syncRun.status === "partial",
  );
  const latestSuccessfulSyncAt =
    input.syncRuns
      .filter((syncRun) => syncRun.status === "completed")
      .sort(
        (left, right) =>
          toTimestamp(right.completedAt ?? right.startedAt) -
          toTimestamp(left.completedAt ?? left.startedAt),
      )[0]?.completedAt ?? null;

  const tone =
    input.rows.length === 0
      ? "warning"
      : attentionConnections.length > 0 || input.failedRecords.length > 0
        ? "critical"
        : activeConnections.length > 0
          ? "positive"
          : "warning";

  const statusLabel =
    input.rows.length === 0
      ? "No connections yet"
      : tone === "positive"
        ? "Ready for onboarding"
        : tone === "critical"
          ? "Attention needed"
          : "Partially ready";

  const helper =
    input.rows.length === 0
      ? "No tenant-scoped integration connection is persisted yet. Create the first connection to begin onboarding data."
      : tone === "positive"
        ? `At least one active connection is persisted and there are no current failed-record blockers in the exposed read models. Latest successful sync ${formatDateTime(latestSuccessfulSyncAt)}.`
        : "Readiness is derived from active connections, persisted connection statuses, recent failed or partial syncs, and unresolved failed records.";

  const cards: MetricCardItem[] = [
    {
      id: "connections-total",
      label: "Total connections",
      value: formatNumber(input.rows.length),
      helper: "Tenant-scoped integration connections currently persisted by the backend.",
      tone: input.rows.length > 0 ? "neutral" : "warning",
    },
    {
      id: "connections-active",
      label: "Active connections",
      value: formatNumber(activeConnections.length),
      helper: "Connections in active status and eligible for sync processing.",
      tone: activeConnections.length > 0 ? "positive" : "warning",
    },
    {
      id: "sync-issues",
      label: "Failed or partial syncs",
      value: formatNumber(problematicSyncRuns.length),
      helper: "Recent sync runs whose persisted status is failed or partial.",
      tone: problematicSyncRuns.length > 0 ? "critical" : "positive",
    },
    {
      id: "failed-records",
      label: "Unresolved onboarding issues",
      value: formatNumber(input.failedRecords.length),
      helper: "Dead-lettered records that still need backend-supported recovery or source correction.",
      tone: input.failedRecords.length > 0 ? "critical" : "positive",
    },
  ];

  return {
    statusLabel,
    tone,
    helper,
    cards,
  };
};

export const deriveLatestOnboardingTimestamp = (input: {
  rows: ConnectionRow[];
  syncRuns: IntegrationSyncRun[];
  failedRecords: IntegrationFailedRecord[];
}): string | null =>
  [
    ...input.rows.map((row) => row.updatedAt),
    ...input.syncRuns.map((syncRun) => syncRun.completedAt ?? syncRun.updatedAt),
    ...input.failedRecords.map((record) => record.createdAt),
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => toTimestamp(right) - toTimestamp(left))[0] ?? null;

export const deriveVisibleSyncRuns = (
  syncRuns: IntegrationSyncRun[],
  integrationConnectionId: string | null,
): IntegrationSyncRun[] =>
  syncRuns
    .filter((syncRun) =>
      integrationConnectionId ? syncRun.integrationConnectionId === integrationConnectionId : true,
    )
    .sort(
      (left, right) =>
        toTimestamp(right.completedAt ?? right.startedAt) -
        toTimestamp(left.completedAt ?? left.startedAt),
    );

export const deriveVisibleFailedRecords = (
  failedRecords: IntegrationFailedRecord[],
  params: Pick<IntegrationsRouteParams, "integrationConnectionId" | "syncRunId">,
): IntegrationFailedRecord[] =>
  failedRecords
    .filter((record) =>
      params.syncRunId
        ? record.syncRunId === params.syncRunId
        : params.integrationConnectionId
          ? record.integrationConnectionId === params.integrationConnectionId
          : true,
    )
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt));

export const createDefaultConnectionEditorState = (
  integrationType: ConnectionEditorState["integrationType"] = "erp",
): ConnectionEditorState => ({
  integrationType,
  name: "",
  status: "active",
  credentialsRef: "",
  endpointBaseUrl: "",
  externalSystemCode: "",
  warehouseGroup: "",
  delimiter: ",",
  hasHeaderRow: true,
  sourceLabel: "",
});

export const buildConnectionEditorState = (
  connection: IntegrationConnection,
): ConnectionEditorState => {
  const config = asRecord(connection.configJson);

  return {
    integrationType: connection.integrationType,
    name: connection.name,
    status: connection.status,
    credentialsRef: connection.credentialsRef ?? "",
    endpointBaseUrl: getString(config.endpointBaseUrl),
    externalSystemCode: getString(config.externalSystemCode),
    warehouseGroup: getString(config.warehouseGroup),
    delimiter: getString(config.delimiter) || ",",
    hasHeaderRow: getBoolean(config.hasHeaderRow, true),
    sourceLabel: getString(config.sourceLabel),
  };
};

export const getSafeConfigFields = (connection: IntegrationConnection): SafeConfigField[] => {
  const config = asRecord(connection.configJson);

  if (connection.integrationType === "erp") {
    return [
      { label: "Adapter mode", value: "Fake" },
      { label: "Endpoint base URL", value: getString(config.endpointBaseUrl) || "Not set" },
      { label: "External system code", value: getString(config.externalSystemCode) || "Not set" },
    ];
  }

  if (connection.integrationType === "wms") {
    return [
      { label: "Adapter mode", value: "Fake" },
      { label: "Endpoint base URL", value: getString(config.endpointBaseUrl) || "Not set" },
      { label: "Warehouse group", value: getString(config.warehouseGroup) || "Not set" },
    ];
  }

  if (connection.integrationType === "csv_import") {
    return [
      { label: "Delimiter", value: getString(config.delimiter) || "," },
      {
        label: "Header row",
        value: getBoolean(config.hasHeaderRow, true) ? "Present" : "Not present",
      },
    ];
  }

  return [{ label: "Source label", value: getString(config.sourceLabel) || "Not set" }];
};

const buildConnectionConfigJson = (state: ConnectionEditorState): unknown => {
  if (state.integrationType === "erp") {
    return {
      adapterMode: "fake",
      ...(state.endpointBaseUrl.trim().length > 0
        ? { endpointBaseUrl: state.endpointBaseUrl.trim() }
        : {}),
      ...(state.externalSystemCode.trim().length > 0
        ? { externalSystemCode: state.externalSystemCode.trim() }
        : {}),
    };
  }

  if (state.integrationType === "wms") {
    return {
      adapterMode: "fake",
      ...(state.endpointBaseUrl.trim().length > 0
        ? { endpointBaseUrl: state.endpointBaseUrl.trim() }
        : {}),
      ...(state.warehouseGroup.trim().length > 0
        ? { warehouseGroup: state.warehouseGroup.trim() }
        : {}),
    };
  }

  if (state.integrationType === "csv_import") {
    return {
      delimiter: state.delimiter || ",",
      hasHeaderRow: state.hasHeaderRow,
    };
  }

  return {
    ...(state.sourceLabel.trim().length > 0 ? { sourceLabel: state.sourceLabel.trim() } : {}),
  };
};

export const buildCreateConnectionInput = (
  state: ConnectionEditorState,
): CreateIntegrationConnectionInput => ({
  integrationType: state.integrationType,
  name: state.name.trim(),
  status: state.status,
  configJson: buildConnectionConfigJson(state),
  ...(state.credentialsRef.trim().length > 0
    ? { credentialsRef: state.credentialsRef.trim() }
    : {}),
});

export const buildUpdateConnectionInput = (
  state: ConnectionEditorState,
): UpdateIntegrationConnectionInput => ({
  name: state.name.trim(),
  status: state.status,
  configJson: buildConnectionConfigJson(state),
  credentialsRef: state.credentialsRef.trim().length > 0 ? state.credentialsRef.trim() : null,
});

export const getConnectionConfigHelp = (
  integrationType: ConnectionEditorState["integrationType"],
): string => {
  if (integrationType === "erp") {
    return "ERP connections only expose fake-adapter metadata in this phase. Capture endpoint and external system code only when those references are meaningful to your onboarding workflow.";
  }

  if (integrationType === "wms") {
    return "WMS connections expose fake-adapter metadata in this phase. Use warehouse group only when that backend grouping is already meaningful to your tenant.";
  }

  if (integrationType === "csv_import") {
    return "CSV import connections store parsing preferences only. Secret file-transfer setup is not exposed by the backend today.";
  }

  return "Manual bridge connections are metadata only. Use the source label to explain how operators or a bridge process will feed records into the platform.";
};

export const getSyncInputInstructions = (
  integrationType: IntegrationConnection["integrationType"],
): {
  label: string;
  placeholder: string;
  helper: string;
} => {
  if (integrationType === "csv_import") {
    return {
      label: "CSV content",
      placeholder: "sku_code,name,base_uom\\nSKU-001,Sample SKU,EA",
      helper:
        "Paste raw CSV content exactly as you want the backend CSV adapter to parse it. The client sends it as { csvContent } without additional transformation.",
    };
  }

  return {
    label: "Input payload JSON",
    placeholder:
      '{\n  "records": [\n    {\n      "recordType": "catalog",\n      "sourceReference": "ext-001",\n      "payload": {\n        "skuCode": "SKU-001",\n        "name": "Sample SKU"\n      }\n    }\n  ]\n}',
    helper:
      "Paste a JSON object that already matches the backend adapter input contract, typically { \"records\": [...] }. The client will not reshape the payload for you.",
  };
};

export const buildCreateSyncRunInput = (
  draft: SyncRunCreateDraft,
  integrationType: IntegrationConnection["integrationType"],
): CreateIntegrationSyncRunInput => {
  const trimmedInput = draft.inputPayloadText.trim();

  if (trimmedInput.length === 0) {
    return {
      connectionId: draft.connectionId,
      direction: draft.direction,
      syncType: draft.syncType,
    };
  }

  if (integrationType === "csv_import") {
    return {
      connectionId: draft.connectionId,
      direction: draft.direction,
      syncType: draft.syncType,
      inputPayload: {
        csvContent: draft.inputPayloadText,
      },
    };
  }

  const parsed = JSON.parse(trimmedInput) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      'Sync input JSON must be an object that already matches the backend adapter contract, usually { "records": [...] }.',
    );
  }

  return {
    connectionId: draft.connectionId,
    direction: draft.direction,
    syncType: draft.syncType,
    inputPayload: parsed,
  };
};

export const createDefaultSyncRunDraft = (connectionId = ""): SyncRunCreateDraft => ({
  connectionId,
  direction: "inbound",
  syncType: "catalog_import",
  inputPayloadText: "",
});

export const deriveSyncActionAvailability = (
  syncRun: IntegrationSyncRun,
): {
  canProcess: boolean;
  reason: string | null;
} => {
  if (syncRun.status === "pending") {
    return {
      canProcess: true,
      reason: null,
    };
  }

  if (syncRun.status === "running") {
    return {
      canProcess: false,
      reason: "This sync run is already running.",
    };
  }

  return {
    canProcess: false,
    reason:
      "The backend only exposes process for pending sync runs. Failed or partial runs can be replaced by creating a fresh sync run instead.",
  };
};

export const formatConnectionStatus = (value: ConnectionRow["status"]): string =>
  formatLabel(value);

export const getSyncRunSummaryLabel = (syncRun: IntegrationSyncRun | null): string =>
  syncRun
    ? `${formatSyncType(syncRun.syncType)} | ${formatSyncStatus(syncRun.status)}`
    : "No sync run selected";

export { formatIntegrationType, formatSyncStatus, formatSyncType };
