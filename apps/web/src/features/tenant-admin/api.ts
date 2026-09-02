import type { ApiClient } from "../../lib/api/types";
import type {
  ApprovalTask,
  BillingEntitlements,
  Decision,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  InviteMemberInput,
  OrganizationEntitlement,
  OrganizationInvitation,
  OrganizationMembership,
  PlanSubscription,
  SupportExecutionTask,
  SupportTimelineItem,
} from "./types";

const buildQueryString = (filters: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
};

export const listOrganizationMemberships = (
  apiClient: ApiClient,
  organizationId: string,
): Promise<OrganizationMembership[]> =>
  apiClient.get(`/organizations/${organizationId}/memberships`);

export const listOrganizationEntitlements = (
  apiClient: ApiClient,
  organizationId: string,
): Promise<OrganizationEntitlement[]> =>
  apiClient.get(`/organizations/${organizationId}/entitlements`);

export const inviteOrganizationMember = (
  apiClient: ApiClient,
  organizationId: string,
  input: InviteMemberInput,
): Promise<OrganizationInvitation> =>
  apiClient.post(`/organizations/${organizationId}/invitations`, input);

export const getCurrentSubscription = (
  apiClient: ApiClient,
): Promise<PlanSubscription | null> => apiClient.get("/billing/subscription");

export const getBillingEntitlements = (
  apiClient: ApiClient,
): Promise<BillingEntitlements> => apiClient.get("/billing/entitlements");

export const listIntegrationConnections = (
  apiClient: ApiClient,
): Promise<IntegrationConnection[]> => apiClient.get("/integrations/connections");

export const listIntegrationSyncRuns = (
  apiClient: ApiClient,
): Promise<IntegrationSyncRun[]> => apiClient.get("/integrations/syncs");

export const listIntegrationFailedRecords = (
  apiClient: ApiClient,
): Promise<IntegrationFailedRecord[]> =>
  apiClient.get("/integrations/failed-records?resolved=false");

export const listDecisions = (apiClient: ApiClient): Promise<Decision[]> =>
  apiClient.get("/decisioning/decisions");

export const listApprovalTasks = (apiClient: ApiClient): Promise<ApprovalTask[]> =>
  apiClient.get("/workflow/approvals");

export const listExecutions = (
  apiClient: ApiClient,
): Promise<SupportExecutionTask[]> =>
  apiClient.get(
    `/support/executions${buildQueryString({
      limit: "50",
    })}`,
  );

export const listAuditTimeline = (
  apiClient: ApiClient,
): Promise<SupportTimelineItem[]> =>
  apiClient.get(
    `/support/audit-timeline${buildQueryString({
      limit: "50",
    })}`,
  );
