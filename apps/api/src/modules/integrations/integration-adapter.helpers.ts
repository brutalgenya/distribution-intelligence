import Papa from "papaparse";
import { IntegrationSyncType } from "@prisma/client";

import { BadRequestError } from "../../shared/errors.js";
import type {
  IntegrationAdapterLoadInput,
  IntegrationOutboundCommand,
  IntegrationOutboundCommandResult,
} from "./integration-adapter.types.js";
import {
  csvImportInputPayloadSchema,
  externalIntegrationRecordSchema,
  manualBridgeInputPayloadSchema,
  MAX_MANUAL_IMPORT_RECORDS,
} from "./integration.schemas.js";

const getTrimmedValue = (row: Record<string, string | undefined>, key: string): string => row[key]?.trim() ?? "";

const parseCsvRows = (csvContent: string): Array<Record<string, string | undefined>> => {
  const parseResult = Papa.parse<Record<string, string | undefined>>(csvContent, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parseResult.errors.length > 0) {
    throw new BadRequestError(parseResult.errors.map((error) => error.message).join("; "));
  }

  if (parseResult.data.length > MAX_MANUAL_IMPORT_RECORDS) {
    throw new BadRequestError(`CSV import exceeds the maximum row count of ${MAX_MANUAL_IMPORT_RECORDS}.`);
  }

  return parseResult.data;
};

const parseJsonField = (value: string, fieldName: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestError(`${fieldName} must contain valid JSON.`);
  }
};

const parseCatalogCsvRecord = (row: Record<string, string | undefined>) => {
  const kind = getTrimmedValue(row, "kind");
  const sourceReference = getTrimmedValue(row, "sourceReference");

  switch (kind) {
    case "catalog_sku":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          skuCode: getTrimmedValue(row, "skuCode"),
          name: getTrimmedValue(row, "name"),
          description: getTrimmedValue(row, "description") || undefined,
          baseUom: getTrimmedValue(row, "baseUom"),
          packSize: Number(getTrimmedValue(row, "packSize")),
          status: getTrimmedValue(row, "status") || undefined,
          metadata: undefined,
        },
      });
    case "location":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          code: getTrimmedValue(row, "code"),
          name: getTrimmedValue(row, "name"),
          type: getTrimmedValue(row, "type"),
          status: getTrimmedValue(row, "status") || undefined,
        },
      });
    default:
      throw new BadRequestError(`Unsupported catalog CSV record kind: ${kind || "[missing]"}.`);
  }
};

const parseDemandCsvRecord = (row: Record<string, string | undefined>) => {
  const kind = getTrimmedValue(row, "kind");
  const sourceReference = getTrimmedValue(row, "sourceReference");

  switch (kind) {
    case "customer_order":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          orderNumber: getTrimmedValue(row, "orderNumber"),
          customerReference: getTrimmedValue(row, "customerReference") || undefined,
          orderedAt: getTrimmedValue(row, "orderedAt"),
          lines: parseJsonField(getTrimmedValue(row, "linesJson") || "[]", "linesJson"),
        },
      });
    case "historical_sale":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          skuCode: getTrimmedValue(row, "skuCode"),
          locationCode: getTrimmedValue(row, "locationCode"),
          quantity: Number(getTrimmedValue(row, "quantity")),
          soldAt: getTrimmedValue(row, "soldAt"),
          sourceType: getTrimmedValue(row, "saleSourceType") || undefined,
        },
      });
    default:
      throw new BadRequestError(`Unsupported demand CSV record kind: ${kind || "[missing]"}.`);
  }
};

const parseInventoryCsvRecord = (row: Record<string, string | undefined>) => {
  const kind = getTrimmedValue(row, "kind");
  const sourceReference = getTrimmedValue(row, "sourceReference");

  switch (kind) {
    case "location":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          code: getTrimmedValue(row, "code"),
          name: getTrimmedValue(row, "name"),
          type: getTrimmedValue(row, "type"),
          status: getTrimmedValue(row, "status") || undefined,
        },
      });
    case "inventory_snapshot":
      return externalIntegrationRecordSchema.parse({
        kind,
        sourceReference,
        payload: {
          skuCode: getTrimmedValue(row, "skuCode"),
          locationCode: getTrimmedValue(row, "locationCode"),
          onHandQty: Number(getTrimmedValue(row, "onHandQty")),
        },
      });
    default:
      throw new BadRequestError(`Unsupported inventory CSV record kind: ${kind || "[missing]"}.`);
  }
};

export const loadManualRecords = (input: IntegrationAdapterLoadInput) =>
  manualBridgeInputPayloadSchema.parse(input.inputPayload ?? {}).records;

export const loadCsvRecords = (input: IntegrationAdapterLoadInput) => {
  const { csvContent } = csvImportInputPayloadSchema.parse(input.inputPayload ?? {});

  const rows = parseCsvRows(csvContent);
  return rows.map((row) => {
    switch (input.syncType) {
      case IntegrationSyncType.catalog_import:
        return parseCatalogCsvRecord(row);
      case IntegrationSyncType.demand_import:
        return parseDemandCsvRecord(row);
      case IntegrationSyncType.inventory_import:
        return parseInventoryCsvRecord(row);
    }
  });
};

export const buildMockOutboundResult = (input: IntegrationOutboundCommand): IntegrationOutboundCommandResult => ({
  acknowledged: true,
  externalReference: `${input.connection.integrationType}:${input.commandType}:${input.correlationId}`,
  responsePayload: {
    acknowledged: true,
    targetConnectionId: input.connection.id,
    commandType: input.commandType,
  },
});
