ALTER TYPE "WorkerType" ADD VALUE 'integration';

CREATE TYPE "IntegrationType" AS ENUM ('erp', 'wms', 'csv_import', 'manual_bridge');
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('active', 'inactive', 'error');
CREATE TYPE "IntegrationDirection" AS ENUM ('inbound', 'outbound');
CREATE TYPE "IntegrationSyncType" AS ENUM ('catalog_import', 'demand_import', 'inventory_import');
CREATE TYPE "IntegrationSyncStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'partial');

CREATE TABLE "integration_connections" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "integrationType" "IntegrationType" NOT NULL,
  "name" TEXT NOT NULL,
  "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'active',
  "configJson" JSONB NOT NULL,
  "credentialsRef" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_sync_runs" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "integrationConnectionId" UUID NOT NULL,
  "requestedByUserId" UUID,
  "direction" "IntegrationDirection" NOT NULL,
  "syncType" "IntegrationSyncType" NOT NULL,
  "status" "IntegrationSyncStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "successCount" INTEGER NOT NULL DEFAULT 0,
  "failureCount" INTEGER NOT NULL DEFAULT 0,
  "checkpoint" JSONB,
  "errorSummary" JSONB,
  "inputPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_sync_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_failed_records" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "integrationConnectionId" UUID NOT NULL,
  "syncRunId" UUID,
  "recordType" TEXT NOT NULL,
  "sourceReference" TEXT,
  "payload" JSONB NOT NULL,
  "errorMessage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "integration_failed_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_source_records" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "integrationConnectionId" UUID NOT NULL,
  "syncRunId" UUID,
  "syncType" "IntegrationSyncType" NOT NULL,
  "recordType" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "payloadChecksum" TEXT NOT NULL,
  "canonicalEntityType" TEXT,
  "canonicalEntityId" TEXT,
  "firstProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastProcessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "integration_source_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "integration_connections_organizationId_integrationType_status_idx"
  ON "integration_connections"("organizationId", "integrationType", "status");
CREATE INDEX "integration_connections_organizationId_updatedAt_idx"
  ON "integration_connections"("organizationId", "updatedAt");

CREATE INDEX "integration_sync_runs_organizationId_integrationConnectionId_createdAt_idx"
  ON "integration_sync_runs"("organizationId", "integrationConnectionId", "createdAt");
CREATE INDEX "integration_sync_runs_organizationId_status_startedAt_idx"
  ON "integration_sync_runs"("organizationId", "status", "startedAt");

CREATE INDEX "integration_failed_records_organizationId_createdAt_idx"
  ON "integration_failed_records"("organizationId", "createdAt");
CREATE INDEX "integration_failed_records_organizationId_integrationConnectionId_createdAt_idx"
  ON "integration_failed_records"("organizationId", "integrationConnectionId", "createdAt");
CREATE INDEX "integration_failed_records_syncRunId_idx"
  ON "integration_failed_records"("syncRunId");

CREATE UNIQUE INDEX "integration_source_records_organizationId_integrationConnectionId_recordType_externalReference_key"
  ON "integration_source_records"("organizationId", "integrationConnectionId", "recordType", "externalReference");
CREATE INDEX "integration_source_records_organizationId_syncType_lastProcessedAt_idx"
  ON "integration_source_records"("organizationId", "syncType", "lastProcessedAt");
CREATE INDEX "integration_source_records_syncRunId_idx"
  ON "integration_source_records"("syncRunId");

ALTER TABLE "integration_connections"
  ADD CONSTRAINT "integration_connections_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "integration_sync_runs"
  ADD CONSTRAINT "integration_sync_runs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_runs"
  ADD CONSTRAINT "integration_sync_runs_integrationConnectionId_fkey"
  FOREIGN KEY ("integrationConnectionId") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_sync_runs"
  ADD CONSTRAINT "integration_sync_runs_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_failed_records"
  ADD CONSTRAINT "integration_failed_records_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_failed_records"
  ADD CONSTRAINT "integration_failed_records_integrationConnectionId_fkey"
  FOREIGN KEY ("integrationConnectionId") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_failed_records"
  ADD CONSTRAINT "integration_failed_records_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "integration_source_records"
  ADD CONSTRAINT "integration_source_records_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_source_records"
  ADD CONSTRAINT "integration_source_records_integrationConnectionId_fkey"
  FOREIGN KEY ("integrationConnectionId") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "integration_source_records"
  ADD CONSTRAINT "integration_source_records_syncRunId_fkey"
  FOREIGN KEY ("syncRunId") REFERENCES "integration_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
