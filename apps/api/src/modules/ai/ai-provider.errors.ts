export class AiProviderError extends Error {
  public constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export const isAiProviderError = (error: unknown): error is AiProviderError => error instanceof AiProviderError;
