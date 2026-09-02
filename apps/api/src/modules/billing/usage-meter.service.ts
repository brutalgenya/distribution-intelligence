import { Prisma, UsageMeterType } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { AiRunRepository } from "../ai/ai-run.repository.js";
import { ExecutionTaskRepository } from "../execution/execution-task.repository.js";
import { ForecastJobRepository } from "../forecasting/forecast-job.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { OrganizationMembershipRepository } from "../tenancy/membership.repository.js";
import { billingAuditEventTypes, billingOutboxEventTypes } from "./billing.constants.js";
import { toUsageMeterDto } from "./billing.mappers.js";
import type { BillingUsageMeterDto } from "./billing.schemas.js";
import type { BillingUsageSummary, UsageWindow } from "./billing.types.js";
import { UsageMeterRepository } from "./usage-meter.repository.js";

const usageSummaryToValue = (usage: BillingUsageSummary, meterType: UsageMeterType): number => {
  switch (meterType) {
    case UsageMeterType.users:
      return usage.users;
    case UsageMeterType.skus:
      return usage.skus;
    case UsageMeterType.forecast_jobs:
      return usage.forecastJobs;
    case UsageMeterType.ai_runs:
      return usage.aiRuns;
    case UsageMeterType.executed_automation_actions:
      return usage.executedAutomationActions;
  }
};

const toJsonValue = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

export class UsageMeterService {
  public constructor(
    private readonly db: DbClient,
    private readonly membershipRepository: OrganizationMembershipRepository,
    private readonly skuRepository: SkuRepository,
    private readonly forecastJobRepository: ForecastJobRepository,
    private readonly aiRunRepository: AiRunRepository,
    private readonly executionTaskRepository: ExecutionTaskRepository,
    private readonly usageMeterRepository: UsageMeterRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async listUsageMeters(
    context: RequestContext,
    filters: { meterType?: UsageMeterType },
  ): Promise<BillingUsageMeterDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "billing.read");

    const meters = await this.usageMeterRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.meterType ? { meterType: filters.meterType } : {}),
    });

    return meters.map(toUsageMeterDto);
  }

  public async computeUsageSummary(
    db: DbClient,
    organizationId: string,
    usageWindow: UsageWindow,
  ): Promise<BillingUsageSummary> {
    const [users, skus, forecastJobs, aiRuns, executedAutomationActions] = await Promise.all([
      this.membershipRepository.countByOrganization(db, organizationId),
      this.skuRepository.countByOrganization(db, organizationId),
      this.forecastJobRepository.countByOrganizationCreatedAtRange(db, {
        organizationId,
        createdAtGte: usageWindow.start,
        createdAtLt: usageWindow.end,
      }),
      this.aiRunRepository.countByOrganizationCreatedAtRange(db, {
        organizationId,
        createdAtGte: usageWindow.start,
        createdAtLt: usageWindow.end,
      }),
      this.executionTaskRepository.countSucceededByOrganizationAndRequestedAtRange(db, {
        organizationId,
        requestedAtGte: usageWindow.start,
        requestedAtLt: usageWindow.end,
      }),
    ]);

    return {
      users,
      skus,
      forecastJobs,
      aiRuns,
      executedAutomationActions,
    };
  }

  public async recordUsageMetersInTransaction(
    db: DbClient,
    input: {
      organizationId: string;
      actorUserId: string | null;
      correlationId: string;
      usageWindow: UsageWindow;
      meterTypes: readonly UsageMeterType[];
      sourceType: string;
      sourceReference?: string | null;
    },
  ): Promise<BillingUsageMeterDto[]> {
    const usageSummary = await this.computeUsageSummary(db, input.organizationId, input.usageWindow);

    const persistedMeters = await Promise.all(
      input.meterTypes.map((meterType) =>
        this.usageMeterRepository.upsert(db, {
          organizationId: input.organizationId,
          meterType,
          measurementWindowStart: input.usageWindow.start,
          measurementWindowEnd: input.usageWindow.end,
          create: {
            organizationId: input.organizationId,
            meterType,
            usageValue: usageSummaryToValue(usageSummary, meterType),
            measurementWindowStart: input.usageWindow.start,
            measurementWindowEnd: input.usageWindow.end,
            sourceType: input.sourceType,
            ...(input.sourceReference ? { sourceReference: input.sourceReference } : {}),
          },
          update: {
            usageValue: usageSummaryToValue(usageSummary, meterType),
            sourceType: input.sourceType,
            sourceReference: input.sourceReference ?? null,
          },
        }),
      ),
    );

    await this.auditEventRepository.create(db, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: billingAuditEventTypes.usageRecorded,
      entityType: "UsageMeter",
      entityId: `${input.organizationId}:${input.sourceType}`,
      payload: {
        meterTypes: input.meterTypes,
        measurementWindowStart: input.usageWindow.start.toISOString(),
        measurementWindowEnd: input.usageWindow.end.toISOString(),
        usageSummary: {
          users: usageSummary.users,
          skus: usageSummary.skus,
          forecastJobs: usageSummary.forecastJobs,
          aiRuns: usageSummary.aiRuns,
          executedAutomationActions: usageSummary.executedAutomationActions,
        },
        sourceType: input.sourceType,
        sourceReference: input.sourceReference ?? null,
      } satisfies Prisma.InputJsonObject,
      correlationId: input.correlationId,
    });

    await this.outboxEventRepository.create(db, {
      organizationId: input.organizationId,
      eventType: billingOutboxEventTypes.usageRecorded,
      aggregateType: "UsageMeter",
      aggregateId: `${input.organizationId}:${input.sourceType}`,
      payload: {
        organizationId: input.organizationId,
        meterTypes: input.meterTypes,
        measurementWindowStart: input.usageWindow.start.toISOString(),
        measurementWindowEnd: input.usageWindow.end.toISOString(),
        usageSummary: toJsonValue({
          users: usageSummary.users,
          skus: usageSummary.skus,
          forecastJobs: usageSummary.forecastJobs,
          aiRuns: usageSummary.aiRuns,
          executedAutomationActions: usageSummary.executedAutomationActions,
        }),
        sourceType: input.sourceType,
        sourceReference: input.sourceReference ?? null,
      } satisfies Prisma.InputJsonObject,
    });

    return persistedMeters.map(toUsageMeterDto);
  }
}
