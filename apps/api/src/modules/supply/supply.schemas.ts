import { Prisma, PurchaseOrderStatus, SupplierStatus } from "@prisma/client";
import { z } from "zod";

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(jsonValueSchema);

const codeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

export const supplierIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const supplierSkuIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const purchaseOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const supplierScopedParamsSchema = z.object({
  supplierId: z.string().uuid(),
});

export const skuScopedParamsSchema = z.object({
  skuId: z.string().uuid(),
});

export const createSupplierBodySchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1).max(160),
  status: z.nativeEnum(SupplierStatus).default(SupplierStatus.active),
  contactEmail: z.string().trim().email().max(320).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  metadata: jsonObjectSchema.optional(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierBodySchema>;

export const updateSupplierBodySchema = z
  .object({
    code: codeSchema.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    status: z.nativeEnum(SupplierStatus).optional(),
    contactEmail: z.string().trim().email().max(320).optional(),
    contactPhone: z.string().trim().max(40).optional(),
    metadata: jsonObjectSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateSupplierInput = z.infer<typeof updateSupplierBodySchema>;

export const listSuppliersQuerySchema = z.object({
  status: z.nativeEnum(SupplierStatus).optional(),
});

export const createSupplierSkuBodySchema = z.object({
  supplierId: z.string().uuid(),
  skuId: z.string().uuid(),
  supplierSkuCode: z.string().trim().max(120).optional(),
  isPrimary: z.boolean().default(false),
  minOrderQty: z.coerce.number().int().positive().default(1),
  casePackQty: z.coerce.number().int().positive().optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
  leadTimeDays: z.coerce.number().int().positive().optional(),
});

export type CreateSupplierSkuInput = z.infer<typeof createSupplierSkuBodySchema>;

export const updateSupplierSkuBodySchema = z
  .object({
    supplierSkuCode: z.string().trim().max(120).optional(),
    isPrimary: z.boolean().optional(),
    minOrderQty: z.coerce.number().int().positive().optional(),
    casePackQty: z.coerce.number().int().positive().optional(),
    unitCost: z.coerce.number().nonnegative().optional(),
    leadTimeDays: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateSupplierSkuInput = z.infer<typeof updateSupplierSkuBodySchema>;

export const listSupplierSkusQuerySchema = z.object({
  supplierId: z.string().uuid().optional(),
  skuId: z.string().uuid().optional(),
  isPrimary: z.coerce.boolean().optional(),
});

const purchaseOrderLineBodySchema = z.object({
  skuId: z.string().uuid(),
  quantityOrdered: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative().optional(),
  expectedLocationId: z.string().uuid().optional(),
});

export const createPurchaseOrderBodySchema = z.object({
  supplierId: z.string().uuid(),
  poNumber: z.string().trim().min(1).max(80),
  expectedDeliveryAt: z.string().datetime().optional(),
  currency: z.string().trim().length(3).optional(),
  notes: z.string().trim().max(1000).optional(),
  lines: z.array(purchaseOrderLineBodySchema).min(1),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderBodySchema>;

export const listPurchaseOrdersQuerySchema = z.object({
  status: z.nativeEnum(PurchaseOrderStatus).optional(),
  supplierId: z.string().uuid().optional(),
});

export const delayPurchaseOrderBodySchema = z
  .object({
    expectedDeliveryAt: z.string().datetime().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .default({});

export type DelayPurchaseOrderInput = z.infer<typeof delayPurchaseOrderBodySchema>;

const receivePurchaseOrderLineBodySchema = z.object({
  lineId: z.string().uuid(),
  quantityReceived: z.coerce.number().int().nonnegative(),
  locationId: z.string().uuid().optional(),
});

export const receivePurchaseOrderBodySchema = z.object({
  receivedAt: z.string().datetime().optional(),
  lines: z.array(receivePurchaseOrderLineBodySchema).min(1),
});

export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderBodySchema>;

export interface SupplierDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  status: SupplierStatus;
  contactEmail: string | null;
  contactPhone: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierSkuDto {
  id: string;
  organizationId: string;
  supplierId: string;
  skuId: string;
  supplierSkuCode: string | null;
  isPrimary: boolean;
  minOrderQty: number;
  casePackQty: number | null;
  unitCost: number | null;
  leadTimeDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierLeadTimeStatDto {
  id: string;
  organizationId: string;
  supplierId: string;
  skuId: string;
  sampleCount: number;
  averageLeadTimeDays: number;
  minLeadTimeDays: number;
  maxLeadTimeDays: number;
  lastObservedLeadTimeDays: number;
  lastObservedAt: string;
  updatedAt: string;
}

export interface SupplierPerformanceSnapshotDto {
  id: string;
  organizationId: string;
  supplierId: string;
  totalPurchaseOrders: number;
  delayedPurchaseOrders: number;
  receivedPurchaseOrders: number;
  averageLeadTimeDays: number | null;
  lastReceiptAt: string | null;
  updatedAt: string;
}

export interface PurchaseOrderLineDto {
  id: string;
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number | null;
  expectedLocationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderDto {
  id: string;
  organizationId: string;
  supplierId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  receivedAt: string | null;
  currency: string | null;
  notes: string | null;
  wasEverDelayed: boolean;
  delayedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLineDto[];
}
