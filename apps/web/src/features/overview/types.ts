import type {
  ActivationChecklistItem,
  ActivationSummary,
  BillingEntitlements,
  CommercialReadiness,
  DataReadiness,
  IntelligenceReadiness,
  NextBestAction,
  PlanSubscription,
} from "../activation/types";
import type {
  ApprovalRow,
  GovernanceFrictionSummary,
  InterventionPatternRow,
  OverrideRow,
} from "../approval-governance/types";
import type { BuyerPurchaseOrderQueueRow } from "../buyer-actions/types";
import type {
  AiRun,
  ConnectionRow,
  DataOpsHealthSummary,
  ForecastJob,
  ForecastResult,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  SalesImportRun,
} from "../data-ops/types";
import type { ConnectionRow as IntegrationConnectionRow, OnboardingReadinessSummary } from "../integrations/types";
import type { MetricCardItem, MetricTone, RiskHotspot, AnomalyHighlight } from "../outcomes/types";
import type { GovernanceSummary } from "../policies/types";
import type { PurchaseOrderQueueRow, SupplierCoverageRow } from "../supply-execution/types";
import type {
  SupportActionableItem,
  SupportActionSummaryCard,
} from "../support-actions/types";
import type {
  AdministrativeAuditItem,
  OrganizationMembership,
  TenantAdminSummary,
  PilotHandoffChecklistItem,
} from "../tenant-admin/types";
import type { WorkerStatus, SupportExecutionTask } from "../workflow/types";

export type {
  ActivationChecklistItem,
  ActivationSummary,
  BillingEntitlements,
  CommercialReadiness,
  DataReadiness,
  IntelligenceReadiness,
  PlanSubscription,
  ApprovalRow,
  GovernanceFrictionSummary,
  InterventionPatternRow,
  OverrideRow,
  BuyerPurchaseOrderQueueRow,
  AiRun,
  ConnectionRow,
  DataOpsHealthSummary,
  ForecastJob,
  ForecastResult,
  IntegrationConnectionRow,
  IntegrationFailedRecord,
  IntegrationSyncRun,
  OnboardingReadinessSummary,
  MetricCardItem,
  MetricTone,
  RiskHotspot,
  AnomalyHighlight,
  GovernanceSummary,
  PurchaseOrderQueueRow,
  SupplierCoverageRow,
  SupportActionableItem,
  SupportActionSummaryCard,
  AdministrativeAuditItem,
  OrganizationMembership,
  TenantAdminSummary,
  PilotHandoffChecklistItem,
  WorkerStatus,
  SupportExecutionTask,
  NextBestAction,
  SalesImportRun,
};

export type CommandCenterAudienceKey = "admin" | "operator" | "buyer";

export type CommandCenterRoleFocusKey = "admin" | "operator" | "shared";

export interface CommandCenterGlobalSummary {
  title: string;
  tone: MetricTone;
  helper: string;
  cards: MetricCardItem[];
  freshnessAt: string | null;
}

export interface CommandCenterRoleFocus {
  focus: CommandCenterRoleFocusKey;
  currentRoleLabel: string;
  orderedAudiences: CommandCenterAudienceKey[];
  title: string;
  helper: string;
}

export interface CommandCenterLink {
  label: string;
  href: string;
}

export interface CommandCenterSnapshot {
  key: CommandCenterAudienceKey;
  eyebrow: string;
  title: string;
  description: string;
  tone: MetricTone;
  cards: MetricCardItem[];
  highlights: string[];
  links: CommandCenterLink[];
  freshnessAt: string | null;
  currentRolePriority: boolean;
}

export interface CommandCenterActionItem {
  id: string;
  audience: CommandCenterAudienceKey | "shared";
  title: string;
  description: string;
  label: string;
  href: string;
  tone: MetricTone;
}

export interface CommandCenterRecentActivityItem {
  id: string;
  categoryLabel: string;
  title: string;
  description: string;
  timestamp: string;
  href: string | null;
  linkLabel: string | null;
  tone: MetricTone;
}

export interface CommandCenterViewModel {
  activationSummary: ActivationSummary;
  activationChecklist: ActivationChecklistItem[];
  activationNextAction: NextBestAction;
  onboardingReadiness: OnboardingReadinessSummary;
  dataHealthSummary: DataOpsHealthSummary;
  organizationSummary: TenantAdminSummary;
  governanceSummary: GovernanceSummary;
  governanceFrictionSummary: GovernanceFrictionSummary;
  globalSummary: CommandCenterGlobalSummary;
  roleFocus: CommandCenterRoleFocus;
  snapshots: Record<CommandCenterAudienceKey, CommandCenterSnapshot>;
  orderedSnapshots: CommandCenterSnapshot[];
  nextBestActions: CommandCenterActionItem[];
  recentActivity: CommandCenterRecentActivityItem[];
}
