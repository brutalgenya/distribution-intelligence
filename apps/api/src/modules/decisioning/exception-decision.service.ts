import { DecisionType, PolicyType, SupplierStatus } from "@prisma/client";

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
import { calculateDaysOfCover, sumForecastQuantities } from "./decisioning-formulas.js";
import { toDecisionDto } from "./decisioning.mappers.js";
import type {
  DecisionGenerationResultDto,
  ExceptionPolicyRules,
  GenerateExceptionInput,
} from "./decisioning.schemas.js";
import { DecisionPersistenceService } from "./decision-persistence.service.js";
import { PolicyService } from "./policy.service.js";

interface ScopeInput {
  skuId: string;
  locationId: string;
}

export class ExceptionDecisionService {
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
    input: GenerateExceptionInput,
  ): Promise<DecisionGenerationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      await this.requireScope(db, organizationId, input);

      const policy = await this.policyService.requireActivePolicy(db, organizationId, PolicyType.exception);
      const rules = this.policyService.parseRules(policy) as ExceptionPolicyRules;
      const position =
        (await this.inventoryPositionRepository.findByScope(db, {
          organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
        })) ?? {
          organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
          onHandQty: 0,
          reservedQty: 0,
          inTransitQty: 0,
          availableToPromiseQty: 0,
          safetyStockQty: 0,
          reorderPointQty: 0,
        };

      const primarySupplierMapping = await this.supplierSkuRepository.findPrimaryBySku(db, {
        organizationId,
        skuId: input.skuId,
      });
      const supplier =
        primarySupplierMapping &&
        (await this.supplierRepository.findByIdForOrganization(db, {
          organizationId,
          id: primarySupplierMapping.supplierId,
        }));
      const leadTimeStat =
        primarySupplierMapping &&
        (await this.supplierLeadTimeStatRepository.findBySupplierAndSku(db, {
          organizationId,
          supplierId: primarySupplierMapping.supplierId,
          skuId: input.skuId,
        }));

      const forecastJob = await this.forecastJobRepository.findLatestCompletedSkuLocationJob(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      });
      const forecastResults = forecastJob
        ? await this.forecastResultRepository.listByJobIdForOrganization(db, {
            organizationId,
            forecastJobId: forecastJob.id,
          })
        : [];
      const scopedForecastResults = forecastResults.filter(
        (result) => result.skuId === input.skuId && result.locationId === input.locationId,
      );
      const forecastHorizonDays = Math.min(rules.forecastHorizonDays, scopedForecastResults.length);
      const forecastQty =
        forecastHorizonDays > 0
          ? sumForecastQuantities(
              scopedForecastResults.map((result) => result.forecastQty),
              { horizonDays: forecastHorizonDays },
            )
          : 0;

      const openPurchaseOrders = await this.purchaseOrderRepository.listOpenBySkuLocation(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      });
      const openPurchaseOrderQty = openPurchaseOrders.reduce((sum, purchaseOrder) => {
        const outstandingQty = purchaseOrder.lines
          .filter((line) => line.skuId === input.skuId && line.expectedLocationId === input.locationId)
          .reduce((lineSum, line) => lineSum + Math.max(0, line.quantityOrdered - line.quantityReceived), 0);
        return sum + outstandingQty;
      }, 0);

      const availableSupplyQty = position.availableToPromiseQty + openPurchaseOrderQty;
      const daysOfCover = calculateDaysOfCover(availableSupplyQty, forecastQty, Math.max(forecastHorizonDays, 1));

      const reasons: Array<{ code: string; message: string }> = [];
      if (!primarySupplierMapping || !supplier || supplier.status !== SupplierStatus.active) {
        reasons.push({
          code: DecisionReasonCodes.noPrimarySupplier,
          message: "No active primary supplier mapping is available for this SKU.",
        });
      }

      if (!forecastJob || forecastHorizonDays === 0) {
        reasons.push({
          code: DecisionReasonCodes.missingForecast,
          message: "No completed sku_location forecast is available for this decision scope.",
        });
      }

      if (
        primarySupplierMapping &&
        leadTimeStat &&
        primarySupplierMapping.leadTimeDays !== null &&
        leadTimeStat.averageLeadTimeDays - primarySupplierMapping.leadTimeDays >=
          rules.leadTimeDriftThresholdDays
      ) {
        reasons.push({
          code: DecisionReasonCodes.supplierLeadTimeIncrease,
          message: "Observed supplier lead time has drifted above the configured threshold.",
        });
      }

      if (forecastQty > availableSupplyQty) {
        reasons.push({
          code: DecisionReasonCodes.openPurchaseOrderInsufficient,
          message: "Open supply and available inventory do not cover the forecasted demand horizon.",
        });
      }

      if (daysOfCover !== null && daysOfCover <= rules.stockoutRiskCoverDays) {
        reasons.push({
          code: DecisionReasonCodes.forecastExceedsAvailableSupply,
          message: "Projected days of cover are below the configured stockout-risk threshold.",
        });
      }

      if (
        forecastQty > 0 &&
        position.availableToPromiseQty > 0 &&
        forecastQty > position.availableToPromiseQty * rules.demandSpikeMultiplier
      ) {
        reasons.push({
          code: DecisionReasonCodes.demandSpikeDetected,
          message: "Forecast demand is materially above the available-to-promise baseline.",
        });
      }

      const uniqueReasons = reasons.filter(
        (reason, index, collection) =>
          collection.findIndex((candidate) => candidate.code === reason.code) === index,
      );

      if (uniqueReasons.length === 0) {
        return {
          generated: false,
          deduplicated: false,
          supersededDecisionIds: [],
          decision: null,
        };
      }

      const persistedDecision = await this.decisionPersistenceService.persistDecisionCandidate(db, {
        organizationId,
        decisionType: DecisionType.exception,
        automationTier: rules.automationTier,
        policyId: policy.id,
        policyVersion: policy.version,
        skuId: input.skuId,
        locationId: input.locationId,
        supplierId: supplier?.id ?? null,
        confidenceScore: null,
        proposedPayload: {
          skuId: input.skuId,
          locationId: input.locationId,
          detectedReasonCodes: uniqueReasons.map((reason) => reason.code),
          recommendationType: "investigate",
          issueCount: uniqueReasons.length,
        },
        rationale: {
          reasonCodes: uniqueReasons.map((reason) => reason.code),
          forecastQty,
          forecastHorizonDays,
          availableToPromiseQty: position.availableToPromiseQty,
          openPurchaseOrderQty,
          availableSupplyQty,
          daysOfCover,
          configuredLeadTimeDays: primarySupplierMapping?.leadTimeDays ?? null,
          observedLeadTimeDays: leadTimeStat?.averageLeadTimeDays ?? null,
        },
        reasons: uniqueReasons,
        scores: [
          { metric: "forecast_qty", value: forecastQty },
          { metric: "available_to_promise_qty", value: position.availableToPromiseQty },
          { metric: "open_purchase_order_qty", value: openPurchaseOrderQty },
          ...(daysOfCover !== null ? [{ metric: "days_of_cover", value: daysOfCover }] : []),
          ...(leadTimeStat ? [{ metric: "observed_lead_time_days", value: leadTimeStat.averageLeadTimeDays }] : []),
        ],
        artifacts: [
          {
            artifactType: DecisionArtifactTypes.inventorySnapshot,
            payload: {
              onHandQty: position.onHandQty,
              reservedQty: position.reservedQty,
              inTransitQty: position.inTransitQty,
              availableToPromiseQty: position.availableToPromiseQty,
            },
          },
          {
            artifactType: DecisionArtifactTypes.forecastSnapshot,
            payload: {
              forecastJobId: forecastJob?.id ?? null,
              forecastHorizonDays,
              forecastQty,
            },
          },
          {
            artifactType: DecisionArtifactTypes.supplySnapshot,
            payload: {
              supplierId: supplier?.id ?? null,
              supplierSkuId: primarySupplierMapping?.id ?? null,
              configuredLeadTimeDays: primarySupplierMapping?.leadTimeDays ?? null,
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
    });
  }

  private async requireScope(db: DbClient, organizationId: string, scope: ScopeInput): Promise<void> {
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
  }
}
