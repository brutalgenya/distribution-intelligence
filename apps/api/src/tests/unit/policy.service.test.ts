import { PolicyStatus, PolicyType, Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AuditEventRepository } from "../../modules/audit/audit.repository.js";
import type { AuthorizationService } from "../../modules/authz/authz.service.js";
import type { BillingEntitlementService } from "../../modules/billing/billing-entitlement.service.js";
import type { OutboxEventRepository } from "../../modules/outbox/outbox.repository.js";
import { PolicyService } from "../../modules/decisioning/policy.service.js";
import type { PolicyRepository } from "../../modules/decisioning/policy.repository.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";

const requestContext: RequestContext = {
  correlationId: "f5ceb3ef-83f5-43c6-ac85-4f45b7fa229d",
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

describe("PolicyService", () => {
  it("creates a policy with normalized rules and writes audit and outbox events", async () => {
    const policyRepository = {
      create: vi.fn().mockResolvedValue({
        id: "policy-id",
        organizationId: "organization-id",
        policyType: PolicyType.replenishment,
        name: "Replenishment v1",
        version: 1,
        status: PolicyStatus.draft,
        rulesJson: {
          automationTier: "recommend",
          forecastHorizonDays: 14,
          targetDaysOfCover: 14,
          leadTimeBufferDays: 0,
          defaultLeadTimeDays: 7,
          useSafetyStock: true,
          shortageBufferQty: 0,
          demandSpikeMultiplier: 2,
        },
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
    } as unknown as PolicyRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new PolicyService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      policyRepository,
      {
        ensureAutomationTierAllowedInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.createPolicy(requestContext, {
      policyType: PolicyType.replenishment,
      name: "Replenishment v1",
      version: 1,
      rulesJson: {
        automationTier: "recommend",
        forecastHorizonDays: 14,
        targetDaysOfCover: 14,
        leadTimeBufferDays: 0,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      },
    });

    expect(result.id).toBe("policy-id");
    expect(result.policyType).toBe(PolicyType.replenishment);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });

  it("activates a draft policy and archives the previous active version", async () => {
    const policyRepository = {
      findByIdForOrganization: vi.fn().mockResolvedValue({
        id: "policy-id",
        organizationId: "organization-id",
        policyType: PolicyType.replenishment,
        name: "Replenishment v2",
        version: 2,
        status: PolicyStatus.draft,
        rulesJson: {
          automationTier: "recommend",
          forecastHorizonDays: 14,
          targetDaysOfCover: 14,
          leadTimeBufferDays: 0,
          defaultLeadTimeDays: 7,
          useSafetyStock: true,
          shortageBufferQty: 0,
          demandSpikeMultiplier: 2,
        },
        createdByUserId: "owner-id",
        createdAt: new Date("2026-03-28T00:00:00.000Z"),
        updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      }),
      listActiveByType: vi.fn().mockResolvedValue([
        {
          id: "old-policy-id",
          organizationId: "organization-id",
          policyType: PolicyType.replenishment,
          name: "Replenishment v1",
          version: 1,
          status: PolicyStatus.active,
          rulesJson: {},
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-27T00:00:00.000Z"),
          updatedAt: new Date("2026-03-27T00:00:00.000Z"),
        },
      ]),
      updateForOrganization: vi
        .fn()
        .mockResolvedValueOnce({
          id: "old-policy-id",
          organizationId: "organization-id",
          policyType: PolicyType.replenishment,
          name: "Replenishment v1",
          version: 1,
          status: PolicyStatus.archived,
          rulesJson: {},
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-27T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        })
        .mockResolvedValueOnce({
          id: "policy-id",
          organizationId: "organization-id",
          policyType: PolicyType.replenishment,
          name: "Replenishment v2",
          version: 2,
          status: PolicyStatus.active,
          rulesJson: {
            automationTier: "recommend",
            forecastHorizonDays: 14,
            targetDaysOfCover: 14,
            leadTimeBufferDays: 0,
            defaultLeadTimeDays: 7,
            useSafetyStock: true,
            shortageBufferQty: 0,
            demandSpikeMultiplier: 2,
          },
          createdByUserId: "owner-id",
          createdAt: new Date("2026-03-28T00:00:00.000Z"),
          updatedAt: new Date("2026-03-28T00:00:00.000Z"),
        }),
    } as unknown as PolicyRepository;

    const authorizationService = {
      requireOrganizationPermission: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthorizationService;

    const auditEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuditEventRepository;

    const outboxEventRepository = {
      create: vi.fn().mockResolvedValue(undefined),
    } as unknown as OutboxEventRepository;

    const service = new PolicyService(
      {} as Prisma.TransactionClient,
      transactionRunner,
      policyRepository,
      {
        ensureAutomationTierAllowedInTransaction: vi.fn().mockResolvedValue(undefined),
      } as unknown as BillingEntitlementService,
      authorizationService,
      auditEventRepository,
      outboxEventRepository,
    );

    const result = await service.activatePolicy(requestContext, "policy-id");

    expect(result.status).toBe(PolicyStatus.active);
    expect(vi.mocked(policyRepository.updateForOrganization)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(auditEventRepository.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(outboxEventRepository.create)).toHaveBeenCalledTimes(1);
  });
});
