-- Create enums
CREATE TYPE "SalesImportRunStatus" AS ENUM ('completed', 'failed');
CREATE TYPE "CustomerOrderStatus" AS ENUM ('open', 'cancelled');
CREATE TYPE "DemandSignalType" AS ENUM ('historical_sale', 'customer_order', 'customer_order_cancellation', 'manual_import');
CREATE TYPE "ForecastScopeType" AS ENUM ('sku', 'sku_location', 'organization');
CREATE TYPE "ForecastJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE "ForecastModelType" AS ENUM ('baseline_recent_average');

-- Create tables
CREATE TABLE "sales_import_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "status" "SalesImportRunStatus" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "acceptedRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL,
    "errorSummary" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "historical_sales" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "salesImportRunId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "rowFingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "historical_sales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_orders" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" "CustomerOrderStatus" NOT NULL DEFAULT 'open',
    "customerReference" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customer_order_lines" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "demand_signals" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID,
    "signalType" "DemandSignalType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_signals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_jobs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "ForecastJobStatus" NOT NULL DEFAULT 'pending',
    "requestedByUserId" UUID NOT NULL,
    "scopeType" "ForecastScopeType" NOT NULL,
    "scopeReference" JSONB,
    "horizonDays" INTEGER NOT NULL,
    "modelType" "ForecastModelType" NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "forecast_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_results" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "forecastJobId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "forecastQty" INTEGER NOT NULL,
    "confidenceLow" INTEGER,
    "confidenceHigh" INTEGER,
    "modelType" "ForecastModelType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forecast_results_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "sales_import_runs_organizationId_status_createdAt_idx"
    ON "sales_import_runs"("organizationId", "status", "createdAt");

CREATE UNIQUE INDEX "historical_sales_organizationId_rowFingerprint_key"
    ON "historical_sales"("organizationId", "rowFingerprint");
CREATE INDEX "historical_sales_organizationId_skuId_soldAt_idx"
    ON "historical_sales"("organizationId", "skuId", "soldAt");
CREATE INDEX "historical_sales_organizationId_locationId_soldAt_idx"
    ON "historical_sales"("organizationId", "locationId", "soldAt");
CREATE INDEX "historical_sales_organizationId_sourceType_sourceReference_idx"
    ON "historical_sales"("organizationId", "sourceType", "sourceReference");

CREATE UNIQUE INDEX "customer_orders_organizationId_orderNumber_key"
    ON "customer_orders"("organizationId", "orderNumber");
CREATE INDEX "customer_orders_organizationId_status_createdAt_idx"
    ON "customer_orders"("organizationId", "status", "createdAt");
CREATE INDEX "customer_orders_organizationId_orderedAt_idx"
    ON "customer_orders"("organizationId", "orderedAt");

CREATE INDEX "customer_order_lines_orderId_idx" ON "customer_order_lines"("orderId");
CREATE INDEX "customer_order_lines_skuId_idx" ON "customer_order_lines"("skuId");
CREATE INDEX "customer_order_lines_locationId_idx" ON "customer_order_lines"("locationId");

CREATE INDEX "demand_signals_organizationId_signalType_observedAt_idx"
    ON "demand_signals"("organizationId", "signalType", "observedAt");
CREATE INDEX "demand_signals_organizationId_skuId_observedAt_idx"
    ON "demand_signals"("organizationId", "skuId", "observedAt");
CREATE INDEX "demand_signals_organizationId_locationId_observedAt_idx"
    ON "demand_signals"("organizationId", "locationId", "observedAt");
CREATE INDEX "demand_signals_organizationId_createdAt_idx"
    ON "demand_signals"("organizationId", "createdAt");
CREATE INDEX "demand_signals_organizationId_sourceType_sourceReference_idx"
    ON "demand_signals"("organizationId", "sourceType", "sourceReference");

CREATE INDEX "forecast_jobs_organizationId_status_createdAt_idx"
    ON "forecast_jobs"("organizationId", "status", "createdAt");
CREATE INDEX "forecast_jobs_organizationId_modelType_createdAt_idx"
    ON "forecast_jobs"("organizationId", "modelType", "createdAt");

CREATE INDEX "forecast_results_forecastJobId_idx" ON "forecast_results"("forecastJobId");
CREATE INDEX "forecast_results_organizationId_forecastDate_idx"
    ON "forecast_results"("organizationId", "forecastDate");
CREATE INDEX "forecast_results_organizationId_skuId_forecastDate_idx"
    ON "forecast_results"("organizationId", "skuId", "forecastDate");
CREATE INDEX "forecast_results_organizationId_locationId_forecastDate_idx"
    ON "forecast_results"("organizationId", "locationId", "forecastDate");

-- Add foreign keys
ALTER TABLE "sales_import_runs"
    ADD CONSTRAINT "sales_import_runs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_import_runs"
    ADD CONSTRAINT "sales_import_runs_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "historical_sales"
    ADD CONSTRAINT "historical_sales_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historical_sales"
    ADD CONSTRAINT "historical_sales_salesImportRunId_fkey"
    FOREIGN KEY ("salesImportRunId") REFERENCES "sales_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historical_sales"
    ADD CONSTRAINT "historical_sales_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historical_sales"
    ADD CONSTRAINT "historical_sales_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_orders"
    ADD CONSTRAINT "customer_orders_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_orders"
    ADD CONSTRAINT "customer_orders_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_orders"
    ADD CONSTRAINT "customer_orders_cancelledByUserId_fkey"
    FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_order_lines"
    ADD CONSTRAINT "customer_order_lines_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_order_lines"
    ADD CONSTRAINT "customer_order_lines_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_order_lines"
    ADD CONSTRAINT "customer_order_lines_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "demand_signals"
    ADD CONSTRAINT "demand_signals_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_signals"
    ADD CONSTRAINT "demand_signals_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "demand_signals"
    ADD CONSTRAINT "demand_signals_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "forecast_jobs"
    ADD CONSTRAINT "forecast_jobs_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_jobs"
    ADD CONSTRAINT "forecast_jobs_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "forecast_results"
    ADD CONSTRAINT "forecast_results_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_results"
    ADD CONSTRAINT "forecast_results_forecastJobId_fkey"
    FOREIGN KEY ("forecastJobId") REFERENCES "forecast_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_results"
    ADD CONSTRAINT "forecast_results_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_results"
    ADD CONSTRAINT "forecast_results_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
