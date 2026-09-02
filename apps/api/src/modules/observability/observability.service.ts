import { ExecutionTaskStatus, WorkerType } from "@prisma/client";

import type { AppConfig } from "../../infrastructure/config/env.js";
import type { DbClient } from "../../infrastructure/db/types.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { ExecutionTaskRepository } from "../execution/execution-task.repository.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { IntegrationSyncRunRepository } from "../integrations/integration-sync-run.repository.js";
import type { HealthDto, LivenessDto, ReadinessDto, WorkerStatusDto } from "./observability.schemas.js";
import { WorkerRunRepository } from "./worker-run.repository.js";

const RECENT_WINDOW_HOURS = 24;

export class ObservabilityService {
  public constructor(
    private readonly config: AppConfig,
    private readonly db: DbClient,
    private readonly telemetryService: TelemetryService,
    private readonly workerRunRepository: WorkerRunRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly integrationSyncRunRepository: IntegrationSyncRunRepository,
    private readonly authorizationService: AuthorizationService,
  ) {}

  public getLiveness(): LivenessDto {
    return {
      status: "ok",
      checkedAt: new Date().toISOString(),
      environment: this.config.APP_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  public async getReadiness(): Promise<ReadinessDto> {
    const databaseUp = await this.isDatabaseReachable();

    return {
      status: databaseUp ? "ready" : "not_ready",
      checkedAt: new Date().toISOString(),
      environment: this.config.APP_ENV,
      database: {
        status: databaseUp ? "up" : "down",
      },
    };
  }

  public async getHealth(): Promise<HealthDto> {
    const readiness = await this.getReadiness();

    return {
      status: readiness.status === "ready" ? "ok" : "degraded",
      checkedAt: readiness.checkedAt,
      environment: readiness.environment,
      readiness: readiness.status,
      database: readiness.database,
    };
  }

  public async getMetrics(context: RequestContext) {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    await this.updateOperationalGauges(organizationId);
    return this.telemetryService.snapshot();
  }

  public async getWorkerStatus(context: RequestContext): Promise<WorkerStatusDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "support.read");

    await this.updateOperationalGauges(organizationId);

    const recentWindowStart = new Date(Date.now() - RECENT_WINDOW_HOURS * 60 * 60 * 1000);
    const workerTypes: WorkerType[] = [
      WorkerType.forecast,
      WorkerType.execution,
      WorkerType.outcomes,
      WorkerType.integration,
    ];

    return Promise.all(
      workerTypes.map(async (workerType) => {
        const lastRun = await this.workerRunRepository.findLatestByWorkerType(this.db, workerType);
        const recentFailureCount = await this.workerRunRepository.countByWorkerTypeAndStatus(this.db, {
          workerType,
          status: "failed",
          createdAtGte: recentWindowStart,
        });
        const processedAggregate = await this.workerRunRepository.sumProcessedCountByWorkerType(this.db, {
          workerType,
          createdAtGte: recentWindowStart,
        });

        const backlog = await this.getRetryBacklogForWorker(organizationId, workerType);
        const deadLetterCount = workerType === WorkerType.execution ? backlog.deadLetterCount : 0;

        return {
          workerType,
          lastRunAt: lastRun?.startedAt.toISOString() ?? null,
          lastStatus: lastRun?.status ?? null,
          currentlyRunning: lastRun?.status === "running" && lastRun.completedAt === null,
          recentFailureCount,
          recentProcessedCount: processedAggregate._sum.processedCount ?? 0,
          retryBacklog: backlog.retryBacklog,
          deadLetterCount,
          lastError: lastRun?.errorMessage ?? null,
        } satisfies WorkerStatusDto;
      }),
    );
  }

  private async updateOperationalGauges(organizationId: string): Promise<void> {
    const now = new Date();
    const executionBacklog = await this.executionTaskRepository.listByOrganization(this.db, {
      organizationId,
    });
    const forecastQueued = await this.forecastJobRepository.listByOrganization(this.db, {
      organizationId,
    });

    const runnableExecutionCount = executionBacklog.filter(
      (task) =>
        task.status === ExecutionTaskStatus.pending ||
        (task.status === ExecutionTaskStatus.failed &&
          (task.nextRetryAt === null || task.nextRetryAt <= now)),
    ).length;
    const deadLetterCount = executionBacklog.filter(
      (task) => task.status === ExecutionTaskStatus.dead_lettered,
    ).length;
    const forecastBacklogCount = forecastQueued.filter(
      (job) => job.status === "pending" || job.status === "failed",
    ).length;
    const integrationBacklog = await this.integrationSyncRunRepository.listByOrganization(this.db, {
      organizationId,
    });
    const integrationBacklogCount = integrationBacklog.filter(
      (run) => run.status === "pending" || run.status === "failed" || run.status === "partial",
    ).length;

    this.telemetryService.setGauge("forecast.queue.depth", forecastBacklogCount, { organizationId });
    this.telemetryService.setGauge("execution.queue.depth", runnableExecutionCount, { organizationId });
    this.telemetryService.setGauge("execution.dead_letter.count", deadLetterCount, { organizationId });
    this.telemetryService.setGauge("integration.queue.depth", integrationBacklogCount, { organizationId });
  }

  private async getRetryBacklogForWorker(
    organizationId: string,
    workerType: WorkerType,
  ): Promise<{ retryBacklog: number; deadLetterCount: number }> {
    if (workerType === WorkerType.forecast) {
      const jobs = await this.forecastJobRepository.listByOrganization(this.db, { organizationId });
      return {
        retryBacklog: jobs.filter((job) => job.status === "pending" || job.status === "failed").length,
        deadLetterCount: 0,
      };
    }

    if (workerType === WorkerType.execution) {
      const tasks = await this.executionTaskRepository.listByOrganization(this.db, { organizationId });
      const now = new Date();

      return {
        retryBacklog: tasks.filter(
          (task) =>
            task.status === ExecutionTaskStatus.pending ||
            (task.status === ExecutionTaskStatus.failed &&
              (task.nextRetryAt === null || task.nextRetryAt <= now)),
        ).length,
        deadLetterCount: tasks.filter((task) => task.status === ExecutionTaskStatus.dead_lettered).length,
      };
    }

    if (workerType === WorkerType.integration) {
      const runs = await this.integrationSyncRunRepository.listByOrganization(this.db, { organizationId });
      return {
        retryBacklog: runs.filter(
          (run) => run.status === "pending" || run.status === "failed" || run.status === "partial",
        ).length,
        deadLetterCount: 0,
      };
    }

    return {
      retryBacklog: 0,
      deadLetterCount: 0,
    };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
