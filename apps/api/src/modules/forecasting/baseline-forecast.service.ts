import { ForecastScopeType } from "@prisma/client";

import { BASELINE_FORECAST_CONFIDENCE_FACTOR } from "./forecasting.constants.js";
import { addUtcDays, toUtcDayStart } from "./forecasting-dates.js";
import type {
  BaselineForecastPoint,
  ForecastScopeReference,
  NormalizedDemandSignal,
} from "./forecasting.types.js";

const groupKeyForSignal = (scopeType: ForecastScopeType, signal: NormalizedDemandSignal): string =>
  scopeType === ForecastScopeType.sku ? signal.skuId : `${signal.skuId}:${signal.locationId ?? "none"}`;

export class BaselineForecastService {
  public forecast(input: {
    scopeType: ForecastScopeType;
    scopeReference: ForecastScopeReference | null;
    horizonDays: number;
    lookbackDays: number;
    anchorDate: Date;
    signals: NormalizedDemandSignal[];
  }): BaselineForecastPoint[] {
    const anchorDate = toUtcDayStart(input.anchorDate);
    const lookbackStart = addUtcDays(anchorDate, -(input.lookbackDays - 1));

    const seriesMap = new Map<string, { skuId: string; locationId: string | null; daily: Map<string, number> }>();

    for (const signal of input.signals) {
      const key = groupKeyForSignal(input.scopeType, signal);
      const locationId = input.scopeType === ForecastScopeType.sku ? null : signal.locationId;

      const existingSeries = seriesMap.get(key) ?? {
        skuId: signal.skuId,
        locationId,
        daily: new Map<string, number>(),
      };

      const observedDay = toUtcDayStart(signal.observedAt).toISOString();
      existingSeries.daily.set(observedDay, (existingSeries.daily.get(observedDay) ?? 0) + signal.quantity);
      seriesMap.set(key, existingSeries);
    }

    if (input.scopeType === ForecastScopeType.sku && input.scopeReference?.skuId && seriesMap.size === 0) {
      seriesMap.set(input.scopeReference.skuId, {
        skuId: input.scopeReference.skuId,
        locationId: null,
        daily: new Map<string, number>(),
      });
    }

    if (
      input.scopeType === ForecastScopeType.sku_location &&
      input.scopeReference?.skuId &&
      input.scopeReference.locationId &&
      seriesMap.size === 0
    ) {
      seriesMap.set(`${input.scopeReference.skuId}:${input.scopeReference.locationId}`, {
        skuId: input.scopeReference.skuId,
        locationId: input.scopeReference.locationId,
        daily: new Map<string, number>(),
      });
    }

    const points: BaselineForecastPoint[] = [];

    for (const series of seriesMap.values()) {
      let total = 0;

      for (let offset = 0; offset < input.lookbackDays; offset += 1) {
        const day = addUtcDays(lookbackStart, offset).toISOString();
        total += series.daily.get(day) ?? 0;
      }

      const averageQty = Math.max(0, Math.round(total / input.lookbackDays));
      const confidenceLow = Math.max(0, Math.floor(averageQty * (1 - BASELINE_FORECAST_CONFIDENCE_FACTOR)));
      const confidenceHigh = Math.ceil(averageQty * (1 + BASELINE_FORECAST_CONFIDENCE_FACTOR));

      for (let horizonOffset = 1; horizonOffset <= input.horizonDays; horizonOffset += 1) {
        points.push({
          skuId: series.skuId,
          locationId: series.locationId,
          forecastDate: addUtcDays(anchorDate, horizonOffset),
          forecastQty: averageQty,
          confidenceLow,
          confidenceHigh,
        });
      }
    }

    return points;
  }
}
