import { Prisma, PurchaseOrderStatus, SupplierStatus, type SkuStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { InventoryService } from "../../modules/inventory/inventory.service.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { PurchaseOrderLineRepository } from "../../modules/supply/purchase-order-line.repository.js";
import type { PurchaseOrderRepository } from "../../modules/supply/purchase-order.repository.js";
import { PurchaseOrderService } from "../../modules/supply/purchase-order.service.js";
import type { SupplierRepository } from "../../modules/supply/supplier.repository.js";
import type { SupplyAnalyticsService } from "../../modules/supply/supply-analytics.service.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "95a6c862-c463-4dbc-ad7d-8ac1cff99334",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("PurchaseOrderService", () => {
  it("creates a purchase order draft and recomputes supplier performance", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const supplierRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "supplier-id",
        organizationId: "organization-id",
        code: "SUP-001",
        name: "Acme Supply",
        status: SupplierStatus.active,
        contactEmail: null,
        contactPhone: null,
        metadata: null,
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
    } as unknown as SupplierRepository;

    const skuRepository = {
      listByIdsForOrganization: vi.fn().mockResolvedValue([
        {
          id: "sku-id",
          organizationId: "organization-id",
          skuCode: "SKU-001",
          name: "Widget",
          description: null,
          baseUom: "each",
          packSize: 1,
          status: "active" as SkuStatus,
          metadata: null,
          createdAt: new Date("2026-03-27T00:00:00.000Z"),
          updatedAt: new Date("2026-03-27T00:00:00.000Z"),
        },
      ]),
    } as unknown as SkuRepository;

    const locationRepository = {
      listByIdsForOrganization: vi.fn().mockResolvedValue([]),
    } as unknown as LocationRepository;

    const purchaseOrderRepository = {
      create: vi.fn().mockResolvedValue({
        id: "po-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        poNumber: "PO-001",
        status: PurchaseOrderStatus.draft,
        orderedAt: null,
        expectedDeliveryAt: new Date("2026-04-01T00:00:00.000Z"),
        receivedAt: null,
        currency: "GBP",
        notes: null,
        wasEverDelayed: false,
        delayedAt: null,
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "po-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        poNumber: "PO-001",
        status: PurchaseOrderStatus.draft,
        orderedAt: null,
        expectedDeliveryAt: new Date("2026-04-01T00:00:00.000Z"),
        receivedAt: null,
        currency: "GBP",
        notes: null,
        wasEverDelayed: false,
        delayedAt: null,
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
        lines: [
          {
            id: "po-line-id",
            purchaseOrderId: "po-id",
            skuId: "sku-id",
            quantityOrdered: 8,
            quantityReceived: 0,
            unitCost: new Prisma.Decimal("12.50"),
            expectedLocationId: null,
            createdAt: new Date("2026-03-27T00:00:00.000Z"),
            updatedAt: new Date("2026-03-27T00:00:00.000Z"),
          },
        ],
      }),
    } as unknown as PurchaseOrderRepository;

    const purchaseOrderLineRepository = {
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as PurchaseOrderLineRepository;

    const inventoryService = {
      receiveInventoryInTransaction: vi.fn(),
    } as unknown as InventoryService;

    const supplyAnalyticsService = {
      recomputeSupplierPerformance: vi.fn().mockResolvedValue(undefined),
      recomputeLeadTimeStats: vi.fn().mockResolvedValue(undefined),
    } as unknown as SupplyAnalyticsService;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new PurchaseOrderService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      supplierRepository,
      skuRepository,
      locationRepository,
      purchaseOrderRepository,
      purchaseOrderLineRepository,
      inventoryService,
      supplyAnalyticsService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createDraft(requestContext, {
      supplierId: "supplier-id",
      poNumber: "PO-001",
      expectedDeliveryAt: "2026-04-01T00:00:00.000Z",
      currency: "gbp",
      lines: [
        {
          skuId: "sku-id",
          quantityOrdered: 8,
          unitCost: 12.5,
        },
      ],
    });

    expect(result.id).toBe("po-id");
    expect(result.status).toBe(PurchaseOrderStatus.draft);
    expect(result.currency).toBe("GBP");
    expect(vi.mocked(purchaseOrderLineRepository.createMany)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(supplyAnalyticsService.recomputeSupplierPerformance)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });

  it("treats a receipt retry with unchanged cumulative quantities as idempotent", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const purchaseOrderRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "po-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        poNumber: "PO-001",
        status: PurchaseOrderStatus.partially_received,
        orderedAt: new Date("2026-03-27T00:00:00.000Z"),
        expectedDeliveryAt: null,
        receivedAt: null,
        currency: null,
        notes: null,
        wasEverDelayed: false,
        delayedAt: null,
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
        lines: [
          {
            id: "po-line-id",
            purchaseOrderId: "po-id",
            skuId: "sku-id",
            quantityOrdered: 10,
            quantityReceived: 4,
            unitCost: null,
            expectedLocationId: "location-id",
            createdAt: new Date("2026-03-27T00:00:00.000Z"),
            updatedAt: new Date("2026-03-27T00:00:00.000Z"),
          },
        ],
      }),
    } as unknown as PurchaseOrderRepository;

    const locationRepository = {
      listByIdsForOrganization: vi.fn().mockResolvedValue([
        {
          id: "location-id",
          organizationId: "organization-id",
          code: "MAIN",
          name: "Main Warehouse",
          type: "warehouse",
          status: "active",
          createdAt: new Date("2026-03-27T00:00:00.000Z"),
          updatedAt: new Date("2026-03-27T00:00:00.000Z"),
        },
      ]),
    } as unknown as LocationRepository;

    const purchaseOrderLineRepository = {
      updateById: vi.fn(),
      listByPurchaseOrderId: vi.fn(),
    } as unknown as PurchaseOrderLineRepository;

    const inventoryService = {
      receiveInventoryInTransaction: vi.fn(),
    } as unknown as InventoryService;

    const supplyAnalyticsService = {
      recomputeSupplierPerformance: vi.fn(),
      recomputeLeadTimeStats: vi.fn(),
    } as unknown as SupplyAnalyticsService;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn(),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn(),
    } as unknown as OutboxEventRepository;

    const service = new PurchaseOrderService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {} as SupplierRepository,
      {} as SkuRepository,
      locationRepository,
      purchaseOrderRepository,
      purchaseOrderLineRepository,
      inventoryService,
      supplyAnalyticsService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.receivePurchaseOrder(requestContext, "po-id", {
      lines: [
        {
          lineId: "po-line-id",
          quantityReceived: 4,
        },
      ],
    });

    expect(result.status).toBe(PurchaseOrderStatus.partially_received);
    expect(vi.mocked(inventoryService.receiveInventoryInTransaction)).not.toHaveBeenCalled();
    expect(vi.mocked(purchaseOrderLineRepository.updateById)).not.toHaveBeenCalled();
    expect(vi.mocked(auditEventRepository.create)).not.toHaveBeenCalled();
    expect(vi.mocked(outboxEventRepository.create)).not.toHaveBeenCalled();
    expect(vi.mocked(supplyAnalyticsService.recomputeSupplierPerformance)).not.toHaveBeenCalled();
  });
});
