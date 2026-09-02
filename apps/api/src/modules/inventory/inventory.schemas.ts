import {
  InventoryReservationStatus,
  InventoryTransferStatus,
  LocationStatus,
  LocationType,
} from "@prisma/client";
import { z } from "zod";

export const locationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const inventoryPositionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const reservationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const transferIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const referenceTypeSchema = z.string().trim().min(1).max(80);
const referenceIdSchema = z.string().trim().min(1).max(120);

export const createLocationBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
  name: z.string().trim().min(1).max(160),
  type: z.nativeEnum(LocationType),
  status: z.nativeEnum(LocationStatus).default(LocationStatus.active),
});

export type CreateLocationInput = z.infer<typeof createLocationBodySchema>;

export const listLocationsQuerySchema = z.object({
  status: z.nativeEnum(LocationStatus).optional(),
});

export const listInventoryPositionsQuerySchema = z.object({
  skuId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export const createReceiptBodySchema = z.object({
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  referenceType: referenceTypeSchema,
  referenceId: referenceIdSchema,
  notes: z.string().trim().max(1000).optional(),
});

export type CreateReceiptInput = z.infer<typeof createReceiptBodySchema>;

export const createAdjustmentBodySchema = z
  .object({
    skuId: z.string().uuid(),
    locationId: z.string().uuid(),
    quantity: z.coerce.number().int().refine((value) => value !== 0, {
      message: "Adjustment quantity cannot be zero.",
    }),
    referenceType: referenceTypeSchema,
    referenceId: referenceIdSchema,
    reason: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.quantity < 0 && !value.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Negative adjustments require a reason.",
        path: ["reason"],
      });
    }
  });

export type CreateAdjustmentInput = z.infer<typeof createAdjustmentBodySchema>;

export const createReservationBodySchema = z.object({
  skuId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  referenceType: referenceTypeSchema,
  referenceId: referenceIdSchema,
  notes: z.string().trim().max(1000).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationBodySchema>;

export const createTransferBodySchema = z.object({
  skuId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  referenceType: referenceTypeSchema.optional(),
  referenceId: referenceIdSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferBodySchema>;

export interface LocationDto {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryPositionDto {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string;
  onHandQty: number;
  reservedQty: number;
  inTransitQty: number;
  availableToPromiseQty: number;
  safetyStockQty: number;
  reorderPointQty: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovementDto {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string;
  movementType: string;
  quantity: number;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface InventoryReservationDto {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string;
  quantity: number;
  status: InventoryReservationStatus;
  referenceType: string;
  referenceId: string;
  notes: string | null;
  createdByUserId: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface InventoryTransferDto {
  id: string;
  organizationId: string;
  skuId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  status: InventoryTransferStatus;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  requestedByUserId: string;
  completedByUserId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface InventoryMutationResultDto {
  movement: InventoryMovementDto;
  position: InventoryPositionDto;
}

export interface InventoryReservationResultDto {
  reservation: InventoryReservationDto;
  position: InventoryPositionDto;
}

export interface InventoryTransferResultDto {
  transfer: InventoryTransferDto;
  sourcePosition: InventoryPositionDto;
  destinationPosition: InventoryPositionDto;
}
