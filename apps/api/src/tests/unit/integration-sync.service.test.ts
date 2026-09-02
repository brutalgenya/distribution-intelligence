import { IntegrationDirection, IntegrationSyncStatus, IntegrationSyncType, IntegrationType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { CustomerOrderLineRepository } from "../../modules/demand/customer-order-line.repository.js";
import type { CustomerOrderRepository } from "../../modules/demand/customer-order.repository.js";
import type { DemandSignalService } from "../../modules/demand/demand-signal.service.js";
import type { HistoricalSaleRepository } from "../../modules/demand/historical-sale.repository.js";
import type { SalesImportRunRepository } from "../../modules/demand/sales-import.repository.js";
import type { InventoryPositionRepository } from "../../modules/inventory/inventory-position.repository.js";
import type { InventoryService } from "../../modules/inventory/inventory.service.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { IntegrationAdapterRegistry } from "../../modules/integrations/integration-adapter.registry.js";
import type { IntegrationConnectionRepository } from "../../modules/integrations/integration-connection.repository.js";
import type { IntegrationFailedRecordRepository } from "../../modules/integrations/integration-failed-record.repository.js";
import type { IntegrationSourceRecordRepository } from "../../modules/integrations/integration-source-record.repository.js";
import type { IntegrationSyncRunRepository } from "../../modules/integrations/integration-sync-run.repository.js";
import { buildPayloadChecksum } from "../../modules/integrations/integration-checksum.js";
import { IntegrationSyncService } from "../../modules/integrations/integration-sync.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const buildSyncRun = (syncType: IntegrationSyncType) => ({
  id: "sync-run-id",
  organizationId: "organization-id",
  integrationConnectionId: "connection-id",
  requestedByUserId: "user-id",
  direction: IntegrationDirection.inbound,
  syncType,
  status: IntegrationSyncStatus.pending,
  startedAt: new Date("2026-03-28T09:00:00.000Z"),
  completedAt: null,
  processedCount: 0,
  successCount: 0,
  failureCount: 0,
  checkpoint: null,
  errorSummary: null,
  inputPayload: { records: [] },
  createdAt: new Date("2026-03-28T09:00:00.000Z"),
  updatedAt: new Date("2026-03-28T09:00:00.000Z"),
  integrationConnection: {
    id: "connection-id",
    organizationId: "organization-id",
    integrationType: IntegrationType.manual_bridge,
    name: "Manual",
    status: "active",
    configJson: {},
    credentialsRef: null,
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  requestedByUser: {
    id: "user-id",
    email: "owner@example.com",
    displayName: "Owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
});

const buildService = (overrides?: {
  adapterRecords?: Array<Record<string, unknown>>;
  existingSourceRecord?: { payloadChecksum: string; canonicalEntityType: string | null; canonicalEntityId: string | null } | null;
}) => {
  const transactionRunner: TransactionRunner = {
    run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
      operation({ salesImportRun: { findUnique: vi.fn() } } as unknown as Prisma.TransactionClient),
    ) as TransactionRunner["run"],
  };

  const integrationConnectionRepository = {
    updateById: vi.fn().mockResolvedValue(undefined),
  } as unknown as IntegrationConnectionRepository;
  const integrationSyncRunRepository = {
    listPendingInboundRuns: vi.fn().mockResolvedValue([buildSyncRun(IntegrationSyncType.inventory_import)]),
    updateById: vi.fn().mockImplementation(async (_db, input) => ({
      ...buildSyncRun(IntegrationSyncType.inventory_import),
      ...input.data,
    })),
  } as unknown as IntegrationSyncRunRepository;
  const integrationFailedRecordRepository = {
    create: vi.fn().mockResolvedValue({
      id: "failed-record-id",
      organizationId: "organization-id",
      integrationConnectionId: "connection-id",
      syncRunId: "sync-run-id",
      recordType: "inventory_snapshot",
      sourceReference: "ext-1",
      payload: {},
      errorMessage: "error",
      createdAt: new Date(),
      resolvedAt: null,
    }),
  } as unknown as IntegrationFailedRecordRepository;
  const integrationSourceRecordRepository = {
    findByExternalReference: vi.fn().mockResolvedValue(overrides?.existingSourceRecord ?? null),
    upsert: vi.fn().mockResolvedValue(undefined),
  } as unknown as IntegrationSourceRecordRepository;
  const integrationAdapterRegistry = {
    resolve: vi.fn().mockReturnValue({
      loadInboundRecords: vi.fn().mockResolvedValue(
        overrides?.adapterRecords ?? [
          {
            kind: "inventory_snapshot",
            sourceReference: "ext-1",
            payload: {
              skuCode: "SKU-001",
              locationCode: "WH-1",
              onHandQty: 5,
            },
          },
        ],
      ),
    }),
  } as unknown as IntegrationAdapterRegistry;
  const telemetryService = {
    measureAsync: vi.fn(async (_name, operation: () => Promise<unknown>) => operation()),
    incrementCounter: vi.fn(),
  } as unknown as TelemetryService;
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as AppLogger;
  const auditEventRepository = {
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditEventRepository;
  const outboxEventRepository = {
    create: vi.fn().mockResolvedValue(undefined),
  } as unknown as OutboxEventRepository;

  const service = new IntegrationSyncService(
    {} as Prisma.TransactionClient,
    transactionRunner,
    integrationConnectionRepository,
    integrationSyncRunRepository,
    integrationFailedRecordRepository,
    integrationSourceRecordRepository,
    {} as SkuRepository,
    {} as LocationRepository,
    {} as CustomerOrderRepository,
    {} as CustomerOrderLineRepository,
    {} as SalesImportRunRepository,
    {} as HistoricalSaleRepository,
    {} as InventoryPositionRepository,
    {} as DemandSignalService,
    {} as InventoryService,
    {} as BillingEntitlementService,
    integrationAdapterRegistry,
    {} as AuthorizationService,
    auditEventRepository,
    outboxEventRepository,
    telemetryService,
    logger,
  );

  return {
    service,
    integrationFailedRecordRepository,
    integrationSourceRecordRepository,
  };
};

describe("IntegrationSyncService", () => {
  it("skips duplicate records when the same external reference and checksum are replayed", async () => {
    const replayedRecord = {
      kind: "inventory_snapshot",
      sourceReference: "ext-1",
      payload: {
        skuCode: "SKU-001",
        locationCode: "WH-1",
        onHandQty: 5,
      },
    } as const;
    const { service, integrationFailedRecordRepository, integrationSourceRecordRepository } = buildService({
      adapterRecords: [replayedRecord],
      existingSourceRecord: {
        payloadChecksum: buildPayloadChecksum(replayedRecord),
        canonicalEntityType: "InventoryPosition",
        canonicalEntityId: "position-id",
      },
    });

    await service.processPendingSyncRuns();

    expect(vi.mocked(integrationSourceRecordRepository.upsert)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(integrationFailedRecordRepository.create)).not.toHaveBeenCalled();
  });

  it("dead-letters immutable replay mismatches instead of applying them twice", async () => {
    const { service, integrationFailedRecordRepository } = buildService({
      existingSourceRecord: {
        payloadChecksum: "different-checksum",
        canonicalEntityType: "InventoryPosition",
        canonicalEntityId: "position-id",
      },
    });

    await service.processPendingSyncRuns();

    expect(vi.mocked(integrationFailedRecordRepository.create)).toHaveBeenCalledTimes(1);
  });
});
