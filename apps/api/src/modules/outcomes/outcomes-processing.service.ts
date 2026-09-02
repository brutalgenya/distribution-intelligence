import { randomUUID } from "node:crypto";

import type { DbClient } from "../../infrastructure/db/types.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { OrganizationRepository } from "../tenancy/organization.repository.js";
import { DEFAULT_OUTCOME_WINDOW_DAYS } from "./outcomes.constants.js";
import { DecisionOutcomeService } from "./decision-outcome.service.js";
import { FillRateService } from "./fill-rate.service.js";
import { ForecastErrorService } from "./forecast-error.service.js";
import type { OutcomesProcessingSummaryDto } from "./outcomes.schemas.js";
import { PolicyEffectivenessService } from "./policy-effectiveness.service.js";
import { StockoutDetectionService } from "./stockout-detection.service.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export class OutcomesProcessingService {
  public constructor(
    private readonly db: DbClient,
    private readonly organizationRepository: OrganizationRepository,
    private readonly stockoutDetectionService: StockoutDetectionService,
    private readonly fillRateService: FillRateService,
    private readonly forecastErrorService: ForecastErrorService,
    private readonly decisionOutcomeService: DecisionOutcomeService,
    private readonly policyEffectivenessService: PolicyEffectivenessService,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async processRecentWindow(
    windowDays = DEFAULT_OUTCOME_WINDOW_DAYS,
  ): Promise<OutcomesProcessingSummaryDto> {
    const end = new Date();
    const start = new Date(end.getTime() - windowDays * DAY_IN_MS);
    const organizations = await this.organizationRepository.listAll(this.db);

    let stockoutCount = 0;
    let fillRateCount = 0;
    let forecastErrorCount = 0;
    let decisionOutcomeCount = 0;
    let policySummaryCount = 0;

    for (const organization of organizations) {
      const summary = await this.processWindowForOrganization(organization.id, {
        measurementWindowStart: start.toISOString(),
        measurementWindowEnd: end.toISOString(),
        correlationId: randomUUID(),
        actorUserId: null,
      });
      stockoutCount += summary.stockoutCount;
      fillRateCount += summary.fillRateCount;
      forecastErrorCount += summary.forecastErrorCount;
      decisionOutcomeCount += summary.decisionOutcomeCount;
      policySummaryCount += summary.policySummaryCount;
    }

    const summary = {
      measurementWindowStart: start.toISOString(),
      measurementWindowEnd: end.toISOString(),
      stockoutCount,
      fillRateCount,
      forecastErrorCount,
      decisionOutcomeCount,
      policySummaryCount,
    } satisfies OutcomesProcessingSummaryDto;

    this.telemetryService.incrementCounter("outcomes.job.succeeded");
    this.logger.info("Outcome processing window completed.", summary, {
      module: "outcomes",
      operation: "processRecentWindow",
    });

    return summary;
  }

  public async processWindowForOrganization(
    organizationId: string,
    input: {
      measurementWindowStart: string;
      measurementWindowEnd: string;
      correlationId: string;
      actorUserId: string | null;
    },
  ): Promise<OutcomesProcessingSummaryDto> {
    return this.telemetryService.measureAsync(
      "outcomes.job.duration_ms",
      async () => {
        const stockouts = await this.stockoutDetectionService.computeStockoutsAsSystem(
          organizationId,
          {
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
          input.correlationId,
        );

        const fillRates = await this.fillRateService.computeFillRateAsSystem(
          organizationId,
          {
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
          input.correlationId,
        );

        const forecastErrors = await this.forecastErrorService.computeForecastErrorAsSystem(
          organizationId,
          {
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
          input.correlationId,
        );

        const decisionOutcomes = await this.decisionOutcomeService.computeDecisionOutcomesAsSystem(
          organizationId,
          {
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
          input.correlationId,
        );

        const policySummaries = await this.policyEffectivenessService.computePolicyEffectivenessAsSystem(
          organizationId,
          {
            measurementWindowStart: input.measurementWindowStart,
            measurementWindowEnd: input.measurementWindowEnd,
          },
          input.correlationId,
        );

        return {
          measurementWindowStart: input.measurementWindowStart,
          measurementWindowEnd: input.measurementWindowEnd,
          stockoutCount: stockouts.computedCount,
          fillRateCount: fillRates.computedCount,
          forecastErrorCount: forecastErrors.computedCount,
          decisionOutcomeCount: decisionOutcomes.computedCount,
          policySummaryCount: policySummaries.computedCount,
        } satisfies OutcomesProcessingSummaryDto;
      },
      { organizationId },
    );
  }
}
