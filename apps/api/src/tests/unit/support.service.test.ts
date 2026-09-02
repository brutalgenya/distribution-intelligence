import { ForecastJobStatus, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../infrastructure/logging/app-logger.js";
import type { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { ExecutionTaskService } from "../../modules/execution/execution-task.service.js";
import type { ForecastJobRepository } from "../../modules/forecasting/forecast-job.repository.js";
import type { OutcomesProcessingService } from "../../modules/outcomes/outcomes-processing.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import type { WorkerRunRepository } from "../../modules/observability/worker-run.repository.js";
import type { SupportRepository } from "../../modules/support/support.repository.js";
import { SupportService } from "../../modules/support/support.service.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "corr-id",
  activeOrganizationId: "organization-id",
  user: {
    id: "owner-id",
    email: "owner@example.com",
    displayName: "Owner",
  },
};

describe("SupportService", () => {
  it("requeues a failed forecast job and records support telemetry", async () => {
    const forecastJobRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "forecast-job-id",
        organizationId: "organization-id",
        status: ForecastJobStatus.failed,
      }),
      updateById: vi.fn().mockResolvedValue({
        id: "forecast-job-id",
        organizationId: "organization-id",
        status: ForecastJobStatus.pending,
      }),
    } as unknown as ForecastJobRepository;

    const service = new SupportService(
      {} as Prisma.TransactionClient,
      {
        run: vi.fn(async (operation: (db: Prisma.TransactionClient) => Promise<unknown>) =>
          operation({} as Prisma.TransactionClient),
        ),
      } as unknown as TransactionRunner,
      {} as SupportRepository,
      forecastJobRepository,
      {} as WorkerRunRepository,
      {} as ExecutionTaskService,
      {} as OutcomesProcessingService,
      {
        requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuthorizationService,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as AuditEventRepository,
      {
        create: vi.fn().mockResolvedValue(undefined),
      } as unknown as OutboxEventRepository,
      {
        incrementCounter: vi.fn(),
      } as unknown as TelemetryService,
      {
        info: vi.fn(),
      } as unknown as AppLogger,
    );

    const job = await service.requeueForecastJob(requestContext, "forecast-job-id", {
      reason: "Retry failed job",
    });

    expect(job.status).toBe(ForecastJobStatus.pending);
    expect(vi.mocked(forecastJobRepository.updateById)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "forecast-job-id",
      }),
    );
  });
});
