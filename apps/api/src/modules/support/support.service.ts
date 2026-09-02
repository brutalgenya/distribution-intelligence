import { ForecastJobStatus } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { ExecutionTaskService } from "../execution/execution-task.service.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { OutcomesProcessingService } from "../outcomes/outcomes-processing.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { WorkerRunRepository } from "../observability/worker-run.repository.js";
import { SupportRepository } from "./support.repository.js";
import type { SupportTimelineItemDto } from "./support.schemas.js";

export class SupportService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly supportRepository: SupportRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly executionTaskService: ExecutionTaskService,
    private readonly outcomesProcessingService: OutcomesProcessingService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async listDecisions(
    context: RequestContext,
    filters: { status?: string; from?: string; to?: string; limit: number },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.supportRepository.listDecisions(this.db, {
      organizationId,
      limit: filters.limit,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
      ...(filters.to ? { to: new Date(filters.to) } : {}),
    });
  }

  public async listExecutions(
    context: RequestContext,
    filters: {
      status?: "pending" | "running" | "succeeded" | "failed" | "dead_lettered" | "cancelled";
      decisionId?: string;
      from?: string;
      to?: string;
      limit: number;
    },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.supportRepository.listExecutionTasks(this.db, {
      organizationId,
      limit: filters.limit,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
      ...(filters.to ? { to: new Date(filters.to) } : {}),
    });
  }

  public async getExecution(context: RequestContext, executionTaskId: string) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    const execution = await this.supportRepository.getExecutionTask(this.db, {
      organizationId,
      id: executionTaskId,
    });
    if (!execution) {
      throw new NotFoundError("Execution task was not found.");
    }

    return execution;
  }

  public async listExecutionAttempts(context: RequestContext, executionTaskId: string) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    const execution = await this.supportRepository.getExecutionTask(this.db, {
      organizationId,
      id: executionTaskId,
    });
    if (!execution) {
      throw new NotFoundError("Execution task was not found.");
    }

    return this.supportRepository.listExecutionAttempts(this.db, {
      organizationId,
      executionTaskId,
    });
  }

  public async listForecastJobs(
    context: RequestContext,
    filters: { status?: ForecastJobStatus; from?: string; to?: string; limit: number },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.supportRepository.listForecastJobs(this.db, {
      organizationId,
      limit: filters.limit,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
      ...(filters.to ? { to: new Date(filters.to) } : {}),
    });
  }

  public async listAiRuns(
    context: RequestContext,
    filters: {
      status?: "pending" | "succeeded" | "failed" | "degraded";
      runType?: "forecast_enhancement" | "anomaly_scoring" | "decision_explanation";
      from?: string;
      to?: string;
      limit: number;
    },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.supportRepository.listAiRuns(this.db, {
      organizationId,
      limit: filters.limit,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.runType ? { runType: filters.runType } : {}),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
      ...(filters.to ? { to: new Date(filters.to) } : {}),
    });
  }

  public async listAuditTimeline(
    context: RequestContext,
    filters: {
      decisionId?: string;
      executionTaskId?: string;
      correlationId?: string;
      from?: string;
      to?: string;
      limit: number;
    },
  ): Promise<SupportTimelineItemDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    const limit = filters.limit;
    const [auditEvents, executionAttempts, aiRuns, outboxEvents, decisionOutcomes] = await Promise.all([
      this.supportRepository.listAuditEvents(this.db, {
        organizationId,
        limit,
        ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
        ...(filters.from ? { from: new Date(filters.from) } : {}),
        ...(filters.to ? { to: new Date(filters.to) } : {}),
      }),
      filters.executionTaskId
        ? this.supportRepository.listExecutionAttempts(this.db, {
            organizationId,
            executionTaskId: filters.executionTaskId,
          })
        : [],
      this.supportRepository.listAiRuns(this.db, {
        organizationId,
        limit,
        ...(filters.from ? { from: new Date(filters.from) } : {}),
        ...(filters.to ? { to: new Date(filters.to) } : {}),
      }),
      this.supportRepository.listOutboxEvents(this.db, {
        organizationId,
        limit,
        ...(filters.decisionId ? { aggregateId: filters.decisionId } : {}),
        ...(filters.from ? { from: new Date(filters.from) } : {}),
        ...(filters.to ? { to: new Date(filters.to) } : {}),
      }),
      this.supportRepository.listDecisionOutcomes(this.db, {
        organizationId,
        limit,
        ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
        ...(filters.from ? { from: new Date(filters.from) } : {}),
        ...(filters.to ? { to: new Date(filters.to) } : {}),
      }),
    ]);

    const items: SupportTimelineItemDto[] = [
      ...auditEvents.map((event) => ({
        type: "audit_event" as const,
        id: event.id,
        createdAt: event.createdAt.toISOString(),
        correlationId: event.correlationId,
        summary: `${event.eventType} on ${event.entityType}`,
        metadata: {
          entityId: event.entityId,
          entityType: event.entityType,
          payload: event.payload as Record<string, unknown>,
        },
      })),
      ...executionAttempts.map((attempt) => ({
        type: "execution_attempt" as const,
        id: attempt.id,
        createdAt: attempt.createdAt.toISOString(),
        correlationId: null,
        summary: `Execution attempt ${attempt.attemptNumber} ${attempt.status}`,
        metadata: {
          executionTaskId: attempt.executionTaskId,
          status: attempt.status,
          errorCode: attempt.errorCode,
        },
      })),
      ...aiRuns.map((run) => ({
        type: "ai_run" as const,
        id: run.id,
        createdAt: run.createdAt.toISOString(),
        correlationId: null,
        summary: `${run.runType} ${run.status}`,
        metadata: {
          subjectType: run.subjectType,
          subjectReference: run.subjectReference,
          modelName: run.modelRegistryEntry.modelName,
        },
      })),
      ...outboxEvents.map((event) => ({
        type: "outbox_event" as const,
        id: event.id,
        createdAt: event.occurredAt.toISOString(),
        correlationId: null,
        summary: event.eventType,
        metadata: {
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          publishedAt: event.publishedAt?.toISOString() ?? null,
        },
      })),
      ...decisionOutcomes.map((outcome) => ({
        type: "decision_outcome" as const,
        id: outcome.id,
        createdAt: outcome.computedAt.toISOString(),
        correlationId: null,
        summary: `Decision outcome ${outcome.outcomeStatus}`,
        metadata: {
          decisionId: outcome.decisionId,
          executionTaskId: outcome.executionTaskId,
          stockoutAvoided: outcome.stockoutAvoided,
          fillRateDelta: outcome.fillRateDelta,
        },
      })),
    ];

    return items
      .filter((item) => !filters.executionTaskId || item.metadata.executionTaskId === filters.executionTaskId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  public async listOutboxEvents(
    context: RequestContext,
    filters: { aggregateId?: string; eventType?: string; from?: string; to?: string; limit: number },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.supportRepository.listOutboxEvents(this.db, {
      organizationId,
      limit: filters.limit,
      ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
      ...(filters.eventType ? { eventType: filters.eventType } : {}),
      ...(filters.from ? { from: new Date(filters.from) } : {}),
      ...(filters.to ? { to: new Date(filters.to) } : {}),
    });
  }

  public async listOutcomes(
    context: RequestContext,
    filters: { decisionId?: string; from?: string; to?: string; limit: number },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    const from = filters.from ? new Date(filters.from) : undefined;
    const to = filters.to ? new Date(filters.to) : undefined;

    const [decisionOutcomes, fillRates, forecastErrors, stockouts, policySummaries] = await Promise.all([
      this.supportRepository.listDecisionOutcomes(this.db, {
        organizationId,
        limit: filters.limit,
        ...(filters.decisionId ? { decisionId: filters.decisionId } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
      this.supportRepository.listFillRateMeasurements(this.db, {
        organizationId,
        limit: filters.limit,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
      this.supportRepository.listForecastErrorMeasurements(this.db, {
        organizationId,
        limit: filters.limit,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
      this.supportRepository.listStockoutIncidents(this.db, {
        organizationId,
        limit: filters.limit,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
      this.supportRepository.listPolicyEffectivenessSummaries(this.db, {
        organizationId,
        limit: filters.limit,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
    ]);

    return {
      decisionOutcomes,
      fillRates,
      forecastErrors,
      stockouts,
      policySummaries,
    };
  }

  public async listWorkerRuns(context: RequestContext, limit = 20) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    return this.workerRunRepository.listRecent(this.db, { limit });
  }

  public async requeueExecutionTask(
    context: RequestContext,
    executionTaskId: string,
    input: { reason?: string },
  ) {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "support.write");

      const retriedTask = await this.executionTaskService.retryExecutionTaskInTransaction(db, {
        organizationId,
        actorUserId: context.user.id,
        correlationId: context.correlationId,
        executionTaskId,
        ...(input.reason ? { reason: input.reason } : {}),
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "support.execution.requeued",
        entityType: "ExecutionTask",
        entityId: retriedTask.id,
        payload: {
          executionTaskId: retriedTask.id,
          decisionId: retriedTask.decisionId,
          reason: input.reason ?? null,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "support.execution.requeued.v1",
        aggregateType: "ExecutionTask",
        aggregateId: retriedTask.id,
        payload: {
          organizationId,
          executionTaskId: retriedTask.id,
          decisionId: retriedTask.decisionId,
          reason: input.reason ?? null,
        },
      });

      this.telemetryService.incrementCounter("support.action.execution_requeue", 1, { organizationId });
      this.logger.info(
        "Support requeued execution task.",
        { executionTaskId: retriedTask.id, decisionId: retriedTask.decisionId },
        { module: "support", operation: "requeueExecution", organizationId, executionTaskId: retriedTask.id },
      );

      return retriedTask;
    });
  }

  public async requeueForecastJob(
    context: RequestContext,
    forecastJobId: string,
    input: { reason?: string },
  ) {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "support.write");

      const job = await this.forecastJobRepository.findByIdForOrganization(db, {
        organizationId,
        id: forecastJobId,
      });
      if (!job) {
        throw new NotFoundError("Forecast job was not found.");
      }

      if (job.status === ForecastJobStatus.pending) {
        return job;
      }

      if (job.status === ForecastJobStatus.running) {
        throw new ConflictError("Forecast job cannot be requeued while it is running.");
      }

      const requeuedJob = await this.forecastJobRepository.updateById(db, {
        id: job.id,
        data: {
          status: ForecastJobStatus.pending,
          startedAt: null,
          completedAt: null,
          errorMessage: null,
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "support.forecast.requeued",
        entityType: "ForecastJob",
        entityId: requeuedJob.id,
        payload: {
          forecastJobId: requeuedJob.id,
          previousStatus: job.status,
          reason: input.reason ?? null,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "support.forecast.requeued.v1",
        aggregateType: "ForecastJob",
        aggregateId: requeuedJob.id,
        payload: {
          organizationId,
          forecastJobId: requeuedJob.id,
          previousStatus: job.status,
          reason: input.reason ?? null,
        },
      });

      this.telemetryService.incrementCounter("support.action.forecast_requeue", 1, { organizationId });
      this.logger.info(
        "Support requeued forecast job.",
        { forecastJobId: requeuedJob.id, previousStatus: job.status },
        { module: "support", operation: "requeueForecast", organizationId, forecastJobId: requeuedJob.id },
      );

      return requeuedJob;
    });
  }

  public async recomputeOutcomes(
    context: RequestContext,
    input: { measurementWindowStart: string; measurementWindowEnd: string },
  ) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.write");

    const result = await this.outcomesProcessingService.processWindowForOrganization(organizationId, {
      measurementWindowStart: input.measurementWindowStart,
      measurementWindowEnd: input.measurementWindowEnd,
      correlationId: context.correlationId,
      actorUserId: context.user.id,
    });

    await this.transactionRunner.run(async (db) => {
      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "support.outcome.recomputed",
        entityType: "OutcomeComputation",
        entityId: organizationId,
        payload: {
          measurementWindowStart: input.measurementWindowStart,
          measurementWindowEnd: input.measurementWindowEnd,
          summary: { ...result },
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "support.outcome.recomputed.v1",
        aggregateType: "Organization",
        aggregateId: organizationId,
        payload: {
          organizationId,
          measurementWindowStart: input.measurementWindowStart,
          measurementWindowEnd: input.measurementWindowEnd,
          summary: { ...result },
        },
      });
    });

    this.telemetryService.incrementCounter("support.action.outcome_recompute", 1, { organizationId });
    this.logger.info(
      "Support recomputed outcomes for explicit window.",
      result,
      { module: "support", operation: "recomputeOutcomes", organizationId, supportAction: "outcome_recompute" },
    );

    return result;
  }
}
