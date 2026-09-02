import { useMemo } from "react";

import {
  useActivationApprovals,
  useActivationDecisions,
  useActivationExecutions,
  useBillingEntitlements,
  useBillingPlans,
  useBillingUsageMeters,
  useCurrentSubscription,
} from "../activation/hooks";
import {
  deriveActivationChecklist,
  deriveActivationSummary,
  deriveNextBestAction,
} from "../activation/selectors";
import type {
  CommercialReadiness,
  DataReadiness,
  IntelligenceReadiness,
} from "../activation/types";
import {
  useApprovalGovernancePolicies,
  useOperatorOverrides,
} from "../approval-governance/hooks";
import {
  buildApprovalRows,
  deriveGovernanceFrictionSummary,
  deriveInterventionPatternRows,
  deriveOverrideRows,
} from "../approval-governance/selectors";
import { useBuyerActionsPurchaseOrders, useBuyerActionsSuppliers } from "../buyer-actions/hooks";
import { deriveBuyerActionsQueueRows } from "../buyer-actions/selectors";
import {
  useForecastJobs,
  useForecastResults,
  useIntegrationConnections,
  useIntegrationFailedRecords,
  useIntegrationSyncRuns,
  useSalesImportRuns,
  useSupportAiRuns,
  useWorkerStatus,
} from "../data-ops/hooks";
import {
  buildForecastJobRows,
  deriveHealthSummary,
} from "../data-ops/selectors";
import { useCatalogSkus, useInventoryPositions, useLocations, useStockoutIncidents, useAnomalyScores as useOutcomeAnomalyScores, usePolicyEffectivenessSummaries } from "../outcomes/hooks";
import {
  deriveAnomalyHighlights,
  deriveRiskHotspots,
} from "../outcomes/selectors";
import {
  buildConnectionRows as buildIntegrationConnectionRows,
  deriveOnboardingReadinessSummary,
} from "../integrations/selectors";
import { deriveGovernanceSummary } from "../policies/selectors";
import { useSession } from "../session/SessionProvider";
import {
  deriveActionableQueue,
  deriveExecutionRecoveryTasks,
  deriveForecastRecoveryJobs,
  deriveSyncRecoveryRuns,
} from "../support-actions/selectors";
import { useTenantAuditTimeline, useTenantMemberships } from "../tenant-admin/hooks";
import {
  deriveAdministrativeAuditItems,
  deriveOrganizationSummary,
  derivePilotHandoffChecklist,
  findCurrentMembership,
} from "../tenant-admin/selectors";
import { derivePurchaseOrderQueueRows, deriveSupplierCoverageRows } from "../supply-execution/selectors";
import {
  deriveAdminSnapshot,
  deriveBuyerSnapshot,
  deriveGlobalHealthSummary,
  deriveLatestCommandCenterEvidenceAt,
  deriveNextBestActions,
  deriveOperatorSnapshot,
  deriveRecentActivity,
  deriveRoleFocus,
} from "./selectors";
import type { CommandCenterViewModel } from "./types";

