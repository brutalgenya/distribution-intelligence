import type { StockoutIncident } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { NotFoundError } from "../../shared/errors.js";
import { requireActiveOrganizationId } from "../../shared/organization-context.js";
import type { RequestContext } from "../../shared/request-context.js";
import type { TransactionRunner } from "../../shared/transaction-runner.js";
import { AuditEventRepository } from "../audit/audit.repository.js";
import { AuthorizationService } from "../authz/authz.service.js";
import { DemandSignalRepository } from "../demand/demand-signal.repository.js";
import { OutboxEventRepository } from "../outbox/outbox.repository.js";
import {
  outcomeAuditEventTypes,
  outcomeOutboxEventTypes,
  OUTCOME_STOCKOUT_SOURCE_TYPE,
  STOCKOUT_DETECTION_RULE,
} from "./outcomes.constants.js";
import {
  buildMeasurementWindow,
  buildWindowReference,
  diffUtcDays,
  endOfUtcDay,
  startOfUtcDay,
} from "./outcomes-date-utils.js";
import { InventoryHistoryService, type InventoryHistoryScope } from "./inventory-history.service.js";
import { toStockoutIncidentDto } from "./outcomes.mappers.js";
import { StockoutIncidentRepository } from "./stockout-incident.repository.js";
import type {
  ComputeStockoutsInput,
  StockoutComputationResultDto,
  StockoutIncidentDto,
} from "./outcomes.schemas.js";

interface DailyDemandPressure {
  day: Date;
  quantity: number;
}

interface IncidentSegment {
  scope: InventoryHistoryScope;
  startDay: Date;
  endDay: Date;
  maxDailyDemandQty: number;
  dayCount: number;
}

export class StockoutDetectionService {
  public constructor(
    private readonly db: DbClient,
    private readonly transactionRunner: TransactionRunner,
    private readonly demandSignalRepository: DemandSignalRepository,
    private readonly stockoutIncidentRepository: StockoutIncidentRepository,
    private readonly inventoryHistoryService: InventoryHistoryService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditEventRepository: AuditEventRepository,
    private readonly outboxEventRepository: OutboxEventRepository,
  ) {}

  public async computeStockouts(
    context: RequestContext,
    input: ComputeStockoutsInput,
  ): Promise<StockoutComputationResultDto> {
    const organizationId = requireActiveOrganizationId(context);

    return this.transactionRunner.run(async (db) => {
      await this.authorizationService.requireOrganizationPermission(db, context, organizationId, "outcomes.write");
      return this.computeStockoutsInTransaction(db, organizationId, input, {
        actorUserId: context.user.id,
        correlationId: context.correlationId,
      });
    });
  }

  public async computeStockoutsAsSystem(
    organizationId: string,
    input: ComputeStockoutsInput,
    correlationId: string,
  ): Promise<StockoutComputationResultDto> {
    return this.transactionRunner.run((db) =>
      this.computeStockoutsInTransaction(db, organizationId, input, {
        actorUserId: null,
        correlationId,
      }),
    );
  }

  public async listIncidents(
    context: RequestContext,
    filters: { skuId?: string; locationId?: string },
  ): Promise<StockoutIncidentDto[]> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const incidents = await this.stockoutIncidentRepository.listByOrganization(this.db, {
      organizationId,
      ...(filters.skuId ? { skuId: filters.skuId } : {}),
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
    });

