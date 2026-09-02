import type { AppConfig } from "../../infrastructure/config/env.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type { BillingProvider } from "./billing-provider.types.js";
import { MockStripeBillingProvider } from "./mock-stripe.provider.js";
import { StripeHttpBillingProvider } from "./stripe-http.provider.js";

export const createBillingProvider = (
  config: AppConfig,
  telemetryService: TelemetryService,
  logger: AppLogger,
): BillingProvider => {
  if (config.BILLING_PROVIDER === "stripe") {
    return new StripeHttpBillingProvider(config, telemetryService, logger);
  }

  return new MockStripeBillingProvider(telemetryService, logger);
};
