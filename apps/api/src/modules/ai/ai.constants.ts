export const aiAuditEventTypes = {
  modelRegistered: "ai.model.registered",
  modelUpdated: "ai.model.updated",
  runStarted: "ai.run.started",
  runSucceeded: "ai.run.succeeded",
  runFailed: "ai.run.failed",
  runDegraded: "ai.run.degraded",
  forecastEnhanced: "forecast.enhanced",
  anomalyScored: "anomaly.scored",
  decisionExplanationGenerated: "decision.explanation.generated",
} as const;

export const aiOutboxEventTypes = {
  modelRegistered: "ai.model.registered.v1",
  modelUpdated: "ai.model.updated.v1",
  runStarted: "ai.run.started.v1",
  runSucceeded: "ai.run.succeeded.v1",
  runFailed: "ai.run.failed.v1",
  runDegraded: "ai.run.degraded.v1",
  forecastEnhanced: "forecast.enhanced.v1",
  anomalyScored: "anomaly.scored.v1",
  decisionExplanationGenerated: "decision.explanation.generated.v1",
} as const;

export const aiSubjectTypes = {
  decision: "Decision",
  forecastJob: "ForecastJob",
  anomalyScope: "AnomalyScope",
} as const;
