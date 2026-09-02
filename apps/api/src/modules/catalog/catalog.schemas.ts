import { Prisma, SkuStatus } from "@prisma/client";
import { z } from "zod";

const jsonValueSchema: z.ZodType<Prisma.InputJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const jsonObjectSchema: z.ZodType<Prisma.InputJsonObject> = z.record(jsonValueSchema);

export const skuIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const skuCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

export const createSkuBodySchema = z.object({
  skuCode: skuCodeSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  baseUom: z.string().trim().min(1).max(32),
  packSize: z.coerce.number().int().positive(),
  status: z.nativeEnum(SkuStatus).default(SkuStatus.active),
  metadata: jsonObjectSchema.optional(),
});

export type CreateSkuInput = z.infer<typeof createSkuBodySchema>;

export const updateSkuBodySchema = z
  .object({
    skuCode: skuCodeSchema.optional(),
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(1000).optional(),
    baseUom: z.string().trim().min(1).max(32).optional(),
    packSize: z.coerce.number().int().positive().optional(),
    status: z.nativeEnum(SkuStatus).optional(),
    metadata: jsonObjectSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateSkuInput = z.infer<typeof updateSkuBodySchema>;

export const listSkusQuerySchema = z.object({
  status: z.nativeEnum(SkuStatus).optional(),
});

export interface SkuDto {
  id: string;
  organizationId: string;
  skuCode: string;
  name: string;
  description: string | null;
  baseUom: string;
  packSize: number;
  status: SkuStatus;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}
