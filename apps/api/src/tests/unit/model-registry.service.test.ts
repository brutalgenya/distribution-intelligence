import { AiModelType, ModelRegistryStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import { ModelRegistryService } from "../../modules/ai/model-registry.service.js";
import type { ModelRegistryRepository } from "../../modules/ai/model-registry.repository.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "d6e57dde-4b06-4cc3-92ff-4325e45025d8",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

const transactionRunner: TransactionRunner = {
  run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
    operation({} as Prisma.TransactionClient),
  ) as TransactionRunner["run"],
};

describe("ModelRegistryService", () => {
  it("deactivates the prior active model before creating a new active entry", async () => {
    const modelRegistryRepository = {
      deactivateActiveByType: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({
        id: "model-id",
        provider: "mock",
        modelName: "mock-forecast-enhancer",
        modelVersion: "v1",
        modelType: AiModelType.forecast_enhancement,
        promptVersion: "p1",
        schemaVersion: "2026-03-28",
        status: ModelRegistryStatus.active,
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as ModelRegistryRepository;

    const service = new ModelRegistryService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      modelRegistryRepository,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as OutboxEventRepository,
    );

    const result = await service.createModelEntry(requestContext, {
      provider: "mock",
      modelName: "mock-forecast-enhancer",
      modelVersion: "v1",
      modelType: AiModelType.forecast_enhancement,
      promptVersion: "p1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    });

    expect(result.status).toBe(ModelRegistryStatus.active);
    expect(vi.mocked(modelRegistryRepository.deactivateActiveByType)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        modelType: AiModelType.forecast_enhancement,
      }),
    );
  });
});
