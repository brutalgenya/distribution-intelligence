import {
  AiModelType,
  AutomationTier,
  CustomerOrderStatus,
  DemandSignalType,
  PlanSubscriptionStatus,
  ModelRegistryStatus,
  PolicyStatus,
  PolicyType,
  Prisma,
  PrismaClient,
  PurchaseOrderStatus,
  RoleCode,
  SupplierStatus,
} from "@prisma/client";

import type { DbClient } from "./types.js";
import { DEFAULT_ORGANIZATION_ENTITLEMENTS } from "../../shared/defaults.js";
import { normalizeEmail } from "../../shared/strings.js";
import {
  DEFAULT_BILLING_PLAN_DEFINITIONS,
  DEFAULT_DEMO_BILLING_PLAN_CODE,
} from "../../modules/billing/billing.constants.js";

const PLATFORM_ROLES: Array<{ code: RoleCode; name: string; description: string }> = [
  { code: RoleCode.owner, name: "Owner", description: "Full tenant control" },
  { code: RoleCode.admin, name: "Admin", description: "Can manage users and organization data" },
  { code: RoleCode.operator, name: "Operator", description: "Operational read access across the tenant" },
  { code: RoleCode.viewer, name: "Viewer", description: "Read-only tenant access" },
];

export const ensurePlatformRoles = async (db: DbClient): Promise<void> => {
  await Promise.all(
    PLATFORM_ROLES.map((role) =>
      db.role.upsert({
        where: { code: role.code },
        update: {
          name: role.name,
          description: role.description,
        },
        create: role,
      }),
    ),
  );
};

export const ensureBillingPlans = async (db: DbClient): Promise<void> => {
  await Promise.all(
    DEFAULT_BILLING_PLAN_DEFINITIONS.map((billingPlan) =>
      db.billingPlan.upsert({
        where: {
          code_version: {
            code: billingPlan.code,
            version: billingPlan.version,
          },
        },
        update: {
          name: billingPlan.name,
          status: billingPlan.status,
          stripePriceId: billingPlan.stripePriceId,
          interval: billingPlan.interval,
          maxUsers: billingPlan.maxUsers,
          maxSkus: billingPlan.maxSkus,
          maxForecastJobsPerPeriod: billingPlan.maxForecastJobsPerPeriod,
          maxAiRunsPerPeriod: billingPlan.maxAiRunsPerPeriod,
          maxAutomationTier: billingPlan.maxAutomationTier,
          integrationsEnabled: billingPlan.integrationsEnabled,
          supportTier: billingPlan.supportTier,
          metadata: {
            seeded: true,
          },
        },
        create: {
          code: billingPlan.code,
          name: billingPlan.name,
          version: billingPlan.version,
          status: billingPlan.status,
          stripePriceId: billingPlan.stripePriceId,
          interval: billingPlan.interval,
          maxUsers: billingPlan.maxUsers,
          maxSkus: billingPlan.maxSkus,
          maxForecastJobsPerPeriod: billingPlan.maxForecastJobsPerPeriod,
          maxAiRunsPerPeriod: billingPlan.maxAiRunsPerPeriod,
          maxAutomationTier: billingPlan.maxAutomationTier,
          integrationsEnabled: billingPlan.integrationsEnabled,
          supportTier: billingPlan.supportTier,
          metadata: {
            seeded: true,
          },
        },
      }),
    ),
  );
};

export interface DemoSeedResult {
  ownerUserId: string;
  organizationId: string;
  planSubscriptionId: string;
  skuId: string;
  locationId: string;
  inventoryPositionId: string;
  salesImportRunId: string;
  customerOrderId: string;
  supplierId: string;
  supplierSkuId: string;
  purchaseOrderId: string;
  replenishmentPolicyId: string;
  allocationPolicyId: string;
  exceptionPolicyId: string;
  forecastEnhancementModelId: string;
  anomalyScoringModelId: string;
  decisionExplanationModelId: string;
}

const DEMO_SALES_IMPORT_RUN_ID = "00000000-0000-0000-0000-00000000d001";

