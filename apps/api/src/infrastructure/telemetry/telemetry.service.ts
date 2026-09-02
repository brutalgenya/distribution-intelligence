import type { MetricTags } from "./metrics-registry.js";
import { InMemoryMetricsRegistry } from "./metrics-registry.js";

export class TelemetryService {
  public constructor(private readonly metricsRegistry: InMemoryMetricsRegistry) {}

  public incrementCounter(name: string, value = 1, tags?: MetricTags): void {
    this.metricsRegistry.incrementCounter(name, value, tags);
  }

  public setGauge(name: string, value: number, tags?: MetricTags): void {
    this.metricsRegistry.setGauge(name, value, tags);
  }

  public recordDuration(name: string, durationMs: number, tags?: MetricTags): void {
    this.metricsRegistry.recordDuration(name, durationMs, tags);
  }

  public async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    tags?: MetricTags,
  ): Promise<T> {
    const start = process.hrtime.bigint();

    try {
      return await operation();
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      this.recordDuration(name, durationMs, tags);
    }
  }

  public snapshot() {
    return this.metricsRegistry.snapshot();
  }
}
