import {
  IntegrationConnectionStatus,
  IntegrationDirection,
  IntegrationSyncStatus,
  IntegrationSyncType,
  IntegrationType,
  LocationStatus,
  LocationType,
  SkuStatus,
} from "@prisma/client";
import { z } from "zod";

const MAX_INTEGRATION_CONFIG_JSON_BYTES = 16_384;
const MAX_SYNC_INPUT_PAYLOAD_BYTES = 262_144;
const MAX_EXTERNAL_ORDER_LINES = 100;
export const MAX_MANUAL_IMPORT_RECORDS = 250;
export const MAX_CSV_IMPORT_BYTES = 131_072;

const jsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

export const jsonObjectSchema = z.record(jsonValueSchema);

const getJsonByteLength = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

const connectionConfigSchemas = {
  [IntegrationType.erp]: z
    .object({
      adapterMode: z.enum(["fake"]).default("fake"),
      endpointBaseUrl: z.string().url().optional(),
      externalSystemCode: z.string().trim().min(1).max(80).optional(),
    })
    .passthrough(),
  [IntegrationType.wms]: z
    .object({
      adapterMode: z.enum(["fake"]).default("fake"),
      endpointBaseUrl: z.string().url().optional(),
      warehouseGroup: z.string().trim().min(1).max(80).optional(),
    })
    .passthrough(),
  [IntegrationType.csv_import]: z
    .object({
      delimiter: z.string().length(1).default(","),
      hasHeaderRow: z.boolean().default(true),
    })
    .passthrough(),
  [IntegrationType.manual_bridge]: z
    .object({
      sourceLabel: z.string().trim().min(1).max(120).optional(),
    })
    .passthrough(),
} satisfies Record<IntegrationType, z.ZodTypeAny>;

export const validateConnectionConfig = (
  integrationType: IntegrationType,
  configJson: Record<string, unknown>,
): Record<string, unknown> => connectionConfigSchemas[integrationType].parse(configJson) as Record<string, unknown>;

export const integrationConnectionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const integrationSyncRunIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const integrationFailedRecordIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createIntegrationConnectionBodySchema = z
  .object({
    integrationType: z.nativeEnum(IntegrationType),
    name: z.string().trim().min(1).max(160),
    status: z.nativeEnum(IntegrationConnectionStatus).default(IntegrationConnectionStatus.active),
    configJson: jsonObjectSchema.default({}),
    credentialsRef: z.string().trim().min(1).max(255).optional(),
  })
  .superRefine((value, ctx) => {
    if (getJsonByteLength(value.configJson) > MAX_INTEGRATION_CONFIG_JSON_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "configJson exceeds the maximum supported size.",
        path: ["configJson"],
      });
    }
  })
  .transform((value) => ({
    ...value,
    configJson: validateConnectionConfig(value.integrationType, value.configJson),
  }));

export type CreateIntegrationConnectionInput = z.infer<typeof createIntegrationConnectionBodySchema>;

export const updateIntegrationConnectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    status: z.nativeEnum(IntegrationConnectionStatus).optional(),
    configJson: jsonObjectSchema.optional(),
    credentialsRef: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })
  .superRefine((value, ctx) => {
    if (value.configJson && getJsonByteLength(value.configJson) > MAX_INTEGRATION_CONFIG_JSON_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "configJson exceeds the maximum supported size.",
        path: ["configJson"],
      });
    }
  });

export type UpdateIntegrationConnectionInput = z.infer<typeof updateIntegrationConnectionBodySchema>;

export const listIntegrationConnectionsQuerySchema = z.object({
  integrationType: z.nativeEnum(IntegrationType).optional(),
  status: z.nativeEnum(IntegrationConnectionStatus).optional(),
});

export const createIntegrationSyncRunBodySchema = z.object({
  connectionId: z.string().uuid(),
  direction: z.nativeEnum(IntegrationDirection).default(IntegrationDirection.inbound),
  syncType: z.nativeEnum(IntegrationSyncType),
  inputPayload: jsonObjectSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.inputPayload && getJsonByteLength(value.inputPayload) > MAX_SYNC_INPUT_PAYLOAD_BYTES) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "inputPayload exceeds the maximum supported size.",
      path: ["inputPayload"],
    });
  }
});

export type CreateIntegrationSyncRunInput = z.infer<typeof createIntegrationSyncRunBodySchema>;

