import { NotFoundError } from "../../shared/errors.js";
import type { AiProvider } from "./ai-provider.types.js";

export class AiProviderRegistry {
  private readonly providersByName: Map<string, AiProvider>;

  public constructor(providers: AiProvider[]) {
    this.providersByName = new Map(providers.map((provider) => [provider.providerName, provider]));
  }

  public getProvider(providerName: string): AiProvider {
    const provider = this.providersByName.get(providerName);
    if (!provider) {
      throw new NotFoundError(`AI provider '${providerName}' is not registered.`);
    }

    return provider;
  }
}