const seedDemoOperationalState = async (
  prisma: PrismaClient,
  input: {
    organizationId: string;
    ownerUserId: string;
    skuId: string;
    locationId: string;
    supplierId: string;
  },
) => {
  const salesImportRun = await prisma.salesImportRun.upsert({
    where: {
      id: DEMO_SALES_IMPORT_RUN_ID,
    },
    update: {
      organizationId: input.organizationId,
      createdByUserId: input.ownerUserId,
      status: "completed",
      totalRows: 3,
      acceptedRows: 3,
      duplicateRows: 0,
      rejectedRows: 0,
      startedAt: new Date("2026-03-20T08:00:00.000Z"),
      completedAt: new Date("2026-03-20T08:01:00.000Z"),
      errorSummary: Prisma.JsonNull,
    },
    create: {
      id: DEMO_SALES_IMPORT_RUN_ID,
      organizationId: input.organizationId,
      createdByUserId: input.ownerUserId,
      status: "completed",
      totalRows: 3,
      acceptedRows: 3,
      duplicateRows: 0,
      rejectedRows: 0,
      startedAt: new Date("2026-03-20T08:00:00.000Z"),
      completedAt: new Date("2026-03-20T08:01:00.000Z"),
      errorSummary: Prisma.JsonNull,
    },
  });

  const historicalSales = [
    {
      rowFingerprint: "demo-sale-2026-03-20",
      sourceReference: "demo-sale-001",
      soldAt: new Date("2026-03-20T10:00:00.000Z"),
      quantity: 14,
    },
    {
      rowFingerprint: "demo-sale-2026-03-21",
      sourceReference: "demo-sale-002",
      soldAt: new Date("2026-03-21T10:00:00.000Z"),
      quantity: 16,
    },
    {
      rowFingerprint: "demo-sale-2026-03-22",
      sourceReference: "demo-sale-003",
      soldAt: new Date("2026-03-22T10:00:00.000Z"),
      quantity: 18,
    },
  ] as const;

  for (const historicalSale of historicalSales) {
    await prisma.historicalSale.upsert({
      where: {
        organizationId_rowFingerprint: {
          organizationId: input.organizationId,
          rowFingerprint: historicalSale.rowFingerprint,
        },
      },
      update: {
        salesImportRunId: salesImportRun.id,
        skuId: input.skuId,
        locationId: input.locationId,
        quantity: historicalSale.quantity,
        soldAt: historicalSale.soldAt,
        sourceType: "demo_bootstrap",
        sourceReference: historicalSale.sourceReference,
      },
      create: {
        organizationId: input.organizationId,
        salesImportRunId: salesImportRun.id,
        skuId: input.skuId,
        locationId: input.locationId,
        quantity: historicalSale.quantity,
        soldAt: historicalSale.soldAt,
        sourceType: "demo_bootstrap",
        sourceReference: historicalSale.sourceReference,
        rowFingerprint: historicalSale.rowFingerprint,
      },
    });
  }

  const customerOrder = await prisma.customerOrder.upsert({
    where: {
      organizationId_orderNumber: {
        organizationId: input.organizationId,
        orderNumber: "DEMO-ORDER-001",
      },
    },
    update: {
      status: CustomerOrderStatus.open,
      customerReference: "DEMO-CUSTOMER-001",
      orderedAt: new Date("2026-03-28T09:00:00.000Z"),
      createdByUserId: input.ownerUserId,
      cancelledAt: null,
      cancelledByUserId: null,
      lines: {
        deleteMany: {},
        create: [
          {
            skuId: input.skuId,
            locationId: input.locationId,
            quantity: 22,
            unitPrice: new Prisma.Decimal("29.99"),
          },
        ],
      },
    },
    create: {
      organizationId: input.organizationId,
      orderNumber: "DEMO-ORDER-001",
      status: CustomerOrderStatus.open,
      customerReference: "DEMO-CUSTOMER-001",
      orderedAt: new Date("2026-03-28T09:00:00.000Z"),
      createdByUserId: input.ownerUserId,
      lines: {
        create: [
          {
            skuId: input.skuId,
            locationId: input.locationId,
            quantity: 22,
            unitPrice: new Prisma.Decimal("29.99"),
          },
        ],
      },
    },
    include: {
      lines: true,
    },
  });

  await prisma.demandSignal.deleteMany({
    where: {
      organizationId: input.organizationId,
      sourceReference: {
        in: [...historicalSales.map((sale) => sale.sourceReference), customerOrder.orderNumber],
      },
    },
  });

  await prisma.demandSignal.createMany({
    data: [
      ...historicalSales.map((historicalSale) => ({
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        signalType: DemandSignalType.historical_sale,
        quantity: historicalSale.quantity,
        observedAt: historicalSale.soldAt,
        sourceType: "demo_bootstrap",
        sourceReference: historicalSale.sourceReference,
        metadata: {
          demo: true,
        } satisfies Prisma.InputJsonObject,
      })),
      {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
        signalType: DemandSignalType.customer_order,
        quantity: 22,
        observedAt: new Date("2026-03-28T09:00:00.000Z"),
        sourceType: "demo_bootstrap",
        sourceReference: customerOrder.orderNumber,
        metadata: {
          demo: true,
        } satisfies Prisma.InputJsonObject,
      },
    ],
  });

  const inventoryPosition = await prisma.inventoryPosition.upsert({
    where: {
      organizationId_skuId_locationId: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        locationId: input.locationId,
      },
    },
    update: {
      onHandQty: 96,
      reservedQty: 6,
      inTransitQty: 12,
      availableToPromiseQty: 102,
      safetyStockQty: 20,
      reorderPointQty: 40,
    },
    create: {
      organizationId: input.organizationId,
      skuId: input.skuId,
      locationId: input.locationId,
      onHandQty: 96,
      reservedQty: 6,
      inTransitQty: 12,
      availableToPromiseQty: 102,
      safetyStockQty: 20,
      reorderPointQty: 40,
    },
  });

  const purchaseOrder = await prisma.purchaseOrder.upsert({
    where: {
      organizationId_poNumber: {
        organizationId: input.organizationId,
        poNumber: "DEMO-PO-001",
      },
    },
    update: {
      supplierId: input.supplierId,
      status: PurchaseOrderStatus.submitted,
      orderedAt: new Date("2026-03-24T12:00:00.000Z"),
      expectedDeliveryAt: new Date("2026-03-31T12:00:00.000Z"),
      receivedAt: null,
      currency: "GBP",
      notes: "Seeded demo purchase order for launch-readiness bootstrap.",
      createdByUserId: input.ownerUserId,
      lines: {
        deleteMany: {},
        create: [
          {
            skuId: input.skuId,
            quantityOrdered: 48,
            quantityReceived: 0,
            unitCost: new Prisma.Decimal("18.50"),
            expectedLocationId: input.locationId,
          },
        ],
      },
    },
    create: {
      organizationId: input.organizationId,
      supplierId: input.supplierId,
      poNumber: "DEMO-PO-001",
      status: PurchaseOrderStatus.submitted,
      orderedAt: new Date("2026-03-24T12:00:00.000Z"),
      expectedDeliveryAt: new Date("2026-03-31T12:00:00.000Z"),
      currency: "GBP",
      notes: "Seeded demo purchase order for launch-readiness bootstrap.",
      createdByUserId: input.ownerUserId,
      lines: {
        create: [
          {
            skuId: input.skuId,
            quantityOrdered: 48,
            quantityReceived: 0,
            unitCost: new Prisma.Decimal("18.50"),
            expectedLocationId: input.locationId,
          },
        ],
      },
    },
    include: {
      lines: true,
    },
  });

  return {
    inventoryPositionId: inventoryPosition.id,
    salesImportRunId: salesImportRun.id,
    customerOrderId: customerOrder.id,
    purchaseOrderId: purchaseOrder.id,
  };
};

