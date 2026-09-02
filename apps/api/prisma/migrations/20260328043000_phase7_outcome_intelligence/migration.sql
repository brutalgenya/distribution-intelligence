CREATE TYPE "DecisionOutcomeStatus" AS ENUM ('pending', 'computed', 'insufficient_data');
CREATE TYPE "OutcomeScopeType" AS ENUM ('organization', 'sku_location');

CREATE TABLE "decision_outcomes" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "executionTaskId" UUID,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "outcomeStatus" "DecisionOutcomeStatus" NOT NULL DEFAULT 'pending',
  "stockoutAvoided" BOOLEAN,
  "fillRateDelta" DOUBLE PRECISION,
  "inventoryDaysDelta" DOUBLE PRECISION,
  "holdingCostDelta" DOUBLE PRECISION,
  "expediteCostDelta" DOUBLE PRECISION,
  "summaryJson" JSONB NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stockout_incidents" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL,
  "incidentStartAt" TIMESTAMP(3) NOT NULL,
  "incidentEndAt" TIMESTAMP(3),
  "severity" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stockout_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fill_rate_measurements" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "skuId" UUID,
  "locationId" UUID,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "orderedQty" INTEGER NOT NULL,
  "fulfilledQty" INTEGER NOT NULL,
  "fillRate" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fill_rate_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_error_measurements" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "forecastJobId" UUID,
  "skuId" UUID NOT NULL,
  "locationId" UUID,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "actualQty" INTEGER NOT NULL,
  "forecastQty" INTEGER NOT NULL,
  "absoluteError" INTEGER NOT NULL,
  "percentageError" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forecast_error_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_cost_snapshots" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "skuId" UUID,
  "locationId" UUID,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "holdingCostEstimate" DOUBLE PRECISION,
  "expediteCostEstimate" DOUBLE PRECISION,
  "carryingDays" INTEGER,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_cost_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "policy_effectiveness_summaries" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "policyId" UUID NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "scopeType" "OutcomeScopeType" NOT NULL,
  "scopeReference" TEXT,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "decisionCount" INTEGER NOT NULL,
  "executedDecisionCount" INTEGER NOT NULL,
  "stockoutAvoidanceRate" DOUBLE PRECISION,
  "averageFillRateDelta" DOUBLE PRECISION,
  "averageForecastError" DOUBLE PRECISION,
  "overrideRate" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_effectiveness_summaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "do_scope_window_uq"
  ON "decision_outcomes"("organizationId", "decisionId", "measurementWindowStart", "measurementWindowEnd");
CREATE UNIQUE INDEX "si_scope_start_source_uq"
  ON "stockout_incidents"("organizationId", "skuId", "locationId", "incidentStartAt", "sourceType");
CREATE UNIQUE INDEX "frm_scope_window_uq"
  ON "fill_rate_measurements"("organizationId", "skuId", "locationId", "measurementWindowStart", "measurementWindowEnd");
CREATE UNIQUE INDEX "fem_scope_window_uq"
  ON "forecast_error_measurements"("organizationId", "forecastJobId", "skuId", "locationId", "measurementWindowStart", "measurementWindowEnd");
CREATE UNIQUE INDEX "ics_scope_snapshot_uq"
  ON "inventory_cost_snapshots"("organizationId", "skuId", "locationId", "snapshotAt");
CREATE UNIQUE INDEX "pes_policy_scope_window_uq"
  ON "policy_effectiveness_summaries"("organizationId", "policyId", "policyVersion", "scopeType", "measurementWindowStart", "measurementWindowEnd");

CREATE INDEX "do_decision_idx"
  ON "decision_outcomes"("organizationId", "decisionId");
CREATE INDEX "do_window_end_idx"
  ON "decision_outcomes"("organizationId", "measurementWindowEnd");

CREATE INDEX "si_detected_idx"
  ON "stockout_incidents"("organizationId", "detectedAt");
CREATE INDEX "si_scope_end_idx"
  ON "stockout_incidents"("organizationId", "skuId", "locationId", "incidentEndAt");

CREATE INDEX "frm_scope_window_end_idx"
  ON "fill_rate_measurements"("organizationId", "skuId", "locationId", "measurementWindowEnd");

CREATE INDEX "fem_job_idx"
  ON "forecast_error_measurements"("organizationId", "forecastJobId");
CREATE INDEX "fem_scope_window_end_idx"
  ON "forecast_error_measurements"("organizationId", "skuId", "locationId", "measurementWindowEnd");

CREATE INDEX "ics_org_snapshot_idx"
  ON "inventory_cost_snapshots"("organizationId", "snapshotAt");
CREATE INDEX "ics_scope_snapshot_idx"
  ON "inventory_cost_snapshots"("organizationId", "skuId", "locationId", "snapshotAt");

CREATE INDEX "pes_policy_window_end_idx"
  ON "policy_effectiveness_summaries"("organizationId", "policyId", "measurementWindowEnd");

ALTER TABLE "decision_outcomes"
  ADD CONSTRAINT "decision_outcomes_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_outcomes"
  ADD CONSTRAINT "decision_outcomes_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_outcomes"
  ADD CONSTRAINT "decision_outcomes_executionTaskId_fkey"
  FOREIGN KEY ("executionTaskId") REFERENCES "execution_tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stockout_incidents"
  ADD CONSTRAINT "stockout_incidents_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stockout_incidents"
  ADD CONSTRAINT "stockout_incidents_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stockout_incidents"
  ADD CONSTRAINT "stockout_incidents_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fill_rate_measurements"
  ADD CONSTRAINT "fill_rate_measurements_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fill_rate_measurements"
  ADD CONSTRAINT "fill_rate_measurements_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fill_rate_measurements"
  ADD CONSTRAINT "fill_rate_measurements_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forecast_error_measurements"
  ADD CONSTRAINT "forecast_error_measurements_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_error_measurements"
  ADD CONSTRAINT "forecast_error_measurements_forecastJobId_fkey"
  FOREIGN KEY ("forecastJobId") REFERENCES "forecast_jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "forecast_error_measurements"
  ADD CONSTRAINT "forecast_error_measurements_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_error_measurements"
  ADD CONSTRAINT "forecast_error_measurements_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_cost_snapshots"
  ADD CONSTRAINT "inventory_cost_snapshots_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_snapshots"
  ADD CONSTRAINT "inventory_cost_snapshots_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_snapshots"
  ADD CONSTRAINT "inventory_cost_snapshots_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "policy_effectiveness_summaries"
  ADD CONSTRAINT "policy_effectiveness_summaries_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_effectiveness_summaries"
  ADD CONSTRAINT "policy_effectiveness_summaries_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "policies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
