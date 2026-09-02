import { PurchaseOrderStatus, type SupplierLeadTimeStat, type SupplierPerformanceSnapshot } from "@prisma/client";
import { NotFoundError } from "../../shared/errors.js";

import type { DbClient } from "../../infrastructure/db/types.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { LEAD_TIME_DAY_IN_MILLISECONDS } from "./supply.constants.js";
import { toSupplierLeadTimeStatDto, toSupplierPerformanceSnapshotDto } from "./supply.mappers.js";
import { PurchaseOrderRepository } from "./purchase-order.repository.js";
import type {
  SupplierLeadTimeStatDto,
  SupplierPerformanceSnapshotDto,
} from "./supply.schemas.js";
import { SupplierLeadTimeStatRepository } from "./supplier-lead-time-stat.repository.js";
import { SupplierPerformanceSnapshotRepository } from "./supplier-performance.repository.js";
import { SupplierRepository } from "./supplier.repository.js";

const calculateLeadTimeDays = (orderedAt: Date, receivedAt: Date): number =>
  Math.max(0, Math.ceil((receivedAt.getTime() - orderedAt.getTime()) / LEAD_TIME_DAY_IN_MILLISECONDS));

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

export class SupplyAnalyticsService {
  public constructor(
    private readonly db: DbClient,
    private readonly supplierRepository: SupplierRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly supplierLeadTimeStatRepository: SupplierLeadTimeStatRepository,
    private readonly supplierPerformanceSnapshotRepository: SupplierPerformanceSnapshotRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async getSupplierPerformance(
    context: RequestContext,
    supplierId: string,
  ): Promise<SupplierPerformanceSnapshotDto | null> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");
    await this.requireSupplier(organizationId, supplierId);

    const snapshot = await this.supplierPerformanceSnapshotRepository.findBySupplier(this.db, {
      organizationId,
      supplierId,
    });

    return snapshot ? toSupplierPerformanceSnapshotDto(snapshot) : null;
  }

  public async listLeadTimeStats(
    context: RequestContext,
    supplierId: string,
  ): Promise<SupplierLeadTimeStatDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");
    await this.requireSupplier(organizationId, supplierId);

    const stats = await this.supplierLeadTimeStatRepository.listBySupplier(this.db, {
      organizationId,
      supplierId,
    });

