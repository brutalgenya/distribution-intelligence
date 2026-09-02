CREATE TYPE "PolicyType" AS ENUM ('replenishment', 'allocation', 'exception');

CREATE TYPE "PolicyStatus" AS ENUM ('draft', 'active', 'archived');

CREATE TYPE "DecisionType" AS ENUM ('replenishment', 'allocation', 'exception');

CREATE TYPE "DecisionStatus" AS ENUM ('proposed', 'superseded', 'dismissed');

CREATE TYPE "AutomationTier" AS ENUM ('observe', 'recommend', 'draft_only', 'auto_execute');

CREATE TABLE "policies" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "policyType" "PolicyType" NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PolicyStatus" NOT NULL DEFAULT 'draft',
  "rulesJson" JSONB NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decisions" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionType" "DecisionType" NOT NULL,
  "status" "DecisionStatus" NOT NULL DEFAULT 'proposed',
  "automationTier" "AutomationTier" NOT NULL,
  "policyId" UUID NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "skuId" UUID,
  "locationId" UUID,
  "supplierId" UUID,
  "confidenceScore" DOUBLE PRECISION,
  "proposedPayload" JSONB NOT NULL,
  "rationale" JSONB NOT NULL,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_reasons" (
  "id" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decision_reasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_scores" (
  "id" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "metric" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decision_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_artifacts" (
  "id" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "artifactType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decision_artifacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policies_organizationId_policyType_version_key"
  ON "policies"("organizationId", "policyType", "version");

CREATE INDEX "policies_organizationId_policyType_status_updatedAt_idx"
  ON "policies"("organizationId", "policyType", "status", "updatedAt");

CREATE INDEX "decisions_organizationId_decisionType_status_createdAt_idx"
  ON "decisions"("organizationId", "decisionType", "status", "createdAt");

CREATE INDEX "decisions_organizationId_skuId_locationId_decisionType_idx"
  ON "decisions"("organizationId", "skuId", "locationId", "decisionType");

CREATE INDEX "decisions_policyId_idx"
  ON "decisions"("policyId");

CREATE INDEX "decision_reasons_decisionId_idx"
  ON "decision_reasons"("decisionId");

CREATE INDEX "decision_scores_decisionId_idx"
  ON "decision_scores"("decisionId");

CREATE INDEX "decision_artifacts_decisionId_idx"
  ON "decision_artifacts"("decisionId");

ALTER TABLE "policies"
  ADD CONSTRAINT "policies_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policies"
  ADD CONSTRAINT "policies_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "policies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decisions"
  ADD CONSTRAINT "decisions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "decision_reasons"
  ADD CONSTRAINT "decision_reasons_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_scores"
  ADD CONSTRAINT "decision_scores_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_artifacts"
  ADD CONSTRAINT "decision_artifacts_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
