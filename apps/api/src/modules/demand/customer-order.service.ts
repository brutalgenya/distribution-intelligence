import { Prisma, type CustomerOrderLine, type Location, type Sku } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import type {
  CreateCustomerOrderInput,
  CustomerOrderDto,
  CustomerOrderLineDto,
} from "./demand.schemas.js";
import { CustomerOrderLineRepository } from "./customer-order-line.repository.js";
import {
  CustomerOrderRepository,
  type CustomerOrderWithLines,
} from "./customer-order.repository.js";
import { DemandSignalService } from "./demand-signal.service.js";

const toCustomerOrderLineDto = (line: CustomerOrderLine): CustomerOrderLineDto => ({
  id: line.id,
  skuId: line.skuId,
  locationId: line.locationId,
  quantity: line.quantity,
  unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
  createdAt: line.createdAt.toISOString(),
});

const toCustomerOrderDto = (order: CustomerOrderWithLines): CustomerOrderDto => ({
  id: order.id,
  organizationId: order.organizationId,
  orderNumber: order.orderNumber,
  status: order.status,
  customerReference: order.customerReference,
  orderedAt: order.orderedAt.toISOString(),
  createdByUserId: order.createdByUserId,
  cancelledAt: order.cancelledAt?.toISOString() ?? null,
  cancelledByUserId: order.cancelledByUserId,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  lines: order.lines.map(toCustomerOrderLineDto),
});

export class CustomerOrderService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly customerOrderRepository: CustomerOrderRepository,
    private readonly customerOrderLineRepository: CustomerOrderLineRepository,
    private readonly demandSignalService: DemandSignalService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createOrder(context: RequestContext, input: CreateCustomerOrderInput): Promise<CustomerOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "demand.write");
        await this.validateOrderReferences(db, organizationId, input);

        const order = await this.customerOrderRepository.create(db, {
          organizationId,
          orderNumber: input.orderNumber,
          ...(input.customerReference ? { customerReference: input.customerReference } : {}),
          orderedAt: new Date(input.orderedAt),
          createdByUserId: context.user.id,
        });

        await this.customerOrderLineRepository.createMany(
          db,
          input.lines.map((line) => ({
            orderId: order.id,
            skuId: line.skuId,
            locationId: line.locationId,
            quantity: line.quantity,
            ...(line.unitPrice !== undefined ? { unitPrice: new Prisma.Decimal(line.unitPrice) } : {}),
          })),
        );

        const persistedOrder = await this.customerOrderRepository.findByIdForOrganization(db, {
          organizationId,
          id: order.id,
        });
        if (!persistedOrder) {
          throw new NotFoundError("Customer order was not found after creation.");
        }

        await this.demandSignalService.appendSignals(
          db,
          persistedOrder.lines.map((line) => ({
            organizationId,
            skuId: line.skuId,
            locationId: line.locationId,
            signalType: "customer_order",
            quantity: line.quantity,
            observedAt: persistedOrder.orderedAt,
            sourceType: "customer_order",
            sourceReference: persistedOrder.id,
            metadata: {
              orderNumber: persistedOrder.orderNumber,
              orderLineId: line.id,
            } satisfies Prisma.InputJsonObject,
          })),
        );

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "demand.order.created",
          entityType: "CustomerOrder",
          entityId: persistedOrder.id,
          payload: {
            orderNumber: persistedOrder.orderNumber,
            lineCount: persistedOrder.lines.length,
            orderedAt: persistedOrder.orderedAt.toISOString(),
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "demand.order.created.v1",
          aggregateType: "CustomerOrder",
          aggregateId: persistedOrder.id,
          payload: {
            organizationId,
            customerOrderId: persistedOrder.id,
            orderNumber: persistedOrder.orderNumber,
            lineCount: persistedOrder.lines.length,
            status: persistedOrder.status,
          },
        });

        return toCustomerOrderDto(persistedOrder);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Order number already exists in this organization.");
      }

      throw error;
    }
  }

  public async cancelOrder(context: RequestContext, orderId: string): Promise<CustomerOrderDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "demand.write");

      const order = await this.customerOrderRepository.findByIdForOrganization(db, {
        organizationId,
        id: orderId,
      });
      if (!order) {
        throw new NotFoundError("Customer order was not found.");
      }

      if (order.status === "cancelled") {
        return toCustomerOrderDto(order);
      }

      const cancelledOrder = await this.customerOrderRepository.markCancelled(db, {
        id: order.id,
        cancelledAt: new Date(),
        cancelledByUserId: context.user.id,
      });

      await this.demandSignalService.appendSignals(
        db,
        cancelledOrder.lines.map((line) => ({
          organizationId,
          skuId: line.skuId,
          locationId: line.locationId,
          signalType: "customer_order_cancellation",
          quantity: -line.quantity,
          observedAt: cancelledOrder.cancelledAt ?? new Date(),
          sourceType: "customer_order_cancellation",
          sourceReference: cancelledOrder.id,
          metadata: {
            orderNumber: cancelledOrder.orderNumber,
            orderLineId: line.id,
          } satisfies Prisma.InputJsonObject,
        })),
      );

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "demand.order.cancelled",
        entityType: "CustomerOrder",
        entityId: cancelledOrder.id,
        payload: {
          orderNumber: cancelledOrder.orderNumber,
          lineCount: cancelledOrder.lines.length,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "demand.order.cancelled.v1",
        aggregateType: "CustomerOrder",
        aggregateId: cancelledOrder.id,
        payload: {
          organizationId,
          customerOrderId: cancelledOrder.id,
          orderNumber: cancelledOrder.orderNumber,
          status: cancelledOrder.status,
        },
      });

      return toCustomerOrderDto(cancelledOrder);
    });
  }

  public async listOrders(
    context: RequestContext,
    filters: { status?: CustomerOrderWithLines["status"] },
  ): Promise<CustomerOrderDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "demand.read");

    const orders = await this.customerOrderRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return orders.map(toCustomerOrderDto);
  }

  public async getOrder(context: RequestContext, orderId: string): Promise<CustomerOrderDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "demand.read");

    const order = await this.customerOrderRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: orderId,
    });
    if (!order) {
      throw new NotFoundError("Customer order was not found.");
    }

    return toCustomerOrderDto(order);
  }

  private async validateOrderReferences(
    db: DbClient,
    organizationId: string,
    input: CreateCustomerOrderInput,
  ): Promise<void> {
    const skuIds = [...new Set(input.lines.map((line) => line.skuId))];
    const locationIds = [...new Set(input.lines.map((line) => line.locationId))];

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

    const skuById = new Map<string, Sku>(skus.map((sku) => [sku.id, sku]));
    const locationById = new Map<string, Location>(locations.map((location) => [location.id, location]));

    for (const line of input.lines) {
      if (!skuById.has(line.skuId)) {
        throw new NotFoundError(`SKU ${line.skuId} was not found in the active organization.`);
      }

      if (!locationById.has(line.locationId)) {
        throw new NotFoundError(`Location ${line.locationId} was not found in the active organization.`);
      }
    }
  }
}
