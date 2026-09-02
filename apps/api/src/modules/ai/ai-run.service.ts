import { AiRunStatus, Prisma, UsageMeterType, type AiRunType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { aiAuditEventTypes, aiOutboxEventTypes } from "./ai.constants.js";
import { toAiRunDto } from "./ai.mappers.js";
import type { AiRunDto } from "./ai.schemas.js";
import { AiRunRepository, type AiRunWithModel } from "./ai-run.repository.js";

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export class AiRunService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly aiRunRepository: AiRunRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async listRuns(
    context: RequestContext,
    filters: { runType?: AiRunType; status?: AiRunStatus },
  ): Promise<AiRunDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const runs = await this.aiRunRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.runType ? { runType: filters.runType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });

    return runs.map(toAiRunDto);
  }

  public async getRun(context: RequestContext, aiRunId: string): Promise<AiRunDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "ai.read");

    const run = await this.requireRun(this.db, organizationId, aiRunId);
    return toAiRunDto(run);
  }

  public startRun(
    input: {
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      modelRegistryEntryId: string;
      runType: AiRunType;
      subjectType: string;
      subjectReference: string;
      inputChecksum: string;
      inputPayload: unknown;
    },
  ): Promise<AiRunWithModel> {
    return this.transactionRunner.run((db) => this.startRunInTransaction(db, input));
  }

  public async startRunInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      modelRegistryEntryId: string;
      runType: AiRunType;
      subjectType: string;
      subjectReference: string;
      inputChecksum: string;
      inputPayload: unknown;
    },
  ): Promise<AiRunWithModel> {
    await this.billingEntitlementService.ensureAiRunAllowedInTransaction(db, {
      organizationId: input.organizationId,
    });

    const run = await this.aiRunRepository.create(db, {
      organizationId: input.organizationId,
      modelRegistryEntryId: input.modelRegistryEntryId,
      runType: input.runType,
      status: AiRunStatus.pending,
      subjectType: input.subjectType,
      subjectReference: input.subjectReference,
      inputChecksum: input.inputChecksum,
      inputPayload: toJsonValue(input.inputPayload),
    });

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: aiAuditEventTypes.runStarted,
      entityType: "AiRun",
      entityId: run.id,
      payload: {
        runType: run.runType,
        status: run.status,
        subjectType: run.subjectType,
        subjectReference: run.subjectReference,
        modelRegistryEntryId: run.modelRegistryEntryId,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: aiOutboxEventTypes.runStarted,
      aggregateType: "AiRun",
      aggregateId: run.id,
      payload: {
        organizationId: input.organizationId,
        aiRunId: run.id,
        runType: run.runType,
        status: run.status,
        subjectType: run.subjectType,
        subjectReference: run.subjectReference,
        modelRegistryEntryId: run.modelRegistryEntryId,
      },
    });

    await this.billingEntitlementService.recordCurrentUsageInTransaction(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      meterTypes: [UsageMeterType.ai_runs],
      sourceType: "ai_run_started",
      sourceReference: run.id,
    });

    this.telemetryService.incrementCounter("ai.run.started", 1, {
      organizationId: input.organizationId,
      runType: input.runType,
    });
    this.logger.info(
      "AI run started.",
      { aiRunId: run.id, runType: run.runType, subjectType: run.subjectType, subjectReference: run.subjectReference },
      { module: "ai", operation: "startRun", organizationId: input.organizationId, aiRunId: run.id },
    );

    return run;
  }

  public markSucceededInTransaction(
    db: DbClient,
    input: {
      aiRunId: string;
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      outputPayload: unknown;
      latencyMs: number;
    },
  ): Promise<AiRunWithModel> {
    return this.completeRunInTransaction(db, {
      ...input,
      status: AiRunStatus.succeeded,
    });
  }

  public markFailedInTransaction(
    db: DbClient,
    input: {
      aiRunId: string;
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      errorMessage: string;
      latencyMs?: number;
    },
  ): Promise<AiRunWithModel> {
    return this.completeRunInTransaction(db, {
      ...input,
      status: AiRunStatus.failed,
    });
  }

  public markDegradedInTransaction(
    db: DbClient,
    input: {
      aiRunId: string;
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      errorMessage: string;
      latencyMs?: number;
    },
  ): Promise<AiRunWithModel> {
    return this.completeRunInTransaction(db, {
      ...input,
      status: AiRunStatus.degraded,
    });
  }

  private async completeRunInTransaction(
    db: DbClient,
    input:
      | {
          aiRunId: string;
          organizationId: string;
          actorUserId: string | null;
          correlationId: string;
          outputPayload: unknown;
          latencyMs: number;
          status: "succeeded";
        }
      | {
          aiRunId: string;
          organizationId: string;
          actorUserId: string | null;
          correlationId: string;
          errorMessage: string;
          latencyMs?: number;
          status: "failed" | "degraded";
        },
  ): Promise<AiRunWithModel> {
    const updateData =
      input.status === "succeeded"
        ? {
            status: input.status,
            outputPayload: toJsonValue(input.outputPayload),
            latencyMs: input.latencyMs,
            errorMessage: null,
            completedAt: new Date(),
          }
        : {
            status: input.status,
            errorMessage: input.errorMessage,
            ...(input.latencyMs !== undefined ? { latencyMs: input.latencyMs } : { latencyMs: null }),
            completedAt: new Date(),
          };

    const completedRun = await this.aiRunRepository.updateById(db, {
      id: input.aiRunId,
      data: updateData,
    });

    const eventType =
      input.status === "succeeded"
        ? aiAuditEventTypes.runSucceeded
        : input.status === "degraded"
          ? aiAuditEventTypes.runDegraded
          : aiAuditEventTypes.runFailed;
    const outboxEventType =
      input.status === "succeeded"
        ? aiOutboxEventTypes.runSucceeded
        : input.status === "degraded"
          ? aiOutboxEventTypes.runDegraded
          : aiOutboxEventTypes.runFailed;

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType,
      entityType: "AiRun",
      entityId: completedRun.id,
      payload: {
        runType: completedRun.runType,
        status: completedRun.status,
        errorMessage: completedRun.errorMessage,
        latencyMs: completedRun.latencyMs,
      },
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: outboxEventType,
      aggregateType: "AiRun",
      aggregateId: completedRun.id,
      payload: {
        organizationId: input.organizationId,
        aiRunId: completedRun.id,
        runType: completedRun.runType,
        status: completedRun.status,
        errorMessage: completedRun.errorMessage,
        latencyMs: completedRun.latencyMs,
      },
    });

    this.telemetryService.incrementCounter(`ai.run.${completedRun.status}`, 1, {
      organizationId: input.organizationId,
      runType: completedRun.runType,
    });
    if (completedRun.latencyMs !== null) {
      this.telemetryService.recordDuration("ai.run.duration_ms", completedRun.latencyMs, {
        organizationId: input.organizationId,
        runType: completedRun.runType,
        status: completedRun.status,
      });
    }
    this.logger.info(
      "AI run completed.",
      {
        aiRunId: completedRun.id,
        runType: completedRun.runType,
        status: completedRun.status,
        latencyMs: completedRun.latencyMs,
      },
      { module: "ai", operation: "completeRun", organizationId: input.organizationId, aiRunId: completedRun.id },
    );

    return completedRun;
  }

  private async requireRun(db: DbClient, organizationId: string, aiRunId: string): Promise<AiRunWithModel> {
    const run = await this.aiRunRepository.findByIdForOrganization(db, {
      organizationId,
      id: aiRunId,
    });
    if (!run) {
      throw new NotFoundError("AI run was not found.");
    }

    return run;
  }
}
