import {
  Prisma,
  PurchaseOrderStatus,
  SupplierStatus,
  type Location,
  type PurchaseOrderLine,
  type Supplier,
} from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { type CreateReceiptInput } from "../inventory/inventory.schemas.js";
import { InventoryService } from "../inventory/inventory.service.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  assertPurchaseOrderCanReceive,
  assertPurchaseOrderTransition,
  derivePurchaseOrderReceiptStatus,
} from "./purchase-order-lifecycle.js";
import { toPurchaseOrderDto } from "./supply.mappers.js";
import type {
  CreatePurchaseOrderInput,
  DelayPurchaseOrderInput,
  PurchaseOrderDto,
  ReceivePurchaseOrderInput,
} from "./supply.schemas.js";
import { PurchaseOrderLineRepository } from "./purchase-order-line.repository.js";
import { PurchaseOrderRepository, type PurchaseOrderWithLines } from "./purchase-order.repository.js";
import { SupplyAnalyticsService } from "./supply-analytics.service.js";
import { SupplierRepository } from "./supplier.repository.js";

export class PurchaseOrderService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly supplierRepository: SupplierRepository,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly purchaseOrderLineRepository: PurchaseOrderLineRepository,
    private readonly inventoryService: InventoryService,
    private readonly supplyAnalyticsService: SupplyAnalyticsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createDraft(context: RequestContext, input: CreatePurchaseOrderInput): Promise<PurchaseOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");
        return this.createDraftInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          input,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("PO number already exists in this organization.");
      }

      throw error;
    }
  }

  public async createDraftInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string;
      correlationId: string;
      input: CreatePurchaseOrderInput;
    },
  ): Promise<PurchaseOrderDto> {
    const supplier = await this.requireActiveSupplier(db, input.organizationId, input.input.supplierId);
    await this.validatePurchaseOrderLines(db, input.organizationId, input.input.lines);

    const purchaseOrder = await this.purchaseOrderRepository.create(db, {
      organizationId: input.organizationId,
      supplierId: supplier.id,
      poNumber: input.input.poNumber,
      ...(input.input.expectedDeliveryAt ? { expectedDeliveryAt: new Date(input.input.expectedDeliveryAt) } : {}),
      ...(input.input.currency ? { currency: input.input.currency.toUpperCase() } : {}),
      ...(input.input.notes ? { notes: input.input.notes } : {}),
      createdByUserId: input.actorUserId,
    });

    await this.purchaseOrderLineRepository.createMany(
      db,
      input.input.lines.map((line) => ({
        purchaseOrderId: purchaseOrder.id,
        skuId: line.skuId,
        quantityOrdered: line.quantityOrdered,
        ...(line.unitCost !== undefined ? { unitCost: new Prisma.Decimal(line.unitCost) } : {}),
        ...(line.expectedLocationId ? { expectedLocationId: line.expectedLocationId } : {}),
      })),
    );

    const persistedPurchaseOrder = await this.requirePurchaseOrder(db, input.organizationId, purchaseOrder.id);

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: "supply.purchase_order.created",
      entityType: "PurchaseOrder",
      entityId: persistedPurchaseOrder.id,
      payload: {
        supplierId: persistedPurchaseOrder.supplierId,
        poNumber: persistedPurchaseOrder.poNumber,
        lineCount: persistedPurchaseOrder.lines.length,
        status: persistedPurchaseOrder.status,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: "supply.purchase_order.created.v1",
      aggregateType: "PurchaseOrder",
      aggregateId: persistedPurchaseOrder.id,
      payload: {
        organizationId: input.organizationId,
        purchaseOrderId: persistedPurchaseOrder.id,
        supplierId: persistedPurchaseOrder.supplierId,
        poNumber: persistedPurchaseOrder.poNumber,
        status: persistedPurchaseOrder.status,
      },
    });

    await this.supplyAnalyticsService.recomputeSupplierPerformance(db, {
      organizationId: input.organizationId,
      supplierId: supplier.id,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
    });

    return toPurchaseOrderDto(persistedPurchaseOrder);
  }

  public async submitPurchaseOrder(context: RequestContext, purchaseOrderId: string): Promise<PurchaseOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

      const purchaseOrder = await this.requirePurchaseOrder(db, organizationId, purchaseOrderId);
      if (purchaseOrder.status === PurchaseOrderStatus.submitted) {
        return toPurchaseOrderDto(purchaseOrder);
      }

      assertPurchaseOrderTransition(purchaseOrder.status, PurchaseOrderStatus.submitted);

      const submittedPurchaseOrder = await this.purchaseOrderRepository.updateForOrganization(db, {
        organizationId,
        id: purchaseOrderId,
        data: {
          status: PurchaseOrderStatus.submitted,
          orderedAt: purchaseOrder.orderedAt ?? new Date(),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "supply.purchase_order.submitted",
        entityType: "PurchaseOrder",
        entityId: submittedPurchaseOrder.id,
        payload: {
          supplierId: submittedPurchaseOrder.supplierId,
          poNumber: submittedPurchaseOrder.poNumber,
          status: submittedPurchaseOrder.status,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "supply.purchase_order.submitted.v1",
        aggregateType: "PurchaseOrder",
        aggregateId: submittedPurchaseOrder.id,
        payload: {
          organizationId,
          purchaseOrderId: submittedPurchaseOrder.id,
          supplierId: submittedPurchaseOrder.supplierId,
          poNumber: submittedPurchaseOrder.poNumber,
          status: submittedPurchaseOrder.status,
        },
      });

      return toPurchaseOrderDto(submittedPurchaseOrder);
    });
  }

  public async delayPurchaseOrder(
    context: RequestContext,
    purchaseOrderId: string,
    input: DelayPurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

      const purchaseOrder = await this.requirePurchaseOrder(db, organizationId, purchaseOrderId);
      if (purchaseOrder.status === PurchaseOrderStatus.delayed) {
        return toPurchaseOrderDto(purchaseOrder);
      }

      assertPurchaseOrderTransition(purchaseOrder.status, PurchaseOrderStatus.delayed);

      const delayedPurchaseOrder = await this.purchaseOrderRepository.updateForOrganization(db, {
        organizationId,
        id: purchaseOrderId,
        data: {
          status: PurchaseOrderStatus.delayed,
          delayedAt: new Date(),
          wasEverDelayed: true,
          ...(input.expectedDeliveryAt ? { expectedDeliveryAt: new Date(input.expectedDeliveryAt) } : {}),
          ...(input.notes ? { notes: input.notes } : {}),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "supply.purchase_order.delayed",
        entityType: "PurchaseOrder",
        entityId: delayedPurchaseOrder.id,
        payload: {
          supplierId: delayedPurchaseOrder.supplierId,
          poNumber: delayedPurchaseOrder.poNumber,
          status: delayedPurchaseOrder.status,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "supply.purchase_order.delayed.v1",
        aggregateType: "PurchaseOrder",
        aggregateId: delayedPurchaseOrder.id,
        payload: {
          organizationId,
          purchaseOrderId: delayedPurchaseOrder.id,
          supplierId: delayedPurchaseOrder.supplierId,
          poNumber: delayedPurchaseOrder.poNumber,
          status: delayedPurchaseOrder.status,
        },
      });

      await this.supplyAnalyticsService.recomputeSupplierPerformance(db, {
        organizationId,
        supplierId: delayedPurchaseOrder.supplierId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });

      return toPurchaseOrderDto(delayedPurchaseOrder);
    });
  }

  public async receivePurchaseOrder(
    context: RequestContext,
    purchaseOrderId: string,
    input: ReceivePurchaseOrderInput,
  ): Promise<PurchaseOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

      const purchaseOrder = await this.requirePurchaseOrder(db, organizationId, purchaseOrderId);
      assertPurchaseOrderCanReceive(purchaseOrder.status);

      const receiptRequests = this.buildReceiptRequestMap(input.lines);
      const validatedLines = await this.validateReceiptLines(db, organizationId, purchaseOrder, receiptRequests);

      if (validatedLines.every((line) => line.deltaQuantity === 0)) {
        if (
          purchaseOrder.status === PurchaseOrderStatus.partially_received ||
          purchaseOrder.status === PurchaseOrderStatus.received
        ) {
          return toPurchaseOrderDto(purchaseOrder);
        }

        throw new ConflictError("Receipt request does not advance any purchase order quantities.");
      }

      for (const validatedLine of validatedLines) {
        if (validatedLine.deltaQuantity === 0 || !validatedLine.locationId) {
          continue;
        }

        const inventoryReceiptInput: CreateReceiptInput = {
          skuId: validatedLine.line.skuId,
          locationId: validatedLine.locationId,
          quantity: validatedLine.deltaQuantity,
          referenceType: "purchase_order_line",
          referenceId: validatedLine.line.id,
          notes: `Receipt for PO ${purchaseOrder.poNumber}`,
        };

        await this.inventoryService.receiveInventoryInTransaction(db, context, inventoryReceiptInput);

        await this.purchaseOrderLineRepository.updateById(db, {
          id: validatedLine.line.id,
          data: {
            quantityReceived: validatedLine.requestedQuantityReceived,
            ...(validatedLine.line.expectedLocationId === null
              ? { expectedLocationId: validatedLine.locationId }
              : {}),
          },
        });
      }

      const refreshedLines = await this.purchaseOrderLineRepository.listByPurchaseOrderId(db, purchaseOrder.id);
      const nextStatus = derivePurchaseOrderReceiptStatus(purchaseOrder.status, refreshedLines);
      const receiptTimestamp = input.receivedAt ? new Date(input.receivedAt) : new Date();

      const updatedPurchaseOrder = await this.purchaseOrderRepository.updateForOrganization(db, {
        organizationId,
        id: purchaseOrder.id,
        data: {
          ...(nextStatus !== purchaseOrder.status ? { status: nextStatus } : {}),
          ...(nextStatus === PurchaseOrderStatus.received
            ? { receivedAt: purchaseOrder.receivedAt ?? receiptTimestamp }
            : {}),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "supply.purchase_order.received",
        entityType: "PurchaseOrder",
        entityId: updatedPurchaseOrder.id,
        payload: {
          supplierId: updatedPurchaseOrder.supplierId,
          poNumber: updatedPurchaseOrder.poNumber,
          status: updatedPurchaseOrder.status,
          lineCount: updatedPurchaseOrder.lines.length,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "supply.purchase_order.received.v1",
        aggregateType: "PurchaseOrder",
        aggregateId: updatedPurchaseOrder.id,
        payload: {
          organizationId,
          purchaseOrderId: updatedPurchaseOrder.id,
          supplierId: updatedPurchaseOrder.supplierId,
          poNumber: updatedPurchaseOrder.poNumber,
          status: updatedPurchaseOrder.status,
        },
      });

      await this.supplyAnalyticsService.recomputeSupplierPerformance(db, {
        organizationId,
        supplierId: updatedPurchaseOrder.supplierId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });

      if (updatedPurchaseOrder.status === PurchaseOrderStatus.received) {
        await this.supplyAnalyticsService.recomputeLeadTimeStats(db, {
          organizationId,
          supplierId: updatedPurchaseOrder.supplierId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
        });
      }

      return toPurchaseOrderDto(updatedPurchaseOrder);
    });
  }

  public async listPurchaseOrders(
    context: RequestContext,
    filters: { status?: PurchaseOrderStatus; supplierId?: string },
  ): Promise<PurchaseOrderDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    if (filters.supplierId) {
      await this.requireSupplier(this.db, organizationId, filters.supplierId);
    }

    const purchaseOrders = await this.purchaseOrderRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    });

    return purchaseOrders.map(toPurchaseOrderDto);
  }

  public async getPurchaseOrder(context: RequestContext, purchaseOrderId: string): Promise<PurchaseOrderDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    const purchaseOrder = await this.requirePurchaseOrder(this.db, organizationId, purchaseOrderId);
    return toPurchaseOrderDto(purchaseOrder);
  }

  private buildReceiptRequestMap(
    lines: ReceivePurchaseOrderInput["lines"],
  ): Map<string, { quantityReceived: number; locationId?: string }> {
    const receiptRequests = new Map<string, { quantityReceived: number; locationId?: string }>();

    for (const line of lines) {
      if (receiptRequests.has(line.lineId)) {
        throw new BadRequestError(`Duplicate receipt line ${line.lineId} is not allowed.`);
      }

      receiptRequests.set(line.lineId, {
        quantityReceived: line.quantityReceived,
        ...(line.locationId ? { locationId: line.locationId } : {}),
      });
    }

    return receiptRequests;
  }

  private async validatePurchaseOrderLines(
    db: DbClient,
    organizationId: string,
    lines: CreatePurchaseOrderInput["lines"],
  ): Promise<void> {
    const skuIds = [...new Set(lines.map((line) => line.skuId))];
    const locationIds = [...new Set(lines.flatMap((line) => (line.expectedLocationId ? [line.expectedLocationId] : [])))];

    const [skus, locations] = await Promise.all([
      this.skuRepository.listByIdsForOrganization(db, {
        organizationId,
        ids: skuIds,
      }),
      this.locationRepository.listByIdsForOrganization(db, {
        organizationId,
        ids: locationIds,
      }),
    ]);

    const skuIdsInOrganization = new Set(skus.map((sku) => sku.id));
    const locationIdsInOrganization = new Set(locations.map((location) => location.id));

    for (const line of lines) {
      if (!skuIdsInOrganization.has(line.skuId)) {
        throw new NotFoundError(`SKU ${line.skuId} was not found in the active organization.`);
      }

      if (line.expectedLocationId && !locationIdsInOrganization.has(line.expectedLocationId)) {
        throw new NotFoundError(`Location ${line.expectedLocationId} was not found in the active organization.`);
      }
    }
  }

  private async validateReceiptLines(
    db: DbClient,
    organizationId: string,
    purchaseOrder: PurchaseOrderWithLines,
    receiptRequests: Map<string, { quantityReceived: number; locationId?: string }>,
  ): Promise<Array<{ line: PurchaseOrderLine; requestedQuantityReceived: number; deltaQuantity: number; locationId: string | null }>> {
    const linesById = new Map(purchaseOrder.lines.map((line) => [line.id, line]));
    const resolvedLocationIds = new Set<string>();
    const validatedLines: Array<{
      line: PurchaseOrderLine;
      requestedQuantityReceived: number;
      deltaQuantity: number;
      locationId: string | null;
    }> = [];

    for (const [lineId, request] of receiptRequests.entries()) {
      const line = linesById.get(lineId);
      if (!line) {
        throw new NotFoundError(`Purchase order line ${lineId} was not found on this PO.`);
      }

      if (request.quantityReceived < line.quantityReceived) {
        throw new ConflictError("Receipt quantities cannot reduce previously received quantities.");
      }

      if (request.quantityReceived > line.quantityOrdered) {
        throw new ConflictError("Receipt quantities cannot exceed ordered quantities.");
      }

      if (line.expectedLocationId && request.locationId && line.expectedLocationId !== request.locationId) {
        throw new ConflictError("Receipt location must match the expected location for the PO line.");
      }

      const locationId = line.expectedLocationId ?? request.locationId ?? null;
      if (request.quantityReceived > line.quantityReceived && locationId === null) {
        throw new ConflictError("Receipt location is required when the PO line has no expected location.");
      }

      if (locationId) {
        resolvedLocationIds.add(locationId);
      }

      validatedLines.push({
        line,
        requestedQuantityReceived: request.quantityReceived,
        deltaQuantity: request.quantityReceived - line.quantityReceived,
        locationId,
      });
    }

    if (resolvedLocationIds.size > 0) {
      const locations = await this.locationRepository.listByIdsForOrganization(db, {
        organizationId,
        ids: [...resolvedLocationIds],
      });
      const locationById = new Map<string, Location>(locations.map((location) => [location.id, location]));

      for (const validatedLine of validatedLines) {
        if (!validatedLine.locationId) {
          continue;
        }

        const location = locationById.get(validatedLine.locationId);
        if (!location) {
          throw new NotFoundError(`Location ${validatedLine.locationId} was not found in the active organization.`);
        }
      }
    }

    return validatedLines;
  }

  private async requirePurchaseOrder(
    db: DbClient,
    organizationId: string,
    purchaseOrderId: string,
  ): Promise<PurchaseOrderWithLines> {
    const purchaseOrder = await this.purchaseOrderRepository.findByIdForOrganization(db, {
      organizationId,
      id: purchaseOrderId,
    });
    if (!purchaseOrder) {
      throw new NotFoundError("Purchase order was not found.");
    }

    return purchaseOrder;
  }

  private async requireSupplier(db: DbClient, organizationId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findByIdForOrganization(db, {
      organizationId,
      id: supplierId,
    });
    if (!supplier) {
      throw new NotFoundError("Supplier was not found.");
    }

    return supplier;
  }

  private async requireActiveSupplier(db: DbClient, organizationId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.requireSupplier(db, organizationId, supplierId);
    if (supplier.status !== SupplierStatus.active) {
      throw new ForbiddenError("Purchase orders require an active supplier.");
    }

    return supplier;
  }
}
