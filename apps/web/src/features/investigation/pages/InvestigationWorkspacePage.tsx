import { useSearchParams } from "react-router-dom";

import { isApiError } from "../../../lib/api/errors";
import { useSession } from "../../session/SessionProvider";
import { DecisionWorkflowSection } from "../components/DecisionWorkflowSection";
import { ForecastDemandSection } from "../components/ForecastDemandSection";
import { InvestigationHeader } from "../components/InvestigationHeader";
import {
  InvestigationEmptyState,
  InvestigationErrorNotice,
  InvestigationSectionSkeleton,
} from "../components/InvestigationStates";
import { InventoryStateSection } from "../components/InventoryStateSection";
import { OutcomesIncidentsSection } from "../components/OutcomesIncidentsSection";
import { SupplyCoverageSection } from "../components/SupplyCoverageSection";
import {
  useInvestigationContext,
  useInvestigationDecisions,
  useInvestigationForecastDemand,
  useInvestigationParams,
  useInvestigationSignals,
  useInvestigationSupply,
} from "../hooks";
import { buildInvestigationHref } from "../route";
import { deriveRiskSummary } from "../selectors";

const getApiErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? `${error.message} Correlation: ${error.correlationId}.` : fallback;

export const InvestigationWorkspacePage = (): JSX.Element => {
  const session = useSession();
  const [searchParams] = useSearchParams();
  const params = useInvestigationParams();

  const contextQuery = useInvestigationContext(params);
  const signalsQuery = useInvestigationSignals(params);
  const forecastDemandQuery = useInvestigationForecastDemand(params);
  const supplyQuery = useInvestigationSupply(params);
  const decisionsQuery = useInvestigationDecisions(params);

  if (!session.isConfigured) {
    return (
      <InvestigationEmptyState
        title="Set demo session headers"
        message="Paste the seeded demo user id and organization id into the session panel above. The investigation workspace uses those values on every request to the real API."
      />
    );
  }

  if (params === null) {
    return (
      <div className="page-stack">
        <InvestigationEmptyState
          title="Choose a SKU and location to investigate"
          message={`Open this view with shareable query parameters like /investigation?skuId=<uuid>&locationId=<uuid>, or jump in from a hotspot row in /outcomes. Current query: ${searchParams.toString() || "none"}.`}
        />
      </div>
    );
  }

  if (contextQuery.isLoading || signalsQuery.isLoading) {
    return (
      <div className="page-stack">
        <InvestigationSectionSkeleton rows={4} />
        <InvestigationSectionSkeleton rows={3} />
      </div>
    );
  }

  if (contextQuery.isError) {
    return (
      <div className="page-stack">
        <InvestigationErrorNotice
          title="Investigation context unavailable"
          message={getApiErrorMessage(
            contextQuery.error,
            "The SKU or location context could not be loaded.",
          )}
        />
      </div>
    );
  }

  if (signalsQuery.isError) {
    return (
      <div className="page-stack">
        <InvestigationErrorNotice
          title="Risk signals unavailable"
          message={getApiErrorMessage(
            signalsQuery.error,
            "The investigation signals could not be loaded.",
          )}
        />
      </div>
    );
  }

  const context = contextQuery.data;
  const signals = signalsQuery.data;

  if (!context || !signals) {
    return (
      <div className="page-stack">
        <InvestigationEmptyState
          title="Investigation data unavailable"
          message="The requested SKU/location scope did not return enough persisted data to open the investigation workspace."
        />
      </div>
    );
  }

  const riskSummary = deriveRiskSummary(context, signals);
  const decisionData = decisionsQuery.data ?? { decisions: [] };

  return (
    <div className="page-stack">
      <InvestigationHeader
        context={context}
        riskSummary={riskSummary}
        investigationHref={buildInvestigationHref(params.skuId, params.locationId)}
      />

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <InventoryStateSection context={context} />

          {forecastDemandQuery.isLoading ? (
            <InvestigationSectionSkeleton rows={3} />
          ) : forecastDemandQuery.isError ? (
            <InvestigationErrorNotice
              title="Forecast and demand context unavailable"
              message={getApiErrorMessage(
                forecastDemandQuery.error,
                "Forecast snapshots or demand context could not be loaded.",
              )}
            />
          ) : forecastDemandQuery.data ? (
            <ForecastDemandSection forecastDemand={forecastDemandQuery.data} signals={signals} />
          ) : (
            <InvestigationEmptyState
              title="Forecast and demand context unavailable"
              message="No forecast or demand context was returned for this scope."
            />
          )}
        </div>

        {decisionsQuery.isLoading ? (
          <InvestigationSectionSkeleton rows={4} />
        ) : decisionsQuery.isError ? (
          <InvestigationErrorNotice
            title="Decision and workflow context unavailable"
            message={getApiErrorMessage(
              decisionsQuery.error,
              "Related decisions or execution history could not be loaded.",
            )}
          />
        ) : (
          <OutcomesIncidentsSection signals={signals} decisionData={decisionData} />
        )}
      </div>

      {supplyQuery.isLoading ? (
        <InvestigationSectionSkeleton rows={4} />
      ) : supplyQuery.isError ? (
        <InvestigationErrorNotice
          title="Supply coverage unavailable"
          message={getApiErrorMessage(
            supplyQuery.error,
            "Supplier mappings or purchase-order coverage could not be loaded.",
          )}
        />
      ) : supplyQuery.data ? (
        <SupplyCoverageSection supply={supplyQuery.data} params={params} />
      ) : null}

      {decisionsQuery.isLoading ? (
        <InvestigationSectionSkeleton rows={4} />
      ) : decisionsQuery.isError ? (
        <InvestigationErrorNotice
          title="Decision and workflow context unavailable"
          message={getApiErrorMessage(
            decisionsQuery.error,
            "Related decisions or execution history could not be loaded.",
          )}
        />
      ) : (
        <DecisionWorkflowSection decisionData={decisionData} />
      )}
    </div>
  );
};
