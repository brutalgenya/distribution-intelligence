import { CustomerOrderStatus, SalesImportRunStatus } from "@prisma/client";
import { z } from "zod";

export const salesImportRunIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const customerOrderIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const salesImportBodySchema = z.object({
  csvContent: z.string().min(1),
  sourceType: z.string().trim().min(1).max(80).default("historical_sales_csv"),
});

export type SalesImportInput = z.infer<typeof salesImportBodySchema>;

export const listSalesImportRunsQuerySchema = z.object({
  status: z.nativeEnum(SalesImportRunStatus).optional(),
});

const customerOrderLineBodySchema = z.object({
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative().optional(),
});

export const createCustomerOrderBodySchema = z.object({
  orderNumber: z.string().trim().min(1).max(80),
  customerReference: z.string().trim().max(160).optional(),
  orderedAt: z.string().datetime(),
  lines: z.array(customerOrderLineBodySchema).min(1),
});

export type CreateCustomerOrderInput = z.infer<typeof createCustomerOrderBodySchema>;

export const listCustomerOrdersQuerySchema = z.object({
  status: z.nativeEnum(CustomerOrderStatus).optional(),
});

export interface SalesImportRowErrorDto {
  rowNumber: number;
  message: string;
}

export interface SalesImportRunDto {
  id: string;
  organizationId: string;
  status: SalesImportRunStatus;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  rejectedRows: number;
  errorSummary: unknown;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesImportResultDto {
  run: SalesImportRunDto;
  errors: SalesImportRowErrorDto[];
}

export interface CustomerOrderLineDto {
  id: string;
  skuId: string;
  locationId: string;
  quantity: number;
  unitPrice: number | null;
  createdAt: string;
}

export interface CustomerOrderDto {
  id: string;
  organizationId: string;
  orderNumber: string;
  status: CustomerOrderStatus;
  customerReference: string | null;
  orderedAt: string;
  createdByUserId: string;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  lines: CustomerOrderLineDto[];
}
