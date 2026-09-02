import type { ApiClient } from "../../lib/api/types";
import type {
  ApprovalTask,
  BillingEntitlements,
  BillingPlan,
  BillingUsageMeter,
  CheckoutSession,
  Decision,
  ForecastJob,
  ForecastResult,
  IntegrationConnection,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  PlanSubscription,
  PortalSession,
  SupportExecutionTask,
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

export const listBillingPlans = (apiClient: ApiClient): Promise<BillingPlan[]> =>
  apiClient.get("/billing/plans");

export const getCurrentSubscription = (apiClient: ApiClient): Promise<PlanSubscription | null> =>
  apiClient.get("/billing/subscription");

export const getBillingEntitlements = (apiClient: ApiClient): Promise<BillingEntitlements> =>
  apiClient.get("/billing/entitlements");

export const listBillingUsageMeters = (apiClient: ApiClient): Promise<BillingUsageMeter[]> =>
  apiClient.get("/billing/usage");

export const createCheckoutSession = (
  apiClient: ApiClient,
  input: { planCode: string; successUrl?: string; cancelUrl?: string },
): Promise<CheckoutSession> => apiClient.post("/billing/checkout-session", input);

export const createPortalSession = (
  apiClient: ApiClient,
  input: { returnUrl?: string },
): Promise<PortalSession> => apiClient.post("/billing/portal-session", input);

export const listIntegrationConnections = (apiClient: ApiClient): Promise<IntegrationConnection[]> =>
  apiClient.get("/integrations/connections");

export const listIntegrationSyncRuns = (apiClient: ApiClient): Promise<IntegrationSyncRun[]> =>
  apiClient.get("/integrations/syncs");

export const listIntegrationFailedRecords = (
  apiClient: ApiClient,
): Promise<IntegrationFailedRecord[]> =>
  apiClient.get("/integrations/failed-records?resolved=false");

export const processIntegrationSyncRun = (
  apiClient: ApiClient,
  syncRunId: string,
): Promise<IntegrationSyncRun> => apiClient.post(`/integrations/syncs/${syncRunId}/process`, {});

export const listForecastJobs = (apiClient: ApiClient): Promise<ForecastJob[]> =>
  apiClient.get("/support/forecast-jobs?limit=50");

export const listForecastResults = (
  apiClient: ApiClient,
  forecastJobId: string,
): Promise<ForecastResult[]> => apiClient.get(`/forecasting/jobs/${forecastJobId}/results`);

export const listDecisions = (apiClient: ApiClient): Promise<Decision[]> =>
  apiClient.get("/decisioning/decisions");

export const listApprovalTasks = (apiClient: ApiClient): Promise<ApprovalTask[]> =>
  apiClient.get("/workflow/approvals");

export const listExecutions = (apiClient: ApiClient): Promise<SupportExecutionTask[]> =>
  apiClient.get(
    `/support/executions${buildQueryString({
      limit: "50",
    })}`,
  );