export const seedDemoTenant = async (prisma: PrismaClient): Promise<DemoSeedResult> => {
  await ensurePlatformRoles(prisma);
  await ensureBillingPlans(prisma);

  const ownerRole = await prisma.role.findUniqueOrThrow({
    where: { code: RoleCode.owner },
  });

  const owner = await prisma.user.upsert({
    where: { email: normalizeEmail("owner@demo.wholesale-ai.local") },
    update: {
      displayName: "Demo Owner",
    },
    create: {
      email: normalizeEmail("owner@demo.wholesale-ai.local"),
      displayName: "Demo Owner",
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "demo-wholesale" },
    update: {
      name: "Demo Wholesale AI",
    },
    create: {
      name: "Demo Wholesale AI",
      slug: "demo-wholesale",
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: owner.id,
      },
    },
    update: {
      roleId: ownerRole.id,
    },
    create: {
      organizationId: organization.id,
      userId: owner.id,
      roleId: ownerRole.id,
    },
  });

  await Promise.all(
    DEFAULT_ORGANIZATION_ENTITLEMENTS.map((entitlement) =>
      prisma.entitlement.upsert({
        where: {
          organizationId_key: {
            organizationId: organization.id,
            key: entitlement.key,
          },
        },
        update: {
          value: entitlement.value,
        },
        create: {
          organizationId: organization.id,
          key: entitlement.key,
          value: entitlement.value,
        },
      }),
    ),
  );

  const demoBillingPlan = await prisma.billingPlan.findFirstOrThrow({
    where: {
      code: DEFAULT_DEMO_BILLING_PLAN_CODE,
      status: "active",
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });

  const currentPeriodStart = new Date();
  const currentPeriodEnd = new Date(currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000);

  const planSubscription = await prisma.planSubscription.upsert({
    where: {
      organizationId: organization.id,
    },
    update: {
      billingPlanId: demoBillingPlan.id,
      status: PlanSubscriptionStatus.active,
      currentPeriodStart,
      currentPeriodEnd,
      stripeCustomerId: "cus_demo_wholesale",
      stripeSubscriptionId: "sub_demo_wholesale",
      cancelAtPeriodEnd: false,
      createdByUserId: owner.id,
    },
    create: {
      organizationId: organization.id,
      billingPlanId: demoBillingPlan.id,
      status: PlanSubscriptionStatus.active,
      currentPeriodStart,
      currentPeriodEnd,
      stripeCustomerId: "cus_demo_wholesale",
      stripeSubscriptionId: "sub_demo_wholesale",
      cancelAtPeriodEnd: false,
      createdByUserId: owner.id,
    },
  });

  const sku = await prisma.sku.upsert({
    where: {
      organizationId_skuCode: {
        organizationId: organization.id,
        skuCode: "DEMO-SKU-001",
      },
    },
    update: {
      name: "Demo Inventory SKU",
      description: "Seeded SKU for exercising Phase 2 inventory flows",
      baseUom: "each",
      packSize: 1,
      metadata: {
        seeded: true,
      },
    },
    create: {
      organizationId: organization.id,
      skuCode: "DEMO-SKU-001",
      name: "Demo Inventory SKU",
      description: "Seeded SKU for exercising Phase 2 inventory flows",
      baseUom: "each",
      packSize: 1,
      metadata: {
        seeded: true,
      },
    },
  });

  const location = await prisma.location.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "MAIN",
      },
    },
    update: {
      name: "Main Warehouse",
      type: "warehouse",
    },
    create: {
      organizationId: organization.id,
      code: "MAIN",
      name: "Main Warehouse",
      type: "warehouse",
    },
  });

  const supplier = await prisma.supplier.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: "DEMO-SUP-001",
      },
    },
    update: {
      name: "Demo Supply Co",
      status: SupplierStatus.active,
      contactEmail: "purchasing@demo-supply.local",
      metadata: {
        seeded: true,
      },
    },
    create: {
      organizationId: organization.id,
      code: "DEMO-SUP-001",
      name: "Demo Supply Co",
      status: SupplierStatus.active,
      contactEmail: "purchasing@demo-supply.local",
      metadata: {
        seeded: true,
      },
    },
  });

  const supplierSku = await prisma.supplierSku.upsert({
    where: {
      organizationId_supplierId_skuId: {
        organizationId: organization.id,
        supplierId: supplier.id,
        skuId: sku.id,
      },
    },
    update: {
      supplierSkuCode: "SUP-DEMO-SKU-001",
      isPrimary: true,
      minOrderQty: 1,
      casePackQty: 12,
      unitCost: new Prisma.Decimal("18.50"),
      leadTimeDays: 7,
    },
    create: {
      organizationId: organization.id,
      supplierId: supplier.id,
      skuId: sku.id,
      supplierSkuCode: "SUP-DEMO-SKU-001",
      isPrimary: true,
      minOrderQty: 1,
      casePackQty: 12,
      unitCost: new Prisma.Decimal("18.50"),
      leadTimeDays: 7,
    },
  });

  const replenishmentPolicy = await prisma.policy.upsert({
    where: {
      organizationId_policyType_version: {
        organizationId: organization.id,
        policyType: PolicyType.replenishment,
        version: 1,
      },
    },
    update: {
      name: "Demo Replenishment Policy",
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        forecastHorizonDays: 14,
        targetDaysOfCover: 14,
        leadTimeBufferDays: 1,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      },
    },
    create: {
      organizationId: organization.id,
      policyType: PolicyType.replenishment,
      name: "Demo Replenishment Policy",
      version: 1,
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        forecastHorizonDays: 14,
        targetDaysOfCover: 14,
        leadTimeBufferDays: 1,
        defaultLeadTimeDays: 7,
        useSafetyStock: true,
        shortageBufferQty: 0,
        demandSpikeMultiplier: 2,
      },
      createdByUserId: owner.id,
    },
  });

  const allocationPolicy = await prisma.policy.upsert({
    where: {
      organizationId_policyType_version: {
        organizationId: organization.id,
        policyType: PolicyType.allocation,
        version: 1,
      },
    },
    update: {
      name: "Demo Allocation Policy",
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        shortageThresholdQty: 1,
        prioritizationMode: "oldest_order_first",
        maxAffectedOrders: 20,
      },
    },
    create: {
      organizationId: organization.id,
      policyType: PolicyType.allocation,
      name: "Demo Allocation Policy",
      version: 1,
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.recommend,
        shortageThresholdQty: 1,
        prioritizationMode: "oldest_order_first",
        maxAffectedOrders: 20,
      },
      createdByUserId: owner.id,
    },
  });

  const exceptionPolicy = await prisma.policy.upsert({
    where: {
      organizationId_policyType_version: {
        organizationId: organization.id,
        policyType: PolicyType.exception,
        version: 1,
      },
    },
    update: {
      name: "Demo Exception Policy",
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.observe,
        forecastHorizonDays: 14,
        leadTimeDriftThresholdDays: 3,
        demandSpikeMultiplier: 2,
        stockoutRiskCoverDays: 3,
      },
    },
    create: {
      organizationId: organization.id,
      policyType: PolicyType.exception,
      name: "Demo Exception Policy",
      version: 1,
      status: PolicyStatus.active,
      rulesJson: {
        automationTier: AutomationTier.observe,
        forecastHorizonDays: 14,
        leadTimeDriftThresholdDays: 3,
        demandSpikeMultiplier: 2,
        stockoutRiskCoverDays: 3,
      },
      createdByUserId: owner.id,
    },
  });

  const forecastEnhancementModel = await prisma.modelRegistryEntry.upsert({
    where: {
      id: "00000000-0000-0000-0000-00000000a801",
    },
    update: {
      provider: "mock",
      modelName: "mock-forecast-enhancer",
      modelVersion: "v1",
      modelType: AiModelType.forecast_enhancement,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
    create: {
      id: "00000000-0000-0000-0000-00000000a801",
      provider: "mock",
      modelName: "mock-forecast-enhancer",
      modelVersion: "v1",
      modelType: AiModelType.forecast_enhancement,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
  });

  const anomalyScoringModel = await prisma.modelRegistryEntry.upsert({
    where: {
      id: "00000000-0000-0000-0000-00000000a802",
    },
    update: {
      provider: "mock",
      modelName: "mock-anomaly-scorer",
      modelVersion: "v1",
      modelType: AiModelType.anomaly_scoring,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
    create: {
      id: "00000000-0000-0000-0000-00000000a802",
      provider: "mock",
      modelName: "mock-anomaly-scorer",
      modelVersion: "v1",
      modelType: AiModelType.anomaly_scoring,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
  });

  const decisionExplanationModel = await prisma.modelRegistryEntry.upsert({
    where: {
      id: "00000000-0000-0000-0000-00000000a803",
    },
    update: {
      provider: "mock",
      modelName: "mock-decision-explainer",
      modelVersion: "v1",
      modelType: AiModelType.decision_explanation,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
    create: {
      id: "00000000-0000-0000-0000-00000000a803",
      provider: "mock",
      modelName: "mock-decision-explainer",
      modelVersion: "v1",
      modelType: AiModelType.decision_explanation,
      promptVersion: "seed-v1",
      schemaVersion: "2026-03-28",
      status: ModelRegistryStatus.active,
    },
  });

  const demoOperationalState = await seedDemoOperationalState(prisma, {
    organizationId: organization.id,
    ownerUserId: owner.id,
    skuId: sku.id,
    locationId: location.id,
    supplierId: supplier.id,
  });

  return {
    ownerUserId: owner.id,
    organizationId: organization.id,
    planSubscriptionId: planSubscription.id,
    skuId: sku.id,
    locationId: location.id,
    inventoryPositionId: demoOperationalState.inventoryPositionId,
    salesImportRunId: demoOperationalState.salesImportRunId,
    customerOrderId: demoOperationalState.customerOrderId,
    supplierId: supplier.id,
    supplierSkuId: supplierSku.id,
    purchaseOrderId: demoOperationalState.purchaseOrderId,
    replenishmentPolicyId: replenishmentPolicy.id,
    allocationPolicyId: allocationPolicy.id,
    exceptionPolicyId: exceptionPolicy.id,
    forecastEnhancementModelId: forecastEnhancementModel.id,
    anomalyScoringModelId: anomalyScoringModel.id,
    decisionExplanationModelId: decisionExplanationModel.id,
  };
};
