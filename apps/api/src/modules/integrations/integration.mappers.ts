import type { Prisma } from "@prisma/client";

import { BadRequestError } from "../../shared/errors.js";
import type { ExternalIntegrationRecord } from "./integration.schemas.js";

export interface CanonicalCatalogSkuRecord {
  kind: "catalog_sku";
  externalReference: string;
  skuCode: string;
  name: string;
  description?: string;
  baseUom: string;
  packSize: number;
  status: "active" | "inactive";
  metadata?: Prisma.InputJsonObject;
}

export interface CanonicalLocationRecord {
  kind: "location";
  externalReference: string;
  code: string;
  name: string;
  type: "warehouse" | "store" | "staging" | "transit";
  status: "active" | "inactive";
}

export interface CanonicalCustomerOrderRecord {
  kind: "customer_order";
  externalReference: string;
  orderNumber: string;
  customerReference?: string;
  orderedAt: string;
  lines: Array<{
    skuCode: string;
    locationCode: string;
    quantity: number;
    unitPrice?: number;
  }>;
}

export interface CanonicalHistoricalSaleRecord {
  kind: "historical_sale";
  externalReference: string;
  skuCode: string;
  locationCode: string;
  quantity: number;
  soldAt: string;
  sourceType: string;
}

export interface CanonicalInventorySnapshotRecord {
  kind: "inventory_snapshot";
  externalReference: string;
  skuCode: string;
  locationCode: string;
  onHandQty: number;
}

export type CanonicalCatalogRecord = CanonicalCatalogSkuRecord | CanonicalLocationRecord;
export type CanonicalDemandRecord = CanonicalCustomerOrderRecord | CanonicalHistoricalSaleRecord;
export type CanonicalInventoryRecord = CanonicalLocationRecord | CanonicalInventorySnapshotRecord;

export const mapCatalogRecord = (record: ExternalIntegrationRecord): CanonicalCatalogRecord => {
  switch (record.kind) {
    case "catalog_sku":
      return {
        kind: "catalog_sku",
        externalReference: record.sourceReference,
        skuCode: record.payload.skuCode,
        name: record.payload.name,
        ...(record.payload.description ? { description: record.payload.description } : {}),
        baseUom: record.payload.baseUom,
        packSize: record.payload.packSize,
        status: record.payload.status,
        ...(record.payload.metadata ? { metadata: record.payload.metadata } : {}),
      };
    case "location":
      return {
        kind: "location",
        externalReference: record.sourceReference,
        code: record.payload.code,
        name: record.payload.name,
        type: record.payload.type,
        status: record.payload.status,
      };
    default:
      throw new BadRequestError(`Record kind ${record.kind} cannot be processed in catalog syncs.`);
  }
};

export const mapDemandRecord = (record: ExternalIntegrationRecord): CanonicalDemandRecord => {
  switch (record.kind) {
    case "customer_order":
      return {
        kind: "customer_order",
        externalReference: record.sourceReference,
        orderNumber: record.payload.orderNumber,
        ...(record.payload.customerReference ? { customerReference: record.payload.customerReference } : {}),
        orderedAt: record.payload.orderedAt,
        lines: record.payload.lines.map((line) => ({
          skuCode: line.skuCode,
          locationCode: line.locationCode,
          quantity: line.quantity,
          ...(line.unitPrice !== undefined ? { unitPrice: line.unitPrice } : {}),
        })),
      };
    case "historical_sale":
      return {
        kind: "historical_sale",
        externalReference: record.sourceReference,
        skuCode: record.payload.skuCode,
        locationCode: record.payload.locationCode,
        quantity: record.payload.quantity,
        soldAt: record.payload.soldAt,
        sourceType: record.payload.sourceType,
      };
    default:
      throw new BadRequestError(`Record kind ${record.kind} cannot be processed in demand syncs.`);
  }
};

export const mapInventoryRecord = (record: ExternalIntegrationRecord): CanonicalInventoryRecord => {
  switch (record.kind) {
    case "location":
      return {
        kind: "location",
        externalReference: record.sourceReference,
        code: record.payload.code,
        name: record.payload.name,
        type: record.payload.type,
        status: record.payload.status,
      };
    case "inventory_snapshot":
      return {
        kind: "inventory_snapshot",
        externalReference: record.sourceReference,
        skuCode: record.payload.skuCode,
        locationCode: record.payload.locationCode,
        onHandQty: record.payload.onHandQty,
      };
    default:
      throw new BadRequestError(`Record kind ${record.kind} cannot be processed in inventory syncs.`);
  }
};
