import { Link } from "react-router-dom";

import { AuditTimeline } from "../../../components/ui/AuditTimeline";
import { EmptyState } from "../../../components/ui/EmptyState";
import { ErrorNotice } from "../../../components/ui/ErrorNotice";
import { PageHeader } from "../../../components/ui/PageHeader";
import { PageIntro } from "../../../components/ui/PageIntro";
import { SectionBlock } from "../../../components/ui/SectionBlock";
import { SkeletonBlock } from "../../../components/ui/SkeletonBlock";
import { StatusChip } from "../../../components/ui/StatusChip";
import {
  uiButtonSecondaryClassName,
} from "../../../components/ui/classes";
import { isApiError } from "../../../lib/api/errors";
import { formatDateTime } from "../../../lib/utils/format";
import { useSession } from "../../session/SessionProvider";
import { AnomalyPanel } from "../components/AnomalyPanel";
import { MetricCardGrid } from "../components/MetricCardGrid";
import { PolicyEffectivenessTable } from "../components/PolicyEffectivenessTable";
import { RiskHotspotsTable } from "../components/RiskHotspotsTable";
import { TrendCard } from "../components/TrendCard";
import {
  useAnomalyScores,
  useCatalogSkus,
  useDecisionOutcomes,
  useFillRateMeasurements,
  useForecastErrorMeasurements,
  useInventoryPositions,
  useLocations,
  usePolicyEffectivenessSummaries,
  useStockoutIncidents,
} from "../hooks";
import {
  deriveAnomalyHighlights,
  deriveFillRateTrend,
  deriveForecastErrorTrend,
  deriveOutcomeMetricCards,
  deriveRiskHotspots,
  deriveRiskMetricCards,
  getOutcomesFreshnessLabel,
  getRiskFreshnessLabel,
  sortPolicySummaries,
} from "../selectors";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const RiskAndOutcomesPage = (): JSX.Element => {
  const session = useSession();
  const skuQuery = useCatalogSkus();
  const locationQuery = useLocations();
  const positionsQuery = useInventoryPositions();
  const stockoutsQuery = useStockoutIncidents();
  const anomaliesQuery = useAnomalyScores();
  const fillRateQuery = useFillRateMeasurements();
  const forecastErrorQuery = useForecastErrorMeasurements();
  const decisionOutcomesQuery = useDecisionOutcomes();
  const policySummariesQuery = usePolicyEffectivenessSummaries();

  const skus = skuQuery.data ?? [];
  const locations = locationQuery.data ?? [];
  const positions = positionsQuery.data ?? [];
  const stockouts = stockoutsQuery.data ?? [];
  const anomalies = anomaliesQuery.data ?? [];
  const fillRates = fillRateQuery.data ?? [];
  const forecastErrors = forecastErrorQuery.data ?? [];
  const decisionOutcomes = decisionOutcomesQuery.data ?? [];
  const policySummaries = policySummariesQuery.data ?? [];

  const riskHotspots = deriveRiskHotspots({
    positions,
    stockouts,
    anomalies,
    skus,
    locations,
  });
  const riskCards = deriveRiskMetricCards({
    positions,
    stockouts,
    anomalies,
    hotspots: riskHotspots,
  });
  const anomalyHighlights = deriveAnomalyHighlights({
    anomalies,
    skus,
    locations,
  });
  const fillRateTrend = deriveFillRateTrend(fillRates);
  const forecastErrorTrend = deriveForecastErrorTrend(forecastErrors);
  const outcomeMetricCards = deriveOutcomeMetricCards({
    decisionOutcomes,
    policySummaries,
  });
  const sortedPolicySummaries = sortPolicySummaries(policySummaries);

  const riskFreshness = getRiskFreshnessLabel({
    positions,
    stockouts,
    anomalies,
  });
  const outcomesFreshness = getOutcomesFreshnessLabel({
    fillRates,
    forecastErrors,
    decisionOutcomes,
    policySummaries,
  });

  const riskBaseError =
    positionsQuery.isError || stockoutsQuery.isError
      ? getApiErrorMessage(
          positionsQuery.error ?? stockoutsQuery.error,
          "Inventory risk data could not be loaded.",
        )
      : null;

  const outcomesMetricError =
    decisionOutcomesQuery.isError || policySummariesQuery.isError
      ? getApiErrorMessage(
          decisionOutcomesQuery.error ?? policySummariesQuery.error,
          "Outcome summary metrics could not be loaded.",
        )
      : null;

  if (!session.isConfigured) {
    return (
      <EmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. The app sends those values as x-user-id and x-organization-id on every request."
      />
    );
  }

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Outcomes and Risk"
        title="Operational exposure and measured impact"
        description="Quantify current inventory risk and verify whether policy-governed decisions are actually improving service, coverage, and operating outcomes."
        actions={
          <>
            <Link to="/decisions" className={uiButtonSecondaryClassName}>
              Open decisions
            </Link>
            <Link to="/workflow" className={uiButtonSecondaryClassName}>
              Open workflow
            </Link>
          </>
        }
      />

      <section className="space-y-4">
        <PageHeader
          label="Risk Posture"
          title="Inventory risk"
          description={`Start with current operational exposure: depleted ATP, open stockout incidents, and anomaly signals that deserve attention before the next decision or execution step. ${riskFreshness}`}
          actions={<StatusChip tone="warning">{riskHotspots.length} hotspots</StatusChip>}
        />

        {positionsQuery.isLoading || stockoutsQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonBlock rows={4} variant="metric" />
          </div>
        ) : null}

        {riskBaseError ? <ErrorNotice title="Risk section unavailable" message={riskBaseError} /> : null}

        {!positionsQuery.isLoading && !stockoutsQuery.isLoading && !riskBaseError ? (
          <>
            <MetricCardGrid items={riskCards} />
            <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
              <RiskHotspotsTable hotspots={riskHotspots} />
              {anomaliesQuery.isError ? (
                <ErrorNotice
                  title="Anomaly panel unavailable"
                  message={getApiErrorMessage(
                    anomaliesQuery.error,
                    "Anomaly scores could not be loaded.",
                  )}
                />
              ) : anomaliesQuery.isLoading ? (
                <SkeletonBlock height="h-72" />
              ) : (
                <AnomalyPanel anomalies={anomalyHighlights} />
              )}
            </div>
          </>
        ) : null}
      </section>

      <section className="space-y-4">
        <PageHeader
          label="Impact"
          title="ROI and outcomes"
          description={`Use persisted measurements to see whether decision quality and operational impact are improving over time. This view stays within the metrics the backend actually computes. ${outcomesFreshness}`}
          actions={<StatusChip tone="info">{decisionOutcomes.length} linked outcomes</StatusChip>}
        />

        {decisionOutcomesQuery.isLoading || policySummariesQuery.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonBlock rows={4} variant="metric" />
          </div>
        ) : null}

        {outcomesMetricError ? (
          <ErrorNotice title="Outcome metrics unavailable" message={outcomesMetricError} />
        ) : !decisionOutcomesQuery.isLoading && !policySummariesQuery.isLoading ? (
          <MetricCardGrid items={outcomeMetricCards} />
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {fillRateQuery.isError ? (
            <ErrorNotice
              title="Fill-rate trend unavailable"
              message={getApiErrorMessage(fillRateQuery.error, "Fill-rate measurements could not be loaded.")}
            />
          ) : fillRateQuery.isLoading ? (
            <SkeletonBlock height="h-60" />
          ) : (
            <TrendCard trend={fillRateTrend} />
          )}

          {forecastErrorQuery.isError ? (
            <ErrorNotice
              title="Forecast error trend unavailable"
              message={getApiErrorMessage(
                forecastErrorQuery.error,
                "Forecast error measurements could not be loaded.",
              )}
            />
          ) : forecastErrorQuery.isLoading ? (
            <SkeletonBlock height="h-60" />
          ) : (
            <TrendCard trend={forecastErrorTrend} />
          )}
        </div>

        {policySummariesQuery.isError ? (
          <ErrorNotice
            title="Policy effectiveness unavailable"
            message={getApiErrorMessage(
              policySummariesQuery.error,
              "Policy effectiveness summaries could not be loaded.",
            )}
          />
        ) : policySummariesQuery.isLoading ? (
          <SkeletonBlock height="h-72" />
        ) : sortedPolicySummaries.length > 0 ? (
          <PolicyEffectivenessTable summaries={sortedPolicySummaries} />
        ) : (
          <EmptyState
            title="No policy effectiveness summaries yet"
            message="The backend has not persisted policy-level outcome summaries for this tenant yet, so the ROI section is showing only the measurements that are currently available."
          />
        )}
      </section>

      <SectionBlock
        label="Automation Ledger"
        title="Latest measured validations"
        description="Recent linked outcomes are rendered as an evidence ledger rather than a mock analytics feed."
      >
        <AuditTimeline
          items={decisionOutcomes
            .slice()
            .sort(
              (left, right) =>
                new Date(right.computedAt).getTime() - new Date(left.computedAt).getTime(),
            )
            .slice(0, 6)
            .map((outcome) => ({
              id: outcome.id,
              eyebrow: outcome.outcomeStatus,
              title: `Decision ${outcome.decisionId.slice(0, 8)} validated`,
              description: `Measured ${formatDateTime(outcome.measurementWindowStart)} to ${formatDateTime(outcome.measurementWindowEnd)}. ${
                outcome.stockoutAvoided === null
                  ? "No stockout verdict was computed."
                  : outcome.stockoutAvoided
                    ? "Stockout avoidance was confirmed."
                    : "The stockout avoidance target was not met."
              }`,
              timestamp: outcome.computedAt,
              tone: outcome.outcomeStatus === "computed" ? "positive" : "warning",
            }))}
          empty={
            <EmptyState
              title="No validated outcomes yet"
              message="Linked decision outcomes have not been computed for this tenant yet."
            />
          }
        />
      </SectionBlock>
    </div>
  );
};
