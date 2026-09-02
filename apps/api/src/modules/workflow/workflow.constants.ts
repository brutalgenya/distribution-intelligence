export const workflowAuditEventTypes = {
  approvalRequested: "workflow.approval.requested",
  approvalApproved: "workflow.approval.approved",
  approvalRejected: "workflow.approval.rejected",
  overrideRecorded: "workflow.override.recorded",
} as const;

export const workflowOutboxEventTypes = {
  approvalRequested: "workflow.approval.requested.v1",
  approvalApproved: "workflow.approval.approved.v1",
  approvalRejected: "workflow.approval.rejected.v1",
  overrideRecorded: "workflow.override.recorded.v1",
} as const;

// Auto-executed replenishment proposals above this quantity are gated for approval.
export const AUTO_EXECUTION_REPLENISHMENT_QTY_APPROVAL_THRESHOLD = 250;
