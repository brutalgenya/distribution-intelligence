import type { ApprovalTask, OperatorOverride } from "@prisma/client";

import type {
  ApprovalTaskDto,
  OperatorOverrideDto,
} from "./workflow.schemas.js";

export const toApprovalTaskDto = (approvalTask: ApprovalTask): ApprovalTaskDto => ({
  id: approvalTask.id,
  organizationId: approvalTask.organizationId,
  decisionId: approvalTask.decisionId,
  purpose: approvalTask.purpose,
  status: approvalTask.status,
  requestedByUserId: approvalTask.requestedByUserId,
  assignedToUserId: approvalTask.assignedToUserId,
  requestedAt: approvalTask.requestedAt.toISOString(),
  decidedAt: approvalTask.decidedAt?.toISOString() ?? null,
  decidedByUserId: approvalTask.decidedByUserId,
  comment: approvalTask.comment,
  createdAt: approvalTask.createdAt.toISOString(),
  updatedAt: approvalTask.updatedAt.toISOString(),
});

export const toOperatorOverrideDto = (override: OperatorOverride): OperatorOverrideDto => ({
  id: override.id,
  organizationId: override.organizationId,
  decisionId: override.decisionId,
  executionTaskId: override.executionTaskId,
  overrideType: override.overrideType,
  reason: override.reason,
  payload: override.payload,
  createdByUserId: override.createdByUserId,
  createdAt: override.createdAt.toISOString(),
});
