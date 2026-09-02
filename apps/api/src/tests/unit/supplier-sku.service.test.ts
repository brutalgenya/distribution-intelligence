import { Prisma, type SupplierStatus, type SkuStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { SupplierSkuService } from "../../modules/supply/supplier-sku.service.js";
import type { SupplierRepository } from "../../modules/supply/supplier.repository.js";
import type { SupplierSkuRepository } from "../../modules/supply/supplier-sku.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "ffb7ca02-b1f6-44a6-83e6-a67955d660b7",
  activeOrganizationId: "organization-id",
  user: {
    id: "operator-id",
    email: "operator@example.com",
    displayName: "Operator",
  },
};

describe("SupplierSkuService", () => {
  it("creates a primary mapping and clears other primary mappings for the SKU", async () => {
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
        status: "active" as SupplierStatus,
        contactEmail: null,
        contactPhone: null,
        metadata: null,
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
    } as unknown as SupplierRepository;

    const skuRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
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
      }),
    } as unknown as SkuRepository;

    const supplierSkuRepository = {
      create: vi.fn().mockResolvedValue({
        id: "supplier-sku-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        skuId: "sku-id",
        supplierSkuCode: "ACME-001",
        isPrimary: true,
        minOrderQty: 5,
        casePackQty: 10,
        unitCost: new Prisma.Decimal("12.50"),
        leadTimeDays: 7,
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
      clearPrimaryForSku: vi.fn().mockResolvedValue(undefined),
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "supplier-sku-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        skuId: "sku-id",
        supplierSkuCode: "ACME-001",
        isPrimary: true,
        minOrderQty: 5,
        casePackQty: 10,
        unitCost: new Prisma.Decimal("12.50"),
        leadTimeDays: 7,
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
    } as unknown as SupplierSkuRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new SupplierSkuService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      supplierRepository,
      skuRepository,
      supplierSkuRepository,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createMapping(requestContext, {
      supplierId: "supplier-id",
      skuId: "sku-id",
      supplierSkuCode: "ACME-001",
      isPrimary: true,
      minOrderQty: 5,
      casePackQty: 10,
      unitCost: 12.5,
      leadTimeDays: 7,
    });

    expect(result.id).toBe("supplier-sku-id");
    expect(result.isPrimary).toBe(true);
    expect(vi.mocked(supplierSkuRepository.clearPrimaryForSku)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: "organization-id",
        skuId: "sku-id",
        exceptId: "supplier-sku-id",
      }),
    );
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
