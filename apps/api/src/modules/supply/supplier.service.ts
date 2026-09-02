import { Prisma, type Supplier } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { toSupplierDto } from "./supply.mappers.js";
import type { CreateSupplierInput, SupplierDto, UpdateSupplierInput } from "./supply.schemas.js";
import { SupplierRepository } from "./supplier.repository.js";

export class SupplierService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly supplierRepository: SupplierRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createSupplier(context: RequestContext, input: CreateSupplierInput): Promise<SupplierDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

        const supplier = await this.supplierRepository.create(db, {
          organizationId,
          code: input.code,
          name: input.name,
          status: input.status,
          ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
          ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "supply.supplier.created",
          entityType: "Supplier",
          entityId: supplier.id,
          payload: {
            code: supplier.code,
            name: supplier.name,
            status: supplier.status,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "supply.supplier.created.v1",
          aggregateType: "Supplier",
          aggregateId: supplier.id,
          payload: {
            organizationId,
            supplierId: supplier.id,
            code: supplier.code,
            status: supplier.status,
          },
        });

        return toSupplierDto(supplier);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Supplier code already exists in this organization.");
      }

      throw error;
    }
  }

  public async updateSupplier(
    context: RequestContext,
    supplierId: string,
    input: UpdateSupplierInput,
  ): Promise<SupplierDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "supply.write");

        await this.requireSupplier(db, organizationId, supplierId);

        const updatedSupplier = await this.supplierRepository.updateForOrganization(db, {
          organizationId,
          id: supplierId,
          data: {
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
            ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          },
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "supply.supplier.updated",
          entityType: "Supplier",
          entityId: updatedSupplier.id,
          payload: {
            changes: {
              ...(input.code !== undefined ? { code: input.code } : {}),
              ...(input.name !== undefined ? { name: input.name } : {}),
              ...(input.status !== undefined ? { status: input.status } : {}),
              ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
              ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone } : {}),
              ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
            },
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "supply.supplier.updated.v1",
          aggregateType: "Supplier",
          aggregateId: updatedSupplier.id,
          payload: {
            organizationId,
            supplierId: updatedSupplier.id,
          },
        });

        return toSupplierDto(updatedSupplier);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Supplier code already exists in this organization.");
      }

      throw error;
    }
  }

  public async listSuppliers(
    context: RequestContext,
    filters: { status?: Supplier["status"] },
  ): Promise<SupplierDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    const suppliers = await this.supplierRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return suppliers.map(toSupplierDto);
  }

  public async getSupplier(context: RequestContext, supplierId: string): Promise<SupplierDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "supply.read");

    const supplier = await this.requireSupplier(this.db, organizationId, supplierId);
    return toSupplierDto(supplier);
  }

  public async requireSupplier(db: DbClient, organizationId: string, supplierId: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findByIdForOrganization(db, {
      organizationId,
      id: supplierId,
    });
    if (!supplier) {
      throw new NotFoundError("Supplier was not found.");
    }

    return supplier;
  }
}
