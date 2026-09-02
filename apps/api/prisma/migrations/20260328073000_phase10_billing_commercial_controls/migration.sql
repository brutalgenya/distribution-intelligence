CREATE TYPE "BillingPlanStatus" AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');
CREATE TYPE "PlanSubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'incomplete', 'unpaid');
CREATE TYPE "StripeEventProcessingStatus" AS ENUM ('pending', 'processed', 'failed');
CREATE TYPE "UsageMeterType" AS ENUM ('users', 'skus', 'forecast_jobs', 'ai_runs', 'executed_automation_actions');

CREATE TABLE "billing_plans" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "BillingPlanStatus" NOT NULL DEFAULT 'active',
  "stripePriceId" TEXT,
  "interval" "BillingInterval" NOT NULL,
  "maxUsers" INTEGER NOT NULL,
  "maxSkus" INTEGER NOT NULL,
  "maxForecastJobsPerPeriod" INTEGER NOT NULL,
  "maxAiRunsPerPeriod" INTEGER NOT NULL,
  "maxAutomationTier" "AutomationTier" NOT NULL,
  "integrationsEnabled" JSONB,
  "supportTier" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plan_subscriptions" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "billingPlanId" UUID NOT NULL,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "status" "PlanSubscriptionStatus" NOT NULL,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "lastStripeEventId" TEXT,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "plan_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "plan_subscriptions_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "plan_subscriptions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "stripe_event_logs" (
  "id" UUID NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "organizationId" UUID,
  "processingStatus" "StripeEventProcessingStatus" NOT NULL DEFAULT 'pending',
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stripe_event_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stripe_event_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "usage_meters" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "meterType" "UsageMeterType" NOT NULL,
  "usageValue" INTEGER NOT NULL,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usage_meters_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "billing_plans_stripePriceId_key" ON "billing_plans"("stripePriceId");
CREATE UNIQUE INDEX "billing_plans_code_version_key" ON "billing_plans"("code", "version");
CREATE INDEX "billing_plans_code_status_updatedAt_idx" ON "billing_plans"("code", "status", "updatedAt");

CREATE UNIQUE INDEX "plan_subscriptions_organizationId_key" ON "plan_subscriptions"("organizationId");
CREATE UNIQUE INDEX "plan_subscriptions_stripeCustomerId_key" ON "plan_subscriptions"("stripeCustomerId");
CREATE UNIQUE INDEX "plan_subscriptions_stripeSubscriptionId_key" ON "plan_subscriptions"("stripeSubscriptionId");
CREATE INDEX "plan_subscriptions_organizationId_status_idx" ON "plan_subscriptions"("organizationId", "status");
CREATE INDEX "plan_subscriptions_billingPlanId_updatedAt_idx" ON "plan_subscriptions"("billingPlanId", "updatedAt");

CREATE UNIQUE INDEX "stripe_event_logs_stripeEventId_key" ON "stripe_event_logs"("stripeEventId");
CREATE INDEX "stripe_event_logs_organizationId_createdAt_idx" ON "stripe_event_logs"("organizationId", "createdAt");
CREATE INDEX "stripe_event_logs_processingStatus_createdAt_idx" ON "stripe_event_logs"("processingStatus", "createdAt");

CREATE UNIQUE INDEX "usage_meters_organizationId_meterType_measurementWindowStart_measurem_key" ON "usage_meters"("organizationId", "meterType", "measurementWindowStart", "measurementWindowEnd");
CREATE INDEX "usage_meters_organizationId_meterType_measurementWindowEnd_idx" ON "usage_meters"("organizationId", "meterType", "measurementWindowEnd");
