import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { DemandSignalRepository } from "../../modules/demand/demand-signal.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { StockoutIncidentRepository } from "../../modules/outcomes/stockout-incident.repository.js";
import { StockoutDetectionService } from "../../modules/outcomes/stockout-detection.service.js";
import type { InventoryHistoryService } from "../../modules/outcomes/inventory-history.service.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("StockoutDetectionService", () => {
  it("creates a stockout incident when ATP is non-positive on a pressured day", async () => {
    const demandSignalRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "signal-id",
          organizationId: "organization-id",
          skuId: "sku-id",
          locationId: "location-id",
          signalType: "customer_order",
          quantity: 5,
          observedAt: new Date("2026-03-28T10:00:00.000Z"),
          sourceType: "customer_order",
          sourceReference: "order-id",
          metadata: null,
          createdAt: new Date("2026-03-28T10:00:00.000Z"),
        },
      ]),
    } as unknown as DemandSignalRepository;

    const stockoutIncidentRepository = {
      upsert: vi.fn(async () => ({
        id: "incident-id",
        organizationId: "organization-id",
        skuId: "sku-id",
        locationId: "location-id",
        detectedAt: new Date("2026-03-28T23:59:59.000Z"),
        incidentStartAt: new Date("2026-03-28T00:00:00.000Z"),
        incidentEndAt: null,
        severity: "warning",
        sourceType: "outcome_window_detector",
        sourceReference: "2026-03-28T00:00:00.000Z|2026-03-29T00:00:00.000Z",
        createdAt: new Date("2026-03-28T23:59:59.000Z"),
        updatedAt: new Date("2026-03-28T23:59:59.000Z"),
      })),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
    } as unknown as StockoutIncidentRepository;

    const inventoryHistoryService = {
      calculateSnapshotAt: vi.fn().mockResolvedValue({
        asOf: new Date("2026-03-28T23:59:59.999Z"),
        onHandQty: 0,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 0,
      }),
    } as unknown as InventoryHistoryService;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new StockoutDetectionService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      demandSignalRepository,
      stockoutIncidentRepository,
      inventoryHistoryService,
      {
        requireOrganizationPermission: vi.fn(),
      } as unknown as AuthorizationService,
      {
        create: vi.fn(),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn(),
      } as unknown as OutboxEventRepository,
    );

    const result = await service.computeStockoutsInTransaction(
      {} as Prisma.TransactionClient,
      "organization-id",
      {
        measurementWindowStart: "2026-03-28T00:00:00.000Z",
        measurementWindowEnd: "2026-03-29T00:00:00.000Z",
      },
      {
        actorUserId: "owner-id",
        correlationId: "corr-id",
      },
    );

    expect(result.computedCount).toBe(1);
    expect(result.incidents[0]?.skuId).toBe("sku-id");
    expect(vi.mocked(stockoutIncidentRepository.upsert)).toHaveBeenCalledTimes(1);
  });
});
