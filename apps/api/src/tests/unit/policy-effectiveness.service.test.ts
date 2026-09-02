import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { PolicyRepository } from "../../modules/decisioning/policy.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { DecisionOutcomeRepository } from "../../modules/outcomes/decision-outcome.repository.js";
import type { ForecastErrorMeasurementRepository } from "../../modules/outcomes/forecast-error-measurement.repository.js";
import { PolicyEffectivenessService } from "../../modules/outcomes/policy-effectiveness.service.js";
import type { PolicyEffectivenessSummaryRepository } from "../../modules/outcomes/policy-effectiveness-summary.repository.js";
import type { OperatorOverrideRepository } from "../../modules/workflow/operator-override.repository.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

describe("PolicyEffectivenessService", () => {
  it("aggregates decision outcomes, forecast errors, and overrides into one summary", async () => {
    const policyRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "policy-id",
        organizationId: "organization-id",
        policyType: "replenishment",
        name: "Replenishment v1",
        version: 1,
        status: "active",
        rulesJson: {},
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      listByOrganization: vi.fn(),
    } as unknown as PolicyRepository;

    const decisionRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "decision-1",
          organizationId: "organization-id",
          decisionType: "replenishment",
          status: "executed",
          automationTier: "recommend",
          policyId: "policy-id",
          policyVersion: 1,
          skuId: "sku-id",
          locationId: "location-id",
          supplierId: null,
          confidenceScore: null,
          proposedPayload: {},
          rationale: {},
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-28T12:00:00.000Z"),
          updatedAt: new Date("2026-03-28T12:00:00.000Z"),
          reasons: [],
          scores: [],
          artifacts: [],
        },
      ]),
    } as unknown as DecisionRepository;

    const decisionOutcomeRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "outcome-id",
          organizationId: "organization-id",
          decisionId: "decision-1",
          executionTaskId: null,
          measurementWindowStart: new Date("2026-03-28T00:00:00.000Z"),
          measurementWindowEnd: new Date("2026-03-29T00:00:00.000Z"),
          outcomeStatus: "computed",
          stockoutAvoided: true,
          fillRateDelta: 0.2,
          inventoryDaysDelta: 1,
          holdingCostDelta: 3,
          expediteCostDelta: -1,
          summaryJson: {},
          computedAt: new Date("2026-03-29T00:00:00.000Z"),
          createdAt: new Date("2026-03-29T00:00:00.000Z"),
          updatedAt: new Date("2026-03-29T00:00:00.000Z"),
        },
      ]),
    } as unknown as DecisionOutcomeRepository;

    const forecastErrorMeasurementRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "forecast-error-id",
          organizationId: "organization-id",
          forecastJobId: "job-id",
          skuId: "sku-id",
          locationId: "location-id",
          measurementWindowStart: new Date("2026-03-28T00:00:00.000Z"),
          measurementWindowEnd: new Date("2026-03-29T00:00:00.000Z"),
          actualQty: 9,
          forecastQty: 12,
          absoluteError: 3,
          percentageError: 0.33,
          createdAt: new Date("2026-03-29T00:00:00.000Z"),
          updatedAt: new Date("2026-03-29T00:00:00.000Z"),
        },
      ]),
    } as unknown as ForecastErrorMeasurementRepository;

    const operatorOverrideRepository = {
      listByOrganization: vi.fn().mockResolvedValue([
        {
          id: "override-id",
          organizationId: "organization-id",
          decisionId: "decision-1",
          executionTaskId: null,
          overrideType: "manual_retry",
          reason: "Retried manually",
          payload: null,
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-28T18:00:00.000Z"),
        },
      ]),
    } as unknown as OperatorOverrideRepository;

    const policyEffectivenessSummaryRepository = {
      upsert: vi.fn(async (_db: unknown, input: { create: Record<string, unknown> }) => ({
        id: "summary-id",
        createdAt: new Date("2026-03-29T00:00:00.000Z"),
        updatedAt: new Date("2026-03-29T00:00:00.000Z"),
        ...input.create,
      })),
      listByOrganization: vi.fn(),
      findByIdForOrganization: vi.fn(),
    } as unknown as PolicyEffectivenessSummaryRepository;

    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const service = new PolicyEffectivenessService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      policyRepository,
      decisionRepository,
      decisionOutcomeRepository,
      forecastErrorMeasurementRepository,
      operatorOverrideRepository,
      policyEffectivenessSummaryRepository,
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

    const result = await service.computePolicyEffectivenessInTransaction(
      {} as Prisma.TransactionClient,
      "organization-id",
      {
        policyId: "policy-id",
        measurementWindowStart: "2026-03-28T00:00:00.000Z",
        measurementWindowEnd: "2026-03-29T00:00:00.000Z",
      },
      {
        actorUserId: "owner-id",
        correlationId: "corr-id",
      },
    );

    expect(result.computedCount).toBe(1);
    expect(result.summaries[0]?.decisionCount).toBe(1);
    expect(result.summaries[0]?.stockoutAvoidanceRate).toBe(1);
    expect(result.summaries[0]?.averageFillRateDelta).toBe(0.2);
    expect(result.summaries[0]?.averageForecastError).toBe(3);
    expect(result.summaries[0]?.overrideRate).toBe(1);
  });
});
