import { ForecastScopeType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import type { DbClient } from "../../infrastructure/db/types.js";
import { DemandSignalRepository } from "./demand-signal.repository.js";
import type { ForecastScopeReference, NormalizedDemandSignal } from "../forecasting/forecasting.types.js";

export class DemandSignalService {
  public constructor(private readonly demandSignalRepository: DemandSignalRepository) {}

  public appendSignals(db: DbClient, data: Prisma.DemandSignalCreateManyInput[]): Promise<void> {
    return this.demandSignalRepository.createMany(db, data);
  }

  public async listSignalsForForecast(
    db: DbClient,
    input: {
      organizationId: string;
      scopeType: ForecastScopeType;
      scopeReference: ForecastScopeReference | null;
      observedAtGte: Date;
      observedAtLte: Date;
      createdAtLte: Date;
    },
  ): Promise<NormalizedDemandSignal[]> {
    const scopeFilters = {
      ...(input.scopeType === ForecastScopeType.sku || input.scopeType === ForecastScopeType.sku_location
        ? input.scopeReference?.skuId
          ? { skuId: input.scopeReference.skuId }
          : {}
        : {}),
      ...(input.scopeType === ForecastScopeType.sku_location
        ? input.scopeReference?.locationId
          ? { locationId: input.scopeReference.locationId }
          : {}
        : {}),
    };

    const signals = await this.demandSignalRepository.listByOrganization(db, {
      organizationId: input.organizationId,
      observedAtGte: input.observedAtGte,
      observedAtLte: input.observedAtLte,
      createdAtLte: input.createdAtLte,
      ...scopeFilters,
    });

    return signals.map((signal) => ({
      id: signal.id,
      organizationId: signal.organizationId,
      skuId: signal.skuId,
      locationId: signal.locationId,
      quantity: signal.quantity,
      observedAt: signal.observedAt,
      sourceType: signal.sourceType,
      sourceReference: signal.sourceReference,
      metadata: signal.metadata,
      createdAt: signal.createdAt,
    }));
  }
}
