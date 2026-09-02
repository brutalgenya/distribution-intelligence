import type {
  PurchaseOrderLine,
  Supplier,
  SupplierLeadTimeStat,
  SupplierPerformanceSnapshot,
  SupplierSku,
} from "@prisma/client";

import type { PurchaseOrderWithLines } from "./purchase-order.repository.js";
import type {
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  SupplierDto,
  SupplierLeadTimeStatDto,
  SupplierPerformanceSnapshotDto,
  SupplierSkuDto,
} from "./supply.schemas.js";

export const toSupplierDto = (supplier: Supplier): SupplierDto => ({
  id: supplier.id,
  organizationId: supplier.organizationId,
  code: supplier.code,
  name: supplier.name,
  status: supplier.status,
  contactEmail: supplier.contactEmail,
  contactPhone: supplier.contactPhone,
  metadata: supplier.metadata,
  createdAt: supplier.createdAt.toISOString(),
  updatedAt: supplier.updatedAt.toISOString(),
});

export const toSupplierSkuDto = (supplierSku: SupplierSku): SupplierSkuDto => ({
  id: supplierSku.id,
  organizationId: supplierSku.organizationId,
  supplierId: supplierSku.supplierId,
  skuId: supplierSku.skuId,
  supplierSkuCode: supplierSku.supplierSkuCode,
  isPrimary: supplierSku.isPrimary,
  minOrderQty: supplierSku.minOrderQty,
  casePackQty: supplierSku.casePackQty,
  unitCost: supplierSku.unitCost === null ? null : Number(supplierSku.unitCost),
  leadTimeDays: supplierSku.leadTimeDays,
  createdAt: supplierSku.createdAt.toISOString(),
  updatedAt: supplierSku.updatedAt.toISOString(),
});

export const toSupplierLeadTimeStatDto = (
  stat: SupplierLeadTimeStat,
): SupplierLeadTimeStatDto => ({
  id: stat.id,
  organizationId: stat.organizationId,
  supplierId: stat.supplierId,
  skuId: stat.skuId,
  sampleCount: stat.sampleCount,
  averageLeadTimeDays: stat.averageLeadTimeDays,
  minLeadTimeDays: stat.minLeadTimeDays,
  maxLeadTimeDays: stat.maxLeadTimeDays,
  lastObservedLeadTimeDays: stat.lastObservedLeadTimeDays,
  lastObservedAt: stat.lastObservedAt.toISOString(),
  updatedAt: stat.updatedAt.toISOString(),
});

export const toSupplierPerformanceSnapshotDto = (
  snapshot: SupplierPerformanceSnapshot,
): SupplierPerformanceSnapshotDto => ({
  id: snapshot.id,
  organizationId: snapshot.organizationId,
  supplierId: snapshot.supplierId,
  totalPurchaseOrders: snapshot.totalPurchaseOrders,
  delayedPurchaseOrders: snapshot.delayedPurchaseOrders,
  receivedPurchaseOrders: snapshot.receivedPurchaseOrders,
  averageLeadTimeDays: snapshot.averageLeadTimeDays,
  lastReceiptAt: snapshot.lastReceiptAt?.toISOString() ?? null,
  updatedAt: snapshot.updatedAt.toISOString(),
});

export const toPurchaseOrderLineDto = (line: PurchaseOrderLine): PurchaseOrderLineDto => ({
  id: line.id,
  skuId: line.skuId,
  quantityOrdered: line.quantityOrdered,
  quantityReceived: line.quantityReceived,
  unitCost: line.unitCost === null ? null : Number(line.unitCost),
  expectedLocationId: line.expectedLocationId,
  createdAt: line.createdAt.toISOString(),
  updatedAt: line.updatedAt.toISOString(),
});

export const toPurchaseOrderDto = (purchaseOrder: PurchaseOrderWithLines): PurchaseOrderDto => ({
  id: purchaseOrder.id,
  organizationId: purchaseOrder.organizationId,
  supplierId: purchaseOrder.supplierId,
  poNumber: purchaseOrder.poNumber,
  status: purchaseOrder.status,
  orderedAt: purchaseOrder.orderedAt?.toISOString() ?? null,
  expectedDeliveryAt: purchaseOrder.expectedDeliveryAt?.toISOString() ?? null,
  receivedAt: purchaseOrder.receivedAt?.toISOString() ?? null,
  currency: purchaseOrder.currency,
  notes: purchaseOrder.notes,
  wasEverDelayed: purchaseOrder.wasEverDelayed,
  delayedAt: purchaseOrder.delayedAt?.toISOString() ?? null,
  createdByUserId: purchaseOrder.createdByUserId,
  createdAt: purchaseOrder.createdAt.toISOString(),
  updatedAt: purchaseOrder.updatedAt.toISOString(),
  lines: purchaseOrder.lines.map(toPurchaseOrderLineDto),
});
