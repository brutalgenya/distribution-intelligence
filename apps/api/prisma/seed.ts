import "dotenv/config";

import { loadConfig } from "../src/infrastructure/config/env.js";
import { seedDemoTenant } from "../src/infrastructure/db/bootstrap-data.js";
import { createPrismaClient } from "../src/infrastructure/db/prisma.js";

const main = async (): Promise<void> => {
  const config = loadConfig(process.env);
  const prisma = createPrismaClient(config);

  try {
    await prisma.$connect();
    const result = await seedDemoTenant(prisma);
    console.log(
      JSON.stringify(
        {
          seeded: true,
          ownerUserId: result.ownerUserId,
          organizationId: result.organizationId,
          planSubscriptionId: result.planSubscriptionId,
          skuId: result.skuId,
          locationId: result.locationId,
          inventoryPositionId: result.inventoryPositionId,
          salesImportRunId: result.salesImportRunId,
          customerOrderId: result.customerOrderId,
          supplierId: result.supplierId,
          supplierSkuId: result.supplierSkuId,
          purchaseOrderId: result.purchaseOrderId,
          replenishmentPolicyId: result.replenishmentPolicyId,
          allocationPolicyId: result.allocationPolicyId,
          exceptionPolicyId: result.exceptionPolicyId,
          forecastEnhancementModelId: result.forecastEnhancementModelId,
          anomalyScoringModelId: result.anomalyScoringModelId,
          decisionExplanationModelId: result.decisionExplanationModelId,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
};

void main();
