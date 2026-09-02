import { AnomalySeverity } from "@prisma/client";

import { AiProviderError } from "./ai-provider.errors.js";
import type {
  AiProvider,
  AiProviderInvocationResult,
  AnomalyScoringProviderInput,
  DecisionExplanationProviderInput,
  ForecastEnhancementProviderInput,
} from "./ai-provider.types.js";

const shouldRetryablyFail = (modelName: string): boolean => modelName.includes("retryable-fail");
const shouldFail = (modelName: string): boolean => shouldRetryablyFail(modelName) || modelName.includes("fail");
const shouldReturnInvalid = (modelName: string): boolean => modelName.includes("invalid");

const assertMockBehavior = (modelName: string): void => {
  if (shouldRetryablyFail(modelName)) {
    throw new AiProviderError("Mock provider produced a retryable failure.", "mock_retryable_failure", true);
  }

  if (shouldFail(modelName)) {
    throw new AiProviderError("Mock provider produced a non-retryable failure.", "mock_failure", false);
  }
};

const clampNonNegativeInt = (value: number): number => Math.max(0, Math.round(value));

export class MockAiProvider implements AiProvider {
  public readonly providerName = "mock";

  public async enhanceForecast(input: ForecastEnhancementProviderInput): Promise<AiProviderInvocationResult> {
    assertMockBehavior(input.model.modelName);

    if (shouldReturnInvalid(input.model.modelName)) {
      return {
        output: {
          adjustedForecasts: [
            {
              forecastDate: "not-a-real-date",
            },
          ],
        },
        latencyMs: 25,
      };
    }

    return {
      output: {
        adjustedForecasts: input.baselineForecasts.map((point) => ({
          skuId: point.skuId,
          locationId: point.locationId,
          forecastDate: point.forecastDate,
          enhancedForecastQty: clampNonNegativeInt(point.forecastQty * 1.1),
          confidenceLow: point.confidenceLow ?? clampNonNegativeInt(point.forecastQty * 0.9),
          confidenceHigh: point.confidenceHigh ?? clampNonNegativeInt(point.forecastQty * 1.25),
        })),
        explanationSummary: "Deterministic mock uplift applied to the baseline forecast.",
      },
      latencyMs: 25,
    };
  }

  public async scoreAnomaly(input: AnomalyScoringProviderInput): Promise<AiProviderInvocationResult> {
    assertMockBehavior(input.model.modelName);

    if (shouldReturnInvalid(input.model.modelName)) {
      return {
        output: {
          anomalyScore: "bad-score",
        },
        latencyMs: 20,
      };
    }

    const demandDelta = Math.abs(input.currentDemandQty - input.previousWindowDemandQty);
    const baselineDemand = Math.max(input.previousWindowDemandQty, 1);
    const score = Math.min(0.99, Math.round((demandDelta / baselineDemand) * 100) / 100);
    const severity =
      score >= 0.8
        ? AnomalySeverity.high
        : score >= 0.4
          ? AnomalySeverity.medium
          : AnomalySeverity.low;

    return {
      output: {
        anomalyScore: score,
        severity,
        explanationSummary: `Current demand is ${input.currentDemandQty} versus ${input.previousWindowDemandQty} in the prior window.`,
        factors: [
          `current_demand:${input.currentDemandQty}`,
          `previous_window_demand:${input.previousWindowDemandQty}`,
          `signal_count:${input.signalCount}`,
        ],
      },
      latencyMs: 20,
    };
  }

  public async explainDecision(input: DecisionExplanationProviderInput): Promise<AiProviderInvocationResult> {
    assertMockBehavior(input.model.modelName);

    if (shouldReturnInvalid(input.model.modelName)) {
      return {
        output: {
          summary: 42,
        },
        latencyMs: 15,
      };
    }

    const bullets = input.decision.reasons.map((reason) => `${reason.code}: ${reason.message}`);

    return {
      output: {
        title: `${input.decision.decisionType} decision explanation`,
        summary: `This ${input.decision.decisionType} decision remains ${input.decision.status} under ${input.decision.automationTier} automation.`,
        bullets: bullets.length > 0 ? bullets : ["No explicit decision reasons were stored for this decision."],
        caution: "This explanation is advisory and does not replace the persisted deterministic rationale.",
      },
      latencyMs: 15,
    };
  }
}
