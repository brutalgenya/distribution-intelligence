import { Prisma, UsageMeterType, type Sku } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import type { CreateSkuInput, SkuDto, UpdateSkuInput } from "./catalog.schemas.js";
import { SkuRepository } from "./sku.repository.js";

const toSkuDto = (sku: Sku): SkuDto => ({
  id: sku.id,
  organizationId: sku.organizationId,
  skuCode: sku.skuCode,
  name: sku.name,
  description: sku.description,
  baseUom: sku.baseUom,
  packSize: sku.packSize,
  status: sku.status,
  metadata: sku.metadata,
  createdAt: sku.createdAt.toISOString(),
  updatedAt: sku.updatedAt.toISOString(),
});

export class CatalogService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createSku(context: RequestContext, input: CreateSkuInput): Promise<SkuDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "catalog.write");
        await this.billingEntitlementService.ensureNewSkuAllowedInTransaction(db, {
          organizationId,
        });

        const createData: Prisma.SkuUncheckedCreateInput = {
          organizationId,
          skuCode: input.skuCode,
          name: input.name,
          ...(input.description !== undefined ? { description: input.description } : {}),
          baseUom: input.baseUom,
          packSize: input.packSize,
          status: input.status,
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        };

        const sku = await this.skuRepository.create(db, createData);
        await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
          organizationId,
          actorUserId: context.user.id,
          correlationId: context.correlationId,
          meterTypes: [UsageMeterType.skus],
          sourceType: "sku_created",
          sourceReference: sku.id,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "catalog.sku.created",
          entityType: "Sku",
          entityId: sku.id,
          payload: {
            skuCode: sku.skuCode,
            name: sku.name,
            baseUom: sku.baseUom,
            packSize: sku.packSize,
            status: sku.status,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "catalog.sku.created.v1",
          aggregateType: "Sku",
          aggregateId: sku.id,
          payload: {
            organizationId,
            skuId: sku.id,
            skuCode: sku.skuCode,
            status: sku.status,
          },
        });

        return toSkuDto(sku);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("SKU code already exists in this organization.");
      }

      throw error;
    }
  }

  public async updateSku(context: RequestContext, skuId: string, input: UpdateSkuInput): Promise<SkuDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "catalog.write");

        const existingSku = await this.skuRepository.findByIdForOrganization(db, {
          organizationId,
          id: skuId,
        });
        if (!existingSku) {
          throw new NotFoundError("SKU was not found.");
        }

        const changePayload = {
          ...(input.skuCode !== undefined ? { skuCode: input.skuCode } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.baseUom !== undefined ? { baseUom: input.baseUom } : {}),
          ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        } satisfies Prisma.InputJsonObject;

        const updateData: Prisma.SkuUncheckedUpdateInput = {
          ...(input.skuCode !== undefined ? { skuCode: input.skuCode } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.baseUom !== undefined ? { baseUom: input.baseUom } : {}),
          ...(input.packSize !== undefined ? { packSize: input.packSize } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        };

        const updatedSku = await this.skuRepository.updateForOrganization(db, {
          organizationId,
          id: skuId,
          data: updateData,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "catalog.sku.updated",
          entityType: "Sku",
          entityId: updatedSku.id,
          payload: {
            changes: changePayload,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "catalog.sku.updated.v1",
          aggregateType: "Sku",
          aggregateId: updatedSku.id,
          payload: {
            organizationId,
            skuId: updatedSku.id,
            changes: changePayload,
          },
        });

        return toSkuDto(updatedSku);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("SKU code already exists in this organization.");
      }

      throw error;
    }
  }

  public async listSkus(
    context: RequestContext,
    filters: {
      status?: Sku["status"];
    },
  ): Promise<SkuDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "catalog.read");

    const skus = await this.skuRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return skus.map(toSkuDto);
  }

  public async getSku(context: RequestContext, skuId: string): Promise<SkuDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "catalog.read");

    const sku = await this.skuRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: skuId,
    });
    if (!sku) {
      throw new NotFoundError("SKU was not found.");
    }

    return toSkuDto(sku);
  }
}
