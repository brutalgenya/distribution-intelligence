import { Prisma, type IntegrationConnection } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { integrationAuditEventTypes, integrationOutboxEventTypes } from "./integration.constants.js";
import { IntegrationConnectionRepository } from "./integration-connection.repository.js";
import type {
  CreateIntegrationConnectionInput,
  IntegrationConnectionDto,
  UpdateIntegrationConnectionInput,
} from "./integration.schemas.js";
import { validateConnectionConfig } from "./integration.schemas.js";

const toIntegrationConnectionDto = (connection: IntegrationConnection): IntegrationConnectionDto => ({
  id: connection.id,
  organizationId: connection.organizationId,
  integrationType: connection.integrationType,
  name: connection.name,
  status: connection.status,
  configJson: connection.configJson,
  credentialsRef: connection.credentialsRef,
  lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
  createdAt: connection.createdAt.toISOString(),
  updatedAt: connection.updatedAt.toISOString(),
});

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export class IntegrationConnectionService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly integrationConnectionRepository: IntegrationConnectionRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createConnection(
    context: RequestContext,
    input: CreateIntegrationConnectionInput,
  ): Promise<IntegrationConnectionDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "integrations.write");

      const connection = await this.integrationConnectionRepository.create(db, {
        organizationId,
        integrationType: input.integrationType,
        name: input.name,
        status: input.status,
        configJson: toJsonValue(input.configJson),
        ...(input.credentialsRef ? { credentialsRef: input.credentialsRef } : {}),
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: integrationAuditEventTypes.connectionCreated,
        entityType: "IntegrationConnection",
        entityId: connection.id,
        payload: {
          integrationType: connection.integrationType,
          name: connection.name,
          status: connection.status,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: integrationOutboxEventTypes.connectionCreated,
        aggregateType: "IntegrationConnection",
        aggregateId: connection.id,
        payload: {
          organizationId,
          integrationConnectionId: connection.id,
          integrationType: connection.integrationType,
          status: connection.status,
        },
      });

      return toIntegrationConnectionDto(connection);
    });
  }

  public async updateConnection(
    context: RequestContext,
    connectionId: string,
    input: UpdateIntegrationConnectionInput,
  ): Promise<IntegrationConnectionDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "integrations.write");

      const existingConnection = await this.integrationConnectionRepository.findByIdForOrganization(db, {
        organizationId,
        id: connectionId,
      });
      if (!existingConnection) {
        throw new NotFoundError("Integration connection was not found.");
      }

      const updateData: Prisma.IntegrationConnectionUncheckedUpdateInput = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.configJson !== undefined
          ? { configJson: toJsonValue(validateConnectionConfig(existingConnection.integrationType, input.configJson)) }
          : {}),
        ...(input.credentialsRef !== undefined
          ? input.credentialsRef === null
            ? { credentialsRef: null }
            : { credentialsRef: input.credentialsRef }
          : {}),
      };

      const updatedConnection = await this.integrationConnectionRepository.updateById(db, {
        id: existingConnection.id,
        data: updateData,
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: integrationAuditEventTypes.connectionUpdated,
        entityType: "IntegrationConnection",
        entityId: updatedConnection.id,
        payload: {
          changes: toJsonValue({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.configJson !== undefined ? { configJson: input.configJson } : {}),
            ...(input.credentialsRef !== undefined ? { credentialsRefUpdated: true } : {}),
          }),
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: integrationOutboxEventTypes.connectionUpdated,
        aggregateType: "IntegrationConnection",
        aggregateId: updatedConnection.id,
        payload: {
          organizationId,
          integrationConnectionId: updatedConnection.id,
          changes: toJsonValue({
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.status !== undefined ? { status: input.status } : {}),
            ...(input.configJson !== undefined ? { configJson: input.configJson } : {}),
            ...(input.credentialsRef !== undefined ? { credentialsRefUpdated: true } : {}),
          }),
        },
      });

      return toIntegrationConnectionDto(updatedConnection);
    });
  }

  public async listConnections(
    context: RequestContext,
    filters: { integrationType?: IntegrationConnection["integrationType"]; status?: IntegrationConnection["status"] },
  ): Promise<IntegrationConnectionDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const connections = await this.integrationConnectionRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.integrationType ? { integrationType: filters.integrationType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });

    return connections.map(toIntegrationConnectionDto);
  }

  public async getConnection(context: RequestContext, connectionId: string): Promise<IntegrationConnectionDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "integrations.read");

    const connection = await this.integrationConnectionRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: connectionId,
    });
    if (!connection) {
      throw new NotFoundError("Integration connection was not found.");
    }

    return toIntegrationConnectionDto(connection);
  }
}
