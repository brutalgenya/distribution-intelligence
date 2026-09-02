import { SupplierStatus, type Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { SupplierService } from "../../modules/supply/supplier.service.js";
import type { SupplierRepository } from "../../modules/supply/supplier.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "c369c3ce-b8e2-4d68-9650-5102c3b729b3",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("SupplierService", () => {
  it("creates a supplier and writes audit and outbox events", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const supplierRepository = {
      create: vi.fn().mockResolvedValue({
        id: "supplier-id",
        organizationId: "organization-id",
        code: "SUP-001",
        name: "Acme Supply",
        status: SupplierStatus.active,
        contactEmail: "buyer@acme.example",
        contactPhone: null,
        metadata: { tier: "preferred" },
        createdAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
    } as unknown as SupplierRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new SupplierService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      supplierRepository,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createSupplier(requestContext, {
      code: "SUP-001",
      name: "Acme Supply",
      status: SupplierStatus.active,
      contactEmail: "buyer@acme.example",
      metadata: {
        tier: "preferred",
      },
    });

    expect(result.id).toBe("supplier-id");
    expect(result.code).toBe("SUP-001");
    expect(vi.mocked(supplierRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
