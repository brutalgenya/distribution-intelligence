import { describe, expect, it } from "vitest";

import { InMemoryMetricsRegistry } from "../../infrastructure/telemetry/metrics-registry.js";

describe("InMemoryMetricsRegistry", () => {
  it("tracks counters, gauges, and timers with tag separation", () => {
    const registry = new InMemoryMetricsRegistry();

    registry.incrementCounter("http.request.count", 1, { method: "GET" });
    registry.incrementCounter("http.request.count", 2, { method: "GET" });
    registry.setGauge("execution.queue.depth", 3, { organizationId: "org-1" });
    registry.recordDuration("execution.task.duration_ms", 150, { workerType: "execution" });
    registry.recordDuration("execution.task.duration_ms", 250, { workerType: "execution" });

    const snapshot = registry.snapshot();

    expect(snapshot.counters).toEqual([
      expect.objectContaining({
        name: "http.request.count",
        value: 3,
        tags: { method: "GET" },
      }),
    ]);
    expect(snapshot.gauges).toEqual([
      expect.objectContaining({
        name: "execution.queue.depth",
        value: 3,
      }),
    ]);
    expect(snapshot.timers).toEqual([
      expect.objectContaining({
        name: "execution.task.duration_ms",
        count: 2,
        minMs: 150,
        maxMs: 250,
        avgMs: 200,
      }),
    ]);
  });
});
