import { ForecastModelType, ForecastScopeType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { BaselineForecastService } from "../../modules/forecasting/baseline-forecast.service.js";

describe("BaselineForecastService", () => {
  it("returns deterministic zero-filled recent-window forecasts", () => {
    const service = new BaselineForecastService();
    const input = {
      scopeType: ForecastScopeType.sku_location,
      scopeReference: {
        skuId: "sku-id",
        locationId: "location-id",
      },
      horizonDays: 3,
      lookbackDays: 14,
      anchorDate: new Date("2026-03-27T00:00:00.000Z"),
      signals: [
        {
          id: "signal-1",
          organizationId: "organization-id",
          skuId: "sku-id",
          locationId: "location-id",
          quantity: 14,
          observedAt: new Date("2026-03-20T12:00:00.000Z"),
          sourceType: "historical_sale",
          sourceReference: "sale-1",
          metadata: null,
          createdAt: new Date("2026-03-27T12:00:00.000Z"),
        },
      ],
    };

    const first = service.forecast(input);
    const second = service.forecast(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(3);
    expect(first.map((point) => point.forecastQty)).toEqual([1, 1, 1]);
    expect(first.map((point) => point.forecastDate.toISOString())).toEqual([
      "2026-03-28T00:00:00.000Z",
      "2026-03-29T00:00:00.000Z",
      "2026-03-30T00:00:00.000Z",
    ]);
    expect(first.every((point) => point.locationId === "location-id")).toBe(true);
  });
});