    return incidents.map(toStockoutIncidentDto);
  }

  public async getIncident(context: RequestContext, incidentId: string): Promise<StockoutIncidentDto> {
    const organizationId = requireActiveOrganizationId(context);
    await this.authorizationService.requireOrganizationPermission(this.db, context, organizationId, "outcomes.read");

    const incident = await this.stockoutIncidentRepository.findByIdForOrganization(this.db, {
      organizationId,
      id: incidentId,
    });
    if (!incident) {
      throw new NotFoundError("Stockout incident was not found.");
    }

    return toStockoutIncidentDto(incident);
  }

  public async computeStockoutsInTransaction(
    db: DbClient,
    organizationId: string,
    input: ComputeStockoutsInput,
    options: { actorUserId: string | null; correlationId: string },
  ): Promise<StockoutComputationResultDto> {
    const window = buildMeasurementWindow(input.measurementWindowStart, input.measurementWindowEnd);
    const sourceReference = buildWindowReference(window);
    const demandSignals = await this.demandSignalRepository.listByOrganization(db, {
      organizationId,
      observedAtGte: window.start,
      observedAtLte: window.end,
      ...(input.skuId ? { skuId: input.skuId } : {}),
      ...(input.locationId ? { locationId: input.locationId } : {}),
    });

    const dailyDemandByScope = new Map<string, DailyDemandPressure[]>();
    for (const signal of demandSignals) {
      if (!signal.locationId) {
        continue;
      }

      const day = startOfUtcDay(signal.observedAt);
      const scopeKey = `${signal.skuId}:${signal.locationId}`;
      const existingPressures = dailyDemandByScope.get(scopeKey) ?? [];
      const existingDay = existingPressures.find(
        (pressure) => pressure.day.getTime() === day.getTime(),
      );

      if (existingDay) {
        existingDay.quantity += signal.quantity;
      } else {
        existingPressures.push({
          day,
          quantity: signal.quantity,
        });
      }

      dailyDemandByScope.set(scopeKey, existingPressures);
    }

    const incidents: StockoutIncident[] = [];
    for (const [scopeKey, dailyPressures] of [...dailyDemandByScope.entries()].sort((left, right) =>
      left[0].localeCompare(right[0]),
    )) {
      const [skuId, locationId] = scopeKey.split(":");
      if (!skuId || !locationId) {
        continue;
      }
      const scope: InventoryHistoryScope = {
        organizationId,
        skuId,
        locationId,
      };

      const breachedDays: DailyDemandPressure[] = [];
      for (const pressure of dailyPressures
        .filter((item) => item.quantity > 0)
        .sort((left, right) => left.day.getTime() - right.day.getTime())) {
        const snapshot = await this.inventoryHistoryService.calculateSnapshotAt(
          db,
          scope,
          endOfUtcDay(pressure.day),
        );
        if (snapshot.availableToPromiseQty <= 0) {
          breachedDays.push(pressure);
        }
      }

      const segments = this.buildSegments(scope, breachedDays);
      for (const segment of segments) {
        const isOpen = startOfUtcDay(window.end).getTime() === segment.endDay.getTime();
        const incident = await this.stockoutIncidentRepository.upsert(db, {
          organizationId,
          skuId: segment.scope.skuId,
          locationId: segment.scope.locationId,
          incidentStartAt: startOfUtcDay(segment.startDay),
          sourceType: OUTCOME_STOCKOUT_SOURCE_TYPE,
          create: {
            organizationId,
            skuId: segment.scope.skuId,
            locationId: segment.scope.locationId,
            detectedAt: new Date(),
            incidentStartAt: startOfUtcDay(segment.startDay),
            ...(isOpen ? {} : { incidentEndAt: endOfUtcDay(segment.endDay) }),
            severity: segment.maxDailyDemandQty >= 10 || segment.dayCount >= 2 ? "critical" : "warning",
            sourceType: OUTCOME_STOCKOUT_SOURCE_TYPE,
            sourceReference,
          },
          update: {
            detectedAt: new Date(),
            incidentEndAt: isOpen ? null : endOfUtcDay(segment.endDay),
            severity: segment.maxDailyDemandQty >= 10 || segment.dayCount >= 2 ? "critical" : "warning",
            sourceReference,
          },
        });

        incidents.push(incident);

        await this.auditEventRepository.create(db, {
          organizationId,
          actorUserId: options.actorUserId,
          eventType: outcomeAuditEventTypes.stockoutDetected,
          entityType: "StockoutIncident",
          entityId: incident.id,
          payload: {
            skuId: incident.skuId,
            locationId: incident.locationId,
            incidentStartAt: incident.incidentStartAt.toISOString(),
            incidentEndAt: incident.incidentEndAt?.toISOString() ?? null,
            sourceReference,
            rule: STOCKOUT_DETECTION_RULE,
          },
          correlationId: options.correlationId,
        });

        await this.outboxEventRepository.create(db, {
          organizationId,
          eventType: outcomeOutboxEventTypes.stockoutDetected,
          aggregateType: "StockoutIncident",
          aggregateId: incident.id,
          payload: {
            organizationId,
            stockoutIncidentId: incident.id,
            skuId: incident.skuId,
            locationId: incident.locationId,
            incidentStartAt: incident.incidentStartAt.toISOString(),
            incidentEndAt: incident.incidentEndAt?.toISOString() ?? null,
            severity: incident.severity,
            sourceReference,
          },
        });
      }
    }

    return {
      measurementWindowStart: window.start.toISOString(),
      measurementWindowEnd: window.end.toISOString(),
      computedCount: incidents.length,
      incidents: incidents.map(toStockoutIncidentDto),
    };
  }

  private buildSegments(
    scope: InventoryHistoryScope,
    breachedDays: DailyDemandPressure[],
  ): IncidentSegment[] {
    if (breachedDays.length === 0) {
      return [];
    }

    const segments: IncidentSegment[] = [];
    let currentSegment: IncidentSegment = {
      scope,
      startDay: breachedDays[0]!.day,
      endDay: breachedDays[0]!.day,
      maxDailyDemandQty: breachedDays[0]!.quantity,
      dayCount: 1,
    };

    for (const pressure of breachedDays.slice(1)) {
      if (diffUtcDays(pressure.day, currentSegment.endDay) === 1) {
        currentSegment.endDay = pressure.day;
        currentSegment.dayCount += 1;
        currentSegment.maxDailyDemandQty = Math.max(currentSegment.maxDailyDemandQty, pressure.quantity);
        continue;
      }

      segments.push(currentSegment);
      currentSegment = {
        scope,
        startDay: pressure.day,
        endDay: pressure.day,
        maxDailyDemandQty: pressure.quantity,
        dayCount: 1,
      };
    }

    segments.push(currentSegment);
    return segments;
  }
}
