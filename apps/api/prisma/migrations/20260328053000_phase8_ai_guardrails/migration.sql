CREATE TYPE "AiModelType" AS ENUM ('forecast_enhancement', 'anomaly_scoring', 'decision_explanation');
CREATE TYPE "ModelRegistryStatus" AS ENUM ('active', 'inactive', 'deprecated');
CREATE TYPE "AiRunType" AS ENUM ('forecast_enhancement', 'anomaly_scoring', 'decision_explanation');
CREATE TYPE "AiRunStatus" AS ENUM ('pending', 'succeeded', 'failed', 'degraded');
CREATE TYPE "AnomalySeverity" AS ENUM ('low', 'medium', 'high');

CREATE TABLE "model_registry_entries" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "modelType" "AiModelType" NOT NULL,
  "promptVersion" TEXT,
  "schemaVersion" TEXT NOT NULL,
  "status" "ModelRegistryStatus" NOT NULL DEFAULT 'inactive',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_registry_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_runs" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "modelRegistryEntryId" UUID NOT NULL,
  "runType" "AiRunType" NOT NULL,
  "status" "AiRunStatus" NOT NULL DEFAULT 'pending',
  "subjectType" TEXT NOT NULL,
  "subjectReference" TEXT NOT NULL,
  "inputChecksum" TEXT NOT NULL,
  "inputPayload" JSONB NOT NULL,
  "outputPayload" JSONB,
  "errorMessage" TEXT,
  "latencyMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enhanced_forecast_results" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "forecastJobId" UUID NOT NULL,
  "aiRunId" UUID NOT NULL,
  "modelRegistryEntryId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "locationId" UUID,
  "forecastDate" TIMESTAMP(3) NOT NULL,
  "baselineForecastQty" INTEGER NOT NULL,
  "enhancedForecastQty" INTEGER NOT NULL,
  "confidenceLow" INTEGER,
  "confidenceHigh" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "enhanced_forecast_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "anomaly_scores" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "aiRunId" UUID NOT NULL,
  "modelRegistryEntryId" UUID NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectReference" TEXT NOT NULL,
  "measurementWindowStart" TIMESTAMP(3) NOT NULL,
  "measurementWindowEnd" TIMESTAMP(3) NOT NULL,
  "anomalyScore" DOUBLE PRECISION NOT NULL,
  "severity" "AnomalySeverity" NOT NULL,
  "explanationSummary" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anomaly_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_explanations" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "decisionId" UUID NOT NULL,
  "aiRunId" UUID NOT NULL,
  "modelRegistryEntryId" UUID NOT NULL,
  "summary" TEXT NOT NULL,
  "explanationJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_explanations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "anomaly_scores_organizationId_modelRegistryEntryId_subjectType_subjectReference_measurementWindowStart_measurementWindowEnd_key"
  ON "anomaly_scores"("organizationId", "modelRegistryEntryId", "subjectType", "subjectReference", "measurementWindowStart", "measurementWindowEnd");
CREATE UNIQUE INDEX "decision_explanations_organizationId_decisionId_modelRegistryEntryId_key"
  ON "decision_explanations"("organizationId", "decisionId", "modelRegistryEntryId");

CREATE INDEX "model_registry_entries_modelType_status_updatedAt_idx"
  ON "model_registry_entries"("modelType", "status", "updatedAt");
CREATE INDEX "ai_runs_organizationId_runType_createdAt_idx"
  ON "ai_runs"("organizationId", "runType", "createdAt");
CREATE INDEX "ai_runs_organizationId_subjectType_subjectReference_createdAt_idx"
  ON "ai_runs"("organizationId", "subjectType", "subjectReference", "createdAt");
CREATE INDEX "ai_runs_modelRegistryEntryId_idx"
  ON "ai_runs"("modelRegistryEntryId");
CREATE INDEX "enhanced_forecast_results_organizationId_forecastJobId_forecastDate_idx"
  ON "enhanced_forecast_results"("organizationId", "forecastJobId", "forecastDate");
CREATE INDEX "enhanced_forecast_results_organizationId_skuId_locationId_forecastDate_idx"
  ON "enhanced_forecast_results"("organizationId", "skuId", "locationId", "forecastDate");
CREATE INDEX "enhanced_forecast_results_modelRegistryEntryId_idx"
  ON "enhanced_forecast_results"("modelRegistryEntryId");
CREATE INDEX "anomaly_scores_organizationId_subjectType_subjectReference_measurementWindowEnd_idx"
  ON "anomaly_scores"("organizationId", "subjectType", "subjectReference", "measurementWindowEnd");
CREATE INDEX "anomaly_scores_modelRegistryEntryId_idx"
  ON "anomaly_scores"("modelRegistryEntryId");
CREATE INDEX "decision_explanations_organizationId_decisionId_createdAt_idx"
  ON "decision_explanations"("organizationId", "decisionId", "createdAt");
CREATE INDEX "decision_explanations_modelRegistryEntryId_idx"
  ON "decision_explanations"("modelRegistryEntryId");

ALTER TABLE "ai_runs"
  ADD CONSTRAINT "ai_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_runs"
  ADD CONSTRAINT "ai_runs_modelRegistryEntryId_fkey"
  FOREIGN KEY ("modelRegistryEntryId") REFERENCES "model_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_forecastJobId_fkey"
  FOREIGN KEY ("forecastJobId") REFERENCES "forecast_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_aiRunId_fkey"
  FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_modelRegistryEntryId_fkey"
  FOREIGN KEY ("modelRegistryEntryId") REFERENCES "model_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enhanced_forecast_results"
  ADD CONSTRAINT "enhanced_forecast_results_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "anomaly_scores"
  ADD CONSTRAINT "anomaly_scores_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_scores"
  ADD CONSTRAINT "anomaly_scores_aiRunId_fkey"
  FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "anomaly_scores"
  ADD CONSTRAINT "anomaly_scores_modelRegistryEntryId_fkey"
  FOREIGN KEY ("modelRegistryEntryId") REFERENCES "model_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "decision_explanations"
  ADD CONSTRAINT "decision_explanations_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_explanations"
  ADD CONSTRAINT "decision_explanations_decisionId_fkey"
  FOREIGN KEY ("decisionId") REFERENCES "decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_explanations"
  ADD CONSTRAINT "decision_explanations_aiRunId_fkey"
  FOREIGN KEY ("aiRunId") REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decision_explanations"
  ADD CONSTRAINT "decision_explanations_modelRegistryEntryId_fkey"
  FOREIGN KEY ("modelRegistryEntryId") REFERENCES "model_registry_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
