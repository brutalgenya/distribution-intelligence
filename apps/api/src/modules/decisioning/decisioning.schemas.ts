import {
  AutomationTier,
  DecisionStatus,
  DecisionType,
  PolicyStatus,
  PolicyType,
} from "@prisma/client";
import { z } from "zod";

const replenishmentPolicyRulesSchema = z.object({
  automationTier: z.nativeEnum(AutomationTier).default(AutomationTier.recommend),
  forecastHorizonDays: z.coerce.number().int().positive().max(90).default(14),
  targetDaysOfCover: z.coerce.number().int().positive().max(180).default(14),
  leadTimeBufferDays: z.coerce.number().int().nonnegative().max(90).default(0),
  defaultLeadTimeDays: z.coerce.number().int().positive().max(90).default(7),
  useSafetyStock: z.boolean().default(true),
  shortageBufferQty: z.coerce.number().int().nonnegative().default(0),
  demandSpikeMultiplier: z.coerce.number().positive().default(2),
});

const allocationPolicyRulesSchema = z.object({
  automationTier: z.nativeEnum(AutomationTier).default(AutomationTier.recommend),
  shortageThresholdQty: z.coerce.number().int().positive().default(1),
  prioritizationMode: z.literal("oldest_order_first").default("oldest_order_first"),
  maxAffectedOrders: z.coerce.number().int().positive().max(100).default(20),
});

const exceptionPolicyRulesSchema = z.object({
  automationTier: z.nativeEnum(AutomationTier).default(AutomationTier.observe),
  forecastHorizonDays: z.coerce.number().int().positive().max(90).default(14),
  leadTimeDriftThresholdDays: z.coerce.number().int().positive().max(90).default(3),
  demandSpikeMultiplier: z.coerce.number().positive().default(2),
  stockoutRiskCoverDays: z.coerce.number().int().positive().max(30).default(3),
});

export type ReplenishmentPolicyRules = z.infer<typeof replenishmentPolicyRulesSchema>;
export type AllocationPolicyRules = z.infer<typeof allocationPolicyRulesSchema>;
export type ExceptionPolicyRules = z.infer<typeof exceptionPolicyRulesSchema>;
export type PolicyRules = ReplenishmentPolicyRules | AllocationPolicyRules | ExceptionPolicyRules;

export const createPolicyBodySchema = z.discriminatedUnion("policyType", [
  z.object({
    policyType: z.literal(PolicyType.replenishment),
    name: z.string().trim().min(1).max(160),
    version: z.coerce.number().int().positive(),
    rulesJson: replenishmentPolicyRulesSchema,
  }),
  z.object({
    policyType: z.literal(PolicyType.allocation),
    name: z.string().trim().min(1).max(160),
    version: z.coerce.number().int().positive(),
    rulesJson: allocationPolicyRulesSchema,
  }),
  z.object({
    policyType: z.literal(PolicyType.exception),
    name: z.string().trim().min(1).max(160),
    version: z.coerce.number().int().positive(),
    rulesJson: exceptionPolicyRulesSchema,
  }),
]);

export type CreatePolicyInput = z.infer<typeof createPolicyBodySchema>;

export const updatePolicyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    rulesJson: z.unknown().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdatePolicyInput = z.infer<typeof updatePolicyBodySchema>;

export const policyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const policyTypeParamsSchema = z.object({
  policyType: z.nativeEnum(PolicyType),
});

export const decisionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const skuScopedParamsSchema = z.object({
  skuId: z.string().uuid(),
});

export const listPoliciesQuerySchema = z.object({
  policyType: z.nativeEnum(PolicyType).optional(),
  status: z.nativeEnum(PolicyStatus).optional(),
});

const decisionScopeBodySchema = z.object({
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
});

export const generateReplenishmentBodySchema = decisionScopeBodySchema;
export type GenerateReplenishmentInput = z.infer<typeof generateReplenishmentBodySchema>;

export const generateReplenishmentBatchBodySchema = z
  .object({
    skuId: z.string().uuid().optional(),
    locationId: z.string().uuid().optional(),
  })
  .default({});

export type GenerateReplenishmentBatchInput = z.infer<typeof generateReplenishmentBatchBodySchema>;

export const generateAllocationBodySchema = decisionScopeBodySchema;
export type GenerateAllocationInput = z.infer<typeof generateAllocationBodySchema>;

export const generateExceptionBodySchema = decisionScopeBodySchema;
export type GenerateExceptionInput = z.infer<typeof generateExceptionBodySchema>;

export const listDecisionsQuerySchema = z.object({
  decisionType: z.nativeEnum(DecisionType).optional(),
  status: z.nativeEnum(DecisionStatus).optional(),
  skuId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export interface PolicyDto {
  id: string;
  organizationId: string;
  policyType: PolicyType;
  name: string;
  version: number;
  status: PolicyStatus;
  rulesJson: PolicyRules;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionReasonDto {
  id: string;
  code: string;
  message: string;
  createdAt: string;
}

export interface DecisionScoreDto {
  id: string;
  metric: string;
  value: number;
  createdAt: string;
}

export interface DecisionArtifactDto {
  id: string;
  artifactType: string;
  payload: unknown;
  createdAt: string;
}

export interface DecisionDto {
  id: string;
  organizationId: string;
  decisionType: DecisionType;
  status: DecisionStatus;
  automationTier: AutomationTier;
  policyId: string;
  policyVersion: number;
  skuId: string | null;
  locationId: string | null;
  supplierId: string | null;
  confidenceScore: number | null;
  proposedPayload: unknown;
  rationale: unknown;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  reasons: DecisionReasonDto[];
  scores: DecisionScoreDto[];
  artifacts: DecisionArtifactDto[];
}

export interface DecisionGenerationResultDto {
  generated: boolean;
  deduplicated: boolean;
  supersededDecisionIds: string[];
  decision: DecisionDto | null;
}

export const parsePolicyRules = (policyType: PolicyType, rulesJson: unknown): PolicyRules => {
  switch (policyType) {
    case PolicyType.replenishment:
      return replenishmentPolicyRulesSchema.parse(rulesJson);
    case PolicyType.allocation:
      return allocationPolicyRulesSchema.parse(rulesJson);
    case PolicyType.exception:
      return exceptionPolicyRulesSchema.parse(rulesJson);
  }
};
