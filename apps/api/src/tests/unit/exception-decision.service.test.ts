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
import { ExceptionDecisionService } from "../../modules/decisioning/exception-decision.service.js";
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
  correlationId: "64377557-f4bf-43a0-b16c-d9e2a7103b17",
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
    decisionType: DecisionType.exception,
    status: DecisionStatus.proposed,
    automationTier: AutomationTier.observe,
    policyId: "exception-policy-id",
    policyVersion: 1,
    skuId: "sku-id",
    locationId: "location-id",
    supplierId: "supplier-id",
    confidenceScore: null,
    proposedPayload: {
      detectedReasonCodes: [
        DecisionReasonCodes.supplierLeadTimeIncrease,
        DecisionReasonCodes.openPurchaseOrderInsufficient,
        DecisionReasonCodes.forecastExceedsAvailableSupply,
        DecisionReasonCodes.demandSpikeDetected,
      ],
      recommendationType: "investigate",
      issueCount: 4,
    },
    rationale: {
      reasonCodes: [
        DecisionReasonCodes.supplierLeadTimeIncrease,
        DecisionReasonCodes.openPurchaseOrderInsufficient,
        DecisionReasonCodes.forecastExceedsAvailableSupply,
        DecisionReasonCodes.demandSpikeDetected,
      ],
    },
    createdByUserId: "operator-id",
    createdAt: new Date("2026-03-28T00:00:00.000Z"),
    updatedAt: new Date("2026-03-28T00:00:00.000Z"),
    reasons: [
      {
        id: "reason-id-1",
        decisionId: "decision-id",
        code: DecisionReasonCodes.supplierLeadTimeIncrease,
        message: "Observed supplier lead time has drifted above the configured threshold.",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    scores: [
      {
        id: "score-id-1",
        decisionId: "decision-id",
        metric: "days_of_cover",
        value: 0.2,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
    artifacts: [
      {
        id: "artifact-id-1",
        decisionId: "decision-id",
        artifactType: DecisionArtifactTypes.supplySnapshot,
        payload: {
          supplierId: "supplier-id",
          observedLeadTimeDays: 9,
        },
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
      },
    ],
  }) as DecisionWithDetails;

describe("ExceptionDecisionService", () => {
  it("raises deterministic exception decisions from inventory, forecast, and supply drift inputs", async () => {
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
        onHandQty: 2,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 2,
        safetyStockQty: 0,
        reorderPointQty: 0,
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
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
        minOrderQty: 1,
        casePackQty: null,
        unitCost: null,
        leadTimeDays: 5,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as SupplierSkuRepository;

    const supplierLeadTimeStatRepository = {
      findBySupplierAndSku: vi.fn().mockResolvedValue({
        id: "lead-time-id",
        organizationId: "organization-id",
        supplierId: "supplier-id",
        skuId: "sku-id",
        sampleCount: 6,
        averageLeadTimeDays: 9,
        minLeadTimeDays: 7,
        maxLeadTimeDays: 10,
        lastObservedLeadTimeDays: 9,
        lastObservedAt: new Date("2026-03-27T00:00:00.000Z"),
        updatedAt: new Date("2026-03-27T00:00:00.000Z"),
      }),
    } as unknown as SupplierLeadTimeStatRepository;

    const purchaseOrderRepository = {
      listOpenBySkuLocation: vi.fn().mockResolvedValue([]),
    } as unknown as PurchaseOrderRepository;

    const forecastJobRepository = {
      findLatestCompletedSkuLocationJob: vi.fn().mockResolvedValue({
        id: "forecast-job-id",
        organizationId: "organization-id",
        status: "completed",
        requestedByUserId: "operator-id",
        scopeType: "sku_location",
        scopeReference: {
          skuId: "sku-id",
          locationId: "location-id",
        },
        horizonDays: 2,
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
          forecastQty: 10,
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
          forecastQty: 10,
          confidenceLow: null,
          confidenceHigh: null,
          modelType: "baseline_recent_average",
          createdAt: new Date("2026-03-28T00:02:00.000Z"),
        },
      ]),
    } as unknown as ForecastResultRepository;

    const policyService = {
      requireActivePolicy: vi.fn().mockResolvedValue({
        id: "exception-policy-id",
        organizationId: "organization-id",
        policyType: PolicyType.exception,
        name: "Exceptions v1",
        version: 1,
        status: PolicyStatus.active,
        rulesJson: {},
        createdByUserId: "operator-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      parseRules: vi.fn().mockReturnValue({
        automationTier: AutomationTier.observe,
        forecastHorizonDays: 2,
        leadTimeDriftThresholdDays: 3,
        demandSpikeMultiplier: 2,
        stockoutRiskCoverDays: 3,
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

    const service = new ExceptionDecisionService(
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
    expect(result.decision?.decisionType).toBe(DecisionType.exception);

    const persistenceInput = vi.mocked(decisionPersistenceService.persistDecisionCandidate).mock.calls[0]?.[1];
    expect(persistenceInput?.reasons.map((reason) => reason.code)).toEqual([
      DecisionReasonCodes.supplierLeadTimeIncrease,
      DecisionReasonCodes.openPurchaseOrderInsufficient,
      DecisionReasonCodes.forecastExceedsAvailableSupply,
      DecisionReasonCodes.demandSpikeDetected,
    ]);
    expect(persistenceInput?.scores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "days_of_cover", value: 0.2 }),
        expect.objectContaining({ metric: "observed_lead_time_days", value: 9 }),
      ]),
    );
  });
});
