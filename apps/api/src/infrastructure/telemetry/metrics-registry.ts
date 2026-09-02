export interface MetricTags {
  [key: string]: string | number | boolean | null | undefined;
}

export interface CounterMetricSnapshot {
  name: string;
  tags: Record<string, string>;
  value: number;
  updatedAt: string;
}

export interface GaugeMetricSnapshot {
  name: string;
  tags: Record<string, string>;
  value: number;
  updatedAt: string;
}

export interface TimerMetricSnapshot {
  name: string;
  tags: Record<string, string>;
  count: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
  avgMs: number;
  updatedAt: string;
}

export interface MetricsSnapshot {
  generatedAt: string;
  counters: CounterMetricSnapshot[];
  gauges: GaugeMetricSnapshot[];
  timers: TimerMetricSnapshot[];
}

interface CounterMetricValue {
  name: string;
  tags: Record<string, string>;
  value: number;
  updatedAt: Date;
}

interface GaugeMetricValue {
  name: string;
  tags: Record<string, string>;
  value: number;
  updatedAt: Date;
}

interface TimerMetricValue {
  name: string;
  tags: Record<string, string>;
  count: number;
  minMs: number;
  maxMs: number;
  totalMs: number;
  updatedAt: Date;
}

const normalizeTags = (tags?: MetricTags): Record<string, string> =>
  Object.fromEntries(
    Object.entries(tags ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, String(value)]),
  );

const buildMetricKey = (name: string, tags: Record<string, string>): string =>
  `${name}:${JSON.stringify(tags)}`;

export class InMemoryMetricsRegistry {
  private readonly counters = new Map<string, CounterMetricValue>();
  private readonly gauges = new Map<string, GaugeMetricValue>();
  private readonly timers = new Map<string, TimerMetricValue>();

  public incrementCounter(name: string, value = 1, tags?: MetricTags): void {
    const normalizedTags = normalizeTags(tags);
    const key = buildMetricKey(name, normalizedTags);
    const existing = this.counters.get(key);
    const now = new Date();

    this.counters.set(key, {
      name,
      tags: normalizedTags,
      value: (existing?.value ?? 0) + value,
      updatedAt: now,
    });
  }

  public setGauge(name: string, value: number, tags?: MetricTags): void {
    const normalizedTags = normalizeTags(tags);
    const key = buildMetricKey(name, normalizedTags);

    this.gauges.set(key, {
      name,
      tags: normalizedTags,
      value,
      updatedAt: new Date(),
    });
  }

  public recordDuration(name: string, durationMs: number, tags?: MetricTags): void {
    const normalizedTags = normalizeTags(tags);
    const key = buildMetricKey(name, normalizedTags);
    const now = new Date();
    const existing = this.timers.get(key);

    this.timers.set(key, {
      name,
      tags: normalizedTags,
      count: (existing?.count ?? 0) + 1,
      minMs: existing ? Math.min(existing.minMs, durationMs) : durationMs,
      maxMs: existing ? Math.max(existing.maxMs, durationMs) : durationMs,
      totalMs: (existing?.totalMs ?? 0) + durationMs,
      updatedAt: now,
    });
  }

  public snapshot(): MetricsSnapshot {
    return {
      generatedAt: new Date().toISOString(),
      counters: Array.from(this.counters.values()).map((metric) => ({
        ...metric,
        updatedAt: metric.updatedAt.toISOString(),
      })),
      gauges: Array.from(this.gauges.values()).map((metric) => ({
        ...metric,
        updatedAt: metric.updatedAt.toISOString(),
      })),
      timers: Array.from(this.timers.values()).map((metric) => ({
        name: metric.name,
        tags: metric.tags,
        count: metric.count,
        minMs: metric.minMs,
        maxMs: metric.maxMs,
        totalMs: metric.totalMs,
        avgMs: metric.count === 0 ? 0 : metric.totalMs / metric.count,
        updatedAt: metric.updatedAt.toISOString(),
      })),
    };
  }

  public reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.timers.clear();
  }
}
