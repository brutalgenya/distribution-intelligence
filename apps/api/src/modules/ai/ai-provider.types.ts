import type { ModelRegistryEntry } from "@prisma/client";

import type { DecisionWithDetails } from "../decisioning/decision.repository.js";

export interface AiProviderInvocationResult {
  output: unknown;
  latencyMs: number;
}

export interface ForecastEnhancementProviderInput {
  model: ModelRegistryEntry;
  forecastJobId: string;
  organizationId: string;
  scopeType: string;
  scopeReference: unknown;
  baselineForecasts: ReadonlyArray<{
    skuId: string;
    locationId: string | null;
    forecastDate: string;
    forecastQty: number;
    confidenceLow: number | null;
    confidenceHigh: number | null;
  }>;
}

export interface AnomalyScoringProviderInput {
  model: ModelRegistryEntry;
  organizationId: string;
  subjectType: string;
  subjectReference: string;
  measurementWindowStart: string;
  measurementWindowEnd: string;
  currentDemandQty: number;
  previousWindowDemandQty: number;
  signalCount: number;
}

export interface DecisionExplanationProviderInput {
  model: ModelRegistryEntry;
  organizationId: string;
  decision: DecisionWithDetails;
}

export interface AiProvider {
  readonly providerName: string;
  enhanceForecast(input: ForecastEnhancementProviderInput): Promise<AiProviderInvocationResult>;
  scoreAnomaly(input: AnomalyScoringProviderInput): Promise<AiProviderInvocationResult>;
  explainDecision(input: DecisionExplanationProviderInput): Promise<AiProviderInvocationResult>;
}