    return stats.map(toSupplierLeadTimeStatDto);
  }

  public async recomputeSupplierPerformance(
    db: DbClient,
    input: {
      organizationId: string;
      supplierId: string;
      actorUserId: string | null;
      correlationId: string;
      emitEvents?: boolean;
    },
  ): Promise<SupplierPerformanceSnapshot> {
    const purchaseOrders = await this.purchaseOrderRepository.listByOrganization(db, {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
    });

    const receivedPurchaseOrders = purchaseOrders.filter(
      (purchaseOrder) => purchaseOrder.status === PurchaseOrderStatus.received && purchaseOrder.receivedAt !== null,
    );
    const leadTimes = receivedPurchaseOrders.flatMap((purchaseOrder) =>
      purchaseOrder.orderedAt && purchaseOrder.receivedAt
        ? [calculateLeadTimeDays(purchaseOrder.orderedAt, purchaseOrder.receivedAt)]
        : [],
    );
    const averageLeadTimeDays = average(leadTimes);
    const lastReceiptAt =
      receivedPurchaseOrders.length > 0
        ? [...receivedPurchaseOrders]
            .map((purchaseOrder) => purchaseOrder.receivedAt)
            .filter((value): value is Date => value !== null)
            .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
        : null;

    const snapshot = await this.supplierPerformanceSnapshotRepository.upsert(db, {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      data: {
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        totalPurchaseOrders: purchaseOrders.length,
        delayedPurchaseOrders: purchaseOrders.filter((purchaseOrder) => purchaseOrder.wasEverDelayed).length,
        receivedPurchaseOrders: receivedPurchaseOrders.length,
        ...(averageLeadTimeDays !== null ? { averageLeadTimeDays } : {}),
        ...(lastReceiptAt ? { lastReceiptAt } : {}),
      },
      update: {
        totalPurchaseOrders: purchaseOrders.length,
        delayedPurchaseOrders: purchaseOrders.filter((purchaseOrder) => purchaseOrder.wasEverDelayed).length,
        receivedPurchaseOrders: receivedPurchaseOrders.length,
        averageLeadTimeDays,
        lastReceiptAt,
      },
    });

    if (input.emitEvents !== false) {
      await this.auditEventRepository.create(db, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: "supply.performance.updated",
        entityType: "SupplierPerformanceSnapshot",
        entityId: snapshot.id,
        payload: {
          supplierId: input.supplierId,
          totalPurchaseOrders: snapshot.totalPurchaseOrders,
          delayedPurchaseOrders: snapshot.delayedPurchaseOrders,
          receivedPurchaseOrders: snapshot.receivedPurchaseOrders,
        },
        correlationId: input.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: input.organizationId,
        eventType: "supply.performance.updated.v1",
        aggregateType: "SupplierPerformanceSnapshot",
        aggregateId: snapshot.id,
        payload: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
          totalPurchaseOrders: snapshot.totalPurchaseOrders,
          delayedPurchaseOrders: snapshot.delayedPurchaseOrders,
          receivedPurchaseOrders: snapshot.receivedPurchaseOrders,
        },
      });
    }

    return snapshot;
  }

  public async recomputeLeadTimeStats(
    db: DbClient,
    input: {
      organizationId: string;
      supplierId: string;
      actorUserId: string | null;
      correlationId: string;
      emitEvents?: boolean;
    },
  ): Promise<SupplierLeadTimeStat[]> {
    const purchaseOrders = await this.purchaseOrderRepository.listByOrganization(db, {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      status: PurchaseOrderStatus.received,
    });

    const groupedStats = new Map<
      string,
      { values: number[]; lastObservedAt: Date; lastObservedLeadTimeDays: number }
    >();

    for (const purchaseOrder of purchaseOrders) {
      if (!purchaseOrder.orderedAt || !purchaseOrder.receivedAt) {
        continue;
      }

      const leadTimeDays = calculateLeadTimeDays(purchaseOrder.orderedAt, purchaseOrder.receivedAt);

      for (const line of purchaseOrder.lines) {
        if (line.quantityReceived <= 0) {
          continue;
        }

        const currentGroup = groupedStats.get(line.skuId) ?? {
          values: [],
          lastObservedAt: purchaseOrder.receivedAt,
          lastObservedLeadTimeDays: leadTimeDays,
        };
        currentGroup.values.push(leadTimeDays);
        if (purchaseOrder.receivedAt.getTime() > currentGroup.lastObservedAt.getTime()) {
          currentGroup.lastObservedAt = purchaseOrder.receivedAt;
          currentGroup.lastObservedLeadTimeDays = leadTimeDays;
        }
        groupedStats.set(line.skuId, currentGroup);
      }
    }

    await this.supplierLeadTimeStatRepository.deleteBySupplier(db, {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
    });

    await this.supplierLeadTimeStatRepository.createMany(
      db,
      [...groupedStats.entries()].map(([skuId, group]) => ({
        organizationId: input.organizationId,
        supplierId: input.supplierId,
        skuId,
        sampleCount: group.values.length,
        averageLeadTimeDays: group.values.reduce((sum, value) => sum + value, 0) / group.values.length,
        minLeadTimeDays: Math.min(...group.values),
        maxLeadTimeDays: Math.max(...group.values),
        lastObservedLeadTimeDays: group.lastObservedLeadTimeDays,
        lastObservedAt: group.lastObservedAt,
      })),
    );

    const stats = await this.supplierLeadTimeStatRepository.listBySupplier(db, {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
    });

    if (input.emitEvents !== false) {
      await this.auditEventRepository.create(db, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        eventType: "supply.lead_time.updated",
        entityType: "Supplier",
        entityId: input.supplierId,
        payload: {
          supplierId: input.supplierId,
          skuCount: stats.length,
          sampleCount: stats.reduce((sum, stat) => sum + stat.sampleCount, 0),
        },
        correlationId: input.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId: input.organizationId,
        eventType: "supply.lead_time.updated.v1",
        aggregateType: "Supplier",
        aggregateId: input.supplierId,
        payload: {
          organizationId: input.organizationId,
          supplierId: input.supplierId,
          skuCount: stats.length,
        },
      });
    }

    return stats;
  }

  private async requireSupplier(organizationId: string, supplierId: string): Promise<void> {
    const supplier = await this.supplierRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: supplierId,
    });
    if (!supplier) {
      throw new NotFoundError("Supplier was not found.");
    }
  }
}
