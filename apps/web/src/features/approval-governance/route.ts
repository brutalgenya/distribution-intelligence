import type { ApprovalGovernanceRouteParams } from "./types";

export const buildApprovalGovernanceHref = (
  params: Partial<ApprovalGovernanceRouteParams> = {},
): string => {
  const searchParams = new URLSearchParams();

  if (params.approvalTaskId) {
    searchParams.set("approvalTaskId", params.approvalTaskId);
  }
  if (params.decisionId) {
    searchParams.set("decisionId", params.decisionId);
  }
  if (params.policyId) {
    searchParams.set("policyId", params.policyId);
  }
  if (params.status && params.status !== "all") {
    searchParams.set("status", params.status);
  }
  if (params.decisionType && params.decisionType !== "all") {
    searchParams.set("decisionType", params.decisionType);
  }
  if (params.overrideType && params.overrideType !== "all") {
    searchParams.set("overrideType", params.overrideType);
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `/approval-governance?${queryString}` : "/approval-governance";
};

export const readApprovalGovernanceRouteParams = (
  searchParams: URLSearchParams,
): ApprovalGovernanceRouteParams => ({
  approvalTaskId: searchParams.get("approvalTaskId"),
  decisionId: searchParams.get("decisionId"),
  policyId: searchParams.get("policyId"),
  status: (searchParams.get("status") as ApprovalGovernanceRouteParams["status"]) ?? "all",
  decisionType:
    (searchParams.get("decisionType") as ApprovalGovernanceRouteParams["decisionType"]) ?? "all",
  overrideType:
    (searchParams.get("overrideType") as ApprovalGovernanceRouteParams["overrideType"]) ?? "all",
});