export const listIntegrationSyncRunsQuerySchema = z.object({
  connectionId: z.string().uuid().optional(),
  direction: z.nativeEnum(IntegrationDirection).optional(),
  syncType: z.nativeEnum(IntegrationSyncType).optional(),
  status: z.nativeEnum(IntegrationSyncStatus).optional(),
});

export const listIntegrationFailedRecordsQuerySchema = z.object({
  connectionId: z.string().uuid().optional(),
  syncRunId: z.string().uuid().optional(),
  resolved: z.coerce.boolean().optional(),
});

const sourceReferenceSchema = z.string().trim().min(1).max(160);
const skuCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);
const locationCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

export const externalCatalogSkuRecordSchema = z.object({
  kind: z.literal("catalog_sku"),
  sourceReference: sourceReferenceSchema,
  payload: z.object({
    skuCode: skuCodeSchema,
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional(),
    baseUom: z.string().trim().min(1).max(32),
    packSize: z.coerce.number().int().positive(),
    status: z.nativeEnum(SkuStatus).default(SkuStatus.active),
    metadata: jsonObjectSchema.optional(),
  }),
});

export const externalLocationRecordSchema = z.object({
  kind: z.literal("location"),
  sourceReference: sourceReferenceSchema,
  payload: z.object({
    code: locationCodeSchema,
    name: z.string().trim().min(1).max(160),
    type: z.nativeEnum(LocationType),
    status: z.nativeEnum(LocationStatus).default(LocationStatus.active),
  }),
});

const externalCustomerOrderLineSchema = z.object({
  skuCode: skuCodeSchema,
  locationCode: locationCodeSchema,
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().nonnegative().optional(),
});

export const externalCustomerOrderRecordSchema = z.object({
  kind: z.literal("customer_order"),
  sourceReference: sourceReferenceSchema,
  payload: z.object({
    orderNumber: z.string().trim().min(1).max(80),
    customerReference: z.string().trim().max(160).optional(),
    orderedAt: z.string().datetime(),
    lines: z.array(externalCustomerOrderLineSchema).min(1).max(MAX_EXTERNAL_ORDER_LINES),
  }),
});

export const externalHistoricalSaleRecordSchema = z.object({
  kind: z.literal("historical_sale"),
  sourceReference: sourceReferenceSchema,
  payload: z.object({
    skuCode: skuCodeSchema,
    locationCode: locationCodeSchema,
    quantity: z.coerce.number().int().positive(),
    soldAt: z.string().datetime(),
    sourceType: z.string().trim().min(1).max(80).default("integration_import"),
  }),
});

export const externalInventorySnapshotRecordSchema = z.object({
  kind: z.literal("inventory_snapshot"),
  sourceReference: sourceReferenceSchema,
  payload: z.object({
    skuCode: skuCodeSchema,
    locationCode: locationCodeSchema,
    onHandQty: z.coerce.number().int().nonnegative(),
  }),
});

export const externalIntegrationRecordSchema = z.discriminatedUnion("kind", [
  externalCatalogSkuRecordSchema,
  externalLocationRecordSchema,
  externalCustomerOrderRecordSchema,
  externalHistoricalSaleRecordSchema,
  externalInventorySnapshotRecordSchema,
]);

export type ExternalIntegrationRecord = z.infer<typeof externalIntegrationRecordSchema>;

export const manualBridgeInputPayloadSchema = z.object({
  records: z.array(externalIntegrationRecordSchema).min(1).max(MAX_MANUAL_IMPORT_RECORDS),
});

export const csvImportInputPayloadSchema = z.object({
  csvContent: z.string().min(1).max(MAX_CSV_IMPORT_BYTES),
});

export interface IntegrationConnectionDto {
  id: string;
  organizationId: string;
  integrationType: IntegrationType;
  name: string;
  status: IntegrationConnectionStatus;
  configJson: unknown;
  credentialsRef: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationSyncRunDto {
  id: string;
  organizationId: string;
  integrationConnectionId: string;
  requestedByUserId: string | null;
  direction: IntegrationDirection;
  syncType: IntegrationSyncType;
  status: IntegrationSyncStatus;
  startedAt: string;
  completedAt: string | null;
  processedCount: number;
  successCount: number;
  failureCount: number;
  checkpoint: unknown;
  errorSummary: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationFailedRecordDto {
  id: string;
  organizationId: string;
  integrationConnectionId: string;
  syncRunId: string | null;
  recordType: string;
  sourceReference: string | null;
  payload: unknown;
  errorMessage: string;
  createdAt: string;
  resolvedAt: string | null;
}
