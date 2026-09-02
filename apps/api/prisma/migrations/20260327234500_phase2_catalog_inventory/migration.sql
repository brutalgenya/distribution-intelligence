-- Create enums
CREATE TYPE "SkuStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "LocationType" AS ENUM ('warehouse', 'store', 'staging', 'transit');
CREATE TYPE "LocationStatus" AS ENUM ('active', 'inactive');
CREATE TYPE "InventoryMovementType" AS ENUM (
    'receipt',
    'adjustment',
    'reservation',
    'reservation_release',
    'transfer_out',
    'transfer_in'
);
CREATE TYPE "InventoryReservationStatus" AS ENUM ('active', 'released');
CREATE TYPE "InventoryTransferStatus" AS ENUM ('requested', 'completed');

-- Create tables
CREATE TABLE "skus" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUom" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "status" "SkuStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationType" NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_positions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "onHandQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "inTransitQty" INTEGER NOT NULL DEFAULT 0,
    "availableToPromiseQty" INTEGER NOT NULL DEFAULT 0,
    "safetyStockQty" INTEGER NOT NULL DEFAULT 0,
    "reorderPointQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "movementType" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'active',
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transfers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "skuId" UUID NOT NULL,
    "sourceLocationId" UUID NOT NULL,
    "destinationLocationId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'requested',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "requestedByUserId" UUID NOT NULL,
    "completedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE UNIQUE INDEX "skus_organizationId_skuCode_key" ON "skus"("organizationId", "skuCode");
CREATE INDEX "skus_organizationId_status_idx" ON "skus"("organizationId", "status");
CREATE INDEX "skus_organizationId_createdAt_idx" ON "skus"("organizationId", "createdAt");

CREATE UNIQUE INDEX "locations_organizationId_code_key" ON "locations"("organizationId", "code");
CREATE INDEX "locations_organizationId_status_idx" ON "locations"("organizationId", "status");
CREATE INDEX "locations_organizationId_createdAt_idx" ON "locations"("organizationId", "createdAt");

CREATE UNIQUE INDEX "inventory_positions_organizationId_skuId_locationId_key"
    ON "inventory_positions"("organizationId", "skuId", "locationId");
CREATE INDEX "inventory_positions_organizationId_updatedAt_idx" ON "inventory_positions"("organizationId", "updatedAt");
CREATE INDEX "inventory_positions_organizationId_skuId_idx" ON "inventory_positions"("organizationId", "skuId");
CREATE INDEX "inventory_positions_organizationId_locationId_idx" ON "inventory_positions"("organizationId", "locationId");

CREATE INDEX "inventory_movements_organizationId_createdAt_idx" ON "inventory_movements"("organizationId", "createdAt");
CREATE INDEX "inventory_movements_organizationId_skuId_locationId_createdAt_idx"
    ON "inventory_movements"("organizationId", "skuId", "locationId", "createdAt");
CREATE INDEX "inventory_movements_organizationId_referenceType_referenceId_idx"
    ON "inventory_movements"("organizationId", "referenceType", "referenceId");

CREATE INDEX "inventory_reservations_organizationId_status_createdAt_idx"
    ON "inventory_reservations"("organizationId", "status", "createdAt");
CREATE INDEX "inventory_reservations_organizationId_skuId_locationId_status_idx"
    ON "inventory_reservations"("organizationId", "skuId", "locationId", "status");
CREATE INDEX "inventory_reservations_organizationId_referenceType_referenceId_idx"
    ON "inventory_reservations"("organizationId", "referenceType", "referenceId");

CREATE INDEX "inventory_transfers_organizationId_status_createdAt_idx"
    ON "inventory_transfers"("organizationId", "status", "createdAt");
CREATE INDEX "inventory_transfers_organizationId_skuId_status_idx"
    ON "inventory_transfers"("organizationId", "skuId", "status");
CREATE INDEX "inventory_transfers_organizationId_sourceLocationId_status_idx"
    ON "inventory_transfers"("organizationId", "sourceLocationId", "status");
CREATE INDEX "inventory_transfers_organizationId_destinationLocationId_status_idx"
    ON "inventory_transfers"("organizationId", "destinationLocationId", "status");

-- Add foreign keys
ALTER TABLE "skus"
    ADD CONSTRAINT "skus_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_positions"
    ADD CONSTRAINT "inventory_positions_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_positions"
    ADD CONSTRAINT "inventory_positions_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_positions"
    ADD CONSTRAINT "inventory_positions_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements"
    ADD CONSTRAINT "inventory_movements_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_reservations"
    ADD CONSTRAINT "inventory_reservations_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_skuId_fkey"
    FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_sourceLocationId_fkey"
    FOREIGN KEY ("sourceLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_destinationLocationId_fkey"
    FOREIGN KEY ("destinationLocationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_requestedByUserId_fkey"
    FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers"
    ADD CONSTRAINT "inventory_transfers_completedByUserId_fkey"
    FOREIGN KEY ("completedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
