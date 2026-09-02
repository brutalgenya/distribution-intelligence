import { ExternalDependencyError, RetryableExternalError } from "../../shared/errors.js";

export class BillingProviderConfigurationError extends ExternalDependencyError {
  public constructor(message: string) {
    super(message);
  }
}

export class BillingProviderRetryableError extends RetryableExternalError {
  public constructor(message: string, details?: unknown) {
    super(message, details);
  }
}

export class BillingWebhookVerificationError extends ExternalDependencyError {
  public constructor(message: string, details?: unknown) {
    super(message, details);
  }
}
