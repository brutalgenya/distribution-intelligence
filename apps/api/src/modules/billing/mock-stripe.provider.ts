import { randomUUID } from "node:crypto";

import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import type {
  BillingProvider,
  BillingProviderCheckoutCustomerInput,
  BillingProviderCheckoutInput,
  BillingProviderCheckoutResult,
  BillingProviderPortalInput,
  BillingProviderPortalResult,
  BillingProviderWebhookInput,
  BillingWebhookEvent,
} from "./billing-provider.types.js";
import { normalizeStripeWebhookEvent } from "./stripe-event-normalization.js";

export class MockStripeBillingProvider implements BillingProvider {
  public readonly providerName = "mock" as const;

  public constructor(
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async ensureCustomer(
    input: BillingProviderCheckoutCustomerInput,
  ): Promise<{ customerId: string }> {
    if (input.existingCustomerId) {
      return { customerId: input.existingCustomerId };
    }

    const customerId = `cus_mock_${input.organizationId.replace(/-/g, "").slice(0, 24)}`;
    this.telemetryService.incrementCounter("billing.provider.customer.created", 1, {
      provider: this.providerName,
    });
    this.logger.info(
      "Mock billing customer resolved.",
      { customerId },
      { module: "billing", operation: "ensureCustomer", organizationId: input.organizationId },
    );

    return { customerId };
  }

  public async createCheckoutSession(
    input: BillingProviderCheckoutInput,
  ): Promise<BillingProviderCheckoutResult> {
    const sessionId = `cs_mock_${randomUUID().replace(/-/g, "")}`;
    const result = {
      sessionId,
      url: `https://mock.stripe.local/checkout/${sessionId}`,
      customerId: input.customerId,
    } satisfies BillingProviderCheckoutResult;

    this.telemetryService.incrementCounter("billing.provider.checkout.created", 1, {
      provider: this.providerName,
    });

    return result;
  }

  public async createPortalSession(input: BillingProviderPortalInput): Promise<BillingProviderPortalResult> {
    const sessionId = `bps_mock_${randomUUID().replace(/-/g, "")}`;
    const result = {
      sessionId,
      url: `https://mock.stripe.local/portal/${sessionId}?customer=${input.customerId}`,
    } satisfies BillingProviderPortalResult;

    this.telemetryService.incrementCounter("billing.provider.portal.created", 1, {
      provider: this.providerName,
    });

    return result;
  }

  public async verifyAndParseWebhook(input: BillingProviderWebhookInput): Promise<BillingWebhookEvent> {
    const parsedPayload = JSON.parse(input.rawBody) as unknown;
    const event = normalizeStripeWebhookEvent(parsedPayload);

    this.telemetryService.incrementCounter("billing.provider.webhook.parsed", 1, {
      provider: this.providerName,
      eventType: event.eventType,
    });

    return event;
  }
}
