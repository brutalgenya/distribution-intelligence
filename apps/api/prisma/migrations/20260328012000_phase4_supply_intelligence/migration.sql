CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');

CREATE TYPE "PurchaseOrderStatus" AS ENUM (
  'draft',
  'submitted',
  'partially_received',
  'received',
  'delayed',
  'cancelled'
);

CREATE TABLE "suppliers" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SupplierStatus" NOT NULL DEFAULT 'active',
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_skus" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "supplierSkuCode" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "minOrderQty" INTEGER NOT NULL DEFAULT 1,
  "casePackQty" INTEGER,
  "unitCost" DECIMAL(12,2),
  "leadTimeDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_skus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_lead_time_stats" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "sampleCount" INTEGER NOT NULL,
  "averageLeadTimeDays" DOUBLE PRECISION NOT NULL,
  "minLeadTimeDays" INTEGER NOT NULL,
  "maxLeadTimeDays" INTEGER NOT NULL,
  "lastObservedLeadTimeDays" INTEGER NOT NULL,
  "lastObservedAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_lead_time_stats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supplier_performance_snapshots" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "totalPurchaseOrders" INTEGER NOT NULL,
  "delayedPurchaseOrders" INTEGER NOT NULL,
  "receivedPurchaseOrders" INTEGER NOT NULL,
  "averageLeadTimeDays" DOUBLE PRECISION,
  "lastReceiptAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_performance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "poNumber" TEXT NOT NULL,
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'draft',
  "orderedAt" TIMESTAMP(3),
  "expectedDeliveryAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "currency" TEXT,
  "notes" TEXT,
  "wasEverDelayed" BOOLEAN NOT NULL DEFAULT false,
  "delayedAt" TIMESTAMP(3),
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_lines" (
  "id" UUID NOT NULL,
  "purchaseOrderId" UUID NOT NULL,
  "skuId" UUID NOT NULL,
  "quantityOrdered" INTEGER NOT NULL,
  "quantityReceived" INTEGER NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(12,2),
  "expectedLocationId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "suppliers_organizationId_code_key"
  ON "suppliers"("organizationId", "code");

CREATE INDEX "suppliers_organizationId_status_createdAt_idx"
  ON "suppliers"("organizationId", "status", "createdAt");

CREATE INDEX "suppliers_organizationId_updatedAt_idx"
  ON "suppliers"("organizationId", "updatedAt");

CREATE UNIQUE INDEX "supplier_skus_organizationId_supplierId_skuId_key"
  ON "supplier_skus"("organizationId", "supplierId", "skuId");

CREATE INDEX "supplier_skus_organizationId_supplierId_updatedAt_idx"
  ON "supplier_skus"("organizationId", "supplierId", "updatedAt");

CREATE INDEX "supplier_skus_organizationId_skuId_updatedAt_idx"
  ON "supplier_skus"("organizationId", "skuId", "updatedAt");

CREATE INDEX "supplier_skus_organizationId_skuId_isPrimary_idx"
  ON "supplier_skus"("organizationId", "skuId", "isPrimary");

CREATE UNIQUE INDEX "supplier_lead_time_stats_organizationId_supplierId_skuId_key"
  ON "supplier_lead_time_stats"("organizationId", "supplierId", "skuId");

CREATE INDEX "supplier_lead_time_stats_organizationId_supplierId_updatedAt_idx"
  ON "supplier_lead_time_stats"("organizationId", "supplierId", "updatedAt");

CREATE INDEX "supplier_lead_time_stats_organizationId_skuId_updatedAt_idx"
  ON "supplier_lead_time_stats"("organizationId", "skuId", "updatedAt");

CREATE UNIQUE INDEX "supplier_performance_snapshots_organizationId_supplierId_key"
  ON "supplier_performance_snapshots"("organizationId", "supplierId");

CREATE INDEX "supplier_performance_snapshots_organizationId_supplierId_updatedAt_idx"
  ON "supplier_performance_snapshots"("organizationId", "supplierId", "updatedAt");

CREATE UNIQUE INDEX "purchase_orders_organizationId_poNumber_key"
  ON "purchase_orders"("organizationId", "poNumber");

CREATE INDEX "purchase_orders_organizationId_status_createdAt_idx"
  ON "purchase_orders"("organizationId", "status", "createdAt");

CREATE INDEX "purchase_orders_organizationId_supplierId_status_idx"
  ON "purchase_orders"("organizationId", "supplierId", "status");

CREATE INDEX "purchase_orders_organizationId_orderedAt_idx"
  ON "purchase_orders"("organizationId", "orderedAt");

CREATE INDEX "purchase_order_lines_purchaseOrderId_idx"
  ON "purchase_order_lines"("purchaseOrderId");

CREATE INDEX "purchase_order_lines_skuId_idx"
  ON "purchase_order_lines"("skuId");

CREATE INDEX "purchase_order_lines_expectedLocationId_idx"
  ON "purchase_order_lines"("expectedLocationId");

ALTER TABLE "suppliers"
  ADD CONSTRAINT "suppliers_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_skus"
  ADD CONSTRAINT "supplier_skus_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_skus"
  ADD CONSTRAINT "supplier_skus_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_skus"
  ADD CONSTRAINT "supplier_skus_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_lead_time_stats"
  ADD CONSTRAINT "supplier_lead_time_stats_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_lead_time_stats"
  ADD CONSTRAINT "supplier_lead_time_stats_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_lead_time_stats"
  ADD CONSTRAINT "supplier_lead_time_stats_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_performance_snapshots"
  ADD CONSTRAINT "supplier_performance_snapshots_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "supplier_performance_snapshots"
  ADD CONSTRAINT "supplier_performance_snapshots_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_skuId_fkey"
  FOREIGN KEY ("skuId") REFERENCES "skus"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_lines"
  ADD CONSTRAINT "purchase_order_lines_expectedLocationId_fkey"
  FOREIGN KEY ("expectedLocationId") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
