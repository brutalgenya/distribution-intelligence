import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { HistoricalSaleRepository } from "../../modules/demand/historical-sale.repository.js";
import type { ForecastResultRepository } from "../../modules/forecasting/forecast-result.repository.js";
import type { ForecastErrorMeasurementRepository } from "../../modules/outcomes/forecast-error-measurement.repository.js";
import { ForecastErrorService } from "../../modules/outcomes/forecast-error.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("ForecastErrorService", () => {
  it("computes deterministic forecast error from forecast totals and realized sales", async () => {
    const forecastResultRepository = {
      listByOrganizationWindow: vi.fn().mockResolvedValue([
        {
          id: "result-1",
          organizationId: "organization-id",
          forecastJobId: "job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-29T00:00:00.000Z"),
          forecastQty: 8,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
        },
        {
          id: "result-2",
          organizationId: "organization-id",
          forecastJobId: "job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-30T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      ]),
    } as unknown as ForecastResultRepository;

    const historicalSaleRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "sale-id",
          organizationId: "organization-id",
          salesImportRunId: "import-id",
          skuId: "sku-id",
          locationId: "location-id",
          quantity: 9,
          soldAt: new Date("2026-03-29T12:00:00.000Z"),
          sourceType: "historical_sale",
          sourceReference: "sale-ref",
          rowFingerprint: "fingerprint",
          createdAt: new Date("2026-03-29T12:00:00.000Z"),
        },
      ]),
    } as unknown as HistoricalSaleRepository;

    const forecastErrorMeasurementRepository = {
      upsert: vi.fn(async (_db: unknown, input: { create: Record<string, unknown> }) => ({
        id: "measurement-id",
        createdAt: new Date("2026-03-31T00:00:00.000Z"),
        updatedAt: new Date("2026-03-31T00:00:00.000Z"),
        ...input.create,
      })),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
    } as unknown as ForecastErrorMeasurementRepository;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new ForecastErrorService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      forecastResultRepository,
      historicalSaleRepository,
      forecastErrorMeasurementRepository,
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

    const result = await service.computeForecastErrorInTransaction(
      {} as Prisma.TransactionClient,
      "organization-id",
      {
        measurementWindowStart: "2026-03-29T00:00:00.000Z",
        measurementWindowEnd: "2026-03-31T00:00:00.000Z",
      },
      {
        actorUserId: "owner-id",
        correlationId: "corr-id",
      },
    );

    expect(result.computedCount).toBe(1);
    expect(result.measurements[0]?.forecastQty).toBe(12);
    expect(result.measurements[0]?.actualQty).toBe(9);
    expect(result.measurements[0]?.absoluteError).toBe(3);
  });
});
