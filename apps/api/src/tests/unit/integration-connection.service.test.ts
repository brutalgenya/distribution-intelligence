import { IntegrationConnectionStatus, IntegrationType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { IntegrationConnectionRepository } from "../../modules/integrations/integration-connection.repository.js";
import { IntegrationConnectionService } from "../../modules/integrations/integration-connection.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "69387e0d-0e6e-4927-b85b-f0c13f877db2",
  activeOrganizationId: "organization-id",
  user: {
    id: "user-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("IntegrationConnectionService", () => {
  it("creates an integration connection with audit and outbox events", async () => {
    const transactionRunner: TransactionRunner = {
      run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
        operation({} as Prisma.TransactionClient),
      ) as TransactionRunner["run"],
    };

    const integrationConnectionRepository = {
      create: vi.fn().mockResolvedValue({
        id: "connection-id",
        organizationId: "organization-id",
        integrationType: IntegrationType.manual_bridge,
        name: "Manual Bridge",
        status: IntegrationConnectionStatus.active,
        configJson: { sourceLabel: "ops" },
        credentialsRef: null,
        lastSyncAt: null,
        createdAt: new Date("2026-03-28T08:00:00.000Z"),
        updatedAt: new Date("2026-03-28T08:00:00.000Z"),
      }),
    } as unknown as IntegrationConnectionRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;
    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;
    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new IntegrationConnectionService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      integrationConnectionRepository,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createConnection(requestContext, {
      integrationType: IntegrationType.manual_bridge,
      name: "Manual Bridge",
      status: IntegrationConnectionStatus.active,
      configJson: { sourceLabel: "ops" },
    });

    expect(result.id).toBe("connection-id");
    expect(vi.mocked(integrationConnectionRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
