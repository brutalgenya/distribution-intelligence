import { ApprovalTaskStatus, DecisionStatus, ExecutionTaskStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { ConflictError } from "../../shared/errors.js";
import {
  assertApprovalTaskTransition,
  assertDecisionTransition,
  assertExecutionTaskTransition,
  isDecisionApprovalEligible,
  isDecisionExecutionEligible,
  isExecutionTaskCancellable,
  isExecutionTaskRetryable,
} from "../../modules/workflow/decision-workflow-lifecycle.js";

describe("decision-workflow-lifecycle", () => {
  it("allows the governed approval and execution transitions", () => {
    expect(() =>
      assertDecisionTransition(DecisionStatus.proposed, DecisionStatus.awaiting_approval),
    ).not.toThrow();
    expect(() =>
      assertDecisionTransition(DecisionStatus.awaiting_approval, DecisionStatus.approved),
    ).not.toThrow();
    expect(() =>
      assertDecisionTransition(DecisionStatus.approved, DecisionStatus.execution_requested),
    ).not.toThrow();
    expect(() =>
      assertDecisionTransition(DecisionStatus.execution_requested, DecisionStatus.executing),
    ).not.toThrow();
    expect(() =>
      assertDecisionTransition(DecisionStatus.executing, DecisionStatus.executed),
    ).not.toThrow();
  });

  it("rejects invalid transitions", () => {
    expect(() =>
      assertDecisionTransition(DecisionStatus.executed, DecisionStatus.execution_requested),
    ).toThrow(ConflictError);
    expect(() =>
      assertApprovalTaskTransition(ApprovalTaskStatus.rejected, ApprovalTaskStatus.approved),
    ).toThrow(ConflictError);
    expect(() =>
      assertExecutionTaskTransition(ExecutionTaskStatus.succeeded, ExecutionTaskStatus.running),
    ).toThrow(ConflictError);
  });

  it("exposes eligibility helpers for approvals, execution, retries, and cancellation", () => {
    expect(isDecisionApprovalEligible(DecisionStatus.proposed)).toBe(true);
    expect(isDecisionApprovalEligible(DecisionStatus.awaiting_approval)).toBe(true);
    expect(isDecisionApprovalEligible(DecisionStatus.executed)).toBe(false);

    expect(isDecisionExecutionEligible(DecisionStatus.proposed)).toBe(true);
    expect(isDecisionExecutionEligible(DecisionStatus.approved)).toBe(true);
    expect(isDecisionExecutionEligible(DecisionStatus.execution_failed)).toBe(true);
    expect(isDecisionExecutionEligible(DecisionStatus.dismissed)).toBe(false);

    expect(isExecutionTaskRetryable(ExecutionTaskStatus.failed)).toBe(true);
    expect(isExecutionTaskRetryable(ExecutionTaskStatus.dead_lettered)).toBe(true);
    expect(isExecutionTaskRetryable(ExecutionTaskStatus.succeeded)).toBe(false);

    expect(isExecutionTaskCancellable(ExecutionTaskStatus.pending)).toBe(true);
    expect(isExecutionTaskCancellable(ExecutionTaskStatus.failed)).toBe(true);
    expect(isExecutionTaskCancellable(ExecutionTaskStatus.cancelled)).toBe(false);
  });
});
