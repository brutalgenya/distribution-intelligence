import { type Prisma, SkuStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { CatalogService } from "../../modules/catalog/catalog.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "d43d24df-4208-4350-808a-fdb6ea865221",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("CatalogService", () => {
  it("creates a SKU and writes audit and outbox events", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const skuRepository = {
      create: vi.fn().mockResolvedValue({
        id: "sku-id",
        organizationId: "organization-id",
        skuCode: "SKU-001",
        name: "Widget",
        description: "A widget",
        baseUom: "each",
        packSize: 12,
        status: SkuStatus.active,
        metadata: { color: "blue" },
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    } as unknown as SkuRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new CatalogService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      skuRepository,
      {
        ensureNewSkuAllowedInTransaction: vi.fn().mockResolvedValue(undefined),
        recordCurrentUsageInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createSku(requestContext, {
      skuCode: "SKU-001",
      name: "Widget",
      description: "A widget",
      baseUom: "each",
      packSize: 12,
      status: SkuStatus.active,
      metadata: { color: "blue" },
    });

    expect(result.id).toBe("sku-id");
    expect(result.skuCode).toBe("SKU-001");
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
