import {
  AutomationTier,
  DecisionStatus,
  DecisionType,
  PolicyStatus,
  PolicyType,
  Prisma,
  SupplierStatus,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { DecisionArtifactTypes, DecisionReasonCodes } from "../../modules/decisioning/decisioning.constants.js";
import { ReplenishmentDecisionService } from "../../modules/decisioning/replenishment-decision.service.js";
import type { DecisionPersistenceService } from "../../modules/decisioning/decision-persistence.service.js";
import type { DecisionWithDetails } from "../../modules/decisioning/decision.repository.js";
import type { PolicyService } from "../../modules/decisioning/policy.service.js";
import type { ForecastJobRepository } from "../../modules/forecasting/forecast-job.repository.js";
import type { ForecastResultRepository } from "../../modules/forecasting/forecast-result.repository.js";
import type { InventoryPositionRepository } from "../../modules/inventory/inventory-position.repository.js";
import type { LocationRepository } from "../../modules/inventory/location.repository.js";
import type { PurchaseOrderRepository } from "../../modules/supply/purchase-order.repository.js";
import type { SupplierLeadTimeStatRepository } from "../../modules/supply/supplier-lead-time-stat.repository.js";
import type { SupplierRepository } from "../../modules/supply/supplier.repository.js";
import type { SupplierSkuRepository } from "../../modules/supply/supplier-sku.repository.js";
import type { SkuRepository } from "../../modules/catalog/sku.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "7cf7bb81-94c0-46b5-a7e2-c856bb9476fd",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

const buildDecision = (input: {
  id: string;
  decisionType: DecisionType;
  policyId: string;
  policyVersion: number;
  proposedPayload: Prisma.JsonObject;
  rationale: Prisma.JsonObject;
  reasons: Array<{ code: string; message: string }>;
  scores: Array<{ metric: string; value: number }>;
  artifacts: Array<{ artifactType: string; payload: Prisma.JsonValue }>;
}): DecisionWithDetails =>
  ({
    id: input.id,
    organizationId: "organization-id",
    decisionType: input.decisionType,
    status: DecisionStatus.proposed,
    automationTier: AutomationTier.recommend,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    skuId: "sku-id",
    locationId: "location-id",
    supplierId: input.decisionType === DecisionType.replenishment ? "supplier-id" : null,
    confidenceScore: input.decisionType === DecisionType.replenishment ? 0.9 : null,
    proposedPayload: input.proposedPayload,
    rationale: input.rationale,
    createdByUserId: "owner-id",
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    reasons: input.reasons.map((reason, index) => ({
      id: `reason-${index + 1}`,
      decisionId: input.id,
      code: reason.code,
      message: reason.message,
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    })),
    scores: input.scores.map((score, index) => ({
      id: `score-${index + 1}`,
      decisionId: input.id,
      metric: score.metric,
      value: score.value,
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    })),
    artifacts: input.artifacts.map((artifact, index) => ({
      id: `artifact-${index + 1}`,
      decisionId: input.id,
      artifactType: artifact.artifactType,
      payload: artifact.payload,
      createdAt: new Date("2026-03-28T00:00:00.000Z"),
    })),
  }) as DecisionWithDetails;

describe("ReplenishmentDecisionService", () => {
  it("generates a replenishment proposal that respects MOQ and case-pack rounding", async () => {
    const skuRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "sku-id",
        organizationId: "organization-id",
        skuCode: "SKU-001",
        name: "Widget",
        description: null,
        baseUom: "case",
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
        onHandQty: 7,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 7,
        safetyStockQty: 0,
        reorderPointQty: 0,
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      listByOrganization: vi.fn(),
    } as unknown as InventoryPositionRepository;

    const supplierRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "supplier-id",
        organizationId: "organization-id",
        code: "SUP-001",
        name: "Acme Supply",
        status: SupplierStatus.active,
        contactEmail: null,
        contactPhone: null,
        metadata: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as SupplierRepository;

    const supplierSkuRepository = {
      findPrimaryBySku: vi.fn().mockResolvedValue({
        id: "supplier-sku-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        skuId: "sku-id",
        supplierSkuCode: "SUP-SKU-001",
        isPrimary: true,
        minOrderQty: 12,
        casePackQty: 6,
        unitCost: new Prisma.Decimal("12.50"),
        leadTimeDays: 2,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as SupplierSkuRepository;

    const supplierLeadTimeStatRepository = {
      findBySupplierAndSku: vi.fn().mockResolvedValue(null),
    } as unknown as SupplierLeadTimeStatRepository;

    const purchaseOrderRepository = {
      listOpenBySkuLocation: vi.fn().mockResolvedValue([]),
    } as unknown as PurchaseOrderRepository;

    const forecastJobRepository = {
      findLatestCompletedSkuLocationJob: vi.fn().mockResolvedValue({
        id: "forecast-job-id",
        organizationId: "organization-id",
        status: "completed",
        requestedByUserId: "owner-id",
        scopeType: "sku_location",
        scopeReference: {
          skuId: "sku-id",
          locationId: "location-id",
        },
        horizonDays: 5,
        modelType: "baseline_recent_average",
        inputSnapshot: {},
        errorMessage: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        startedAt: new Date("2026-03-28T00:01:00.000Z"),
        completedAt: new Date("2026-03-28T00:02:00.000Z"),
      }),
    } as unknown as ForecastJobRepository;

    const forecastResultRepository = {
      listByJobIdForOrganization: vi.fn().mockResolvedValue([
        {
          id: "result-1",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-29T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
        {
          id: "result-2",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-30T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
        {
          id: "result-3",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-31T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
        {
          id: "result-4",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-04-01T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
        {
          id: "result-5",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-04-02T00:00:00.000Z"),
          forecastQty: 4,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
      ]),
    } as unknown as ForecastResultRepository;

    const policyService = {
      requireActivePolicy: vi.fn().mockResolvedValue({
        id: "replenishment-policy-id",
        organizationId: "organization-id",
        policyType: PolicyType.replenishment,
        name: "Replenishment v1",
        version: 1,
        status: PolicyStatus.active,
        rulesJson: {},
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      parseRules: vi.fn().mockReturnValue({
        automationTier: AutomationTier.recommend,
        forecastHorizonDays: 5,
        targetDaysOfCover: 3,
        leadTimeBufferDays: 0,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      }),
    } as unknown as PolicyService;

    const decisionPersistenceService = {
      persistDecisionCandidate: vi.fn().mockResolvedValue({
        created: true,
        deduplicated: false,
        supersededDecisionIds: [],
        decision: buildDecision({
          id: "decision-id",
          decisionType: DecisionType.replenishment,
          policyId: "replenishment-policy-id",
          policyVersion: 1,
          proposedPayload: {
            recommendedOrderQty: 18,
            unitOfMeasure: "case",
            basisDate: "2026-03-29T00:00:00.000Z",
          },
          rationale: {
            reasonCodes: [
              DecisionReasonCodes.forecastExceedsAvailableSupply,
              DecisionReasonCodes.openPurchaseOrderInsufficient,
            ],
          },
          reasons: [
            {
              code: DecisionReasonCodes.forecastExceedsAvailableSupply,
              message: "Forecast demand exceeds the currently available supply snapshot.",
            },
          ],
          scores: [{ metric: "recommended_order_qty", value: 18 }],
          artifacts: [
            {
              artifactType: DecisionArtifactTypes.inventorySnapshot,
              payload: { availableToPromiseQty: 7 },
            },
          ],
        }),
      }),
    } as unknown as DecisionPersistenceService;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const service = new ReplenishmentDecisionService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      skuRepository,
      locationRepository,
      inventoryPositionRepository,
      supplierRepository,
      supplierSkuRepository,
      supplierLeadTimeStatRepository,
      purchaseOrderRepository,
      forecastJobRepository,
      forecastResultRepository,
      policyService,
      decisionPersistenceService,
      authorizationService,
    );

    const result = await service.generateForScope(requestContext, {
      skuId: "sku-id",
      locationId: "location-id",
    });

    expect(result.generated).toBe(true);
    expect(result.decision?.decisionType).toBe(DecisionType.replenishment);

    const persistenceInput = vi.mocked(decisionPersistenceService.persistDecisionCandidate).mock.calls[0]?.[1];
    expect(persistenceInput?.proposedPayload).toMatchObject({
      recommendedOrderQty: 18,
      unitOfMeasure: "case",
      basisDate: "2026-03-29T00:00:00.000Z",
    });
    expect(persistenceInput?.rationale).toMatchObject({
      forecastQty: 20,
      projectedShortfallQty: 13,
      leadTimeDaysUsed: 2,
    });
  });

  it("uses the active exception policy when replenishment input state is incomplete", async () => {
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
        onHandQty: 0,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 0,
        safetyStockQty: 0,
        reorderPointQty: 0,
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      listByOrganization: vi.fn(),
    } as unknown as InventoryPositionRepository;

    const forecastJobRepository = {
      findLatestCompletedSkuLocationJob: vi.fn().mockResolvedValue({
        id: "forecast-job-id",
        organizationId: "organization-id",
        status: "completed",
        requestedByUserId: "owner-id",
        scopeType: "sku_location",
        scopeReference: {
          skuId: "sku-id",
          locationId: "location-id",
        },
        horizonDays: 1,
        modelType: "baseline_recent_average",
        inputSnapshot: {},
        errorMessage: null,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        startedAt: new Date("2026-03-28T00:01:00.000Z"),
        completedAt: new Date("2026-03-28T00:02:00.000Z"),
      }),
    } as unknown as ForecastJobRepository;

    const forecastResultRepository = {
      listByJobIdForOrganization: vi.fn().mockResolvedValue([
        {
          id: "result-id",
          organizationId: "organization-id",
          forecastJobId: "forecast-job-id",
          skuId: "sku-id",
          locationId: "location-id",
          forecastDate: new Date("2026-03-29T00:00:00.000Z"),
          forecastQty: 5,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
      ]),
    } as unknown as ForecastResultRepository;

    const policyService = {
      requireActivePolicy: vi
        .fn()
        .mockResolvedValueOnce({
          id: "replenishment-policy-id",
          organizationId: "organization-id",
          policyType: PolicyType.replenishment,
          name: "Replenishment v1",
          version: 1,
          status: PolicyStatus.active,
          rulesJson: {},
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        })
        .mockResolvedValueOnce({
          id: "exception-policy-id",
          organizationId: "organization-id",
          policyType: PolicyType.exception,
          name: "Exceptions v1",
          version: 3,
          status: PolicyStatus.active,
          rulesJson: {},
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }),
      parseRules: vi.fn((policy: { policyType: PolicyType }) =>
        policy.policyType === PolicyType.replenishment
          ? {
              automationTier: AutomationTier.recommend,
              forecastHorizonDays: 1,
              targetDaysOfCover: 3,
              leadTimeBufferDays: 0,
              defaultLeadTimeDays: 7,
              useSafetyStock: true,
              shortageBufferQty: 0,
              demandSpikeMultiplier: 2,
            }
          : {
              automationTier: AutomationTier.observe,
              forecastHorizonDays: 14,
              leadTimeDriftThresholdDays: 3,
              demandSpikeMultiplier: 2,
              stockoutRiskCoverDays: 3,
            },
      ),
    } as unknown as PolicyService;

    const decisionPersistenceService = {
      persistDecisionCandidate: vi.fn().mockResolvedValue({
        created: true,
        deduplicated: false,
        supersededDecisionIds: [],
        decision: buildDecision({
          id: "exception-decision-id",
          decisionType: DecisionType.exception,
          policyId: "exception-policy-id",
          policyVersion: 3,
          proposedPayload: {
            detectedReasonCodes: [DecisionReasonCodes.noPrimarySupplier],
            recommendationType: "investigate",
          },
          rationale: {
            reasonCodes: [DecisionReasonCodes.noPrimarySupplier],
            originatingPolicyId: "replenishment-policy-id",
          },
          reasons: [
            {
              code: DecisionReasonCodes.noPrimarySupplier,
              message: "A primary supplier mapping is required before replenishment can be proposed.",
            },
          ],
          scores: [{ metric: "available_to_promise_qty", value: 0 }],
          artifacts: [
            {
              artifactType: DecisionArtifactTypes.policySnapshot,
              payload: {
                exceptionPolicyId: "exception-policy-id",
                originatingPolicyId: "replenishment-policy-id",
              },
            },
          ],
        }),
      }),
    } as unknown as DecisionPersistenceService;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const service = new ReplenishmentDecisionService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      skuRepository,
      locationRepository,
      inventoryPositionRepository,
      {} as SupplierRepository,
      {
        findPrimaryBySku: vi.fn().mockResolvedValue(null),
      } as unknown as SupplierSkuRepository,
      {} as SupplierLeadTimeStatRepository,
      {
        listOpenBySkuLocation: vi.fn().mockResolvedValue([]),
      } as unknown as PurchaseOrderRepository,
      forecastJobRepository,
      forecastResultRepository,
      policyService,
      decisionPersistenceService,
      authorizationService,
    );

    const result = await service.generateForScope(requestContext, {
      skuId: "sku-id",
      locationId: "location-id",
    });

    expect(result.generated).toBe(true);
    expect(result.decision?.decisionType).toBe(DecisionType.exception);

    const persistenceInput = vi.mocked(decisionPersistenceService.persistDecisionCandidate).mock.calls[0]?.[1];
    expect(persistenceInput?.decisionType).toBe(DecisionType.exception);
    expect(persistenceInput?.policyId).toBe("exception-policy-id");
    expect(persistenceInput?.policyVersion).toBe(3);
    expect(persistenceInput?.rationale).toMatchObject({
      originatingPolicyId: "replenishment-policy-id",
      originatingPolicyType: PolicyType.replenishment,
    });
    expect(persistenceInput?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: DecisionArtifactTypes.policySnapshot,
        }),
      ]),
    );
  });
});
