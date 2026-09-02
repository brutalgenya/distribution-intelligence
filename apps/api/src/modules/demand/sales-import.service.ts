import { createHash } from "node:crypto";

import { Prisma, SalesImportRunStatus } from "@prisma/client";
import Papa, { type ParseError } from "papaparse";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { SkuRepository } from "../catalog/sku.repository.js";
import { LocationRepository } from "../inventory/location.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import type {
  SalesImportInput,
  SalesImportResultDto,
  SalesImportRowErrorDto,
  SalesImportRunDto,
} from "./demand.schemas.js";
import { DemandSignalService } from "./demand-signal.service.js";
import { HistoricalSaleRepository } from "./historical-sale.repository.js";
import { SalesImportRunRepository } from "./sales-import.repository.js";

const REQUIRED_SALES_IMPORT_HEADERS = [
  "skuCode",
  "locationCode",
  "quantity",
  "soldAt",
  "sourceReference",
] as const;

type RawSalesImportRow = Record<string, string | undefined>;

interface ParsedSalesImportRow {
  rowNumber: number;
  skuCode: string;
  locationCode: string;
  quantity: number;
  soldAt: Date;
  sourceReference: string;
}

interface ResolvedSalesImportRow extends ParsedSalesImportRow {
  skuId: string;
  locationId: string;
  rowFingerprint: string;
}

