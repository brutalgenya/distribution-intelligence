import { randomUUID } from "node:crypto";

import sensible from "@fastify/sensible";
import type { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyInstance, type RawServerDefault } from "fastify";

import { loadConfig, type AppConfig } from "./infrastructure/config/env.js";
import { ensureBillingPlans, ensurePlatformRoles } from "./infrastructure/db/bootstrap-data.js";
import { attachPrismaInstrumentation, createPrismaClient, PrismaTransactionRunner } from "./infrastructure/db/prisma.js";
import { registerErrorHandler } from "./infrastructure/http/error-handler.js";
import { authenticationMiddleware } from "./infrastructure/http/middleware/authentication.js";
import { createRateLimitMiddleware, InMemoryRateLimiter } from "./infrastructure/http/middleware/rate-limit.js";
import { registerAiRoutes } from "./infrastructure/http/routes/ai-routes.js";
import { registerBillingRoutes } from "./infrastructure/http/routes/billing-routes.js";
import { registerCatalogRoutes } from "./infrastructure/http/routes/catalog-routes.js";
import { registerDecisioningRoutes } from "./infrastructure/http/routes/decisioning-routes.js";
import { registerDemandRoutes } from "./infrastructure/http/routes/demand-routes.js";
import { registerForecastingRoutes } from "./infrastructure/http/routes/forecasting-routes.js";
import { registerHealthRoutes } from "./infrastructure/http/routes/health-routes.js";
import { registerIntegrationsRoutes } from "./infrastructure/http/routes/integrations-routes.js";
import { registerInventoryRoutes } from "./infrastructure/http/routes/inventory-routes.js";
import { registerInvitationRoutes } from "./infrastructure/http/routes/invitation-routes.js";
import {
  registerObservabilityRoutes,
  registerPublicObservabilityRoutes,
} from "./infrastructure/http/routes/observability-routes.js";
import { registerOrganizationRoutes } from "./infrastructure/http/routes/organization-routes.js";
import { registerOutcomesRoutes } from "./infrastructure/http/routes/outcomes-routes.js";
import { registerSupplyRoutes } from "./infrastructure/http/routes/supply-routes.js";
import { registerSupportRoutes } from "./infrastructure/http/routes/support-routes.js";
import { registerWorkflowRoutes } from "./infrastructure/http/routes/workflow-routes.js";
import { AppLogger } from "./infrastructure/logging/app-logger.js";
import { buildLoggerOptions, createAppLogger } from "./infrastructure/logging/logger.js";
import { setExecutionContext } from "./infrastructure/telemetry/execution-context.js";
import { InMemoryMetricsRegistry } from "./infrastructure/telemetry/metrics-registry.js";
import { TelemetryService } from "./infrastructure/telemetry/telemetry.service.js";
import { AiProviderRegistry } from "./modules/ai/ai-provider-registry.js";
import { AiRunRepository } from "./modules/ai/ai-run.repository.js";
import { AiRunService } from "./modules/ai/ai-run.service.js";
import { AnomalyScoreRepository } from "./modules/ai/anomaly-score.repository.js";
import { AnomalyScoringService } from "./modules/ai/anomaly-scoring.service.js";
import { DecisionExplanationRepository } from "./modules/ai/decision-explanation.repository.js";
import { DecisionExplanationService } from "./modules/ai/decision-explanation.service.js";
import { EnhancedForecastResultRepository } from "./modules/ai/enhanced-forecast-result.repository.js";
import { ForecastEnhancementService } from "./modules/ai/forecast-enhancement.service.js";
import { MockAiProvider } from "./modules/ai/mock-ai.provider.js";
import { ModelRegistryRepository } from "./modules/ai/model-registry.repository.js";
import { ModelRegistryService } from "./modules/ai/model-registry.service.js";
import { AuditEventRepository } from "./modules/audit/audit.repository.js";
import { AuthorizationService } from "./modules/authz/authz.service.js";
import { createBillingProvider } from "./modules/billing/billing-provider.factory.js";
import { BillingCheckoutService } from "./modules/billing/billing-checkout.service.js";
import { BillingEntitlementService } from "./modules/billing/billing-entitlement.service.js";
import { BillingPlanRepository } from "./modules/billing/billing-plan.repository.js";
import { BillingPlanService } from "./modules/billing/billing-plan.service.js";
import { BillingPortalService } from "./modules/billing/billing-portal.service.js";
import { PlanSubscriptionRepository } from "./modules/billing/plan-subscription.repository.js";
import { StripeEventLogRepository } from "./modules/billing/stripe-event-log.repository.js";
import { StripeWebhookService } from "./modules/billing/stripe-webhook.service.js";
import { UsageMeterRepository } from "./modules/billing/usage-meter.repository.js";
import { UsageMeterService } from "./modules/billing/usage-meter.service.js";
import { CatalogService } from "./modules/catalog/catalog.service.js";
import { SkuRepository } from "./modules/catalog/sku.repository.js";
import { AllocationDecisionService } from "./modules/decisioning/allocation-decision.service.js";
import { DecisionArtifactRepository } from "./modules/decisioning/decision-artifact.repository.js";
import { DecisionPersistenceService } from "./modules/decisioning/decision-persistence.service.js";
import { DecisionReadService } from "./modules/decisioning/decision-read.service.js";
import { DecisionReasonRepository } from "./modules/decisioning/decision-reason.repository.js";
import { DecisionRepository } from "./modules/decisioning/decision.repository.js";
import { DecisionScoreRepository } from "./modules/decisioning/decision-score.repository.js";
import { ExceptionDecisionService } from "./modules/decisioning/exception-decision.service.js";
import { PolicyRepository } from "./modules/decisioning/policy.repository.js";
import { PolicyService } from "./modules/decisioning/policy.service.js";
import { ReplenishmentDecisionService } from "./modules/decisioning/replenishment-decision.service.js";
import { CustomerOrderLineRepository } from "./modules/demand/customer-order-line.repository.js";
import { CustomerOrderRepository } from "./modules/demand/customer-order.repository.js";
import { CustomerOrderService } from "./modules/demand/customer-order.service.js";
import { DemandSignalRepository } from "./modules/demand/demand-signal.repository.js";
import { DemandSignalService } from "./modules/demand/demand-signal.service.js";
import { HistoricalSaleRepository } from "./modules/demand/historical-sale.repository.js";
import { SalesImportRunRepository } from "./modules/demand/sales-import.repository.js";
import { SalesImportService } from "./modules/demand/sales-import.service.js";
import { UserRepository } from "./modules/identity/user.repository.js";
import { CsvImportIntegrationAdapter } from "./modules/integrations/csv-import.integration-adapter.js";
import { FakeErpIntegrationAdapter } from "./modules/integrations/fake-erp.integration-adapter.js";
import { FakeWmsIntegrationAdapter } from "./modules/integrations/fake-wms.integration-adapter.js";
import { IntegrationAdapterRegistry } from "./modules/integrations/integration-adapter.registry.js";
import { IntegrationConnectionRepository } from "./modules/integrations/integration-connection.repository.js";
import { IntegrationConnectionService } from "./modules/integrations/integration-connection.service.js";
import { IntegrationFailedRecordRepository } from "./modules/integrations/integration-failed-record.repository.js";
import { IntegrationSourceRecordRepository } from "./modules/integrations/integration-source-record.repository.js";
import { IntegrationSyncRunRepository } from "./modules/integrations/integration-sync-run.repository.js";
import { IntegrationSyncService } from "./modules/integrations/integration-sync.service.js";
import { ManualBridgeIntegrationAdapter } from "./modules/integrations/manual-bridge.integration-adapter.js";
import { ExecutionAdapterRegistry } from "./modules/execution/execution-adapter-registry.js";
import { ExecutionAttemptRepository } from "./modules/execution/execution-attempt.repository.js";
import { ExecutionProcessorService } from "./modules/execution/execution-processor.service.js";
import { ExecutionTaskRepository } from "./modules/execution/execution-task.repository.js";
import { ExecutionTaskService } from "./modules/execution/execution-task.service.js";
import { IdempotencyKeyRepository } from "./modules/execution/idempotency-key.repository.js";
import { InternalNotificationExecutionAdapter } from "./modules/execution/internal-notification-execution.adapter.js";
import { InternalSupplyExecutionAdapter } from "./modules/execution/internal-supply-execution.adapter.js";
import { PurchaseOrderExecutionBridge } from "./modules/execution/purchase-order-execution-bridge.js";
import { BaselineForecastService } from "./modules/forecasting/baseline-forecast.service.js";
import { ForecastJobProcessorService } from "./modules/forecasting/forecast-job-processor.service.js";
import { ForecastJobRepository } from "./modules/forecasting/forecast-job.repository.js";
import { ForecastJobService } from "./modules/forecasting/forecast-job.service.js";
import { ForecastResultRepository } from "./modules/forecasting/forecast-result.repository.js";
import { InventoryMovementRepository } from "./modules/inventory/inventory-movement.repository.js";
import { InventoryPositionRepository } from "./modules/inventory/inventory-position.repository.js";
import { InventoryRecomputationService } from "./modules/inventory/inventory-recomputation.service.js";
import { InventoryReservationRepository } from "./modules/inventory/inventory-reservation.repository.js";
import { InventoryService } from "./modules/inventory/inventory.service.js";
import { InventoryTransferRepository } from "./modules/inventory/inventory-transfer.repository.js";
import { LocationRepository } from "./modules/inventory/location.repository.js";
import { LocationService } from "./modules/inventory/location.service.js";
import { OutboxEventRepository } from "./modules/outbox/outbox.repository.js";
import { DecisionOutcomeRepository } from "./modules/outcomes/decision-outcome.repository.js";
import { DecisionOutcomeService } from "./modules/outcomes/decision-outcome.service.js";
import { FillRateMeasurementRepository } from "./modules/outcomes/fill-rate-measurement.repository.js";
import { FillRateService } from "./modules/outcomes/fill-rate.service.js";
import { ForecastErrorMeasurementRepository } from "./modules/outcomes/forecast-error-measurement.repository.js";
import { ForecastErrorService } from "./modules/outcomes/forecast-error.service.js";
import { InventoryCostSnapshotRepository } from "./modules/outcomes/inventory-cost-snapshot.repository.js";
import { InventoryCostSnapshotService } from "./modules/outcomes/inventory-cost-snapshot.service.js";
import { InventoryHistoryService } from "./modules/outcomes/inventory-history.service.js";
import { OutcomesProcessingService } from "./modules/outcomes/outcomes-processing.service.js";
import { PolicyEffectivenessSummaryRepository } from "./modules/outcomes/policy-effectiveness-summary.repository.js";
import { PolicyEffectivenessService } from "./modules/outcomes/policy-effectiveness.service.js";
import { StockoutIncidentRepository } from "./modules/outcomes/stockout-incident.repository.js";
import { StockoutDetectionService } from "./modules/outcomes/stockout-detection.service.js";
import { ObservabilityService } from "./modules/observability/observability.service.js";
import { WorkerRunRepository } from "./modules/observability/worker-run.repository.js";
import { WorkerRunService } from "./modules/observability/worker-run.service.js";
import { PurchaseOrderLineRepository } from "./modules/supply/purchase-order-line.repository.js";
import { PurchaseOrderRepository } from "./modules/supply/purchase-order.repository.js";
import { PurchaseOrderService } from "./modules/supply/purchase-order.service.js";
import { SupplierLeadTimeStatRepository } from "./modules/supply/supplier-lead-time-stat.repository.js";
import { SupplierPerformanceSnapshotRepository } from "./modules/supply/supplier-performance.repository.js";
import { SupplierRepository } from "./modules/supply/supplier.repository.js";
import { SupplierService } from "./modules/supply/supplier.service.js";
import { SupplierSkuRepository } from "./modules/supply/supplier-sku.repository.js";
import { SupplierSkuService } from "./modules/supply/supplier-sku.service.js";
import { SupplyAnalyticsService } from "./modules/supply/supply-analytics.service.js";
import { SupportRepository } from "./modules/support/support.repository.js";
import { SupportService } from "./modules/support/support.service.js";
import { EntitlementRepository } from "./modules/tenancy/entitlement.repository.js";
import { InvitationService } from "./modules/tenancy/invitation.service.js";
import { OrganizationInvitationRepository } from "./modules/tenancy/invitation.repository.js";
import { OrganizationMembershipRepository } from "./modules/tenancy/membership.repository.js";
import { OrganizationRepository } from "./modules/tenancy/organization.repository.js";
import { OrganizationService } from "./modules/tenancy/organization.service.js";
import { RoleRepository } from "./modules/tenancy/role.repository.js";
import { ApprovalTaskRepository } from "./modules/workflow/approval-task.repository.js";
import { ApprovalTaskService } from "./modules/workflow/approval-task.service.js";
import { DecisionWorkflowService } from "./modules/workflow/decision-workflow.service.js";
import { OperatorOverrideRepository } from "./modules/workflow/operator-override.repository.js";
import { OperatorOverrideService } from "./modules/workflow/operator-override.service.js";
import { PayloadTooLargeError } from "./shared/errors.js";
import type { AppContainer } from "./shared/app-container.js";

