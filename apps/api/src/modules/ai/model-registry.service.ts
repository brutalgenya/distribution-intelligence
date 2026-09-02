import { ModelRegistryStatus, Prisma, type AiModelType, type ModelRegistryEntry } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { aiAuditEventTypes, aiOutboxEventTypes } from "./ai.constants.js";
import { toModelRegistryEntryDto } from "./ai.mappers.js";
import type {
  CreateModelRegistryEntryInput,
  ModelRegistryEntryDto,
  UpdateModelRegistryEntryInput,
} from "./ai.schemas.js";
import { ModelRegistryRepository } from "./model-registry.repository.js";

export class ModelRegistryService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly modelRegistryRepository: ModelRegistryRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createModelEntry(
    context: RequestContext,
    input: CreateModelRegistryEntryInput,
  ): Promise<ModelRegistryEntryDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "ai.write");

        if (input.status === ModelRegistryStatus.active) {
          await this.modelRegistryRepository.deactivateActiveByType(db, {
            modelType: input.modelType,
          });
        }

        const entry = await this.modelRegistryRepository.create(db, {
          provider: input.provider,
          modelName: input.modelName,
          modelVersion: input.modelVersion,
          modelType: input.modelType,
          ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
          schemaVersion: input.schemaVersion,
          status: input.status,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: aiAuditEventTypes.modelRegistered,
          entityType: "ModelRegistryEntry",
          entityId: entry.id,
          payload: {
            provider: entry.provider,
            modelName: entry.modelName,
            modelVersion: entry.modelVersion,
            modelType: entry.modelType,
            status: entry.status,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: aiOutboxEventTypes.modelRegistered,
          aggregateType: "ModelRegistryEntry",
          aggregateId: entry.id,
          payload: {
            modelRegistryEntryId: entry.id,
            provider: entry.provider,
            modelName: entry.modelName,
            modelVersion: entry.modelVersion,
            modelType: entry.modelType,
            status: entry.status,
          },
        });

        return toModelRegistryEntryDto(entry);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("That model registry entry already exists.");
      }

      throw error;
    }
  }

  public async updateModelEntry(
    context: RequestContext,
    modelRegistryEntryId: string,
    input: UpdateModelRegistryEntryInput,
  ): Promise<ModelRegistryEntryDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "ai.write");

      const existingEntry = await this.requireModelEntry(db, modelRegistryEntryId);
      const nextModelType = input.modelType ?? existingEntry.modelType;
      const nextStatus = input.status ?? existingEntry.status;

      if (nextStatus === ModelRegistryStatus.active) {
        await this.modelRegistryRepository.deactivateActiveByType(db, {
          modelType: nextModelType,
          excludeId: existingEntry.id,
        });
      }

      const updatedEntry = await this.modelRegistryRepository.updateById(db, {
        id: existingEntry.id,
        data: {
          ...(input.provider !== undefined ? { provider: input.provider } : {}),
          ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
          ...(input.modelVersion !== undefined ? { modelVersion: input.modelVersion } : {}),
          ...(input.promptVersion !== undefined ? { promptVersion: input.promptVersion } : {}),
          ...(input.schemaVersion !== undefined ? { schemaVersion: input.schemaVersion } : {}),
          ...(input.modelType !== undefined ? { modelType: input.modelType } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: aiAuditEventTypes.modelUpdated,
        entityType: "ModelRegistryEntry",
        entityId: updatedEntry.id,
        payload: {
          changes: {
            ...(input.provider !== undefined ? { provider: input.provider } : {}),
            ...(input.modelName !== undefined ? { modelName: input.modelName } : {}),
            ...(input.modelVersion !== undefined ? { modelVersion: input.modelVersion } : {}),
            ...(input.promptVersion !== undefined ? { promptVersion: input.promptVersion } : {}),
            ...(input.schemaVersion !== undefined ? { schemaVersion: input.schemaVersion } : {}),
            ...(input.modelType !== undefined ? { modelType: input.modelType } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
          },
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: aiOutboxEventTypes.modelUpdated,
        aggregateType: "ModelRegistryEntry",
        aggregateId: updatedEntry.id,
        payload: {
          modelRegistryEntryId: updatedEntry.id,
          provider: updatedEntry.provider,
          modelName: updatedEntry.modelName,
          modelVersion: updatedEntry.modelVersion,
          modelType: updatedEntry.modelType,
          status: updatedEntry.status,
        },
      });

      return toModelRegistryEntryDto(updatedEntry);
    });
  }

  public async listModelEntries(
    context: RequestContext,
    filters: { modelType?: AiModelType; status?: ModelRegistryStatus },
  ): Promise<ModelRegistryEntryDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const entries = await this.modelRegistryRepository.list(this.db, filters);
    return entries.map(toModelRegistryEntryDto);
  }

  public async getModelEntry(context: RequestContext, modelRegistryEntryId: string): Promise<ModelRegistryEntryDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const entry = await this.requireModelEntry(this.db, modelRegistryEntryId);
    return toModelRegistryEntryDto(entry);
  }

  public findActiveModelEntry(db: DbClient, modelType: AiModelType): Promise<ModelRegistryEntry | null> {
    return this.modelRegistryRepository.findActiveByType(db, modelType);
  }

  private async requireModelEntry(db: DbClient, modelRegistryEntryId: string): Promise<ModelRegistryEntry> {
    const entry = await this.modelRegistryRepository.findById(db, modelRegistryEntryId);
    if (!entry) {
      throw new NotFoundError("Model registry entry was not found.");
    }

    return entry;
  }
}
