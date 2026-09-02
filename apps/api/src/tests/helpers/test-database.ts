import { PlanSubscriptionStatus, PrismaClient, RoleCode } from "@prisma/client";

import { ensureBillingPlans, ensurePlatformRoles } from "../../infrastructure/db/bootstrap-data.js";
import { DEFAULT_BILLING_PLAN_CODE } from "../../modules/billing/billing.constants.js";
import { normalizeEmail } from "../../shared/strings.js";
import { getTestDatabaseUrl } from "./test-config.js";

export const createTestPrismaClient = (): PrismaClient =>
  new PrismaClient({
    datasources: {
      db: {
        url: getTestDatabaseUrl(),
      },
    },
  });

export const resetDatabase = async (prisma: PrismaClient): Promise<void> => {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  `;

  if (tables.length > 0) {
    const tableList = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`);
  }

  await ensurePlatformRoles(prisma);
  await ensureBillingPlans(prisma);
};

export const createUser = async (
  prisma: PrismaClient,
  input: { email: string; displayName: string },
) =>
  prisma.user.create({
    data: {
      email: normalizeEmail(input.email),
      displayName: input.displayName,
    },
  });

export const createOrganizationWithMembership = async (
  prisma: PrismaClient,
  input: {
    name: string;
    slug: string;
    userId: string;
    roleCode: RoleCode;
  },
) => {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: input.roleCode },
  });

  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
  });

  await prisma.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId: input.userId,
      roleId: role.id,
    },
  });

  const starterPlan = await prisma.billingPlan.findFirstOrThrow({
    where: {
      code: DEFAULT_BILLING_PLAN_CODE,
      status: "active",
    },
    orderBy: [{ version: "desc" }, { updatedAt: "desc" }],
  });

  await prisma.planSubscription.create({
    data: {
      organizationId: organization.id,
      billingPlanId: starterPlan.id,
      status: PlanSubscriptionStatus.trialing,
      currentPeriodStart: new Date("2026-03-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
      createdByUserId: input.userId,
    },
  });

  return organization;
};

export const createMembership = async (
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    roleCode: RoleCode;
  },
) => {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: input.roleCode },
  });

  return prisma.organizationMembership.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      roleId: role.id,
    },
  });
};
