import { DecisionType, PolicyType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { CustomerOrderRepository } from "../demand/customer-order.repository.js";
import { InventoryPositionRepository } from "../inventory/inventory-position.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { DecisionArtifactTypes, DecisionReasonCodes } from "./decisioning.constants.js";
import { toDecisionDto } from "./decisioning.mappers.js";
import type {
  AllocationPolicyRules,
  DecisionGenerationResultDto,
  GenerateAllocationInput,
} from "./decisioning.schemas.js";
import { DecisionPersistenceService } from "./decision-persistence.service.js";
import { PolicyService } from "./policy.service.js";

export class AllocationDecisionService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly inventoryPositionRepository: InventoryPositionRepository,
    private readonly customerOrderRepository: CustomerOrderRepository,
    private readonly policyService: PolicyService,
    private readonly decisionPersistenceService: DecisionPersistenceService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public async generateForScope(
    context: RequestContext,
    input: GenerateAllocationInput,
  ): Promise<DecisionGenerationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      await this.requireScope(db, organizationId, input);

      const policy = await this.policyService.requireActivePolicy(db, organizationId, PolicyType.allocation);
      const rules = this.policyService.parseRules(policy) as AllocationPolicyRules;
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

      const openOrders = await this.customerOrderRepository.listOpenBySkuLocation(db, {
        organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      });

      const scopedOpenOrders = openOrders.map((order) => ({
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderedAt: order.orderedAt,
        demandQty: order.lines
          .filter((line) => line.skuId === input.skuId && line.locationId === input.locationId)
          .reduce((sum, line) => sum + line.quantity, 0),
      }));

      const demandQty = scopedOpenOrders.reduce((sum, order) => sum + order.demandQty, 0);
      const shortageQty = Math.max(0, demandQty - position.availableToPromiseQty);

      if (demandQty === 0 || shortageQty < rules.shortageThresholdQty) {
        return {
          generated: false,
          deduplicated: false,
          supersededDecisionIds: [],
          decision: null,
        };
      }

      let remainingAllocatableQty = Math.max(0, position.availableToPromiseQty);
      const affectedOrderRefs: string[] = [];
      for (const order of scopedOpenOrders) {
        if (remainingAllocatableQty >= order.demandQty) {
          remainingAllocatableQty -= order.demandQty;
          continue;
        }

        affectedOrderRefs.push(order.orderNumber);
        remainingAllocatableQty = 0;
      }

      const persistedDecision = await this.decisionPersistenceService.persistDecisionCandidate(db, {
        organizationId,
        decisionType: DecisionType.allocation,
        automationTier: rules.automationTier,
        policyId: policy.id,
        policyVersion: policy.version,
        skuId: input.skuId,
        locationId: input.locationId,
        supplierId: null,
        confidenceScore: 0.85,
        proposedPayload: {
          skuId: input.skuId,
          locationId: input.locationId,
          allocatableQty: Math.min(position.availableToPromiseQty, demandQty),
          demandQty,
          shortageQty,
          recommendationSummary: "Prioritize oldest open orders first while stock remains constrained.",
          affectedOrderRefs: affectedOrderRefs.slice(0, rules.maxAffectedOrders),
        },
        rationale: {
          reasonCodes: [DecisionReasonCodes.allocationConflict],
          prioritizationMode: rules.prioritizationMode,
          availableToPromiseQty: position.availableToPromiseQty,
          demandQty,
          shortageQty,
          affectedOrderCount: affectedOrderRefs.length,
        },
        reasons: [
          {
            code: DecisionReasonCodes.allocationConflict,
            message: "Open order demand exceeds available-to-promise inventory.",
          },
        ],
        scores: [
          { metric: "available_to_promise_qty", value: position.availableToPromiseQty },
          { metric: "open_order_demand_qty", value: demandQty },
          { metric: "shortage_qty", value: shortageQty },
          { metric: "affected_order_count", value: affectedOrderRefs.length },
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
            artifactType: DecisionArtifactTypes.demandSnapshot,
            payload: {
              openOrders: scopedOpenOrders.map((order) => ({
                orderId: order.orderId,
                orderNumber: order.orderNumber,
                orderedAt: order.orderedAt.toISOString(),
                demandQty: order.demandQty,
              })),
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

  private async requireScope(
    db: DbClient,
    organizationId: string,
    input: { skuId: string; locationId: string },
  ): Promise<void> {
    const [sku, location] = await Promise.all([
      this.skuRepository.findByIdForOrganization(db, {
        organizationId,
        id: input.skuId,
      }),
      this.locationRepository.findByIdForOrganization(db, {
        organizationId,
        id: input.locationId,
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
