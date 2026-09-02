import {
  AiModelType,
  AiRunStatus,
  AiRunType,
  AutomationTier,
  DecisionStatus,
  DecisionType,
  ModelRegistryStatus,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { AiProviderRegistry } from "../../modules/ai/ai-provider-registry.js";
import type { AiRunService } from "../../modules/ai/ai-run.service.js";
import type { DecisionExplanationRepository } from "../../modules/ai/decision-explanation.repository.js";
import { DecisionExplanationService } from "../../modules/ai/decision-explanation.service.js";
import { MockAiProvider } from "../../modules/ai/mock-ai.provider.js";
import type { ModelRegistryService } from "../../modules/ai/model-registry.service.js";
import type { DecisionWithDetails, DecisionRepository } from "../../modules/decisioning/decision.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "18a1a40f-53ef-4082-99a6-e2af838b417d",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

const decision = {
  id: "decision-id",
  organizationId: "organization-id",
  decisionType: DecisionType.replenishment,
  status: DecisionStatus.proposed,
  automationTier: AutomationTier.recommend,
  policyId: "policy-id",
  policyVersion: 1,
  skuId: "sku-id",
  locationId: "location-id",
  supplierId: "supplier-id",
  confidenceScore: 0.9,
  proposedPayload: {},
  rationale: { deterministic: true },
  createdByUserId: "owner-id",
  createdAt: new Date("2026-03-28T00:00:00.000Z"),
  updatedAt: new Date("2026-03-28T00:00:00.000Z"),
  reasons: [
    {
      id: "reason-id",
      decisionId: "decision-id",
      code: "reorder_point_breached",
      message: "Reorder point was breached.",
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    },
  ],
  scores: [],
  artifacts: [],
} as DecisionWithDetails;

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

describe("DecisionExplanationService", () => {
  it("marks the AI run failed when explanation output fails schema validation", async () => {
    const aiRunService = {
      startRun: vi.fn().mockResolvedValue({
        id: "ai-run-id",
      }),
      markSucceededInTransaction: vi.fn(),
      markFailedInTransaction: vi.fn().mockResolvedValue({
        id: "ai-run-id",
        organizationId: "organization-id",
        modelRegistryEntryId: "model-id",
        runType: AiRunType.decision_explanation,
        status: AiRunStatus.failed,
        subjectType: "Decision",
        subjectReference: "decision-id",
        inputChecksum: "checksum",
        inputPayload: {},
        outputPayload: null,
        errorMessage: "invalid",
        latencyMs: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        completedAt: new Date("2026-03-28T00:00:15.000Z"),
        modelRegistryEntry: {
          id: "model-id",
          provider: "mock",
          modelName: "mock-invalid-decision-explainer",
          modelVersion: "v1",
          modelType: AiModelType.decision_explanation,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        },
      }),
    } as unknown as AiRunService;

    const service = new DecisionExplanationService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      {
        findByIdForOrganization: vi.fn().mockResolvedValue(decision),
      } as unknown as DecisionRepository,
      {
        findByDecisionAndModel: vi.fn().mockResolvedValue(null),
        listByOrganization: vi.fn(),
        findByIdForOrganization: vi.fn(),
        upsert: vi.fn(),
      } as unknown as DecisionExplanationRepository,
      {
        findActiveModelEntry: vi.fn().mockResolvedValue({
          id: "model-id",
          provider: "mock",
          modelName: "mock-invalid-decision-explainer",
          modelVersion: "v1",
          modelType: AiModelType.decision_explanation,
          promptVersion: null,
          schemaVersion: "2026-03-28",
          status: ModelRegistryStatus.active,
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }),
      } as unknown as ModelRegistryService,
      aiRunService,
      new AiProviderRegistry([new MockAiProvider()]),
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn(),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn(),
      } as unknown as OutboxEventRepository,
    );

    const result = await service.generateExplanation(requestContext, "decision-id");

    expect(result.status).toBe("failed");
    expect(result.explanation).toBeNull();
  });
});
