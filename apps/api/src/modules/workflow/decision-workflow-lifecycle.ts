import { ApprovalTaskStatus, DecisionStatus, ExecutionTaskStatus } from "@prisma/client";

import { ConflictError } from "../../shared/errors.js";

const decisionTransitions: Record<DecisionStatus, ReadonlySet<DecisionStatus>> = {
  [DecisionStatus.proposed]: new Set([
    DecisionStatus.awaiting_approval,
    DecisionStatus.approved,
    DecisionStatus.execution_requested,
    DecisionStatus.superseded,
    DecisionStatus.dismissed,
  ]),
  [DecisionStatus.awaiting_approval]: new Set([
    DecisionStatus.approved,
    DecisionStatus.rejected,
    DecisionStatus.dismissed,
  ]),
  [DecisionStatus.approved]: new Set([
    DecisionStatus.execution_requested,
    DecisionStatus.dismissed,
  ]),
  [DecisionStatus.rejected]: new Set([DecisionStatus.dismissed]),
  [DecisionStatus.execution_requested]: new Set([
    DecisionStatus.executing,
    DecisionStatus.execution_failed,
    DecisionStatus.dismissed,
  ]),
  [DecisionStatus.executing]: new Set([
    DecisionStatus.executed,
    DecisionStatus.execution_failed,
  ]),
  [DecisionStatus.executed]: new Set([]),
  [DecisionStatus.execution_failed]: new Set([
    DecisionStatus.execution_requested,
    DecisionStatus.dismissed,
  ]),
  [DecisionStatus.superseded]: new Set([]),
  [DecisionStatus.dismissed]: new Set([]),
};

const approvalTaskTransitions: Record<ApprovalTaskStatus, ReadonlySet<ApprovalTaskStatus>> = {
  [ApprovalTaskStatus.pending]: new Set([
    ApprovalTaskStatus.approved,
    ApprovalTaskStatus.rejected,
    ApprovalTaskStatus.cancelled,
  ]),
  [ApprovalTaskStatus.approved]: new Set([]),
  [ApprovalTaskStatus.rejected]: new Set([]),
  [ApprovalTaskStatus.cancelled]: new Set([]),
};

const executionTaskTransitions: Record<ExecutionTaskStatus, ReadonlySet<ExecutionTaskStatus>> = {
  [ExecutionTaskStatus.pending]: new Set([
    ExecutionTaskStatus.running,
    ExecutionTaskStatus.cancelled,
  ]),
  [ExecutionTaskStatus.running]: new Set([
    ExecutionTaskStatus.succeeded,
    ExecutionTaskStatus.failed,
    ExecutionTaskStatus.dead_lettered,
  ]),
  [ExecutionTaskStatus.succeeded]: new Set([]),
  [ExecutionTaskStatus.failed]: new Set([
    ExecutionTaskStatus.pending,
    ExecutionTaskStatus.running,
    ExecutionTaskStatus.cancelled,
    ExecutionTaskStatus.dead_lettered,
  ]),
  [ExecutionTaskStatus.dead_lettered]: new Set([
    ExecutionTaskStatus.pending,
    ExecutionTaskStatus.cancelled,
  ]),
  [ExecutionTaskStatus.cancelled]: new Set([]),
};

export const assertDecisionTransition = (
  currentStatus: DecisionStatus,
  nextStatus: DecisionStatus,
): void => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!decisionTransitions[currentStatus].has(nextStatus)) {
    throw new ConflictError(`Decision cannot transition from ${currentStatus} to ${nextStatus}.`);
  }
};

export const assertApprovalTaskTransition = (
  currentStatus: ApprovalTaskStatus,
  nextStatus: ApprovalTaskStatus,
): void => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!approvalTaskTransitions[currentStatus].has(nextStatus)) {
    throw new ConflictError(`Approval task cannot transition from ${currentStatus} to ${nextStatus}.`);
  }
};

export const assertExecutionTaskTransition = (
  currentStatus: ExecutionTaskStatus,
  nextStatus: ExecutionTaskStatus,
): void => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!executionTaskTransitions[currentStatus].has(nextStatus)) {
    throw new ConflictError(`Execution task cannot transition from ${currentStatus} to ${nextStatus}.`);
  }
};

export const isDecisionApprovalEligible = (status: DecisionStatus): boolean =>
  status === DecisionStatus.proposed || status === DecisionStatus.awaiting_approval;

export const isDecisionExecutionEligible = (status: DecisionStatus): boolean =>
  status === DecisionStatus.proposed ||
  status === DecisionStatus.approved ||
  status === DecisionStatus.execution_requested ||
  status === DecisionStatus.execution_failed;

export const isExecutionTaskRetryable = (status: ExecutionTaskStatus): boolean =>
  status === ExecutionTaskStatus.failed || status === ExecutionTaskStatus.dead_lettered;

export const isExecutionTaskCancellable = (status: ExecutionTaskStatus): boolean =>
  status === ExecutionTaskStatus.pending ||
  status === ExecutionTaskStatus.failed ||
  status === ExecutionTaskStatus.dead_lettered;
