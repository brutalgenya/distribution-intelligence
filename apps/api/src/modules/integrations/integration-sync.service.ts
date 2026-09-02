import { createHash } from "node:crypto";

import {
  IntegrationConnectionStatus,
  IntegrationSyncStatus,
  LocationStatus,
  Prisma,
  SalesImportRunStatus,
  UsageMeterType,
  type CustomerOrderLine,
  type IntegrationFailedRecord,
  type IntegrationSyncRun,
  type Location,
  type Sku,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { CustomerOrderLineRepository } from "../demand/customer-order-line.repository.js";
import {
  CustomerOrderRepository,
  type CustomerOrderWithLines,
} from "../demand/customer-order.repository.js";
import { DemandSignalService } from "../demand/demand-signal.service.js";
import { HistoricalSaleRepository } from "../demand/historical-sale.repository.js";
import { SalesImportRunRepository } from "../demand/sales-import.repository.js";
import { InventoryPositionRepository } from "../inventory/inventory-position.repository.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { buildPayloadChecksum } from "./integration-checksum.js";
import {
  INTEGRATION_ACTIVE_CONNECTION_STATUSES,
  INTEGRATION_MUTABLE_REPLAY_RECORD_TYPES,
  INTEGRATION_TERMINAL_SYNC_STATUSES,
  integrationAuditEventTypes,
  integrationOutboxEventTypes,
} from "./integration.constants.js";
import { IntegrationAdapterRegistry } from "./integration-adapter.registry.js";
import { IntegrationConnectionRepository } from "./integration-connection.repository.js";
import { IntegrationFailedRecordRepository } from "./integration-failed-record.repository.js";
import {
  mapCatalogRecord,
  mapDemandRecord,
  mapInventoryRecord,
  type CanonicalCatalogSkuRecord,
  type CanonicalCustomerOrderRecord,
  type CanonicalHistoricalSaleRecord,
  type CanonicalInventorySnapshotRecord,
  type CanonicalLocationRecord,
} from "./integration.mappers.js";
import { IntegrationSourceRecordRepository } from "./integration-source-record.repository.js";
import {
  IntegrationSyncRunRepository,
  type IntegrationSyncRunWithConnection,
} from "./integration-sync-run.repository.js";
import type {
  CreateIntegrationSyncRunInput,
  ExternalIntegrationRecord,
  IntegrationFailedRecordDto,
  IntegrationSyncRunDto,
} from "./integration.schemas.js";

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const toIntegrationSyncRunDto = (syncRun: IntegrationSyncRun): IntegrationSyncRunDto => ({
  id: syncRun.id,
  organizationId: syncRun.organizationId,
  integrationConnectionId: syncRun.integrationConnectionId,
  requestedByUserId: syncRun.requestedByUserId,
  direction: syncRun.direction,
  syncType: syncRun.syncType,
  status: syncRun.status,
  startedAt: syncRun.startedAt.toISOString(),
  completedAt: syncRun.completedAt?.toISOString() ?? null,
  processedCount: syncRun.processedCount,
  successCount: syncRun.successCount,
  failureCount: syncRun.failureCount,
  checkpoint: syncRun.checkpoint,
  errorSummary: syncRun.errorSummary,
  createdAt: syncRun.createdAt.toISOString(),
  updatedAt: syncRun.updatedAt.toISOString(),
});

const toIntegrationFailedRecordDto = (record: IntegrationFailedRecord): IntegrationFailedRecordDto => ({
  id: record.id,
  organizationId: record.organizationId,
  integrationConnectionId: record.integrationConnectionId,
  syncRunId: record.syncRunId,
  recordType: record.recordType,
  sourceReference: record.sourceReference,
  payload: record.payload,
  errorMessage: record.errorMessage,
  createdAt: record.createdAt.toISOString(),
  resolvedAt: record.resolvedAt?.toISOString() ?? null,
});

const buildHistoricalSaleFingerprint = (
  organizationId: string,
  input: { skuId: string; locationId: string; quantity: number; soldAt: Date; sourceType: string; sourceReference: string },
): string =>
  createHash("sha256")
    .update(
      [
        organizationId,
        input.skuId,
        input.locationId,
        String(input.quantity),
        input.soldAt.toISOString(),
        input.sourceType,
        input.sourceReference,
      ].join("|"),
    )
    .digest("hex");

const buildCanonicalCustomerOrderSignature = (input: CanonicalCustomerOrderRecord): string =>
  buildPayloadChecksum({
    orderNumber: input.orderNumber,
    customerReference: input.customerReference ?? null,
    orderedAt: input.orderedAt,
    lines: input.lines
      .map((line) => ({
        skuCode: line.skuCode,
        locationCode: line.locationCode,
        quantity: line.quantity,
        unitPrice: line.unitPrice ?? null,
      }))
      .sort((left, right) =>
        `${left.skuCode}:${left.locationCode}:${left.quantity}:${left.unitPrice ?? "null"}`.localeCompare(
          `${right.skuCode}:${right.locationCode}:${right.quantity}:${right.unitPrice ?? "null"}`,
        ),
      ),
  });

const buildPersistedCustomerOrderSignature = (
  input: {
    orderNumber: string;
    customerReference: string | null;
    orderedAt: Date;
    lines: CustomerOrderLine[];
  },
  skuCodeById: Map<string, string>,
  locationCodeById: Map<string, string>,
): string =>
  buildPayloadChecksum({
    orderNumber: input.orderNumber,
    customerReference: input.customerReference,
    orderedAt: input.orderedAt.toISOString(),
    lines: input.lines
      .map((line) => ({
        skuCode: skuCodeById.get(line.skuId) ?? line.skuId,
        locationCode: locationCodeById.get(line.locationId) ?? line.locationId,
        quantity: line.quantity,
        unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
      }))
      .sort((left, right) =>
        `${left.skuCode}:${left.locationCode}:${left.quantity}:${left.unitPrice ?? "null"}`.localeCompare(
          `${right.skuCode}:${right.locationCode}:${right.quantity}:${right.unitPrice ?? "null"}`,
        ),
      ),
  });

interface IntegrationProcessingActor {
  actorUserId: string;
  correlationId: string;
}

interface RecordProcessingOutcome {
  canonicalEntityType: string;
  canonicalEntityId: string | null;
}

interface SyncCounters {
  processedCount: number;
  successCount: number;
  failureCount: number;
}

interface SalesCounters {
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  rejectedRows: number;
}

export class IntegrationSyncService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly integrationSyncRunRepository: IntegrationSyncRunRepository,
    private readonly integrationFailedRecordRepository: IntegrationFailedRecordRepository,
    private readonly integrationSourceRecordRepository: IntegrationSourceRecordRepository,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly customerOrderRepository: CustomerOrderRepository,
    private readonly customerOrderLineRepository: CustomerOrderLineRepository,
    private readonly salesImportRunRepository: SalesImportRunRepository,
    private readonly historicalSaleRepository: HistoricalSaleRepository,
    private readonly inventoryPositionRepository: InventoryPositionRepository,
    private readonly demandSignalService: DemandSignalService,
    private readonly inventoryService: InventoryService,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly integrationAdapterRegistry: IntegrationAdapterRegistry,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async createSyncRun(
    context: RequestContext,
    input: CreateIntegrationSyncRunInput,
  ): Promise<IntegrationSyncRunDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "integrations.write");

      const connection = await this.integrationConnectionRepository.findByIdForOrganization(db, {
        organizationId,
        id: input.connectionId,
      });
      if (!connection) {
        throw new NotFoundError("Integration connection was not found.");
      }

      const syncRun = await this.integrationSyncRunRepository.create(db, {
        organizationId,
        integrationConnectionId: connection.id,
        requestedByUserId: context.user.id,
        direction: input.direction,
        syncType: input.syncType,
        status: IntegrationSyncStatus.pending,
        startedAt: new Date(),
        ...(input.inputPayload ? { inputPayload: input.inputPayload } : {}),
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: integrationAuditEventTypes.syncRequested,
        entityType: "IntegrationSyncRun",
        entityId: syncRun.id,
        payload: {
          integrationConnectionId: connection.id,
          syncType: syncRun.syncType,
          direction: syncRun.direction,
        },
        correlationId: context.correlationId,
      });

      return toIntegrationSyncRunDto(syncRun);
    });
  }

  public async listSyncRuns(
    context: RequestContext,
    filters: {
      integrationConnectionId?: string;
      direction?: IntegrationSyncRun["direction"];
      syncType?: IntegrationSyncRun["syncType"];
      status?: IntegrationSyncRun["status"];
    },
  ): Promise<IntegrationSyncRunDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const runs = await this.integrationSyncRunRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.integrationConnectionId ? { integrationConnectionId: filters.integrationConnectionId } : {}),
      ...(filters.direction ? { direction: filters.direction } : {}),
      ...(filters.syncType ? { syncType: filters.syncType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });

    return runs.map(toIntegrationSyncRunDto);
  }

  public async getSyncRun(context: RequestContext, syncRunId: string): Promise<IntegrationSyncRunDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const syncRun = await this.integrationSyncRunRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: syncRunId,
    });
    if (!syncRun) {
      throw new NotFoundError("Integration sync run was not found.");
    }

    return toIntegrationSyncRunDto(syncRun);
  }

  public async listFailedRecords(
    context: RequestContext,
    filters: { integrationConnectionId?: string; syncRunId?: string; resolved?: boolean },
  ): Promise<IntegrationFailedRecordDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const records = await this.integrationFailedRecordRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.integrationConnectionId ? { integrationConnectionId: filters.integrationConnectionId } : {}),
      ...(filters.syncRunId ? { syncRunId: filters.syncRunId } : {}),
      ...(filters.resolved !== undefined ? { resolved: filters.resolved } : {}),
    });

    return records.map(toIntegrationFailedRecordDto);
  }

  public async getFailedRecord(context: RequestContext, failedRecordId: string): Promise<IntegrationFailedRecordDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const record = await this.integrationFailedRecordRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: failedRecordId,
    });
    if (!record) {
      throw new NotFoundError("Integration failed record was not found.");
    }

    return toIntegrationFailedRecordDto(record);
  }

  public async processSyncRun(context: RequestContext, syncRunId: string): Promise<IntegrationSyncRunDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.write");

    const syncRun = await this.integrationSyncRunRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: syncRunId,
    });
    if (!syncRun) {
      throw new NotFoundError("Integration sync run was not found.");
    }

    return this.processExistingSyncRun(syncRun, {
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });
  }

  public async processPendingSyncRuns(limit = 20): Promise<number> {
    const pendingRuns = await this.integrationSyncRunRepository.listPendingInboundRuns(this.db, limit);
    let processedCount = 0;

    for (const syncRun of pendingRuns) {
      if (!syncRun.requestedByUserId) {
        await this.finalizeSyncRun(syncRun, {
          status: IntegrationSyncStatus.failed,
          processedCount: 0,
          successCount: 0,
          failureCount: 1,
          errorSummary: {
            message: "Sync run cannot be processed without a requestedByUserId.",
          },
          correlationId: syncRun.id,
          actorUserId: null,
        });
        continue;
      }

      await this.processExistingSyncRun(syncRun, {
        actorUserId: syncRun.requestedByUserId,
        correlationId: syncRun.id,
      });
      processedCount += 1;
    }

    return processedCount;
  }

  private async processExistingSyncRun(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
  ): Promise<IntegrationSyncRunDto> {
    if (INTEGRATION_TERMINAL_SYNC_STATUSES.has(syncRun.status)) {
      return toIntegrationSyncRunDto(syncRun);
    }

    if (syncRun.status === IntegrationSyncStatus.running) {
      throw new ConflictError("Integration sync run is already running.");
    }

    if (!INTEGRATION_ACTIVE_CONNECTION_STATUSES.has(syncRun.integrationConnection.status)) {
      throw new ConflictError("Integration connection must be active before sync processing can begin.");
    }

    await this.markSyncRunRunning(syncRun, actor);

    const counters: SyncCounters = {
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
    };
    const salesCounters: SalesCounters = {
      totalRows: 0,
      acceptedRows: 0,
      duplicateRows: 0,
      rejectedRows: 0,
    };

    const adapter = this.integrationAdapterRegistry.resolve(syncRun.integrationConnection.integrationType);
    const salesImportRun =
      syncRun.syncType === "demand_import"
        ? await this.salesImportRunRepository.create(this.db, {
            organizationId: syncRun.organizationId,
            createdByUserId: actor.actorUserId,
            status: SalesImportRunStatus.completed,
            totalRows: 0,
            acceptedRows: 0,
            duplicateRows: 0,
            rejectedRows: 0,
            startedAt: new Date(),
          })
        : null;

    try {
      const records = await this.telemetryService.measureAsync(
        "integration.sync.load.duration_ms",
        () =>
          adapter.loadInboundRecords({
            connection: syncRun.integrationConnection,
            syncType: syncRun.syncType,
            direction: syncRun.direction,
            inputPayload: syncRun.inputPayload ?? null,
          }),
        {
          integrationType: syncRun.integrationConnection.integrationType,
          syncType: syncRun.syncType,
        },
      );

      for (const record of records) {
        counters.processedCount += 1;
        if (record.kind === "historical_sale") {
          salesCounters.totalRows += 1;
        }

        const processingOutcome = await this.processInboundRecord(
          syncRun,
          actor,
          record,
          salesCounters,
          salesImportRun?.id ?? null,
        );
        if (processingOutcome === "success") {
          counters.successCount += 1;
        } else {
          counters.failureCount += 1;
        }
      }

      if (salesImportRun) {
        await this.completeSalesImportRun(syncRun, actor, salesImportRun.id, salesCounters);
      }

      const status =
        counters.failureCount === 0
          ? IntegrationSyncStatus.completed
          : counters.successCount > 0
            ? IntegrationSyncStatus.partial
            : IntegrationSyncStatus.failed;

      const finalizedRun = await this.finalizeSyncRun(syncRun, {
        status,
        processedCount: counters.processedCount,
        successCount: counters.successCount,
        failureCount: counters.failureCount,
        errorSummary:
          counters.failureCount > 0
            ? {
                failedRecordCount: counters.failureCount,
              }
            : null,
        correlationId: actor.correlationId,
        actorUserId: actor.actorUserId,
      });

      this.telemetryService.incrementCounter("integration.sync.processed", 1, {
        syncType: syncRun.syncType,
        status,
      });
      this.logger.info(
        "Processed integration sync run.",
        {
          syncRunId: finalizedRun.id,
          processedCount: counters.processedCount,
          successCount: counters.successCount,
          failureCount: counters.failureCount,
        },
        {
          module: "integrations",
          operation: "processSyncRun",
          organizationId: syncRun.organizationId,
        },
      );

      return toIntegrationSyncRunDto(finalizedRun);
    } catch (error) {
      if (salesImportRun) {
        await this.salesImportRunRepository.updateById(this.db, {
          id: salesImportRun.id,
          data: {
            totalRows: salesCounters.totalRows,
            acceptedRows: salesCounters.acceptedRows,
            duplicateRows: salesCounters.duplicateRows,
            rejectedRows: salesCounters.rejectedRows,
            status: SalesImportRunStatus.failed,
            completedAt: new Date(),
            errorSummary: {
              integrationSyncRunId: syncRun.id,
              message: error instanceof Error ? error.message : "Demand import failed.",
            },
          },
        });
      }

      const finalizedRun = await this.finalizeSyncRun(syncRun, {
        status: IntegrationSyncStatus.failed,
        processedCount: counters.processedCount,
        successCount: counters.successCount,
        failureCount: Math.max(counters.failureCount, 1),
        errorSummary: {
          message: error instanceof Error ? error.message : "Integration sync failed.",
        },
        correlationId: actor.correlationId,
        actorUserId: actor.actorUserId,
      });

      this.telemetryService.incrementCounter("integration.sync.failed", 1, {
        syncType: syncRun.syncType,
        integrationType: syncRun.integrationConnection.integrationType,
      });
      this.logger.error(
        "Integration sync run failed.",
        error,
        {
          module: "integrations",
          operation: "processSyncRun",
          organizationId: syncRun.organizationId,
        },
      );

      return toIntegrationSyncRunDto(finalizedRun);
    }
  }

  private async processInboundRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
    salesCounters: SalesCounters,
    salesImportRunId: string | null,
  ): Promise<"success" | "failure"> {
    const payloadChecksum = buildPayloadChecksum(record);
    const existingSourceRecord = await this.integrationSourceRecordRepository.findByExternalReference(this.db, {
      organizationId: syncRun.organizationId,
      integrationConnectionId: syncRun.integrationConnectionId,
      recordType: record.kind,
      externalReference: record.sourceReference,
    });

    if (existingSourceRecord && existingSourceRecord.payloadChecksum === payloadChecksum) {
      await this.integrationSourceRecordRepository.upsert(this.db, {
        organizationId: syncRun.organizationId,
        integrationConnectionId: syncRun.integrationConnectionId,
        syncRunId: syncRun.id,
        syncType: syncRun.syncType,
        recordType: record.kind,
        externalReference: record.sourceReference,
        payloadChecksum,
        canonicalEntityType: existingSourceRecord.canonicalEntityType,
        canonicalEntityId: existingSourceRecord.canonicalEntityId,
        processedAt: new Date(),
      });

      if (record.kind === "historical_sale") {
        salesCounters.duplicateRows += 1;
      }

      return "success";
    }

    if (existingSourceRecord && !INTEGRATION_MUTABLE_REPLAY_RECORD_TYPES.has(record.kind)) {
      if (record.kind === "historical_sale") {
        salesCounters.rejectedRows += 1;
      }

      await this.deadLetterRecord(syncRun, actor, record, "Immutable integration records cannot change after first processing.");
      return "failure";
    }

    try {
      const outcome = await this.processRecord(syncRun, actor, record, salesImportRunId);
      await this.integrationSourceRecordRepository.upsert(this.db, {
        organizationId: syncRun.organizationId,
        integrationConnectionId: syncRun.integrationConnectionId,
        syncRunId: syncRun.id,
        syncType: syncRun.syncType,
        recordType: record.kind,
        externalReference: record.sourceReference,
        payloadChecksum,
        canonicalEntityType: outcome.canonicalEntityType,
        canonicalEntityId: outcome.canonicalEntityId,
        processedAt: new Date(),
      });

      if (record.kind === "historical_sale") {
        salesCounters.acceptedRows += 1;
      }

      return "success";
    } catch (error) {
      if (record.kind === "historical_sale") {
        salesCounters.rejectedRows += 1;
      }

      await this.deadLetterRecord(syncRun, actor, record, error instanceof Error ? error.message : "Record failed.");
      return "failure";
    }
  }

  private async completeSalesImportRun(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    salesImportRunId: string,
    salesCounters: SalesCounters,
  ): Promise<void> {
    const updateData: Prisma.SalesImportRunUncheckedUpdateInput = {
      totalRows: salesCounters.totalRows,
      acceptedRows: salesCounters.acceptedRows,
      duplicateRows: salesCounters.duplicateRows,
      rejectedRows: salesCounters.rejectedRows,
      status: salesCounters.rejectedRows > 0 ? SalesImportRunStatus.failed : SalesImportRunStatus.completed,
      completedAt: new Date(),
      ...(salesCounters.rejectedRows > 0
        ? {
            errorSummary: {
              integrationSyncRunId: syncRun.id,
              rejectedRows: salesCounters.rejectedRows,
            },
          }
        : {}),
    };

    await this.salesImportRunRepository.updateById(this.db, {
      id: salesImportRunId,
      data: updateData,
    });

    await this.auditEventRepository.create(this.db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      eventType: "demand.sales.imported",
      entityType: "SalesImportRun",
      entityId: salesImportRunId,
      payload: {
        totalRows: salesCounters.totalRows,
        acceptedRows: salesCounters.acceptedRows,
        duplicateRows: salesCounters.duplicateRows,
        rejectedRows: salesCounters.rejectedRows,
        integrationSyncRunId: syncRun.id,
      },
      correlationId: actor.correlationId,
    });

    await this.outboxEventRepository.create(this.db, {
      organizationId: syncRun.organizationId,
      eventType: "demand.sales.imported.v1",
      aggregateType: "SalesImportRun",
      aggregateId: salesImportRunId,
      payload: {
        organizationId: syncRun.organizationId,
        salesImportRunId,
        integrationSyncRunId: syncRun.id,
        totalRows: salesCounters.totalRows,
        acceptedRows: salesCounters.acceptedRows,
        duplicateRows: salesCounters.duplicateRows,
        rejectedRows: salesCounters.rejectedRows,
      },
    });
  }

  private async markSyncRunRunning(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
  ): Promise<void> {
    await this.transactionRunner.run(async (db) => {
      await this.integrationSyncRunRepository.updateById(db, {
        id: syncRun.id,
        data: {
          status: IntegrationSyncStatus.running,
          startedAt: new Date(),
          completedAt: null,
          errorSummary: Prisma.JsonNull,
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        actorUserId: actor.actorUserId,
        eventType: integrationAuditEventTypes.syncStarted,
        entityType: "IntegrationSyncRun",
        entityId: syncRun.id,
        payload: {
          integrationConnectionId: syncRun.integrationConnectionId,
          syncType: syncRun.syncType,
          direction: syncRun.direction,
        },
        correlationId: actor.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        eventType: integrationOutboxEventTypes.syncStarted,
        aggregateType: "IntegrationSyncRun",
        aggregateId: syncRun.id,
        payload: {
          organizationId: syncRun.organizationId,
          integrationSyncRunId: syncRun.id,
          integrationConnectionId: syncRun.integrationConnectionId,
          syncType: syncRun.syncType,
          direction: syncRun.direction,
        },
      });
    });
  }

  private async finalizeSyncRun(
    syncRun: IntegrationSyncRunWithConnection,
    input: {
      status: IntegrationSyncStatus;
      processedCount: number;
      successCount: number;
      failureCount: number;
      errorSummary: Prisma.InputJsonObject | null;
      correlationId: string;
      actorUserId: string | null;
    },
  ): Promise<IntegrationSyncRun> {
    return this.transactionRunner.run(async (db) => {
      const completedAt = new Date();
      const finalizedRun = await this.integrationSyncRunRepository.updateById(db, {
        id: syncRun.id,
        data: {
          status: input.status,
          processedCount: input.processedCount,
          successCount: input.successCount,
          failureCount: input.failureCount,
          completedAt,
          checkpoint: {
            processedCount: input.processedCount,
            successCount: input.successCount,
            failureCount: input.failureCount,
          },
          ...(input.errorSummary ? { errorSummary: input.errorSummary } : { errorSummary: Prisma.JsonNull }),
        },
      });

      await this.integrationConnectionRepository.updateById(db, {
        id: syncRun.integrationConnectionId,
        data:
          input.status === IntegrationSyncStatus.failed
            ? { status: IntegrationConnectionStatus.error }
            : { status: IntegrationConnectionStatus.active, lastSyncAt: completedAt },
      });

      await this.auditEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        actorUserId: input.actorUserId,
        eventType:
          input.status === IntegrationSyncStatus.failed
            ? integrationAuditEventTypes.syncFailed
            : integrationAuditEventTypes.syncCompleted,
        entityType: "IntegrationSyncRun",
        entityId: finalizedRun.id,
        payload: {
          integrationConnectionId: syncRun.integrationConnectionId,
          syncType: syncRun.syncType,
          direction: syncRun.direction,
          status: input.status,
          processedCount: input.processedCount,
          successCount: input.successCount,
          failureCount: input.failureCount,
          errorSummary: input.errorSummary,
        },
        correlationId: input.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        eventType:
          input.status === IntegrationSyncStatus.failed
            ? integrationOutboxEventTypes.syncFailed
            : integrationOutboxEventTypes.syncCompleted,
        aggregateType: "IntegrationSyncRun",
        aggregateId: finalizedRun.id,
        payload: {
          organizationId: syncRun.organizationId,
          integrationSyncRunId: finalizedRun.id,
          integrationConnectionId: syncRun.integrationConnectionId,
          status: input.status,
          processedCount: input.processedCount,
          successCount: input.successCount,
          failureCount: input.failureCount,
          errorSummary: input.errorSummary,
        },
      });

      return finalizedRun;
    });
  }

  private async deadLetterRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
    errorMessage: string,
  ): Promise<void> {
    await this.transactionRunner.run(async (db) => {
      const failedRecord = await this.integrationFailedRecordRepository.create(db, {
        organizationId: syncRun.organizationId,
        integrationConnectionId: syncRun.integrationConnectionId,
        syncRunId: syncRun.id,
        recordType: record.kind,
        sourceReference: record.sourceReference,
        payload: toJsonValue(record),
        errorMessage,
      });

      await this.auditEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        actorUserId: actor.actorUserId,
        eventType: integrationAuditEventTypes.recordDeadLettered,
        entityType: "IntegrationFailedRecord",
        entityId: failedRecord.id,
        payload: {
          syncRunId: syncRun.id,
          recordType: record.kind,
          sourceReference: record.sourceReference,
          errorMessage,
        },
        correlationId: actor.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        eventType: integrationOutboxEventTypes.recordDeadLettered,
        aggregateType: "IntegrationFailedRecord",
        aggregateId: failedRecord.id,
        payload: {
          organizationId: syncRun.organizationId,
          integrationFailedRecordId: failedRecord.id,
          syncRunId: syncRun.id,
          recordType: record.kind,
          sourceReference: record.sourceReference,
          errorMessage,
        },
      });
    });
  }

  private async processRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
    salesImportRunId: string | null,
  ): Promise<RecordProcessingOutcome> {
    switch (syncRun.syncType) {
      case "catalog_import":
        return this.processCatalogRecord(syncRun, actor, record);
      case "demand_import":
        return this.processDemandRecord(syncRun, actor, record, salesImportRunId);
      case "inventory_import":
        return this.processInventoryRecord(syncRun, actor, record);
    }

    throw new BadRequestError(`Unsupported sync type: ${String(syncRun.syncType)}.`);
  }

  private async processCatalogRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
  ): Promise<RecordProcessingOutcome> {
    const canonicalRecord = mapCatalogRecord(record);

    return this.transactionRunner.run(async (db) => {
      if (canonicalRecord.kind === "catalog_sku") {
        return this.upsertSkuRecord(db, syncRun, actor, canonicalRecord);
      }

      return this.upsertLocationRecord(db, syncRun, actor, canonicalRecord);
    });
  }

  private async processDemandRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
    salesImportRunId: string | null,
  ): Promise<RecordProcessingOutcome> {
    const canonicalRecord = mapDemandRecord(record);

    return this.transactionRunner.run(async (db) => {
      if (canonicalRecord.kind === "customer_order") {
        return this.createCustomerOrderFromCanonicalRecord(db, syncRun, actor, canonicalRecord);
      }

      return this.appendHistoricalSaleFromCanonicalRecord(db, syncRun, canonicalRecord, salesImportRunId);
    });
  }

  private async processInventoryRecord(
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: ExternalIntegrationRecord,
  ): Promise<RecordProcessingOutcome> {
    const canonicalRecord = mapInventoryRecord(record);

    return this.transactionRunner.run(async (db) => {
      if (canonicalRecord.kind === "location") {
        return this.upsertLocationRecord(db, syncRun, actor, canonicalRecord);
      }

      return this.applyInventorySnapshotRecord(db, syncRun, actor, canonicalRecord);
    });
  }

  private async upsertSkuRecord(
    db: DbClient,
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: CanonicalCatalogSkuRecord,
  ): Promise<RecordProcessingOutcome> {
    const existingSku = await this.skuRepository.findByCodeForOrganization(db, {
      organizationId: syncRun.organizationId,
      skuCode: record.skuCode,
    });

    if (existingSku) {
      const updatedSku = await this.skuRepository.updateForOrganization(db, {
        organizationId: syncRun.organizationId,
        id: existingSku.id,
        data: {
          skuCode: record.skuCode,
          name: record.name,
          description: record.description ?? null,
          baseUom: record.baseUom,
          packSize: record.packSize,
          status: record.status,
          ...(record.metadata ? { metadata: record.metadata } : { metadata: Prisma.JsonNull }),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        actorUserId: actor.actorUserId,
        eventType: "catalog.sku.updated",
        entityType: "Sku",
        entityId: updatedSku.id,
        payload: {
          sourceReference: record.externalReference,
          skuCode: updatedSku.skuCode,
          status: updatedSku.status,
        },
        correlationId: actor.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        eventType: "catalog.sku.updated.v1",
        aggregateType: "Sku",
        aggregateId: updatedSku.id,
        payload: {
          organizationId: syncRun.organizationId,
          skuId: updatedSku.id,
          sourceReference: record.externalReference,
          skuCode: updatedSku.skuCode,
          status: updatedSku.status,
        },
      });

      return {
        canonicalEntityType: "Sku",
        canonicalEntityId: updatedSku.id,
      };
    }

    await this.billingEntitlementService.ensureNewSkuAllowedInTransaction(db, {
      organizationId: syncRun.organizationId,
    });

    const createdSku = await this.skuRepository.create(db, {
      organizationId: syncRun.organizationId,
      skuCode: record.skuCode,
      name: record.name,
      description: record.description ?? null,
      baseUom: record.baseUom,
      packSize: record.packSize,
      status: record.status,
      ...(record.metadata ? { metadata: record.metadata } : {}),
    });

    await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      correlationId: actor.correlationId,
      meterTypes: [UsageMeterType.skus],
      sourceType: "integration_catalog_import",
      sourceReference: createdSku.id,
    });

    await this.auditEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      eventType: "catalog.sku.created",
      entityType: "Sku",
      entityId: createdSku.id,
      payload: {
        sourceReference: record.externalReference,
        skuCode: createdSku.skuCode,
        status: createdSku.status,
      },
      correlationId: actor.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      eventType: "catalog.sku.created.v1",
      aggregateType: "Sku",
      aggregateId: createdSku.id,
      payload: {
        organizationId: syncRun.organizationId,
        skuId: createdSku.id,
        sourceReference: record.externalReference,
        skuCode: createdSku.skuCode,
        status: createdSku.status,
      },
    });

    return {
      canonicalEntityType: "Sku",
      canonicalEntityId: createdSku.id,
    };
  }

  private async upsertLocationRecord(
    db: DbClient,
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: CanonicalLocationRecord,
  ): Promise<RecordProcessingOutcome> {
    const existingLocation = await this.locationRepository.findByCodeForOrganization(db, {
      organizationId: syncRun.organizationId,
      code: record.code,
    });

    if (existingLocation) {
      const updatedLocation = await this.locationRepository.updateById(db, {
        id: existingLocation.id,
        data: {
          code: record.code,
          name: record.name,
          type: record.type,
          status: record.status,
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        actorUserId: actor.actorUserId,
        eventType: "inventory.location.updated",
        entityType: "Location",
        entityId: updatedLocation.id,
        payload: {
          sourceReference: record.externalReference,
          code: updatedLocation.code,
          status: updatedLocation.status,
        },
        correlationId: actor.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: syncRun.organizationId,
        eventType: "inventory.location.updated.v1",
        aggregateType: "Location",
        aggregateId: updatedLocation.id,
        payload: {
          organizationId: syncRun.organizationId,
          locationId: updatedLocation.id,
          sourceReference: record.externalReference,
          code: updatedLocation.code,
          status: updatedLocation.status,
        },
      });

      return {
        canonicalEntityType: "Location",
        canonicalEntityId: updatedLocation.id,
      };
    }

    const createdLocation = await this.locationRepository.create(db, {
      organizationId: syncRun.organizationId,
      code: record.code,
      name: record.name,
      type: record.type,
      status: record.status,
    });

    await this.auditEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      eventType: "inventory.location.created",
      entityType: "Location",
      entityId: createdLocation.id,
      payload: {
        sourceReference: record.externalReference,
        code: createdLocation.code,
        status: createdLocation.status,
      },
      correlationId: actor.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      eventType: "inventory.location.created.v1",
      aggregateType: "Location",
      aggregateId: createdLocation.id,
      payload: {
        organizationId: syncRun.organizationId,
        locationId: createdLocation.id,
        sourceReference: record.externalReference,
        code: createdLocation.code,
        status: createdLocation.status,
      },
    });

    return {
      canonicalEntityType: "Location",
      canonicalEntityId: createdLocation.id,
    };
  }

  private async createCustomerOrderFromCanonicalRecord(
    db: DbClient,
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: CanonicalCustomerOrderRecord,
  ): Promise<RecordProcessingOutcome> {
    const skuCodes = [...new Set(record.lines.map((line) => line.skuCode))];
    const locationCodes = [...new Set(record.lines.map((line) => line.locationCode))];

    const [skus, locations, existingOrder] = await Promise.all([
      this.skuRepository.listByCodesForOrganization(db, {
        organizationId: syncRun.organizationId,
        skuCodes,
      }),
      this.locationRepository.listByCodesForOrganization(db, {
        organizationId: syncRun.organizationId,
        codes: locationCodes,
      }),
      this.customerOrderRepository.findByOrderNumberForOrganization(db, {
        organizationId: syncRun.organizationId,
        orderNumber: record.orderNumber,
      }),
    ]);

    const skuByCode = new Map<string, Sku>(skus.map((sku) => [sku.skuCode, sku]));
    const locationByCode = new Map<string, Location>(locations.map((location) => [location.code, location]));

    for (const line of record.lines) {
      if (!skuByCode.has(line.skuCode)) {
        throw new NotFoundError(`Unknown skuCode: ${line.skuCode}.`);
      }
      if (!locationByCode.has(line.locationCode)) {
        throw new NotFoundError(`Unknown locationCode: ${line.locationCode}.`);
      }
    }

    if (existingOrder) {
      const existingSkuCodeById = new Map(skus.map((sku) => [sku.id, sku.skuCode]));
      const existingLocationCodeById = new Map(locations.map((location) => [location.id, location.code]));
      const existingSignature = buildPersistedCustomerOrderSignature(
        {
          orderNumber: existingOrder.orderNumber,
          customerReference: existingOrder.customerReference,
          orderedAt: existingOrder.orderedAt,
          lines: existingOrder.lines,
        },
        existingSkuCodeById,
        existingLocationCodeById,
      );
      const incomingSignature = buildCanonicalCustomerOrderSignature(record);

      if (existingSignature !== incomingSignature) {
        throw new ConflictError("Customer order already exists with different contents.");
      }

      return {
        canonicalEntityType: "CustomerOrder",
        canonicalEntityId: existingOrder.id,
      };
    }

    const order = await this.customerOrderRepository.create(db, {
      organizationId: syncRun.organizationId,
      orderNumber: record.orderNumber,
      customerReference: record.customerReference ?? null,
      orderedAt: new Date(record.orderedAt),
      createdByUserId: actor.actorUserId,
    });

    await this.customerOrderLineRepository.createMany(
      db,
      record.lines.map((line) => ({
        orderId: order.id,
        skuId: skuByCode.get(line.skuCode)!.id,
        locationId: locationByCode.get(line.locationCode)!.id,
        quantity: line.quantity,
        ...(line.unitPrice !== undefined ? { unitPrice: new Prisma.Decimal(line.unitPrice) } : {}),
      })),
    );

    const persistedOrder = await this.customerOrderRepository.findByIdForOrganization(db, {
      organizationId: syncRun.organizationId,
      id: order.id,
    });
    if (!persistedOrder) {
      throw new NotFoundError("Customer order was not found after creation.");
    }

    await this.demandSignalService.appendSignals(
      db,
      persistedOrder.lines.map((line) => ({
        organizationId: syncRun.organizationId,
        skuId: line.skuId,
        locationId: line.locationId,
        signalType: "customer_order",
        quantity: line.quantity,
        observedAt: persistedOrder.orderedAt,
        sourceType: "integration_customer_order",
        sourceReference: record.externalReference,
        metadata: {
          integrationSyncRunId: syncRun.id,
          customerOrderId: persistedOrder.id,
          orderLineId: line.id,
        } satisfies Prisma.InputJsonObject,
      })),
    );

    await this.auditEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      eventType: "demand.order.created",
      entityType: "CustomerOrder",
      entityId: persistedOrder.id,
      payload: {
        orderNumber: persistedOrder.orderNumber,
        sourceReference: record.externalReference,
        lineCount: persistedOrder.lines.length,
      },
      correlationId: actor.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: syncRun.organizationId,
      eventType: "demand.order.created.v1",
      aggregateType: "CustomerOrder",
      aggregateId: persistedOrder.id,
      payload: {
        organizationId: syncRun.organizationId,
        customerOrderId: persistedOrder.id,
        sourceReference: record.externalReference,
        orderNumber: persistedOrder.orderNumber,
        lineCount: persistedOrder.lines.length,
        status: persistedOrder.status,
      },
    });

    return {
      canonicalEntityType: "CustomerOrder",
      canonicalEntityId: persistedOrder.id,
    };
  }

  private async appendHistoricalSaleFromCanonicalRecord(
    db: DbClient,
    syncRun: IntegrationSyncRunWithConnection,
    record: CanonicalHistoricalSaleRecord,
    salesImportRunId: string | null,
  ): Promise<RecordProcessingOutcome> {
    const [sku, location] = await Promise.all([
      this.skuRepository.findByCodeForOrganization(db, {
        organizationId: syncRun.organizationId,
        skuCode: record.skuCode,
      }),
      this.locationRepository.findByCodeForOrganization(db, {
        organizationId: syncRun.organizationId,
        code: record.locationCode,
      }),
    ]);

    if (!sku) {
      throw new NotFoundError(`Unknown skuCode: ${record.skuCode}.`);
    }
    if (!location) {
      throw new NotFoundError(`Unknown locationCode: ${record.locationCode}.`);
    }

    const salesImportRun = salesImportRunId
      ? await db.salesImportRun.findUnique({
          where: { id: salesImportRunId },
        })
      : null;
    if (!salesImportRun) {
      throw new NotFoundError("A sales import run is required before historical sales can be appended.");
    }

    const soldAt = new Date(record.soldAt);
    const rowFingerprint = buildHistoricalSaleFingerprint(syncRun.organizationId, {
      skuId: sku.id,
      locationId: location.id,
      quantity: record.quantity,
      soldAt,
      sourceType: record.sourceType,
      sourceReference: record.externalReference,
    });

    const existingRows = await this.historicalSaleRepository.findExistingFingerprints(db, {
      organizationId: syncRun.organizationId,
      rowFingerprints: [rowFingerprint],
    });
    if (!existingRows.has(rowFingerprint)) {
      await this.historicalSaleRepository.createMany(db, [
        {
          organizationId: syncRun.organizationId,
          salesImportRunId: salesImportRun.id,
          skuId: sku.id,
          locationId: location.id,
          quantity: record.quantity,
          soldAt,
          sourceType: record.sourceType,
          sourceReference: record.externalReference,
          rowFingerprint,
        },
      ]);

      await this.demandSignalService.appendSignals(db, [
        {
          organizationId: syncRun.organizationId,
          skuId: sku.id,
          locationId: location.id,
          signalType: "historical_sale",
          quantity: record.quantity,
          observedAt: soldAt,
          sourceType: record.sourceType,
          sourceReference: record.externalReference,
          metadata: {
            integrationSyncRunId: syncRun.id,
            salesImportRunId: salesImportRun.id,
          } satisfies Prisma.InputJsonObject,
        },
      ]);
    }

    return {
      canonicalEntityType: "HistoricalSale",
      canonicalEntityId: rowFingerprint,
    };
  }

  private async applyInventorySnapshotRecord(
    db: DbClient,
    syncRun: IntegrationSyncRunWithConnection,
    actor: IntegrationProcessingActor,
    record: CanonicalInventorySnapshotRecord,
  ): Promise<RecordProcessingOutcome> {
    const [sku, location] = await Promise.all([
      this.skuRepository.findByCodeForOrganization(db, {
        organizationId: syncRun.organizationId,
        skuCode: record.skuCode,
      }),
      this.locationRepository.findByCodeForOrganization(db, {
        organizationId: syncRun.organizationId,
        code: record.locationCode,
      }),
    ]);

    if (!sku) {
      throw new NotFoundError(`Unknown skuCode: ${record.skuCode}.`);
    }
    if (!location) {
      throw new NotFoundError(`Unknown locationCode: ${record.locationCode}.`);
    }
    if (location.status !== LocationStatus.active) {
      throw new ConflictError("Inventory snapshots can only be applied to active locations.");
    }

    const currentPosition = await this.inventoryPositionRepository.findByScope(db, {
      organizationId: syncRun.organizationId,
      skuId: sku.id,
      locationId: location.id,
    });
    const currentOnHandQty = currentPosition?.onHandQty ?? 0;
    const delta = record.onHandQty - currentOnHandQty;

    if (delta === 0) {
      return {
        canonicalEntityType: "InventoryPosition",
        canonicalEntityId: currentPosition?.id ?? null,
      };
    }

    const mutationResult = await this.inventoryService.adjustInventoryInTransaction(db, {
      organizationId: syncRun.organizationId,
      actorUserId: actor.actorUserId,
      correlationId: actor.correlationId,
      input: {
        skuId: sku.id,
        locationId: location.id,
        quantity: delta,
        referenceType: "integration_inventory_snapshot",
        referenceId: record.externalReference,
        ...(delta < 0 ? { reason: "Integration inventory snapshot reconciliation." } : {}),
      },
    });

    return {
      canonicalEntityType: "InventoryPosition",
      canonicalEntityId: mutationResult.position.id,
    };
  }
}