export const useCommandCenterData = (): {
  viewModel: CommandCenterViewModel;
  sessionConfigured: boolean;
  initialLoading: boolean;
  adminError: unknown | null;
  operatorError: unknown | null;
  buyerError: unknown | null;
  activityError: unknown | null;
} => {
  const session = useSession();

  const plansQuery = useBillingPlans();
  const subscriptionQuery = useCurrentSubscription();
  const entitlementsQuery = useBillingEntitlements();
  const usageQuery = useBillingUsageMeters();
  const decisionsQuery = useActivationDecisions();
  const approvalsQuery = useActivationApprovals();
  const executionsQuery = useActivationExecutions();

  const connectionsQuery = useIntegrationConnections();
  const syncRunsQuery = useIntegrationSyncRuns({});
  const failedRecordsQuery = useIntegrationFailedRecords({ resolved: false });
  const forecastJobsQuery = useForecastJobs();
  const salesImportRunsQuery = useSalesImportRuns();
  const aiRunsQuery = useSupportAiRuns();
  const workerStatusQuery = useWorkerStatus();

  const membershipsQuery = useTenantMemberships();
  const auditTimelineQuery = useTenantAuditTimeline();

  const policiesQuery = useApprovalGovernancePolicies();
  const overridesQuery = useOperatorOverrides();

  const skusQuery = useCatalogSkus();
  const locationsQuery = useLocations();
  const positionsQuery = useInventoryPositions();
  const stockoutsQuery = useStockoutIncidents();
  const anomaliesQuery = useOutcomeAnomalyScores();
  const policySummariesQuery = usePolicyEffectivenessSummaries();

  const purchaseOrdersQuery = useBuyerActionsPurchaseOrders();
  const suppliersQuery = useBuyerActionsSuppliers();

  const plans = plansQuery.data ?? [];
  const subscription = subscriptionQuery.data ?? null;
  const entitlements = entitlementsQuery.data ?? null;
  const usageMeters = usageQuery.data ?? [];
  const decisions = decisionsQuery.data ?? [];
  const approvals = approvalsQuery.data ?? [];
  const executions = executionsQuery.data ?? [];

  const connections = connectionsQuery.data ?? [];
  const syncRuns = syncRunsQuery.data ?? [];
  const failedRecords = failedRecordsQuery.data ?? [];
  const forecastJobs = forecastJobsQuery.data ?? [];
  const salesImportRuns = salesImportRunsQuery.data ?? [];
  const aiRuns = aiRunsQuery.data ?? [];
  const workerStatuses = workerStatusQuery.data ?? [];

  const memberships = membershipsQuery.data ?? [];
  const auditTimeline = auditTimelineQuery.data ?? [];
  const policies = policiesQuery.data ?? [];
  const overrides = overridesQuery.data ?? [];

  const skus = skusQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const stockouts = stockoutsQuery.data ?? [];
  const anomalies = anomaliesQuery.data ?? [];
  const policySummaries = policySummariesQuery.data ?? [];

  const purchaseOrders = purchaseOrdersQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];

  const latestCompletedForecastJob = useMemo(
    () =>
      forecastJobs
        .filter((forecastJob) => forecastJob.status === "completed")
        .sort(
          (left, right) =>
            new Date(right.completedAt ?? right.createdAt).getTime() -
            new Date(left.completedAt ?? left.createdAt).getTime(),
        )[0] ?? null,
    [forecastJobs],
  );

  const latestForecastResultsQuery = useForecastResults(latestCompletedForecastJob?.id ?? null);
  const latestForecastResults = latestForecastResultsQuery.data ?? [];

  const commercial = useMemo(
    () =>
      ({
        currentPlan: subscription?.plan ?? null,
        subscription,
        entitlements,
        usageMeters,
        activePlans: plans.filter((plan) => plan.status === "active"),
      }) satisfies CommercialReadiness,
    [entitlements, plans, subscription, usageMeters],
  );

  const dataReadiness = useMemo(
    () =>
      ({
        connections,
        syncRuns,
        failedRecords,
      }) satisfies DataReadiness,
    [connections, failedRecords, syncRuns],
  );

  const intelligence = useMemo(
    () =>
      ({
        forecastJobs,
        latestForecastResults,
        decisions,
        approvals,
        executions,
      }) satisfies IntelligenceReadiness,
    [approvals, decisions, executions, forecastJobs, latestForecastResults],
  );

  const activationSummary = useMemo(
    () =>
      deriveActivationSummary({
        commercial,
        data: dataReadiness,
        intelligence,
        latestForecastResults,
      }),
    [commercial, dataReadiness, intelligence, latestForecastResults],
  );

  const activationChecklist = useMemo(
    () =>
      deriveActivationChecklist({
        commercial,
        data: dataReadiness,
        intelligence,
        latestForecastResults,
      }),
    [commercial, dataReadiness, intelligence, latestForecastResults],
  );

  const activationNextAction = useMemo(
    () =>
      deriveNextBestAction({
        commercial,
        data: dataReadiness,
        intelligence,
        latestForecastResults,
      }),
    [commercial, dataReadiness, intelligence, latestForecastResults],
  );

  const onboardingConnectionRows = useMemo(
    () => buildIntegrationConnectionRows(connections, syncRuns, failedRecords),
    [connections, failedRecords, syncRuns],
  );

  const onboardingReadiness = useMemo(
    () =>
      deriveOnboardingReadinessSummary({
        rows: onboardingConnectionRows,
        syncRuns,
        failedRecords,
      }),
    [failedRecords, onboardingConnectionRows, syncRuns],
  );

  const forecastJobRows = useMemo(
    () => buildForecastJobRows(forecastJobs, { skuId: null, locationId: null }),
    [forecastJobs],
  );

  const dataHealthSummary = useMemo(
    () =>
      deriveHealthSummary({
        connections,
        syncRuns,
        failedRecords,
        forecastJobs: forecastJobRows,
        aiRuns,
        salesImportRuns,
        workerStatus: workerStatuses,
      }),
    [aiRuns, connections, failedRecords, forecastJobRows, salesImportRuns, syncRuns, workerStatuses],
  );

  const hotspots = useMemo(
    () =>
      deriveRiskHotspots({
        positions,
        stockouts,
        anomalies,
        skus,
        locations,
      }),
    [anomalies, locations, positions, skus, stockouts],
  );

  const anomalyHighlights = useMemo(
    () =>
      deriveAnomalyHighlights({
        anomalies,
        skus,
        locations,
      }),
    [anomalies, locations, skus],
  );

  const approvalRows = useMemo(
    () => buildApprovalRows(approvals, decisions, policies, overrides),
    [approvals, decisions, overrides, policies],
  );

  const governanceFrictionSummary = useMemo(
    () =>
      deriveGovernanceFrictionSummary({
        approvals: approvalRows,
        overrides,
        policySummaries,
      }),
    [approvalRows, overrides, policySummaries],
  );

  const overrideRows = useMemo(
    () => deriveOverrideRows(overrides, decisions, policies, executions),
    [decisions, executions, overrides, policies],
  );

  const interventionPatterns = useMemo(
    () =>
      deriveInterventionPatternRows({
        policies,
        decisions,
        approvals: approvalRows,
        overrides: overrideRows,
        policySummaries,
      }),
    [approvalRows, decisions, overrideRows, policies, policySummaries],
  );

  const governanceSummary = useMemo(
    () =>
      deriveGovernanceSummary({
        policies,
        decisions,
        approvals,
      }),
    [approvals, decisions, policies],
  );

  const currentMembership = useMemo(
    () => findCurrentMembership(memberships, session.userId),
    [memberships, session.userId],
  );

  const organizationSummary = useMemo(
    () =>
      deriveOrganizationSummary({
        memberships,
        subscription,
        billingEntitlements: entitlements,
        currentMembership,
      }),
    [currentMembership, entitlements, memberships, subscription],
  );

  const pilotChecklist = useMemo(
    () =>
      derivePilotHandoffChecklist({
        memberships,
        subscription,
        connections,
        syncRuns,
        decisions,
        approvals,
        executions,
        failedRecords,
      }),
    [approvals, connections, decisions, executions, failedRecords, memberships, subscription, syncRuns],
  );

  const administrativeAuditItems = useMemo(
    () => deriveAdministrativeAuditItems(auditTimeline),
    [auditTimeline],
  );

  const buyerQueueRows = useMemo(
    () =>
      deriveBuyerActionsQueueRows({
        purchaseOrders,
        suppliers,
        filters: {
          status: "all",
          supplierId: null,
          action: "all",
          search: "",
        },
        context: {
          skuId: null,
          locationId: null,
        },
      }),
    [purchaseOrders, suppliers],
  );

  const supplyQueueRows = useMemo(
    () =>
      derivePurchaseOrderQueueRows({
        purchaseOrders,
        suppliers,
        filters: {
          status: "all",
          supplierId: null,
          search: "",
        },
        context: {
          skuId: null,
          locationId: null,
        },
      }),
    [purchaseOrders, suppliers],
  );

  const supplierCoverageRows = useMemo(
    () =>
      deriveSupplierCoverageRows({
        suppliers,
        queueRows: supplyQueueRows,
      }),
    [suppliers, supplyQueueRows],
  );

  const executionRecoveryTasks = useMemo(
    () => deriveExecutionRecoveryTasks(executions, { skuId: null, locationId: null }),
    [executions],
  );
  const forecastRecoveryJobs = useMemo(
    () => deriveForecastRecoveryJobs(forecastJobs, { skuId: null, locationId: null }),
    [forecastJobs],
  );
  const syncRecoveryRuns = useMemo(() => deriveSyncRecoveryRuns(syncRuns), [syncRuns]);
  const actionableQueue = useMemo(
    () =>
      deriveActionableQueue({
        executionTasks: executionRecoveryTasks,
        forecastJobs: forecastRecoveryJobs,
        syncRuns: syncRecoveryRuns,
        failedRecords,
        connections,
      }),
    [connections, executionRecoveryTasks, failedRecords, forecastRecoveryJobs, syncRecoveryRuns],
  );

  const roleFocus = useMemo(
    () =>
      deriveRoleFocus({
        memberships,
        userId: session.userId,
      }),
    [memberships, session.userId],
  );

  const latestEvidenceAt = useMemo(
    () =>
      deriveLatestCommandCenterEvidenceAt({
        subscription,
        billingEntitlements: entitlements,
        activationConnections: onboardingConnectionRows,
        syncRuns,
        failedRecords,
        hotspots,
        approvals: approvalRows,
        overrides: overrideRows,
        buyerQueueRows,
        workerStatuses,
        latestTenantEvidenceAt:
          administrativeAuditItems[0]?.createdAt ??
          currentMembership?.createdAt ??
          null,
      }),
    [administrativeAuditItems, approvalRows, buyerQueueRows, currentMembership?.createdAt, entitlements, failedRecords, hotspots, onboardingConnectionRows, overrideRows, subscription, syncRuns, workerStatuses],
  );

  const adminSnapshot = useMemo(
    () =>
      deriveAdminSnapshot({
        roleFocus,
        activationSummary,
        activationChecklist,
        onboardingReadiness,
        organizationSummary,
        governanceSummary,
        currentMembership,
        subscription,
        connections: onboardingConnectionRows,
        memberships,
        latestEvidenceAt,
      }),
    [activationChecklist, activationSummary, currentMembership, governanceSummary, latestEvidenceAt, memberships, onboardingConnectionRows, onboardingReadiness, organizationSummary, roleFocus, subscription],
  );

  const operatorSnapshot = useMemo(
    () =>
      deriveOperatorSnapshot({
        roleFocus,
        approvals: approvalRows,
        hotspots,
        anomalyHighlights,
        overrides: overrideRows,
        actionableQueue,
        interventionPatterns,
        latestEvidenceAt,
      }),
    [actionableQueue, anomalyHighlights, approvalRows, hotspots, interventionPatterns, latestEvidenceAt, overrideRows, roleFocus],
  );

  const buyerSnapshot = useMemo(
    () =>
      deriveBuyerSnapshot({
        roleFocus,
        buyerQueueRows,
        supplyQueueRows,
        supplierCoverageRows,
        latestEvidenceAt,
      }),
    [buyerQueueRows, latestEvidenceAt, roleFocus, supplierCoverageRows, supplyQueueRows],
  );

  const globalSummary = useMemo(
    () =>
      deriveGlobalHealthSummary({
        activationSummary,
        onboardingReadiness,
        subscription,
        connections: onboardingConnectionRows,
        approvals: approvalRows,
        hotspots,
        actionableQueue,
        buyerQueueRows,
        latestEvidenceAt,
      }),
    [actionableQueue, activationSummary, approvalRows, buyerQueueRows, hotspots, latestEvidenceAt, onboardingConnectionRows, onboardingReadiness, subscription],
  );

  const nextBestActions = useMemo(
    () =>
      deriveNextBestActions({
        roleFocus,
        activationNextAction,
        approvals: approvalRows,
        hotspots,
        actionableQueue,
        buyerQueueRows,
        failedRecords,
      }),
    [actionableQueue, activationNextAction, approvalRows, buyerQueueRows, failedRecords, hotspots, roleFocus],
  );

  const recentActivity = useMemo(
    () =>
      deriveRecentActivity({
        syncRuns,
        connections: onboardingConnectionRows,
        forecastJobs: forecastJobs.map((forecastJob) => ({
          id: forecastJob.id,
          status: forecastJob.status,
          scopeType: forecastJob.scopeType,
          createdAt: forecastJob.createdAt,
          completedAt: forecastJob.completedAt,
        })),
        approvals: approvalRows,
        overrides: overrideRows,
        actionableQueue,
        buyerQueueRows,
        auditItems: administrativeAuditItems.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
          eventType: item.eventType,
          summary: item.summary,
        })),
        salesImportRuns,
        workers: workerStatuses,
      }),
    [actionableQueue, administrativeAuditItems, approvalRows, buyerQueueRows, forecastJobs, onboardingConnectionRows, overrideRows, salesImportRuns, syncRuns, workerStatuses],
  );

  const orderedSnapshots = useMemo(
    () =>
      roleFocus.orderedAudiences.map((audience) => {
        if (audience === "admin") {
          return adminSnapshot;
        }
        if (audience === "operator") {
          return operatorSnapshot;
        }
        return buyerSnapshot;
      }),
    [adminSnapshot, buyerSnapshot, operatorSnapshot, roleFocus.orderedAudiences],
  );

  const viewModel = useMemo(
    () =>
      ({
        activationSummary,
        activationChecklist,
        activationNextAction,
        onboardingReadiness,
        dataHealthSummary,
        organizationSummary,
        governanceSummary,
        governanceFrictionSummary,
        globalSummary,
        roleFocus,
        snapshots: {
          admin: adminSnapshot,
          operator: operatorSnapshot,
          buyer: buyerSnapshot,
        },
        orderedSnapshots,
        nextBestActions,
        recentActivity,
      }) satisfies CommandCenterViewModel,
    [activationChecklist, activationNextAction, activationSummary, adminSnapshot, buyerSnapshot, dataHealthSummary, globalSummary, governanceFrictionSummary, governanceSummary, nextBestActions, onboardingReadiness, operatorSnapshot, orderedSnapshots, organizationSummary, recentActivity, roleFocus],
  );

  const initialLoading =
    session.isConfigured &&
    subscriptionQuery.isLoading &&
    connectionsQuery.isLoading &&
    forecastJobsQuery.isLoading &&
    approvalsQuery.isLoading &&
    purchaseOrdersQuery.isLoading;

  const adminError =
    plansQuery.error ??
    subscriptionQuery.error ??
    entitlementsQuery.error ??
    usageQuery.error ??
    membershipsQuery.error ??
    policiesQuery.error ??
    null;

  const operatorError =
    decisionsQuery.error ??
    approvalsQuery.error ??
    executionsQuery.error ??
    positionsQuery.error ??
    stockoutsQuery.error ??
    anomaliesQuery.error ??
    failedRecordsQuery.error ??
    null;

  const buyerError = purchaseOrdersQuery.error ?? suppliersQuery.error ?? null;

  const activityError =
    syncRunsQuery.error ??
    forecastJobsQuery.error ??
    salesImportRunsQuery.error ??
    auditTimelineQuery.error ??
    workerStatusQuery.error ??
    null;

  return {
    viewModel,
    sessionConfigured: session.isConfigured,
    initialLoading,
    adminError,
    operatorError,
    buyerError,
    activityError,
  };
};
