import { DecisionType, PolicyType, SupplierStatus, type Policy } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { ForecastResultRepository } from "../forecasting/forecast-result.repository.js";
import { InventoryPositionRepository } from "../inventory/inventory-position.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { PurchaseOrderRepository } from "../supply/purchase-order.repository.js";
import { SupplierLeadTimeStatRepository } from "../supply/supplier-lead-time-stat.repository.js";
import { SupplierRepository } from "../supply/supplier.repository.js";
import { SupplierSkuRepository } from "../supply/supplier-sku.repository.js";
import { DecisionArtifactTypes, DecisionReasonCodes } from "./decisioning.constants.js";
import {
  calculateDailyAverageForecastQty,
  calculateDaysOfCover,
  calculateProjectedShortfallQty,
  roundRecommendedOrderQuantity,
  sumForecastQuantities,
} from "./decisioning-formulas.js";
import { toDecisionDto } from "./decisioning.mappers.js";
import type {
  DecisionGenerationResultDto,
  ExceptionPolicyRules,
  GenerateReplenishmentBatchInput,
  GenerateReplenishmentInput,
  ReplenishmentPolicyRules,
} from "./decisioning.schemas.js";
import { DecisionPersistenceService } from "./decision-persistence.service.js";
import { PolicyService } from "./policy.service.js";

interface ScopeInput {
  skuId: string;
  locationId: string;
}

interface ScopeEntities {
  sku: {
    id: string;
    baseUom: string;
  };
  location: {
    id: string;
  };
}

interface PositionSnapshot {
  organizationId: string;
  skuId: string;
  locationId: string;
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  availableToPromiseQty: number;
  safetyStockQty: number;
  reorderPointQty: number;
}