const toSalesImportRunDto = (run: {
  id: string;
  organizationId: string;
  status: SalesImportRunStatus;
  totalRows: number;
  acceptedRows: number;
  duplicateRows: number;
  rejectedRows: number;
  errorSummary: unknown;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SalesImportRunDto => ({
  id: run.id,
  organizationId: run.organizationId,
  status: run.status,
  totalRows: run.totalRows,
  acceptedRows: run.acceptedRows,
  duplicateRows: run.duplicateRows,
  rejectedRows: run.rejectedRows,
  errorSummary: run.errorSummary,
  startedAt: run.startedAt.toISOString(),
  completedAt: run.completedAt?.toISOString() ?? null,
  createdAt: run.createdAt.toISOString(),
  updatedAt: run.updatedAt.toISOString(),
});

const getTrimmedValue = (row: RawSalesImportRow, key: string): string => row[key]?.trim() ?? "";

const toParseErrorDto = (error: ParseError): SalesImportRowErrorDto => ({
  rowNumber: typeof error.row === "number" ? error.row + 2 : 1,
  message: error.message,
});

const buildRowFingerprint = (
  organizationId: string,
  row: Pick<ResolvedSalesImportRow, "skuId" | "locationId" | "quantity" | "soldAt" | "sourceReference">,
  sourceType: string,
): string =>
  createHash("sha256")
    .update(
      [
        organizationId,
        row.skuId,
        row.locationId,
        String(row.quantity),
        row.soldAt.toISOString(),
        sourceType,
        row.sourceReference,
      ].join("|"),
    )
    .digest("hex");

export class SalesImportService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly skuRepository: SkuRepository,
    private readonly locationRepository: LocationRepository,
    private readonly salesImportRunRepository: SalesImportRunRepository,
    private readonly historicalSaleRepository: HistoricalSaleRepository,
    private readonly demandSignalService: DemandSignalService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async importSales(
    context: RequestContext,
    input: SalesImportInput,
  ): Promise<SalesImportResultDto> {
    const organizationId = requireActiveOrganizationId(context);
    const startedAt = new Date();

    const parseResult = Papa.parse<RawSalesImportRow>(input.csvContent, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
    });

    const fields = parseResult.meta.fields ?? [];
    const headerErrors = REQUIRED_SALES_IMPORT_HEADERS.filter((header) => !fields.includes(header)).map(
      (header) =>
        ({
          rowNumber: 1,
          message: `Missing required column: ${header}.`,
        }) satisfies SalesImportRowErrorDto,
    );
    const rowParse = headerErrors.length === 0 ? this.parseRows(parseResult.data) : { rows: [], errors: [] };
    const preDbErrors = [...parseResult.errors.map(toParseErrorDto), ...headerErrors, ...rowParse.errors];

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "demand.write");

      const rowErrors = [...preDbErrors];
      const resolvedRows =
        rowParse.rows.length > 0
          ? await this.resolveRowsForOrganization(db, organizationId, input.sourceType, rowParse.rows, rowErrors)
          : [];

      const { acceptedRows, duplicateRows } = await this.filterDuplicateRows(db, organizationId, resolvedRows);
      const completedAt = new Date();
      const status = rowErrors.length > 0 ? SalesImportRunStatus.failed : SalesImportRunStatus.completed;
      const errorSummary =
        rowErrors.length > 0
          ? ({
              rowErrors: rowErrors.map((error) => ({
                rowNumber: error.rowNumber,
                message: error.message,
              })),
            } satisfies Prisma.InputJsonObject)
          : undefined;

      const run = await this.salesImportRunRepository.create(db, {
        organizationId,
        createdByUserId: context.user.id,
        status,
        totalRows: parseResult.data.length,
        acceptedRows: acceptedRows.length,
        duplicateRows,
        rejectedRows: rowErrors.length,
        startedAt,
        completedAt,
        ...(errorSummary ? { errorSummary } : {}),
      });

      if (acceptedRows.length > 0) {
        await this.historicalSaleRepository.createMany(
          db,
          acceptedRows.map((row) => ({
            organizationId,
            salesImportRunId: run.id,
            skuId: row.skuId,
            locationId: row.locationId,
            quantity: row.quantity,
            soldAt: row.soldAt,
            sourceType: input.sourceType,
            sourceReference: row.sourceReference,
            rowFingerprint: row.rowFingerprint,
          })),
        );

        await this.demandSignalService.appendSignals(
          db,
          acceptedRows.map((row) => ({
            organizationId,
            skuId: row.skuId,
            locationId: row.locationId,
            signalType: "historical_sale",
            quantity: row.quantity,
            observedAt: row.soldAt,
            sourceType: input.sourceType,
            sourceReference: row.sourceReference,
            metadata: {
              salesImportRunId: run.id,
              rowFingerprint: row.rowFingerprint,
            } satisfies Prisma.InputJsonObject,
          })),
        );
      }

      await this.auditEventRepository.create(db, {
        organizationId,
        actorUserId: context.user.id,
        eventType: "demand.sales.imported",
        entityType: "SalesImportRun",
        entityId: run.id,
        payload: {
          totalRows: run.totalRows,
          acceptedRows: run.acceptedRows,
          duplicateRows: run.duplicateRows,
          rejectedRows: run.rejectedRows,
          status: run.status,
        },
        correlationId: context.correlationId,
      });

      await this.outboxEventRepository.create(db, {
        organizationId,
        eventType: "demand.sales.imported.v1",
        aggregateType: "SalesImportRun",
        aggregateId: run.id,
        payload: {
          organizationId,
          salesImportRunId: run.id,
          totalRows: run.totalRows,
          acceptedRows: run.acceptedRows,
          duplicateRows: run.duplicateRows,
          rejectedRows: run.rejectedRows,
          status: run.status,
        },
      });

      return {
        run: toSalesImportRunDto(run),
        errors: rowErrors,
      };
    });
  }

  public async listImportRuns(
    context: RequestContext,
    filters: { status?: SalesImportRunStatus },
  ): Promise<SalesImportRunDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "demand.read");

    const runs = await this.salesImportRunRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
    });

    return runs.map(toSalesImportRunDto);
  }

  public async getImportRun(context: RequestContext, runId: string): Promise<SalesImportRunDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "demand.read");

    const run = await this.salesImportRunRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: runId,
    });
    if (!run) {
      throw new NotFoundError("Sales import run was not found.");
    }

    return toSalesImportRunDto(run);
  }

  private parseRows(rows: RawSalesImportRow[]): {
    rows: ParsedSalesImportRow[];
    errors: SalesImportRowErrorDto[];
  } {
    const parsedRows: ParsedSalesImportRow[] = [];
    const errors: SalesImportRowErrorDto[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }

      const rowNumber = index + 2;
      const skuCode = getTrimmedValue(row, "skuCode");
      const locationCode = getTrimmedValue(row, "locationCode");
      const quantityValue = getTrimmedValue(row, "quantity");
      const soldAtValue = getTrimmedValue(row, "soldAt");
      const sourceReference = getTrimmedValue(row, "sourceReference");

      if (!skuCode) {
        errors.push({
          rowNumber,
          message: "skuCode is required.",
        });
        continue;
      }

      if (!locationCode) {
        errors.push({
          rowNumber,
          message: "locationCode is required.",
        });
        continue;
      }

      if (!quantityValue) {
        errors.push({
          rowNumber,
          message: "quantity is required.",
        });
        continue;
      }

      const quantity = Number(quantityValue);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        errors.push({
          rowNumber,
          message: "quantity must be a positive integer.",
        });
        continue;
      }

      if (!soldAtValue) {
        errors.push({
          rowNumber,
          message: "soldAt is required.",
        });
        continue;
      }

      const soldAt = new Date(soldAtValue);
      if (Number.isNaN(soldAt.getTime())) {
        errors.push({
          rowNumber,
          message: "soldAt must be a valid datetime.",
        });
        continue;
      }

      if (!sourceReference) {
        errors.push({
          rowNumber,
          message: "sourceReference is required.",
        });
        continue;
      }

      parsedRows.push({
        rowNumber,
        skuCode,
        locationCode,
        quantity,
        soldAt,
        sourceReference,
      });
    }

    return {
      rows: parsedRows,
      errors,
    };
  }

  private async resolveRowsForOrganization(
    db: DbClient,
    organizationId: string,
    sourceType: string,
    rows: ParsedSalesImportRow[],
    rowErrors: SalesImportRowErrorDto[],
  ): Promise<ResolvedSalesImportRow[]> {
    const skuCodes = [...new Set(rows.map((row) => row.skuCode))];
    const locationCodes = [...new Set(rows.map((row) => row.locationCode))];

    const [skus, locations] = await Promise.all([
      this.skuRepository.listByCodesForOrganization(db, {
        organizationId,
        skuCodes,
      }),
      this.locationRepository.listByCodesForOrganization(db, {
        organizationId,
        codes: locationCodes,
      }),
    ]);

    const skuByCode = new Map(skus.map((sku) => [sku.skuCode, sku]));
    const locationByCode = new Map(locations.map((location) => [location.code, location]));
    const resolvedRows: ResolvedSalesImportRow[] = [];

    for (const row of rows) {
      const sku = skuByCode.get(row.skuCode);
      if (!sku) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: `Unknown skuCode: ${row.skuCode}.`,
        });
        continue;
      }

      const location = locationByCode.get(row.locationCode);
      if (!location) {
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: `Unknown locationCode: ${row.locationCode}.`,
        });
        continue;
      }

      resolvedRows.push({
        ...row,
        skuId: sku.id,
        locationId: location.id,
        rowFingerprint: buildRowFingerprint(
          organizationId,
          {
            skuId: sku.id,
            locationId: location.id,
            quantity: row.quantity,
            soldAt: row.soldAt,
            sourceReference: row.sourceReference,
          },
          sourceType,
        ),
      });
    }

    return resolvedRows;
  }

  private async filterDuplicateRows(
    db: DbClient,
    organizationId: string,
    rows: ResolvedSalesImportRow[],
  ): Promise<{ acceptedRows: ResolvedSalesImportRow[]; duplicateRows: number }> {
    const existingFingerprints = await this.historicalSaleRepository.findExistingFingerprints(db, {
      organizationId,
      rowFingerprints: rows.map((row) => row.rowFingerprint),
    });

    const seenFingerprints = new Set(existingFingerprints);
    const acceptedRows: ResolvedSalesImportRow[] = [];
    let duplicateRows = 0;

    for (const row of rows) {
      if (seenFingerprints.has(row.rowFingerprint)) {
        duplicateRows += 1;
        continue;
      }

      seenFingerprints.add(row.rowFingerprint);
      acceptedRows.push(row);
    }

    return {
      acceptedRows,
      duplicateRows,
    };
  }
}
