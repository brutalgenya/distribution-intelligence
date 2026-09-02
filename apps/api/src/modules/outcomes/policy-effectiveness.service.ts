import { OutcomeScopeType, type Policy } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DecisionRepository } from "../decisioning/decision.repository.js";
import { PolicyRepository } from "../decisioning/policy.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { OperatorOverrideRepository } from "../workflow/operator-override.repository.js";
import { DecisionOutcomeRepository } from "./decision-outcome.repository.js";
import { ForecastErrorMeasurementRepository } from "./forecast-error-measurement.repository.js";
import {
  outcomeAuditEventTypes,
  outcomeOutboxEventTypes,
} from "./outcomes.constants.js";
import { buildMeasurementWindow } from "./outcomes-date-utils.js";
import { toPolicyEffectivenessSummaryDto } from "./outcomes.mappers.js";
import type {
  ComputePolicyEffectivenessInput,
  PolicyEffectivenessComputationResultDto,
  PolicyEffectivenessSummaryDto,
} from "./outcomes.schemas.js";
import { PolicyEffectivenessSummaryRepository } from "./policy-effectiveness-summary.repository.js";

const average = (values: number[]): number | null =>
  values.length === 0 ? null : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;

export class PolicyEffectivenessService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly policyRepository: PolicyRepository,
    private readonly decisionRepository: DecisionRepository,
    private readonly decisionOutcomeRepository: DecisionOutcomeRepository,
    private readonly forecastErrorMeasurementRepository: ForecastErrorMeasurementRepository,
    private readonly operatorOverrideRepository: OperatorOverrideRepository,
    private readonly policyEffectivenessSummaryRepository: PolicyEffectivenessSummaryRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async computePolicyEffectiveness(
    context: RequestContext,
    input: ComputePolicyEffectivenessInput,
  ): Promise<PolicyEffectivenessComputationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "outcomes.write");
      return this.computePolicyEffectivenessInTransaction(db, organizationId, input, {
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });
    });
  }

  public async computePolicyEffectivenessAsSystem(
    organizationId: string,
    input: ComputePolicyEffectivenessInput,
    correlationId: string,
  ): Promise<PolicyEffectivenessComputationResultDto> {
    return this.transactionRunner.run((db) =>
      this.computePolicyEffectivenessInTransaction(db, organizationId, input, {
        actorUserId: null,
        correlationId,
      }),
    );
  }

  public async listSummaries(
    context: RequestContext,
    filters: { policyId?: string },
  ): Promise<PolicyEffectivenessSummaryDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const summaries = await this.policyEffectivenessSummaryRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.policyId ? { policyId: filters.policyId } : {}),
    });

    return summaries.map(toPolicyEffectivenessSummaryDto);
  }

  public async getSummary(context: RequestContext, summaryId: string): Promise<PolicyEffectivenessSummaryDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const summary = await this.policyEffectivenessSummaryRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: summaryId,
    });
    if (!summary) {
      throw new NotFoundError("Policy effectiveness summary was not found.");
    }

    return toPolicyEffectivenessSummaryDto(summary);
  }

  public async listSummariesByPolicy(
    context: RequestContext,
    policyId: string,
  ): Promise<PolicyEffectivenessSummaryDto[]> {
    return this.listSummaries(context, { policyId });
  }

  public async computePolicyEffectivenessInTransaction(
    db: DbClient,
    organizationId: string,
    input: ComputePolicyEffectivenessInput,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<PolicyEffectivenessComputationResultDto> {
    const window = buildMeasurementWindow(input.measurementWindowStart, input.measurementWindowEnd);
    const policies = await this.loadPolicies(db, organizationId, input.policyId);
    const decisions = await this.decisionRepository.listByOrganization(db, { organizationId });
    const decisionOutcomes = await this.decisionOutcomeRepository.listByOrganization(db, { organizationId });
    const forecastErrors = await this.forecastErrorMeasurementRepository.listByOrganization(db, { organizationId });
    const overrides = await this.operatorOverrideRepository.listByOrganization(db, { organizationId });

    const summaries = [];
    for (const policy of policies) {
      const scopedDecisions = decisions.filter(
        (decision) =>
          decision.policyId === policy.id &&
          decision.createdAt.getTime() >= window.start.getTime() &&
          decision.createdAt.getTime() <= window.end.getTime(),
      );
      const decisionIds = new Set(scopedDecisions.map((decision) => decision.id));
      const scopedOutcomes = decisionOutcomes.filter(
        (outcome) =>
          decisionIds.has(outcome.decisionId) &&
          outcome.measurementWindowStart.getTime() === window.start.getTime() &&
          outcome.measurementWindowEnd.getTime() === window.end.getTime(),
      );
      const scopedForecastErrors = forecastErrors.filter(
        (measurement) =>
          measurement.measurementWindowStart.getTime() === window.start.getTime() &&
          measurement.measurementWindowEnd.getTime() === window.end.getTime() &&
          scopedDecisions.some(
            (decision) =>
              decision.skuId === measurement.skuId && decision.locationId === measurement.locationId,
          ),
      );
      const scopedOverrides = overrides.filter(
        (override) =>
          override.createdAt.getTime() >= window.start.getTime() &&
          override.createdAt.getTime() <= window.end.getTime() &&
          override.decisionId !== null &&
          decisionIds.has(override.decisionId),
      );

      const summary = await this.policyEffectivenessSummaryRepository.upsert(db, {
        organizationId,
        policyId: policy.id,
        policyVersion: policy.version,
        scopeType: OutcomeScopeType.organization,
        measurementWindowStart: window.start,
        measurementWindowEnd: window.end,
        create: {
          organizationId,
          policyId: policy.id,
          policyVersion: policy.version,
          scopeType: OutcomeScopeType.organization,
          scopeReference: null,
          measurementWindowStart: window.start,
          measurementWindowEnd: window.end,
          decisionCount: scopedDecisions.length,
          executedDecisionCount: scopedDecisions.filter((decision) => decision.status === "executed").length,
          stockoutAvoidanceRate: average(
            scopedOutcomes
              .filter((outcome) => outcome.stockoutAvoided !== null)
              .map((outcome) => (outcome.stockoutAvoided ? 1 : 0)),
          ),
          averageFillRateDelta: average(
            scopedOutcomes
              .filter((outcome) => outcome.fillRateDelta !== null)
              .map((outcome) => outcome.fillRateDelta!),
          ),
          averageForecastError: average(scopedForecastErrors.map((measurement) => measurement.absoluteError)),
          overrideRate:
            scopedDecisions.length === 0 ? null : scopedOverrides.length / scopedDecisions.length,
        },
        update: {
          decisionCount: scopedDecisions.length,
          executedDecisionCount: scopedDecisions.filter((decision) => decision.status === "executed").length,
          stockoutAvoidanceRate: average(
            scopedOutcomes
              .filter((outcome) => outcome.stockoutAvoided !== null)
              .map((outcome) => (outcome.stockoutAvoided ? 1 : 0)),
          ),
          averageFillRateDelta: average(
            scopedOutcomes
              .filter((outcome) => outcome.fillRateDelta !== null)
              .map((outcome) => outcome.fillRateDelta!),
          ),
          averageForecastError: average(scopedForecastErrors.map((measurement) => measurement.absoluteError)),
          overrideRate:
            scopedDecisions.length === 0 ? null : scopedOverrides.length / scopedDecisions.length,
        },
      });

      summaries.push(summary);

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: options.actorUserId,
        eventType: outcomeAuditEventTypes.policyEffectivenessUpdated,
        entityType: "PolicyEffectivenessSummary",
        entityId: summary.id,
        payload: {
          policyId: policy.id,
          policyVersion: policy.version,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          decisionCount: summary.decisionCount,
          executedDecisionCount: summary.executedDecisionCount,
        },
        correlationId: options.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: outcomeOutboxEventTypes.policyEffectivenessUpdated,
        aggregateType: "PolicyEffectivenessSummary",
        aggregateId: summary.id,
        payload: {
          organizationId,
          policyEffectivenessSummaryId: summary.id,
          policyId: policy.id,
          policyVersion: policy.version,
          measurementWindowStart: window.start.toISOString(),
          measurementWindowEnd: window.end.toISOString(),
          decisionCount: summary.decisionCount,
          executedDecisionCount: summary.executedDecisionCount,
        },
      });
    }

    return {
      measurementWindowStart: window.start.toISOString(),
      measurementWindowEnd: window.end.toISOString(),
      computedCount: summaries.length,
      summaries: summaries.map(toPolicyEffectivenessSummaryDto),
    };
  }

  private async loadPolicies(
    db: DbClient,
    organizationId: string,
    policyId?: string,
  ): Promise<Policy[]> {
    if (policyId) {
      const policy = await this.policyRepository.findByIdForOrganization(db, {
        organizationId,
        id: policyId,
      });
      if (!policy) {
        throw new NotFoundError("Policy was not found.");
      }
      return [policy];
    }

    return this.policyRepository.listByOrganization(db, {
      organizationId,
    });
  }
}
