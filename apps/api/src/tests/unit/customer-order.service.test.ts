import { CustomerOrderStatus, type Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { CustomerOrderLineRepository } from "../../modules/demand/customer-order-line.repository.js";
import type { CustomerOrderRepository } from "../../modules/demand/customer-order.repository.js";
import { CustomerOrderService } from "../../modules/demand/customer-order.service.js";
import type { DemandSignalService } from "../../modules/demand/demand-signal.service.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";

const requestContext: RequestContext = {
  correlationId: "1f19bb82-1830-402d-9646-02ba1bafbfd8",
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

describe("CustomerOrderService", () => {
  it("treats cancelling an already cancelled order as idempotent", async () => {
    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const orderRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "order-id",
        organizationId: "organization-id",
        orderNumber: "SO-100",
        status: CustomerOrderStatus.cancelled,
        customerReference: null,
        orderedAt: new Date("2026-03-20T10:00:00.000Z"),
        createdByUserId: "operator-id",
        cancelledAt: new Date("2026-03-21T10:00:00.000Z"),
        cancelledByUserId: "operator-id",
        createdAt: new Date("2026-03-20T10:00:00.000Z"),
        updatedAt: new Date("2026-03-21T10:00:00.000Z"),
        lines: [
          {
            id: "line-id",
            orderId: "order-id",
            skuId: "sku-id",
            locationId: "location-id",
            quantity: 5,
            unitPrice: null,
            createdAt: new Date("2026-03-20T10:00:00.000Z"),
          },
        ],
      }),
      markCancelled: vi.fn(),
    } as unknown as CustomerOrderRepository;

    const demandSignalService = {
      appendSignals: vi.fn(),
    } as unknown as DemandSignalService;

    const service = new CustomerOrderService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {} as SkuRepository,
      {} as LocationRepository,
      orderRepository,
      {} as CustomerOrderLineRepository,
      demandSignalService,
      authorizationService,
      {} as AuditEventRepository,
      {} as OutboxEventRepository,
    );

    const result = await service.cancelOrder(requestContext, "order-id");

    expect(result.status).toBe(CustomerOrderStatus.cancelled);
    expect(vi.mocked(orderRepository.markCancelled)).not.toHaveBeenCalled();
    expect(vi.mocked(demandSignalService.appendSignals)).not.toHaveBeenCalled();
  });
});
