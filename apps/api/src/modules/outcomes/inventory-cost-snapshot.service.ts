import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { SupplierSkuRepository } from "../supply/supplier-sku.repository.js";
import {
  DEFAULT_DAILY_CARRYING_RATE,
  DEFAULT_EXPEDITE_MULTIPLIER,
  INVENTORY_COST_FORMULA,
  outcomeAuditEventTypes,
} from "./outcomes.constants.js";
import { InventoryHistoryService } from "./inventory-history.service.js";
import { InventoryCostSnapshotRepository } from "./inventory-cost-snapshot.repository.js";
import { toInventoryCostSnapshotDto } from "./outcomes.mappers.js";
import type { InventoryCostSnapshotDto } from "./outcomes.schemas.js";

const roundMetric = (value: number): number => Math.round(value * 100) / 100;

export class InventoryCostSnapshotService {
  public constructor(
    private readonly inventoryHistoryService: InventoryHistoryService,
    private readonly supplierSkuRepository: SupplierSkuRepository,
    private readonly inventoryCostSnapshotRepository: InventoryCostSnapshotRepository,
    private readonly auditEventRepository: AuditEventRepository,
  ) {}

  public async captureSnapshotInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      skuId: string;
      locationId: string;
      snapshotAt: Date;
      carryingDays: number;
      estimatedDailyDemandQty: number;
    },
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<InventoryCostSnapshotDto> {
    const [snapshot, primarySupplierSku] = await Promise.all([
      this.inventoryHistoryService.calculateSnapshotAt(
        db,
        {
          organizationId: input.organizationId,
          skuId: input.skuId,
          locationId: input.locationId,
        },
        input.snapshotAt,
      ),
      this.supplierSkuRepository.findPrimaryBySku(db, {
        organizationId: input.organizationId,
        skuId: input.skuId,
      }),
    ]);

    const unitCost =
      primarySupplierSku?.unitCost === null || primarySupplierSku?.unitCost === undefined
        ? null
        : Number(primarySupplierSku.unitCost);
    const holdingCostEstimate =
      unitCost === null
        ? null
        : roundMetric(snapshot.onHandQty * unitCost * DEFAULT_DAILY_CARRYING_RATE * input.carryingDays);
    const shortageQty = Math.max(
      input.estimatedDailyDemandQty - Math.max(snapshot.availableToPromiseQty, 0),
      0,
    );
    const expediteCostEstimate =
      unitCost === null ? null : roundMetric(shortageQty * unitCost * DEFAULT_EXPEDITE_MULTIPLIER);

    const metadata = {
      formula: INVENTORY_COST_FORMULA,
      unitCost,
      onHandQty: snapshot.onHandQty,
      availableToPromiseQty: snapshot.availableToPromiseQty,
      estimatedDailyDemandQty: input.estimatedDailyDemandQty,
      dailyCarryingRate: DEFAULT_DAILY_CARRYING_RATE,
      expediteMultiplier: DEFAULT_EXPEDITE_MULTIPLIER,
    } satisfies Prisma.InputJsonObject;

    const persistedSnapshot = await this.inventoryCostSnapshotRepository.upsert(db, {
      organizationId: input.organizationId,
      skuId: input.skuId,
      locationId: input.locationId,
      snapshotAt: input.snapshotAt,
      create: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        snapshotAt: input.snapshotAt,
        ...(holdingCostEstimate !== null ? { holdingCostEstimate } : {}),
        ...(expediteCostEstimate !== null ? { expediteCostEstimate } : {}),
        carryingDays: input.carryingDays,
        metadata,
      },
      update: {
        holdingCostEstimate,
        expediteCostEstimate,
        carryingDays: input.carryingDays,
        metadata,
      },
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: options.actorUserId,
      eventType: outcomeAuditEventTypes.inventoryCostSnapshotted,
      entityType: "InventoryCostSnapshot",
      entityId: persistedSnapshot.id,
      payload: {
        skuId: input.skuId,
        locationId: input.locationId,
        snapshotAt: input.snapshotAt.toISOString(),
        holdingCostEstimate,
        expediteCostEstimate,
        carryingDays: input.carryingDays,
      },
      correlationId: options.correlationId,
    });

    return toInventoryCostSnapshotDto(persistedSnapshot);
  }
}
