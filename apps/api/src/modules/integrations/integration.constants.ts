import { IntegrationConnectionStatus, IntegrationSyncStatus } from "@prisma/client";

export const integrationAuditEventTypes = {
  connectionCreated: "integration.connection.created",
  connectionUpdated: "integration.connection.updated",
  syncRequested: "integration.sync.requested",
  syncStarted: "integration.sync.started",
  syncCompleted: "integration.sync.completed",
  syncFailed: "integration.sync.failed",
  recordDeadLettered: "integration.record.dead_lettered",
} as const;

export const integrationOutboxEventTypes = {
  connectionCreated: "integration.connection.created.v1",
  connectionUpdated: "integration.connection.updated.v1",
  syncStarted: "integration.sync.started.v1",
  syncCompleted: "integration.sync.completed.v1",
  syncFailed: "integration.sync.failed.v1",
  recordDeadLettered: "integration.record.dead_lettered.v1",
} as const;

export const INTEGRATION_MUTABLE_REPLAY_RECORD_TYPES = new Set<string>(["catalog_sku", "location"]);

export const INTEGRATION_TERMINAL_SYNC_STATUSES = new Set<IntegrationSyncStatus>([
  IntegrationSyncStatus.completed,
  IntegrationSyncStatus.partial,
  IntegrationSyncStatus.failed,
]);

export const INTEGRATION_ACTIVE_CONNECTION_STATUSES = new Set<IntegrationConnectionStatus>([
  IntegrationConnectionStatus.active,
]);
