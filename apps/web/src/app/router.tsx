import { Navigate, createBrowserRouter } from "react-router-dom";

import { AppShell } from "./layout/AppShell";
import { TenantActivationPage } from "../features/activation/pages/TenantActivationPage";
import { ApprovalGovernancePage } from "../features/approval-governance/pages/ApprovalGovernancePage";
import { BuyerActionsPage } from "../features/buyer-actions/pages/BuyerActionsPage";
import { DecisionInboxPage } from "../features/decisions/pages/DecisionInboxPage";
import { DataForecastOpsPage } from "../features/data-ops/pages/DataForecastOpsPage";
import { IntegrationsOnboardingPage } from "../features/integrations/pages/IntegrationsOnboardingPage";
import { InvestigationWorkspacePage } from "../features/investigation/pages/InvestigationWorkspacePage";
import { CommandCenterPage } from "../features/overview/pages/CommandCenterPage";
import { RiskAndOutcomesPage } from "../features/outcomes/pages/RiskAndOutcomesPage";
import { PolicyGovernancePage } from "../features/policies/pages/PolicyGovernancePage";
import { SupplyExecutionPage } from "../features/supply-execution/pages/SupplyExecutionPage";
import { SupportActionsPage } from "../features/support-actions/pages/SupportActionsPage";
import { TenantAdminPage } from "../features/tenant-admin/pages/TenantAdminPage";
import { WorkflowOperationsPage } from "../features/workflow/pages/WorkflowOperationsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/overview" replace />,
      },
      {
        path: "overview",
        element: <CommandCenterPage />,
      },
      {
        path: "decisions",
        element: <DecisionInboxPage />,
      },
      {
        path: "activation",
        element: <TenantActivationPage />,
      },
      {
        path: "tenant-admin",
        element: <TenantAdminPage />,
      },
      {
        path: "policies",
        element: <PolicyGovernancePage />,
      },
      {
        path: "approval-governance",
        element: <ApprovalGovernancePage />,
      },
      {
        path: "workflow",
        element: <WorkflowOperationsPage />,
      },
      {
        path: "outcomes",
        element: <RiskAndOutcomesPage />,
      },
      {
        path: "investigation",
        element: <InvestigationWorkspacePage />,
      },
      {
        path: "data-ops",
        element: <DataForecastOpsPage />,
      },
      {
        path: "support-actions",
        element: <SupportActionsPage />,
      },
      {
        path: "supply-execution",
        element: <SupplyExecutionPage />,
      },
      {
        path: "buyer-actions",
        element: <BuyerActionsPage />,
      },
      {
        path: "integrations",
        element: <IntegrationsOnboardingPage />,
      },
    ],
  },
]);
