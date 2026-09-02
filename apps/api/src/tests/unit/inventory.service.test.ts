import {
  InventoryTransferStatus,
  LocationStatus,
  LocationType,
  SkuStatus,
  type Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../shared/errors.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { InventoryMovementRepository } from "../../modules/inventory/inventory-movement.repository.js";
import type { InventoryPositionRepository } from "../../modules/inventory/inventory-position.repository.js";
import type { InventoryRecomputationService } from "../../modules/inventory/inventory-recomputation.service.js";
import type { InventoryReservationRepository } from "../../modules/inventory/inventory-reservation.repository.js";
import { InventoryService } from "../../modules/inventory/inventory.service.js";
import type { InventoryTransferRepository } from "../../modules/inventory/inventory-transfer.repository.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";

const requestContext: RequestContext = {
  correlationId: "1d7efc2d-3c7f-424d-90a7-b7ff23ca77c4",
  activeOrganizationId: "organization-id",
  user: {
    id: "operator-id",
    email: "operator@example.com",
    displayName: "Operator",
  },
};

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

describe("InventoryService", () => {
  it("rejects reservations that exceed available stock", async () => {
    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const skuRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "sku-id",
        organizationId: "organization-id",
        skuCode: "SKU-001",
        name: "Widget",
        description: null,
        baseUom: "each",
        packSize: 1,
        status: SkuStatus.active,
        metadata: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as SkuRepository;

    const locationRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "location-id",
        organizationId: "organization-id",
        code: "MAIN",
        name: "Main",
        type: LocationType.warehouse,
        status: LocationStatus.active,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as LocationRepository;

    const recomputationService = {
      calculatePositionQuantities: vi.fn().mockResolvedValue({
        onHandQty: 10,
        reservedQty: 3,
        inTransitQty: 0,
        availableToPromiseQty: 7,
      }),
    } as unknown as InventoryRecomputationService;

    const service = new InventoryService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      skuRepository,
      locationRepository,
      {} as InventoryPositionRepository,
      {} as InventoryMovementRepository,
      {} as InventoryReservationRepository,
      {} as InventoryTransferRepository,
      authorizationService,
      recomputationService,
      {} as AuditEventRepository,
      {} as OutboxEventRepository,
    );

    await expect(
      service.createReservation(requestContext, {
        skuId: "sku-id",
        locationId: "location-id",
        quantity: 8,
        referenceType: "sales_order",
        referenceId: "SO-100",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("treats completed transfer completion as idempotent", async () => {
    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const transferRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "transfer-id",
        organizationId: "organization-id",
        skuId: "sku-id",
        sourceLocationId: "source-location-id",
        destinationLocationId: "destination-location-id",
        quantity: 5,
        status: InventoryTransferStatus.completed,
        referenceType: null,
        referenceId: null,
        notes: null,
        requestedByUserId: "operator-id",
        completedByUserId: "operator-id",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        completedAt: new Date("2026-01-01T01:00:00.000Z"),
      }),
      markCompleted: vi.fn(),
    } as unknown as InventoryTransferRepository;

    const movementRepository = {
      create: vi.fn(),
    } as unknown as InventoryMovementRepository;

    const recomputationService = {
      recomputePosition: vi
        .fn()
        .mockResolvedValueOnce({
          id: "source-position-id",
          organizationId: "organization-id",
          skuId: "sku-id",
          locationId: "source-location-id",
          onHandQty: 5,
          reservedQty: 0,
          inTransitQty: 0,
          availableToPromiseQty: 5,
          safetyStockQty: 0,
          reorderPointQty: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        })
        .mockResolvedValueOnce({
          id: "destination-position-id",
          organizationId: "organization-id",
          skuId: "sku-id",
          locationId: "destination-location-id",
          onHandQty: 5,
          reservedQty: 0,
          inTransitQty: 0,
          availableToPromiseQty: 5,
          safetyStockQty: 0,
          reorderPointQty: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
    } as unknown as InventoryRecomputationService;

    const service = new InventoryService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {} as SkuRepository,
      {} as LocationRepository,
      {} as InventoryPositionRepository,
      movementRepository,
      {} as InventoryReservationRepository,
      transferRepository,
      authorizationService,
      recomputationService,
      {} as AuditEventRepository,
      {} as OutboxEventRepository,
    );

    const result = await service.completeTransfer(requestContext, "transfer-id");

    expect(result.transfer.status).toBe(InventoryTransferStatus.completed);
    expect(vi.mocked(movementRepository.create)).not.toHaveBeenCalled();
    expect(vi.mocked(transferRepository.markCompleted)).not.toHaveBeenCalled();
  });
});
