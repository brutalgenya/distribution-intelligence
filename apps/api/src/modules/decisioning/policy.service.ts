import { PolicyStatus, PolicyType, Prisma, type Policy } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { ConflictError, NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { BillingEntitlementService } from "../billing/billing-entitlement.service.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import { toPolicyDto } from "./decisioning.mappers.js";
import {
  parsePolicyRules,
  type CreatePolicyInput,
  type PolicyDto,
  type PolicyRules,
  type UpdatePolicyInput,
} from "./decisioning.schemas.js";
import { PolicyRepository } from "./policy.repository.js";

export class PolicyService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly policyRepository: PolicyRepository,
    private readonly billingEntitlementService: BillingEntitlementService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async createPolicy(context: RequestContext, input: CreatePolicyInput): Promise<PolicyDto> {
    const organizationId = requireActiveOrganizationId(context);

    try {
      return await this.transactionRunner.run(async (db) => {
        await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

        const normalizedRules = parsePolicyRules(input.policyType, input.rulesJson);
        await this.billingEntitlementService.ensureAutomationTierAllowedInTransaction(db, {
          organizationId,
          requestedAutomationTier: normalizedRules.automationTier,
        });
        const policy = await this.policyRepository.create(db, {
          organizationId,
          policyType: input.policyType,
          name: input.name,
          version: input.version,
          status: PolicyStatus.draft,
          rulesJson: normalizedRules,
          createdByUserId: context.user.id,
        });

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: context.user.id,
          eventType: "decision.policy.created",
          entityType: "Policy",
          entityId: policy.id,
          payload: {
            policyType: policy.policyType,
            version: policy.version,
            status: policy.status,
          },
          correlationId: context.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: "decision.policy.created.v1",
          aggregateType: "Policy",
          aggregateId: policy.id,
          payload: {
            organizationId,
            policyId: policy.id,
            policyType: policy.policyType,
            version: policy.version,
            status: policy.status,
          },
        });

        return toPolicyDto(policy);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError("Policy version already exists for this organization and policy type.");
      }

      throw error;
    }
  }

  public async updateDraftPolicy(
    context: RequestContext,
    policyId: string,
    input: UpdatePolicyInput,
  ): Promise<PolicyDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      const existingPolicy = await this.requirePolicy(db, organizationId, policyId);
      if (existingPolicy.status !== PolicyStatus.draft) {
        throw new ConflictError("Only draft policies can be updated.");
      }

      const normalizedRules =
        input.rulesJson !== undefined
          ? parsePolicyRules(existingPolicy.policyType, input.rulesJson)
          : parsePolicyRules(existingPolicy.policyType, existingPolicy.rulesJson);
      await this.billingEntitlementService.ensureAutomationTierAllowedInTransaction(db, {
        organizationId,
        requestedAutomationTier: normalizedRules.automationTier,
      });

      const updatedPolicy = await this.policyRepository.updateForOrganization(db, {
        organizationId,
        id: policyId,
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.rulesJson !== undefined ? { rulesJson: normalizedRules } : {}),
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "decision.policy.updated",
        entityType: "Policy",
        entityId: updatedPolicy.id,
        payload: {
          changes: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.rulesJson !== undefined ? { rulesJson: normalizedRules } : {}),
          },
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "decision.policy.updated.v1",
        aggregateType: "Policy",
        aggregateId: updatedPolicy.id,
        payload: {
          organizationId,
          policyId: updatedPolicy.id,
          policyType: updatedPolicy.policyType,
          version: updatedPolicy.version,
          status: updatedPolicy.status,
        },
      });

      return toPolicyDto(updatedPolicy);
    });
  }

  public async activatePolicy(context: RequestContext, policyId: string): Promise<PolicyDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "decisioning.write");

      const policy = await this.requirePolicy(db, organizationId, policyId);
      const normalizedRules = this.parseRules(policy);
      await this.billingEntitlementService.ensureAutomationTierAllowedInTransaction(db, {
        organizationId,
        requestedAutomationTier: normalizedRules.automationTier,
      });
      if (policy.status === PolicyStatus.archived) {
        throw new ConflictError("Archived policies cannot be activated.");
      }

      if (policy.status === PolicyStatus.active) {
        return toPolicyDto(policy);
      }

      const activePolicies = await this.policyRepository.listActiveByType(db, {
        organizationId,
        policyType: policy.policyType,
      });

      const archivedPolicyIds: string[] = [];
      for (const activePolicy of activePolicies) {
        if (activePolicy.id === policy.id) {
          continue;
        }

        await this.policyRepository.updateForOrganization(db, {
          organizationId,
          id: activePolicy.id,
          data: {
            status: PolicyStatus.archived,
          },
        });
        archivedPolicyIds.push(activePolicy.id);
      }

      const activatedPolicy = await this.policyRepository.updateForOrganization(db, {
        organizationId,
        id: policy.id,
        data: {
          status: PolicyStatus.active,
        },
      });

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "decision.policy.activated",
        entityType: "Policy",
        entityId: activatedPolicy.id,
        payload: {
          policyType: activatedPolicy.policyType,
          version: activatedPolicy.version,
          archivedPolicyIds,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "decision.policy.activated.v1",
        aggregateType: "Policy",
        aggregateId: activatedPolicy.id,
        payload: {
          organizationId,
          policyId: activatedPolicy.id,
          policyType: activatedPolicy.policyType,
          version: activatedPolicy.version,
          archivedPolicyIds,
        },
      });

      return toPolicyDto(activatedPolicy);
    });
  }

  public async listPolicies(
    context: RequestContext,
    filters: { policyType?: PolicyType; status?: PolicyStatus },
  ): Promise<PolicyDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const policies = await this.policyRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.policyType ? { policyType: filters.policyType } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    });

    return policies.map(toPolicyDto);
  }

  public async getPolicy(context: RequestContext, policyId: string): Promise<PolicyDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const policy = await this.requirePolicy(this.db, organizationId, policyId);
    return toPolicyDto(policy);
  }

  public async getActivePolicy(context: RequestContext, policyType: PolicyType): Promise<PolicyDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "decisioning.read");

    const policy = await this.requireActivePolicy(this.db, organizationId, policyType);
    return toPolicyDto(policy);
  }

  public async requireActivePolicy(db: DbClient, organizationId: string, policyType: PolicyType): Promise<Policy> {
    const policy = await this.policyRepository.findActiveByType(db, {
      organizationId,
      policyType,
    });

    if (!policy) {
      throw new ConflictError(`No active ${policyType} policy is configured for the active organization.`);
    }

    return policy;
  }

  public parseRules(policy: Pick<Policy, "policyType" | "rulesJson">): PolicyRules {
    return parsePolicyRules(policy.policyType, policy.rulesJson);
  }

  private async requirePolicy(db: DbClient, organizationId: string, policyId: string): Promise<Policy> {
    const policy = await this.policyRepository.findByIdForOrganization(db, {
      organizationId,
      id: policyId,
    });

    if (!policy) {
      throw new NotFoundError("Policy was not found.");
    }

    return policy;
  }
}
