import { Prisma, type SupplierSku } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { toSupplierSkuDto } from "./supply.mappers.js";
import type {
  CreateSupplierSkuInput,
  SupplierSkuDto,
  UpdateSupplierSkuInput,
} from "./supply.schemas.js";
import { SupplierRepository } from "./supplier.repository.js";
import { SupplierSkuRepository } from "./supplier-sku.repository.js";

export class SupplierSkuService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly supplierRepository: SupplierRepository,
    private readonly skuRepository: SkuRepository,
    private readonly supplierSkuRepository: SupplierSkuRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createMapping(context: RequestContext, input: CreateSupplierSkuInput): Promise<SupplierSkuDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

        await this.requireSupplier(db, organizationId, input.supplierId);
        await this.requireSku(db, organizationId, input.skuId);

        const mapping = await this.supplierSkuRepository.create(db, {
          organizationId,
          supplierId: input.supplierId,
          skuId: input.skuId,
          ...(input.supplierSkuCode !== undefined ? { supplierSkuCode: input.supplierSkuCode } : {}),
          isPrimary: input.isPrimary,
          minOrderQty: input.minOrderQty,
          ...(input.casePackQty !== undefined ? { casePackQty: input.casePackQty } : {}),
          ...(input.unitCost !== undefined ? { unitCost: new Prisma.Decimal(input.unitCost) } : {}),
          ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
        });

        if (mapping.isPrimary) {
          await this.supplierSkuRepository.clearPrimaryForSku(db, {
            organizationId,
            skuId: mapping.skuId,
            exceptId: mapping.id,
          });
        }

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "supply.supplier_sku.mapped",
          entityType: "SupplierSku",
          entityId: mapping.id,
          payload: {
            supplierId: mapping.supplierId,
            skuId: mapping.skuId,
            isPrimary: mapping.isPrimary,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "supply.supplier_sku.mapped.v1",
          aggregateType: "SupplierSku",
          aggregateId: mapping.id,
          payload: {
            organizationId,
            supplierSkuId: mapping.id,
            supplierId: mapping.supplierId,
            skuId: mapping.skuId,
            isPrimary: mapping.isPrimary,
          },
        });

        const persistedMapping = await this.requireSupplierSku(db, organizationId, mapping.id);
        return toSupplierSkuDto(persistedMapping);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Supplier SKU mapping already exists in this organization.");
      }

      throw error;
    }
  }

  public async updateMapping(
    context: RequestContext,
    supplierSkuId: string,
    input: UpdateSupplierSkuInput,
  ): Promise<SupplierSkuDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

      const existingMapping = await this.requireSupplierSku(db, organizationId, supplierSkuId);

      const updatedMapping = await this.supplierSkuRepository.updateForOrganization(db, {
        organizationId,
        id: supplierSkuId,
        data: {
          ...(input.supplierSkuCode !== undefined ? { supplierSkuCode: input.supplierSkuCode } : {}),
          ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
          ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
          ...(input.casePackQty !== undefined ? { casePackQty: input.casePackQty } : {}),
          ...(input.unitCost !== undefined ? { unitCost: new Prisma.Decimal(input.unitCost) } : {}),
          ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
        },
      });

      if (updatedMapping.isPrimary) {
        await this.supplierSkuRepository.clearPrimaryForSku(db, {
          organizationId,
          skuId: updatedMapping.skuId,
          exceptId: updatedMapping.id,
        });
      }

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "supply.supplier_sku.updated",
        entityType: "SupplierSku",
        entityId: updatedMapping.id,
        payload: {
          supplierId: existingMapping.supplierId,
          skuId: existingMapping.skuId,
          changes: {
            ...(input.supplierSkuCode !== undefined ? { supplierSkuCode: input.supplierSkuCode } : {}),
            ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
            ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
            ...(input.casePackQty !== undefined ? { casePackQty: input.casePackQty } : {}),
            ...(input.unitCost !== undefined ? { unitCost: input.unitCost } : {}),
            ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
          },
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "supply.supplier_sku.updated.v1",
        aggregateType: "SupplierSku",
        aggregateId: updatedMapping.id,
        payload: {
          organizationId,
          supplierSkuId: updatedMapping.id,
          supplierId: updatedMapping.supplierId,
          skuId: updatedMapping.skuId,
          isPrimary: updatedMapping.isPrimary,
        },
      });

      return toSupplierSkuDto(updatedMapping);
    });
  }

  public async listMappings(
    context: RequestContext,
    filters: { supplierId?: string; skuId?: string; isPrimary?: boolean },
  ): Promise<SupplierSkuDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    if (filters.supplierId) {
      await this.requireSupplier(this.db, organizationId, filters.supplierId);
    }

    if (filters.skuId) {
      await this.requireSku(this.db, organizationId, filters.skuId);
    }

    const mappings = await this.supplierSkuRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.isPrimary !== undefined ? { isPrimary: filters.isPrimary } : {}),
    });

    return mappings.map(toSupplierSkuDto);
  }

  public async getMapping(context: RequestContext, supplierSkuId: string): Promise<SupplierSkuDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    const mapping = await this.requireSupplierSku(this.db, organizationId, supplierSkuId);
    return toSupplierSkuDto(mapping);
  }

  private async requireSupplier(db: DbClient, organizationId: string, supplierId: string): Promise<void> {
    const supplier = await this.supplierRepository.findByIdForOrganization(db, {
      organizationId,
      id: supplierId,
    });
    if (!supplier) {
      throw new NotFoundError("Supplier was not found.");
    }
  }

  private async requireSku(db: DbClient, organizationId: string, skuId: string): Promise<void> {
    const sku = await this.skuRepository.findByIdForOrganization(db, {
      organizationId,
      id: skuId,
    });
    if (!sku) {
      throw new NotFoundError("SKU was not found.");
    }
  }

  private async requireSupplierSku(
    db: DbClient,
    organizationId: string,
    supplierSkuId: string,
  ): Promise<SupplierSku> {
    const supplierSku = await this.supplierSkuRepository.findByIdForOrganization(db, {
      organizationId,
      id: supplierSkuId,
    });
    if (!supplierSku) {
      throw new NotFoundError("Supplier SKU mapping was not found.");
    }

    return supplierSku;
  }
}
