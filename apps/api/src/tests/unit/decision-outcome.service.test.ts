import { DecisionOutcomeStatus, DecisionStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { HistoricalSaleRepository } from "../../modules/demand/historical-sale.repository.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { ExecutionTaskRepository } from "../../modules/execution/execution-task.repository.js";
import type { ForecastJobRepository } from "../../modules/forecasting/forecast-job.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { DecisionOutcomeRepository } from "../../modules/outcomes/decision-outcome.repository.js";
import { DecisionOutcomeService } from "../../modules/outcomes/decision-outcome.service.js";
import type { FillRateService } from "../../modules/outcomes/fill-rate.service.js";
import type { ForecastErrorService } from "../../modules/outcomes/forecast-error.service.js";
import type { InventoryCostSnapshotService } from "../../modules/outcomes/inventory-cost-snapshot.service.js";
import type { InventoryHistoryService } from "../../modules/outcomes/inventory-history.service.js";
import type { StockoutDetectionService } from "../../modules/outcomes/stockout-detection.service.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("DecisionOutcomeService", () => {
  it("marks outcomes as insufficient_data when a decision has no SKU-location scope", async () => {
    const decisionRepository = {
      findByIdForOrganization: vi.fn(async () => ({
        id: "decision-id",
        organizationId: "organization-id",
        decisionType: "exception",
        status: DecisionStatus.approved,
        automationTier: "observe",
        policyId: "policy-id",
        policyVersion: 1,
        skuId: null,
        locationId: null,
        supplierId: null,
        confidenceScore: null,
        proposedPayload: {},
        rationale: {},
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        reasons: [],
        scores: [],
        artifacts: [],
      })),
      listByOrganization: vi.fn(),
    } as unknown as DecisionRepository;

    const decisionOutcomeRepository = {
      upsert: vi.fn(async (_db: unknown, input: { create: Record<string, unknown> }) => ({
        id: "outcome-id",
        createdAt: new Date("2026-03-29T00:00:00.000Z"),
        updatedAt: new Date("2026-03-29T00:00:00.000Z"),
        ...input.create,
      })),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
    } as unknown as DecisionOutcomeRepository;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new DecisionOutcomeService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      decisionRepository,
      {} as ExecutionTaskRepository,
      {} as HistoricalSaleRepository,
      {} as ForecastJobRepository,
      {} as FillRateService,
      {} as ForecastErrorService,
      {} as StockoutDetectionService,
      {} as InventoryCostSnapshotService,
      {} as InventoryHistoryService,
      decisionOutcomeRepository,
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

    const result = await service.computeDecisionOutcomesInTransaction(
      {} as Prisma.TransactionClient,
      "organization-id",
      {
        decisionId: "decision-id",
        measurementWindowStart: "2026-03-28T00:00:00.000Z",
        measurementWindowEnd: "2026-03-29T00:00:00.000Z",
      },
      {
        actorUserId: "owner-id",
        correlationId: "corr-id",
      },
    );

    expect(result.computedCount).toBe(1);
    expect(result.outcomes[0]?.outcomeStatus).toBe(DecisionOutcomeStatus.insufficient_data);
  });
});
