import { AutomationTier, DecisionStatus, DecisionType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { DecisionPersistenceService } from "../../modules/decisioning/decision-persistence.service.js";
import type { DecisionArtifactRepository } from "../../modules/decisioning/decision-artifact.repository.js";
import type { DecisionReasonRepository } from "../../modules/decisioning/decision-reason.repository.js";
import type { DecisionRepository, DecisionWithDetails } from "../../modules/decisioning/decision.repository.js";
import type { DecisionScoreRepository } from "../../modules/decisioning/decision-score.repository.js";

const buildDecision = (input: {
  id: string;
  status?: DecisionStatus;
  proposedPayload?: Prisma.JsonObject;
}): DecisionWithDetails =>
  ({
    id: input.id,
    organizationId: "organization-id",
    decisionType: DecisionType.replenishment,
    status: input.status ?? DecisionStatus.proposed,
    automationTier: AutomationTier.recommend,
    policyId: "policy-id",
    policyVersion: 1,
    skuId: "sku-id",
    locationId: "location-id",
    supplierId: "supplier-id",
    confidenceScore: 0.9,
    proposedPayload:
      input.proposedPayload ??
      ({
        recommendedOrderQty: 12,
      } satisfies Prisma.JsonObject),
    rationale: {
      reasonCodes: ["reorder_point_breached"],
    },
    createdByUserId: "owner-id",
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    reasons: [
      {
        id: "reason-id",
        decisionId: input.id,
        code: "reorder_point_breached",
        message: "Available inventory is at or below the reorder point.",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    scores: [
      {
        id: "score-id",
        decisionId: input.id,
        metric: "recommended_order_qty",
        value: 12,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    artifacts: [
      {
        id: "artifact-id",
        decisionId: input.id,
        artifactType: "inventory_snapshot",
        payload: {
          availableToPromiseQty: 0,
        },
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
  }) as DecisionWithDetails;

describe("DecisionPersistenceService", () => {
  it("returns an existing materially identical proposed decision without creating a duplicate", async () => {
    const existingDecision = buildDecision({ id: "decision-id" });

    const decisionRepository = {
      listProposedByScope: vi.fn().mockResolvedValue([existingDecision]),
      create: vi.fn(),
      findByIdForOrganization: vi.fn(),
      updateStatusById: vi.fn(),
    } as unknown as DecisionRepository;

    const service = new DecisionPersistenceService(
      decisionRepository,
      {} as DecisionReasonRepository,
      {} as DecisionScoreRepository,
      {} as DecisionArtifactRepository,
      {} as AuditEventRepository,
      {} as OutboxEventRepository,
    );

    const result = await service.persistDecisionCandidate({} as Prisma.TransactionClient, {
      organizationId: "organization-id",
      decisionType: DecisionType.replenishment,
      automationTier: AutomationTier.recommend,
      policyId: "policy-id",
      policyVersion: 1,
      skuId: "sku-id",
      locationId: "location-id",
      supplierId: "supplier-id",
      confidenceScore: 0.9,
      proposedPayload: {
        recommendedOrderQty: 12,
      },
      rationale: {
        reasonCodes: ["reorder_point_breached"],
      },
      reasons: [
        {
          code: "reorder_point_breached",
          message: "Available inventory is at or below the reorder point.",
        },
      ],
      scores: [
        {
          metric: "recommended_order_qty",
          value: 12,
        },
      ],
      artifacts: [
        {
          artifactType: "inventory_snapshot",
          payload: {
            availableToPromiseQty: 0,
          },
        },
      ],
      actorUserId: "owner-id",
      correlationId: "correlation-id",
    });

    expect(result.deduplicated).toBe(true);
    expect(result.created).toBe(false);
    expect(result.decision.id).toBe("decision-id");
    expect(vi.mocked(decisionRepository.create)).not.toHaveBeenCalled();
  });

  it("supersedes an older proposed decision when the new payload changes", async () => {
    const previousDecision = buildDecision({ id: "old-decision-id" });
    const createdDecision = {
      id: "new-decision-id",
    };
    const reloadedDecision = buildDecision({
      id: "new-decision-id",
      proposedPayload: {
        recommendedOrderQty: 18,
      },
    });

    const decisionRepository = {
      listProposedByScope: vi.fn().mockResolvedValue([previousDecision]),
      create: vi.fn().mockResolvedValue(createdDecision),
      findByIdForOrganization: vi.fn().mockResolvedValue(reloadedDecision),
      updateStatusById: vi.fn().mockResolvedValue(
        buildDecision({
          id: "old-decision-id",
          status: DecisionStatus.superseded,
        }),
      ),
    } as unknown as DecisionRepository;

    const decisionReasonRepository = {
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as DecisionReasonRepository;
    const decisionScoreRepository = {
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as DecisionScoreRepository;
    const decisionArtifactRepository = {
      createMany: vi.fn().mockResolvedValue(undefined),
    } as unknown as DecisionArtifactRepository;
    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;
    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new DecisionPersistenceService(
      decisionRepository,
      decisionReasonRepository,
      decisionScoreRepository,
      decisionArtifactRepository,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.persistDecisionCandidate({} as Prisma.TransactionClient, {
      organizationId: "organization-id",
      decisionType: DecisionType.replenishment,
      automationTier: AutomationTier.recommend,
      policyId: "policy-id",
      policyVersion: 1,
      skuId: "sku-id",
      locationId: "location-id",
      supplierId: "supplier-id",
      confidenceScore: 0.9,
      proposedPayload: {
        recommendedOrderQty: 18,
      },
      rationale: {
        reasonCodes: ["reorder_point_breached"],
      },
      reasons: [
        {
          code: "reorder_point_breached",
          message: "Available inventory is at or below the reorder point.",
        },
      ],
      scores: [
        {
          metric: "recommended_order_qty",
          value: 18,
        },
      ],
      artifacts: [
        {
          artifactType: "inventory_snapshot",
          payload: {
            availableToPromiseQty: 0,
          },
        },
      ],
      actorUserId: "owner-id",
      correlationId: "correlation-id",
    });

    expect(result.created).toBe(true);
    expect(result.deduplicated).toBe(false);
    expect(result.supersededDecisionIds).toEqual(["old-decision-id"]);
    expect(vi.mocked(decisionRepository.updateStatusById)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(2);
  });
});