export class ReplenishmentDecisionService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly inventoryPositionRepository: InventoryPositionRepository,
    private readonly supplierRepository: SupplierRepository,
    private readonly supplierSkuRepository: SupplierSkuRepository,
    private readonly supplierLeadTimeStatRepository: SupplierLeadTimeStatRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly forecastResultRepository: ForecastResultRepository,
    private readonly policyService: PolicyService,
    private readonly decisionPersistenceService: DecisionPersistenceService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async generateForScope(
    context: RequestContext,
    input: GenerateReplenishmentInput,
  ): Promise<DecisionGenerationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      const policy = await this.policyService.requireActivePolicy(db, organizationId, PolicyType.replenishment);
      const rules = this.policyService.parseRules(policy) as ReplenishmentPolicyRules;

      const scopeEntities = await this.requireScope(db, organizationId, input);
      return this.evaluateScope(db, context, organizationId, policy, rules, input, scopeEntities);
    });
  }

  public async generateBatch(
    context: RequestContext,
    input: GenerateReplenishmentBatchInput,
  ): Promise<DecisionGenerationResultDto[]> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      const policy = await this.policyService.requireActivePolicy(db, organizationId, PolicyType.replenishment);
      const rules = this.policyService.parseRules(policy) as ReplenishmentPolicyRules;

      const positions = await this.inventoryPositionRepository.listByOrganization(db, {
        organizationId,
        ...(input.skuId ? { skuId: input.skuId } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
      });

      const scopes = positions
        .map((position) => ({
          skuId: position.skuId,
          locationId: position.locationId,
        }))
        .sort((left, right) =>
          `${left.skuId}:${left.locationId}`.localeCompare(`${right.skuId}:${right.locationId}`),
        );

      if (scopes.length === 0 && input.skuId && input.locationId) {
        const scopeEntities = await this.requireScope(db, organizationId, {
          skuId: input.skuId,
          locationId: input.locationId,
        });
        return [
          await this.evaluateScope(db, context, organizationId, policy, rules, {
            skuId: input.skuId,
            locationId: input.locationId,
          }, scopeEntities),
        ];
      }

      const results: DecisionGenerationResultDto[] = [];
      for (const scope of scopes) {
        const scopeEntities = await this.requireScope(db, organizationId, scope);
        results.push(await this.evaluateScope(db, context, organizationId, policy, rules, scope, scopeEntities));
      }

      return results;
    });
  }

  private async evaluateScope(
    db: DbClient,
    context: RequestContext,
    organizationId: string,
    policy: Policy,
    rules: ReplenishmentPolicyRules,
    scope: ScopeInput,
    scopeEntities: ScopeEntities,
  ): Promise<DecisionGenerationResultDto> {
    const position = await this.getPositionSnapshot(db, organizationId, scope);
    const forecastJob = await this.forecastJobRepository.findLatestCompletedSkuLocationJob(db, {
      organizationId,
      skuId: scope.skuId,
      locationId: scope.locationId,
    });

    if (!forecastJob) {
      const exceptionPolicyContext = await this.getExceptionPolicyContext(db, organizationId);
      return this.persistExceptionDecision(db, context, exceptionPolicyContext.policy, exceptionPolicyContext.rules, policy, position, {
        code: DecisionReasonCodes.missingForecast,
        message: "A completed sku_location forecast is required before replenishment can be proposed.",
      });
    }

    const forecastResults = await this.forecastResultRepository.listByJobIdForOrganization(db, {
      organizationId,
      forecastJobId: forecastJob.id,
    });
    const scopedForecastResults = forecastResults.filter(
      (result) => result.skuId === scope.skuId && result.locationId === scope.locationId,
    );
    const forecastHorizonDays = Math.min(rules.forecastHorizonDays, scopedForecastResults.length);
    if (forecastHorizonDays === 0) {
      const exceptionPolicyContext = await this.getExceptionPolicyContext(db, organizationId);
      return this.persistExceptionDecision(db, context, exceptionPolicyContext.policy, exceptionPolicyContext.rules, policy, position, {
        code: DecisionReasonCodes.missingForecast,
        message: "The latest completed forecast did not contain results for the requested scope.",
      });
    }

    const primarySupplierMapping = await this.supplierSkuRepository.findPrimaryBySku(db, {
      organizationId,
      skuId: scope.skuId,
    });
    if (!primarySupplierMapping) {
      const exceptionPolicyContext = await this.getExceptionPolicyContext(db, organizationId);
      return this.persistExceptionDecision(db, context, exceptionPolicyContext.policy, exceptionPolicyContext.rules, policy, position, {
        code: DecisionReasonCodes.noPrimarySupplier,
        message: "A primary supplier mapping is required before replenishment can be proposed.",
      });
    }

    const supplier = await this.supplierRepository.findByIdForOrganization(db, {
      organizationId,
      id: primarySupplierMapping.supplierId,
    });
    if (!supplier || supplier.status !== SupplierStatus.active) {
      const exceptionPolicyContext = await this.getExceptionPolicyContext(db, organizationId);
      return this.persistExceptionDecision(db, context, exceptionPolicyContext.policy, exceptionPolicyContext.rules, policy, position, {
        code: DecisionReasonCodes.noPrimarySupplier,
        message: "The primary supplier mapping does not reference an active supplier.",
      });
    }

    const leadTimeStat = await this.supplierLeadTimeStatRepository.findBySupplierAndSku(db, {
      organizationId,
      supplierId: supplier.id,
      skuId: scope.skuId,
    });

    const forecastQty = sumForecastQuantities(
      scopedForecastResults.map((result) => result.forecastQty),
      { horizonDays: forecastHorizonDays },
    );
    if (forecastQty <= 0) {
      return {
        generated: false,
        deduplicated: false,
        supersededDecisionIds: [],
        decision: null,
      };
    }

    const leadTimeDaysUsed =
      primarySupplierMapping.leadTimeDays ??
      (leadTimeStat ? Math.max(1, Math.round(leadTimeStat.averageLeadTimeDays)) : rules.defaultLeadTimeDays);

    const openPurchaseOrders = await this.purchaseOrderRepository.listOpenBySkuLocation(db, {
      organizationId,
      skuId: scope.skuId,
      locationId: scope.locationId,
    });
    const openPurchaseOrderQty = openPurchaseOrders.reduce((sum, purchaseOrder) => {
      const matchingLineOutstandingQty = purchaseOrder.lines
        .filter((line) => line.skuId === scope.skuId && line.expectedLocationId === scope.locationId)
        .reduce((lineSum, line) => lineSum + Math.max(0, line.quantityOrdered - line.quantityReceived), 0);
      return sum + matchingLineOutstandingQty;
    }, 0);

    const dailyAverageForecastQty = calculateDailyAverageForecastQty(forecastQty, forecastHorizonDays);
    const requiredQty =
      Math.ceil(dailyAverageForecastQty * (rules.targetDaysOfCover + leadTimeDaysUsed + rules.leadTimeBufferDays)) +
      position.reorderPointQty +
      (rules.useSafetyStock ? position.safetyStockQty : 0) +
      rules.shortageBufferQty;
    const projectedAvailableQty = position.availableToPromiseQty + openPurchaseOrderQty;
    const projectedShortfallQty = calculateProjectedShortfallQty(requiredQty, projectedAvailableQty);

    if (projectedShortfallQty <= 0) {
      return {
        generated: false,
        deduplicated: false,
        supersededDecisionIds: [],
        decision: null,
      };
    }

    const recommendedOrderQty = roundRecommendedOrderQuantity({
      rawQuantity: projectedShortfallQty,
      minOrderQty: primarySupplierMapping.minOrderQty,
      casePackQty: primarySupplierMapping.casePackQty,
    });
    const basisForecastResult = scopedForecastResults[0]!;
    const projectedDaysOfCover = calculateDaysOfCover(
      projectedAvailableQty,
      forecastQty,
      forecastHorizonDays,
    );

    const reasonCodes = [
      ...(position.availableToPromiseQty <= position.reorderPointQty
        ? [DecisionReasonCodes.reorderPointBreached]
        : []),
      ...(forecastQty > projectedAvailableQty
        ? [DecisionReasonCodes.forecastExceedsAvailableSupply]
        : []),
      ...(openPurchaseOrderQty < projectedShortfallQty
        ? [DecisionReasonCodes.openPurchaseOrderInsufficient]
        : []),
      ...(leadTimeStat &&
      primarySupplierMapping.leadTimeDays !== null &&
      leadTimeStat.averageLeadTimeDays > primarySupplierMapping.leadTimeDays
        ? [DecisionReasonCodes.supplierLeadTimeIncrease]
        : []),
    ];

    const persistedDecision = await this.decisionPersistenceService.persistDecisionCandidate(db, {
      organizationId,
      decisionType: DecisionType.replenishment,
      automationTier: rules.automationTier,
      policyId: policy.id,
      policyVersion: policy.version,
      skuId: scope.skuId,
      locationId: scope.locationId,
      supplierId: supplier.id,
      confidenceScore:
        primarySupplierMapping.leadTimeDays !== null ? 0.9 : leadTimeStat ? 0.8 : 0.7,
      proposedPayload: {
        skuId: scope.skuId,
        locationId: scope.locationId,
        supplierId: supplier.id,
        recommendedOrderQty,
        unitOfMeasure: scopeEntities.sku.baseUom,
        expectedLeadTimeDays: leadTimeDaysUsed,
        projectedDaysOfCover,
        projectedShortfallQty,
        basisDate: basisForecastResult.forecastDate.toISOString(),
        recommendationType: "purchase_order",
      },
      rationale: {
        reasonCodes,
        forecastQty,
        forecastHorizonDays,
        availableToPromiseQty: position.availableToPromiseQty,
        openPurchaseOrderQty,
        reorderPointQty: position.reorderPointQty,
        safetyStockQty: position.safetyStockQty,
        requiredQty,
        projectedAvailableQty,
        projectedShortfallQty,
        leadTimeDaysUsed,
        targetDaysOfCover: rules.targetDaysOfCover,
      },
      reasons: reasonCodes.map((code) => ({
        code,
        message: this.buildReasonMessage(code),
      })),
      scores: [
        { metric: "forecast_qty", value: forecastQty },
        { metric: "open_purchase_order_qty", value: openPurchaseOrderQty },
        { metric: "available_to_promise_qty", value: position.availableToPromiseQty },
        { metric: "projected_shortfall_qty", value: projectedShortfallQty },
        { metric: "recommended_order_qty", value: recommendedOrderQty },
        { metric: "lead_time_days_used", value: leadTimeDaysUsed },
      ],
      artifacts: [
        {
          artifactType: DecisionArtifactTypes.inventorySnapshot,
          payload: {
            onHandQty: position.onHandQty,
            reservedQty: position.reservedQty,
            inTransitQty: position.inTransitQty,
            availableToPromiseQty: position.availableToPromiseQty,
            safetyStockQty: position.safetyStockQty,
            reorderPointQty: position.reorderPointQty,
          },
        },
        {
          artifactType: DecisionArtifactTypes.forecastSnapshot,
          payload: {
            forecastJobId: forecastJob.id,
            forecastHorizonDays,
            forecastQty,
            forecastDates: scopedForecastResults.slice(0, forecastHorizonDays).map((result) => ({
              forecastDate: result.forecastDate.toISOString(),
              forecastQty: result.forecastQty,
            })),
          },
        },
        {
          artifactType: DecisionArtifactTypes.supplySnapshot,
          payload: {
            supplierId: supplier.id,
            supplierSkuId: primarySupplierMapping.id,
            minOrderQty: primarySupplierMapping.minOrderQty,
            casePackQty: primarySupplierMapping.casePackQty,
            configuredLeadTimeDays: primarySupplierMapping.leadTimeDays,
            observedLeadTimeDays: leadTimeStat?.averageLeadTimeDays ?? null,
            openPurchaseOrderQty,
          },
        },
      ],
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });

    return {
      generated: true,
      deduplicated: persistedDecision.deduplicated,
      supersededDecisionIds: persistedDecision.supersededDecisionIds,
      decision: toDecisionDto(persistedDecision.decision),
    };
  }

  private async persistExceptionDecision(
    db: DbClient,
    context: RequestContext,
    exceptionPolicy: Policy,
    exceptionRules: ExceptionPolicyRules,
    originatingPolicy: Policy,
    position: PositionSnapshot,
    reason: { code: string; message: string },
  ): Promise<DecisionGenerationResultDto> {
    const persistedDecision = await this.decisionPersistenceService.persistDecisionCandidate(db, {
      organizationId: position.organizationId,
      decisionType: DecisionType.exception,
      automationTier: exceptionRules.automationTier,
      policyId: exceptionPolicy.id,
      policyVersion: exceptionPolicy.version,
      skuId: position.skuId,
      locationId: position.locationId,
      supplierId: null,
      confidenceScore: null,
      proposedPayload: {
        skuId: position.skuId,
        locationId: position.locationId,
        detectedReasonCodes: [reason.code],
        recommendationType: "investigate",
      },
      rationale: {
        reasonCodes: [reason.code],
        availableToPromiseQty: position.availableToPromiseQty,
        reorderPointQty: position.reorderPointQty,
        safetyStockQty: position.safetyStockQty,
        originatingPolicyId: originatingPolicy.id,
        originatingPolicyType: originatingPolicy.policyType,
        originatingPolicyVersion: originatingPolicy.version,
      },
      reasons: [reason],
      scores: [
        { metric: "available_to_promise_qty", value: position.availableToPromiseQty },
        { metric: "reorder_point_qty", value: position.reorderPointQty },
        { metric: "safety_stock_qty", value: position.safetyStockQty },
      ],
      artifacts: [
        {
          artifactType: DecisionArtifactTypes.inventorySnapshot,
          payload: {
            onHandQty: position.onHandQty,
            reservedQty: position.reservedQty,
            inTransitQty: position.inTransitQty,
            availableToPromiseQty: position.availableToPromiseQty,
            safetyStockQty: position.safetyStockQty,
            reorderPointQty: position.reorderPointQty,
          },
        },
        {
          artifactType: DecisionArtifactTypes.policySnapshot,
          payload: {
            exceptionPolicyId: exceptionPolicy.id,
            exceptionPolicyType: exceptionPolicy.policyType,
            exceptionPolicyVersion: exceptionPolicy.version,
            originatingPolicyId: originatingPolicy.id,
            originatingPolicyType: originatingPolicy.policyType,
            originatingPolicyVersion: originatingPolicy.version,
          },
        },
      ],
      actorUserId: context.user.id,
      correlationId: context.correlationId,
    });

    return {
      generated: true,
      deduplicated: persistedDecision.deduplicated,
      supersededDecisionIds: persistedDecision.supersededDecisionIds,
      decision: toDecisionDto(persistedDecision.decision),
    };
  }

  private async getExceptionPolicyContext(
    db: DbClient,
    organizationId: string,
  ): Promise<{ policy: Policy; rules: ExceptionPolicyRules }> {
    const policy = await this.policyService.requireActivePolicy(db, organizationId, PolicyType.exception);

    return {
      policy,
      rules: this.policyService.parseRules(policy) as ExceptionPolicyRules,
    };
  }

  private async requireScope(
    db: DbClient,
    organizationId: string,
    scope: ScopeInput,
  ): Promise<ScopeEntities> {
    const [sku, location] = await Promise.all([
      this.skuRepository.findByIdForOrganization(db, {
        organizationId,
        id: scope.skuId,
      }),
      this.locationRepository.findByIdForOrganization(db, {
        organizationId,
        id: scope.locationId,
      }),
    ]);

    if (!sku) {
      throw new NotFoundError("SKU was not found.");
    }

    if (!location) {
      throw new NotFoundError("Location was not found.");
    }

    return {
      sku: {
        id: sku.id,
        baseUom: sku.baseUom,
      },
      location: {
        id: location.id,
      },
    };
  }

  private async getPositionSnapshot(
    db: DbClient,
    organizationId: string,
    scope: ScopeInput,
  ): Promise<PositionSnapshot> {
    const position = await this.inventoryPositionRepository.findByScope(db, {
      organizationId,
      skuId: scope.skuId,
      locationId: scope.locationId,
    });

    return (
      position ?? {
        organizationId,
        skuId: scope.skuId,
        locationId: scope.locationId,
        onHandQty: 0,
        reservedQty: 0,
        inTransitQty: 0,
        availableToPromiseQty: 0,
        safetyStockQty: 0,
        reorderPointQty: 0,
      }
    );
  }

  private buildReasonMessage(reasonCode: string): string {
    switch (reasonCode) {
      case DecisionReasonCodes.reorderPointBreached:
        return "Available inventory is at or below the reorder point.";
      case DecisionReasonCodes.forecastExceedsAvailableSupply:
        return "Forecast demand exceeds the currently available supply snapshot.";
      case DecisionReasonCodes.openPurchaseOrderInsufficient:
        return "Open purchase orders do not cover the projected shortfall.";
      case DecisionReasonCodes.supplierLeadTimeIncrease:
        return "Observed supplier lead time is above the configured lead time.";
      default:
        return "The replenishment policy produced this reason code.";
    }
  }
}
