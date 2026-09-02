import {
  AutomationTier,
  DecisionStatus,
  DecisionType,
  PolicyStatus,
  PolicyType,
  Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { DecisionArtifactTypes, DecisionReasonCodes } from "../../modules/decisioning/decisioning.constants.js";
import { AllocationDecisionService } from "../../modules/decisioning/allocation-decision.service.js";
import type { DecisionPersistenceService } from "../../modules/decisioning/decision-persistence.service.js";
import type { DecisionWithDetails } from "../../modules/decisioning/decision.repository.js";
import type { PolicyService } from "../../modules/decisioning/policy.service.js";
import type { CustomerOrderRepository } from "../../modules/demand/customer-order.repository.js";
import type { InventoryPositionRepository } from "../../modules/inventory/inventory-position.repository.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "552e4d30-55a4-4717-af81-d26da7e0ddbf",
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

const buildDecision = (): DecisionWithDetails =>
  ({
    id: "decision-id",
    organizationId: "organization-id",
    decisionType: DecisionType.allocation,
    status: DecisionStatus.proposed,
    automationTier: AutomationTier.recommend,
    policyId: "allocation-policy-id",
    policyVersion: 1,
    skuId: "sku-id",
    locationId: "location-id",
    supplierId: null,
    confidenceScore: 0.85,
    proposedPayload: {
      allocatableQty: 5,
      demandQty: 7,
      shortageQty: 2,
      affectedOrderRefs: ["SO-002"],
    },
    rationale: {
      reasonCodes: [DecisionReasonCodes.allocationConflict],
    },
    createdByUserId: "operator-id",
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    reasons: [
      {
        id: "reason-id",
        decisionId: "decision-id",
        code: DecisionReasonCodes.allocationConflict,
        message: "Open order demand exceeds available-to-promise inventory.",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    scores: [
      {
        id: "score-id",
        decisionId: "decision-id",
        metric: "shortage_qty",
        value: 2,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    artifacts: [
      {
        id: "artifact-id",
        decisionId: "decision-id",
        artifactType: DecisionArtifactTypes.demandSnapshot,
        payload: {
          openOrders: [
            { orderNumber: "SO-001", demandQty: 3 },
            { orderNumber: "SO-002", demandQty: 4 },
          ],
        },
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
  }) as DecisionWithDetails;

describe("AllocationDecisionService", () => {
  it("generates an allocation recommendation when open demand exceeds ATP inventory", async () => {
    const skuRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "sku-id",
        organizationId: "organization-id",
        skuCode: "SKU-001",
        name: "Widget",
        description: null,
        baseUom: "each",
        packSize: 1,
        status: "active",
        metadata: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as SkuRepository;

    const locationRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "location-id",
        organizationId: "organization-id",
        code: "MAIN",
        name: "Main Warehouse",
        type: "warehouse",
        status: "active",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as LocationRepository;

    const inventoryPositionRepository = {
      findByScope: vi.fn().mockResolvedValue({
        id: "position-id",
        organizationId: "organization-id",
        skuId: "sku-id",
        locationId: "location-id",
        onHandQty: 5,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 5,
        safetyStockQty: 0,
        reorderPointQty: 0,
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as InventoryPositionRepository;

    const customerOrderRepository = {
      listOpenBySkuLocation: vi.fn().mockResolvedValue([
        {
          id: "order-1",
          organizationId: "organization-id",
          orderNumber: "SO-001",
          status: "open",
          customerReference: null,
          orderedAt: new Date("2026-03-20T00:00:00.000Z"),
          createdByUserId: "operator-id",
          cancelledAt: null,
          cancelledByUserId: null,
          createdAt: new Date("2026-03-20T00:00:00.000Z"),
          updatedAt: new Date("2026-03-20T00:00:00.000Z"),
          lines: [
            {
              id: "line-1",
              orderId: "order-1",
              skuId: "sku-id",
              locationId: "location-id",
              quantity: 3,
              unitPrice: null,
              createdAt: new Date("2026-03-20T00:00:00.000Z"),
            },
          ],
        },
        {
          id: "order-2",
          organizationId: "organization-id",
          orderNumber: "SO-002",
          status: "open",
          customerReference: null,
          orderedAt: new Date("2026-03-21T00:00:00.000Z"),
          createdByUserId: "operator-id",
          cancelledAt: null,
          cancelledByUserId: null,
          createdAt: new Date("2026-03-21T00:00:00.000Z"),
          updatedAt: new Date("2026-03-21T00:00:00.000Z"),
          lines: [
            {
              id: "line-2",
              orderId: "order-2",
              skuId: "sku-id",
              locationId: "location-id",
              quantity: 4,
              unitPrice: null,
              createdAt: new Date("2026-03-21T00:00:00.000Z"),
            },
          ],
        },
      ]),
    } as unknown as CustomerOrderRepository;

    const policyService = {
      requireActivePolicy: vi.fn().mockResolvedValue({
        id: "allocation-policy-id",
        organizationId: "organization-id",
        policyType: PolicyType.allocation,
        name: "Allocation v1",
        version: 1,
        status: PolicyStatus.active,
        rulesJson: {},
        createdByUserId: "operator-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      parseRules: vi.fn().mockReturnValue({
        automationTier: AutomationTier.recommend,
        shortageThresholdQty: 1,
        prioritizationMode: "oldest_order_first",
        maxAffectedOrders: 5,
      }),
    } as unknown as PolicyService;

    const decisionPersistenceService = {
      persistDecisionCandidate: vi.fn().mockResolvedValue({
        created: true,
        deduplicated: false,
        supersededDecisionIds: [],
        decision: buildDecision(),
      }),
    } as unknown as DecisionPersistenceService;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const service = new AllocationDecisionService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      skuRepository,
      locationRepository,
      inventoryPositionRepository,
      customerOrderRepository,
      policyService,
      decisionPersistenceService,
      authorizationService,
    );

    const result = await service.generateForScope(requestContext, {
      skuId: "sku-id",
      locationId: "location-id",
    });

    expect(result.generated).toBe(true);
    expect(result.decision?.decisionType).toBe(DecisionType.allocation);

    const persistenceInput = vi.mocked(decisionPersistenceService.persistDecisionCandidate).mock.calls[0]?.[1];
    expect(persistenceInput?.proposedPayload).toMatchObject({
      allocatableQty: 5,
      demandQty: 7,
      shortageQty: 2,
      affectedOrderRefs: ["SO-002"],
    });
    expect(persistenceInput?.reasons).toEqual([
      {
        code: DecisionReasonCodes.allocationConflict,
        message: "Open order demand exceeds available-to-promise inventory.",
      },
    ]);
  });
});