export interface BuildAppOptions {
  config?: AppConfig;
  prisma?: PrismaClient;
}

const createContainer = (config: AppConfig, prisma: PrismaClient, logger: AppLogger): AppContainer => {
  const transactionRunner = new PrismaTransactionRunner(prisma);
  const metricsRegistry = new InMemoryMetricsRegistry();
  const telemetryService = new TelemetryService(metricsRegistry);

  const repositories = {
    aiRunRepository: new AiRunRepository(),
    anomalyScoreRepository: new AnomalyScoreRepository(),
    auditEventRepository: new AuditEventRepository(),
    approvalTaskRepository: new ApprovalTaskRepository(),
    billingPlanRepository: new BillingPlanRepository(),
    customerOrderLineRepository: new CustomerOrderLineRepository(),
    customerOrderRepository: new CustomerOrderRepository(),
    demandSignalRepository: new DemandSignalRepository(),
    decisionArtifactRepository: new DecisionArtifactRepository(),
    decisionOutcomeRepository: new DecisionOutcomeRepository(),
    decisionReasonRepository: new DecisionReasonRepository(),
    decisionRepository: new DecisionRepository(),
    decisionScoreRepository: new DecisionScoreRepository(),
    entitlementRepository: new EntitlementRepository(),
    executionAttemptRepository: new ExecutionAttemptRepository(),
    executionTaskRepository: new ExecutionTaskRepository(),
    decisionExplanationRepository: new DecisionExplanationRepository(),
    enhancedForecastResultRepository: new EnhancedForecastResultRepository(),
    fillRateMeasurementRepository: new FillRateMeasurementRepository(),
    forecastJobRepository: new ForecastJobRepository(),
    forecastErrorMeasurementRepository: new ForecastErrorMeasurementRepository(),
    forecastResultRepository: new ForecastResultRepository(),
    historicalSaleRepository: new HistoricalSaleRepository(),
    integrationConnectionRepository: new IntegrationConnectionRepository(),
    integrationFailedRecordRepository: new IntegrationFailedRecordRepository(),
    integrationSourceRecordRepository: new IntegrationSourceRecordRepository(),
    integrationSyncRunRepository: new IntegrationSyncRunRepository(),
    idempotencyKeyRepository: new IdempotencyKeyRepository(),
    inventoryCostSnapshotRepository: new InventoryCostSnapshotRepository(),
    inventoryMovementRepository: new InventoryMovementRepository(),
    inventoryPositionRepository: new InventoryPositionRepository(),
    inventoryReservationRepository: new InventoryReservationRepository(),
    inventoryTransferRepository: new InventoryTransferRepository(),
    invitationRepository: new OrganizationInvitationRepository(),
    locationRepository: new LocationRepository(),
    membershipRepository: new OrganizationMembershipRepository(),
    modelRegistryRepository: new ModelRegistryRepository(),
    organizationRepository: new OrganizationRepository(),
    operatorOverrideRepository: new OperatorOverrideRepository(),
    outboxEventRepository: new OutboxEventRepository(),
    policyRepository: new PolicyRepository(),
    policyEffectivenessSummaryRepository: new PolicyEffectivenessSummaryRepository(),
    planSubscriptionRepository: new PlanSubscriptionRepository(),
    purchaseOrderLineRepository: new PurchaseOrderLineRepository(),
    purchaseOrderRepository: new PurchaseOrderRepository(),
    roleRepository: new RoleRepository(),
    salesImportRunRepository: new SalesImportRunRepository(),
    skuRepository: new SkuRepository(),
    stockoutIncidentRepository: new StockoutIncidentRepository(),
    supplierLeadTimeStatRepository: new SupplierLeadTimeStatRepository(),
    supplierPerformanceSnapshotRepository: new SupplierPerformanceSnapshotRepository(),
    supplierRepository: new SupplierRepository(),
    supplierSkuRepository: new SupplierSkuRepository(),
    supportRepository: new SupportRepository(),
    stripeEventLogRepository: new StripeEventLogRepository(),
    userRepository: new UserRepository(),
    usageMeterRepository: new UsageMeterRepository(),
    workerRunRepository: new WorkerRunRepository(),
  };

  const authorizationService = new AuthorizationService(repositories.membershipRepository);
  const demandSignalService = new DemandSignalService(repositories.demandSignalRepository);
  const baselineForecastService = new BaselineForecastService();
  const billingProvider = createBillingProvider(config, telemetryService, logger.child({ module: "billing" }));
  const aiProviderRegistry = new AiProviderRegistry([new MockAiProvider()]);
  const integrationAdapterRegistry = new IntegrationAdapterRegistry([
    new FakeErpIntegrationAdapter(),
    new FakeWmsIntegrationAdapter(),
    new CsvImportIntegrationAdapter(),
    new ManualBridgeIntegrationAdapter(),
  ]);
  const usageMeterService = new UsageMeterService(
    prisma,
    repositories.membershipRepository,
    repositories.skuRepository,
    repositories.forecastJobRepository,
    repositories.aiRunRepository,
    repositories.executionTaskRepository,
    repositories.usageMeterRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const billingEntitlementService = new BillingEntitlementService(
    prisma,
    transactionRunner,
    repositories.billingPlanRepository,
    repositories.planSubscriptionRepository,
    usageMeterService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const billingPlanService = new BillingPlanService(
    prisma,
    repositories.billingPlanRepository,
    authorizationService,
  );
  const billingCheckoutService = new BillingCheckoutService(
    prisma,
    transactionRunner,
    repositories.billingPlanRepository,
    repositories.planSubscriptionRepository,
    billingEntitlementService,
    billingProvider,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "billing" }),
    config.BILLING_CHECKOUT_SUCCESS_URL,
    config.BILLING_CHECKOUT_CANCEL_URL,
    config.DEFAULT_TRIAL_PERIOD_DAYS,
  );
  const billingPortalService = new BillingPortalService(
    prisma,
    transactionRunner,
    repositories.planSubscriptionRepository,
    billingProvider,
    authorizationService,
    repositories.auditEventRepository,
    config.BILLING_PORTAL_RETURN_URL,
  );
  const stripeWebhookService = new StripeWebhookService(
    prisma,
    transactionRunner,
    repositories.billingPlanRepository,
    repositories.planSubscriptionRepository,
    repositories.stripeEventLogRepository,
    billingProvider,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "billing" }),
  );
  const modelRegistryService = new ModelRegistryService(
    prisma,
    transactionRunner,
    repositories.modelRegistryRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const aiRunService = new AiRunService(
    prisma,
    transactionRunner,
    repositories.aiRunRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "ai" }),
  );
  const decisionPersistenceService = new DecisionPersistenceService(
    repositories.decisionRepository,
    repositories.decisionReasonRepository,
    repositories.decisionScoreRepository,
    repositories.decisionArtifactRepository,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const inventoryRecomputationService = new InventoryRecomputationService(
    repositories.inventoryPositionRepository,
    repositories.inventoryMovementRepository,
    repositories.inventoryReservationRepository,
    repositories.inventoryTransferRepository,
    repositories.outboxEventRepository,
  );
  const inventoryHistoryService = new InventoryHistoryService(
    repositories.inventoryMovementRepository,
    repositories.inventoryReservationRepository,
    repositories.inventoryTransferRepository,
  );
  const inventoryService = new InventoryService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.inventoryPositionRepository,
    repositories.inventoryMovementRepository,
    repositories.inventoryReservationRepository,
    repositories.inventoryTransferRepository,
    authorizationService,
    inventoryRecomputationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const supplyAnalyticsService = new SupplyAnalyticsService(
    prisma,
    repositories.supplierRepository,
    repositories.purchaseOrderRepository,
    repositories.supplierLeadTimeStatRepository,
    repositories.supplierPerformanceSnapshotRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const policyService = new PolicyService(
    prisma,
    transactionRunner,
    repositories.policyRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const operatorOverrideService = new OperatorOverrideService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.executionTaskRepository,
    repositories.operatorOverrideRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const approvalTaskService = new ApprovalTaskService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.approvalTaskRepository,
    operatorOverrideService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "workflow" }),
  );
  const catalogService = new CatalogService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const customerOrderService = new CustomerOrderService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.customerOrderRepository,
    repositories.customerOrderLineRepository,
    demandSignalService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const decisionReadService = new DecisionReadService(
    prisma,
    repositories.decisionRepository,
    authorizationService,
  );
  const exceptionDecisionService = new ExceptionDecisionService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.inventoryPositionRepository,
    repositories.supplierRepository,
    repositories.supplierSkuRepository,
    repositories.supplierLeadTimeStatRepository,
    repositories.purchaseOrderRepository,
    repositories.forecastJobRepository,
    repositories.forecastResultRepository,
    policyService,
    decisionPersistenceService,
    authorizationService,
  );
  const forecastEnhancementService = new ForecastEnhancementService(
    prisma,
    transactionRunner,
    repositories.forecastJobRepository,
    repositories.forecastResultRepository,
    repositories.enhancedForecastResultRepository,
    modelRegistryService,
    aiRunService,
    aiProviderRegistry,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const forecastJobProcessorService = new ForecastJobProcessorService(
    prisma,
    transactionRunner,
    repositories.forecastJobRepository,
    repositories.forecastResultRepository,
    demandSignalService,
    baselineForecastService,
    forecastEnhancementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "forecasting" }),
  );
  const forecastJobService = new ForecastJobService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.forecastJobRepository,
    repositories.forecastResultRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "forecasting" }),
  );
  const invitationService = new InvitationService(
    transactionRunner,
    repositories.roleRepository,
    repositories.userRepository,
    repositories.membershipRepository,
    repositories.invitationRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    config.DEFAULT_INVITATION_TTL_HOURS,
  );
  const organizationService = new OrganizationService(
    prisma,
    transactionRunner,
    repositories.organizationRepository,
    repositories.roleRepository,
    repositories.membershipRepository,
    repositories.entitlementRepository,
    billingEntitlementService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    config.DEFAULT_TRIAL_PERIOD_DAYS,
  );
  const purchaseOrderService = new PurchaseOrderService(
    prisma,
    transactionRunner,
    repositories.supplierRepository,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.purchaseOrderRepository,
    repositories.purchaseOrderLineRepository,
    inventoryService,
    supplyAnalyticsService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const replenishmentDecisionService = new ReplenishmentDecisionService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.inventoryPositionRepository,
    repositories.supplierRepository,
    repositories.supplierSkuRepository,
    repositories.supplierLeadTimeStatRepository,
    repositories.purchaseOrderRepository,
    repositories.forecastJobRepository,
    repositories.forecastResultRepository,
    policyService,
    decisionPersistenceService,
    authorizationService,
  );
  const locationService = new LocationService(
    prisma,
    transactionRunner,
    repositories.locationRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const integrationConnectionService = new IntegrationConnectionService(
    prisma,
    transactionRunner,
    repositories.integrationConnectionRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const salesImportService = new SalesImportService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.salesImportRunRepository,
    repositories.historicalSaleRepository,
    demandSignalService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const integrationSyncService = new IntegrationSyncService(
    prisma,
    transactionRunner,
    repositories.integrationConnectionRepository,
    repositories.integrationSyncRunRepository,
    repositories.integrationFailedRecordRepository,
    repositories.integrationSourceRecordRepository,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.customerOrderRepository,
    repositories.customerOrderLineRepository,
    repositories.salesImportRunRepository,
    repositories.historicalSaleRepository,
    repositories.inventoryPositionRepository,
    demandSignalService,
    inventoryService,
    billingEntitlementService,
    integrationAdapterRegistry,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "integrations" }),
  );
  const anomalyScoringService = new AnomalyScoringService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.demandSignalRepository,
    repositories.anomalyScoreRepository,
    modelRegistryService,
    aiRunService,
    aiProviderRegistry,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const decisionExplanationService = new DecisionExplanationService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.decisionExplanationRepository,
    modelRegistryService,
    aiRunService,
    aiProviderRegistry,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const stockoutDetectionService = new StockoutDetectionService(
    prisma,
    transactionRunner,
    repositories.demandSignalRepository,
    repositories.stockoutIncidentRepository,
    inventoryHistoryService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const fillRateService = new FillRateService(
    prisma,
    transactionRunner,
    repositories.customerOrderRepository,
    repositories.historicalSaleRepository,
    repositories.fillRateMeasurementRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const forecastErrorService = new ForecastErrorService(
    prisma,
    transactionRunner,
    repositories.forecastResultRepository,
    repositories.historicalSaleRepository,
    repositories.forecastErrorMeasurementRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const inventoryCostSnapshotService = new InventoryCostSnapshotService(
    inventoryHistoryService,
    repositories.supplierSkuRepository,
    repositories.inventoryCostSnapshotRepository,
    repositories.auditEventRepository,
  );
  const decisionOutcomeService = new DecisionOutcomeService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.executionTaskRepository,
    repositories.historicalSaleRepository,
    repositories.forecastJobRepository,
    fillRateService,
    forecastErrorService,
    stockoutDetectionService,
    inventoryCostSnapshotService,
    inventoryHistoryService,
    repositories.decisionOutcomeRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const policyEffectivenessService = new PolicyEffectivenessService(
    prisma,
    transactionRunner,
    repositories.policyRepository,
    repositories.decisionRepository,
    repositories.decisionOutcomeRepository,
    repositories.forecastErrorMeasurementRepository,
    repositories.operatorOverrideRepository,
    repositories.policyEffectivenessSummaryRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const supplierService = new SupplierService(
    prisma,
    transactionRunner,
    repositories.supplierRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const supplierSkuService = new SupplierSkuService(
    prisma,
    transactionRunner,
    repositories.supplierRepository,
    repositories.skuRepository,
    repositories.supplierSkuRepository,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const allocationDecisionService = new AllocationDecisionService(
    prisma,
    transactionRunner,
    repositories.skuRepository,
    repositories.locationRepository,
    repositories.inventoryPositionRepository,
    repositories.customerOrderRepository,
    policyService,
    decisionPersistenceService,
    authorizationService,
  );
  const purchaseOrderExecutionBridge = new PurchaseOrderExecutionBridge(
    repositories.purchaseOrderRepository,
    purchaseOrderService,
  );
  const executionAdapterRegistry = new ExecutionAdapterRegistry([
    new InternalSupplyExecutionAdapter(purchaseOrderExecutionBridge),
    new InternalNotificationExecutionAdapter(),
  ]);
  const executionTaskService = new ExecutionTaskService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.executionTaskRepository,
    repositories.idempotencyKeyRepository,
    operatorOverrideService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
  );
  const decisionWorkflowService = new DecisionWorkflowService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    approvalTaskService,
    executionTaskService,
    operatorOverrideService,
    authorizationService,
  );
  const executionProcessorService = new ExecutionProcessorService(
    prisma,
    transactionRunner,
    repositories.decisionRepository,
    repositories.executionTaskRepository,
    repositories.executionAttemptRepository,
    repositories.idempotencyKeyRepository,
    executionAdapterRegistry,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "execution" }),
  );
  const outcomesProcessingService = new OutcomesProcessingService(
    prisma,
    repositories.organizationRepository,
    stockoutDetectionService,
    fillRateService,
    forecastErrorService,
    decisionOutcomeService,
    policyEffectivenessService,
    telemetryService,
    logger.child({ module: "outcomes" }),
  );
  const workerRunService = new WorkerRunService(
    prisma,
    repositories.workerRunRepository,
    telemetryService,
    logger.child({ module: "observability" }),
  );
  const observabilityService = new ObservabilityService(
    config,
    prisma,
    telemetryService,
    repositories.workerRunRepository,
    repositories.forecastJobRepository,
    repositories.executionTaskRepository,
    repositories.integrationSyncRunRepository,
    authorizationService,
  );
  const supportService = new SupportService(
    prisma,
    transactionRunner,
    repositories.supportRepository,
    repositories.forecastJobRepository,
    repositories.workerRunRepository,
    executionTaskService,
    outcomesProcessingService,
    authorizationService,
    repositories.auditEventRepository,
    repositories.outboxEventRepository,
    telemetryService,
    logger.child({ module: "support" }),
  );

  const services = {
    aiRunService,
    allocationDecisionService,
    anomalyScoringService,
    approvalTaskService,
    authorizationService,
    billingCheckoutService,
    billingEntitlementService,
    billingPlanService,
    billingPortalService,
    baselineForecastService,
    catalogService,
    customerOrderService,
    demandSignalService,
    decisionExplanationService,
    decisionOutcomeService,
    decisionReadService,
    decisionWorkflowService,
    executionProcessorService,
    executionTaskService,
    exceptionDecisionService,
    fillRateService,
    forecastJobProcessorService,
    forecastJobService,
    forecastErrorService,
    forecastEnhancementService,
    integrationConnectionService,
    integrationSyncService,
    inventoryCostSnapshotService,
    inventoryHistoryService,
    inventoryRecomputationService,
    inventoryService,
    invitationService,
    locationService,
    modelRegistryService,
    operatorOverrideService,
    observabilityService,
    outcomesProcessingService,
    organizationService,
    policyService,
    policyEffectivenessService,
    purchaseOrderService,
    replenishmentDecisionService,
    salesImportService,
    stockoutDetectionService,
    stripeWebhookService,
    supportService,
    supplierService,
    supplierSkuService,
    supplyAnalyticsService,
    telemetryService,
    usageMeterService,
    workerRunService,
  };

  return {
    config,
    prisma,
    transactionRunner,
    logger,
    metricsRegistry,
    telemetryService,
    integrationAdapterRegistry,
    repositories,
    services,
  };
};

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const config = options.config ?? loadConfig(process.env);
  const prisma = options.prisma ?? createPrismaClient(config);
  const rootLogger = createAppLogger(config);
  const logger = new AppLogger(rootLogger);
  const container = createContainer(config, prisma, logger);
  attachPrismaInstrumentation(prisma, container.telemetryService, container.logger);

  await prisma.$connect();
  await ensurePlatformRoles(prisma);
  await ensureBillingPlans(prisma);

  const app: FastifyInstance<RawServerDefault> = Fastify<RawServerDefault>({
    logger: buildLoggerOptions(config),
    bodyLimit: config.HTTP_BODY_LIMIT_BYTES,
    requestTimeout: config.HTTP_REQUEST_TIMEOUT_MS,
    connectionTimeout: config.HTTP_CONNECTION_TIMEOUT_MS,
    keepAliveTimeout: config.HTTP_KEEP_ALIVE_TIMEOUT_MS,
    disableRequestLogging: true,
  });
  app.decorate("container", container);
  const rateLimiter = new InMemoryRateLimiter();

  await app.register(sensible);
  await registerHealthRoutes(app);
  await registerPublicObservabilityRoutes(app);

  app.addHook("onRequest", async (request) => {
    const contentLengthHeader = request.headers["content-length"];
    const contentLength =
      typeof contentLengthHeader === "string" && contentLengthHeader.length > 0
        ? Number(contentLengthHeader)
        : null;
    if (contentLength !== null && Number.isFinite(contentLength) && contentLength > config.HTTP_BODY_LIMIT_BYTES) {
      throw new PayloadTooLargeError("Request payload exceeds the configured HTTP body limit.", {
        contentLength,
        limit: config.HTTP_BODY_LIMIT_BYTES,
      });
    }

    request.observabilityStartTimeNs = process.hrtime.bigint();
    const rawCorrelationId = request.headers["x-correlation-id"];
    const rawTraceId = request.headers["x-trace-id"];
    const correlationId =
      typeof rawCorrelationId === "string" && rawCorrelationId.length > 0 ? rawCorrelationId : randomUUID();
    const traceId = typeof rawTraceId === "string" && rawTraceId.length > 0 ? rawTraceId : null;

    setExecutionContext({
      correlationId,
      requestId: request.id,
      traceId,
    });

    container.telemetryService.incrementCounter("http.request.count", 1, {
      method: request.method,
      route: request.url,
    });
    request.log.info(
      {
        correlationId,
        requestId: request.id,
        traceId,
        method: request.method,
        path: request.url,
      },
      "HTTP request started.",
    );
  });

  app.addHook("preHandler", authenticationMiddleware);
  app.addHook("preHandler", createRateLimitMiddleware(rateLimiter, config));
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("permissions-policy", "geolocation=(), microphone=(), camera=()");
    return payload;
  });
  app.addHook("onResponse", async (request, reply) => {
    const durationMs = request.observabilityStartTimeNs
      ? Number(process.hrtime.bigint() - request.observabilityStartTimeNs) / 1_000_000
      : 0;

    container.telemetryService.recordDuration("http.request.duration_ms", durationMs, {
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
    });
    request.log.info(
      {
        correlationId: request.requestContext?.correlationId ?? null,
        requestId: request.requestContext?.requestId ?? request.id,
        traceId: request.requestContext?.traceId ?? null,
        organizationId: request.requestContext?.activeOrganizationId ?? null,
        userId: request.requestContext?.user.id ?? null,
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        durationMs,
      },
      "HTTP request completed.",
    );
  });
  registerErrorHandler(app, config);

  await registerAiRoutes(app);
  await registerBillingRoutes(app);
  await registerCatalogRoutes(app);
  await registerDecisioningRoutes(app);
  await registerDemandRoutes(app);
  await registerForecastingRoutes(app);
  await registerIntegrationsRoutes(app);
  await registerInventoryRoutes(app);
  await registerOrganizationRoutes(app);
  await registerInvitationRoutes(app);
  await registerObservabilityRoutes(app);
  await registerOutcomesRoutes(app);
  await registerSupportRoutes(app);
  await registerSupplyRoutes(app);
  await registerWorkflowRoutes(app);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });

  return app;
};
