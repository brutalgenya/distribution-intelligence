import type { Prisma } from "@prisma/client";

export type ForecastScopeReference = Prisma.InputJsonObject & {
  skuId?: string | undefined;
  locationId?: string | undefined;
};

export interface NormalizedDemandSignal {
  id: string;
  organizationId: string;
  skuId: string;
  locationId: string | null;
  quantity: number;
  observedAt: Date;
  sourceType: string;
  sourceReference: string;
  metadata: unknown;
  createdAt: Date;
}

export interface BaselineForecastPoint {
  skuId: string;
  locationId: string | null;
  forecastDate: Date;
  forecastQty: number;
  confidenceLow: number | null;
  confidenceHigh: number | null;
}
