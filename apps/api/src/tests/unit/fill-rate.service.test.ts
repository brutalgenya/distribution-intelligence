import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { CustomerOrderRepository } from "../../modules/demand/customer-order.repository.js";
import type { HistoricalSaleRepository } from "../../modules/demand/historical-sale.repository.js";
import type { FillRateMeasurementRepository } from "../../modules/outcomes/fill-rate-measurement.repository.js";
import { FillRateService } from "../../modules/outcomes/fill-rate.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("FillRateService", () => {
  it("measures fill rate from ordered quantity and realized sales", async () => {
    const customerOrderRepository = {
      listByOrderedAtWindow: vi.fn().mockResolvedValue([
        {
          id: "order-id",
          organizationId: "organization-id",
          orderNumber: "SO-001",
          status: "open",
          customerReference: null,
          orderedAt: new Date("2026-03-28T00:00:00.000Z"),
          createdByUserId: "owner-id",
          cancelledAt: null,
          cancelledByUserId: null,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
          lines: [
            {
              id: "line-id",
              orderId: "order-id",
              skuId: "sku-id",
              locationId: "location-id",
              quantity: 10,
              unitPrice: null,
              createdAt: new Date("2026-03-28T00:00:00.000Z"),
            },
          ],
        },
      ]),
    } as unknown as CustomerOrderRepository;

    const historicalSaleRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "sale-id",
          organizationId: "organization-id",
          salesImportRunId: "import-id",
          skuId: "sku-id",
          locationId: "location-id",
          quantity: 6,
          soldAt: new Date("2026-03-28T12:00:00.000Z"),
          sourceType: "historical_sale",
          sourceReference: "sale-ref",
          rowFingerprint: "fingerprint",
          createdAt: new Date("2026-03-28T12:00:00.000Z"),
        },
      ]),
    } as unknown as HistoricalSaleRepository;

    const fillRateMeasurementRepository = {
      upsert: vi.fn(async (_db: unknown, input: { create: Record<string, unknown> }) => ({
        id: "measurement-id",
        createdAt: new Date("2026-03-28T23:59:59.000Z"),
        updatedAt: new Date("2026-03-28T23:59:59.000Z"),
        ...input.create,
      })),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
    } as unknown as FillRateMeasurementRepository;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new FillRateService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      customerOrderRepository,
      historicalSaleRepository,
      fillRateMeasurementRepository,
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

    const result = await service.computeFillRateInTransaction(
      {} as Prisma.TransactionClient,
      "organization-id",
      {
        measurementWindowStart: "2026-03-28T00:00:00.000Z",
        measurementWindowEnd: "2026-03-28T23:59:59.999Z",
      },
      {
        actorUserId: "owner-id",
        correlationId: "corr-id",
      },
    );

    expect(result.computedCount).toBe(1);
    expect(result.measurements[0]?.orderedQty).toBe(10);
    expect(result.measurements[0]?.fulfilledQty).toBe(6);
    expect(result.measurements[0]?.fillRate).toBe(0.6);
  });
});
