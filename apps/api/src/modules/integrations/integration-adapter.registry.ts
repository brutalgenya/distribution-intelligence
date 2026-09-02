import { IntegrationType } from "@prisma/client";

import { NotFoundError } from "../../shared/errors.js";
import type { IntegrationAdapter } from "./integration-adapter.types.js";

export class IntegrationAdapterRegistry {
  private readonly adaptersByType: Map<IntegrationType, IntegrationAdapter>;

  public constructor(adapters: IntegrationAdapter[]) {
    this.adaptersByType = new Map(adapters.map((adapter) => [adapter.supportedIntegrationType, adapter]));
  }

  public resolve(integrationType: IntegrationType): IntegrationAdapter {
    const adapter = this.adaptersByType.get(integrationType);
    if (!adapter) {
      throw new NotFoundError(`No integration adapter is registered for ${integrationType}.`);
    }

    return adapter;
  }
}
