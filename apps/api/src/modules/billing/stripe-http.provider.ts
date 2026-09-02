import { createHmac, timingSafeEqual } from "node:crypto";

import type { AppConfig } from "../../infrastructure/config/env.js";
import { AppLogger } from "../../infrastructure/logging/app-logger.js";
import { TelemetryService } from "../../infrastructure/telemetry/telemetry.service.js";
import { ExternalDependencyError } from "../../shared/errors.js";
import {
  BillingProviderConfigurationError,
  BillingProviderRetryableError,
  BillingWebhookVerificationError,
} from "./billing-provider.errors.js";
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

const buildStripeRequestBody = (input: Record<string, string>): URLSearchParams => {
  const body = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    body.append(key, value);
  }

  return body;
};

const requireString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new ExternalDependencyError(`Stripe response is missing ${fieldName}.`);
  }

  return value;
};

const parseStripeSignature = (signatureHeader: string): { timestamp: string; signatures: string[] } => {
  const parts = signatureHeader.split(",").map((entry) => entry.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    throw new BillingWebhookVerificationError("Stripe signature header is malformed.");
  }

  return { timestamp, signatures };
};

export class StripeHttpBillingProvider implements BillingProvider {
  public readonly providerName = "stripe" as const;

  public constructor(
    private readonly config: AppConfig,
    private readonly telemetryService: TelemetryService,
    private readonly logger: AppLogger,
  ) {}

  public async ensureCustomer(
    input: BillingProviderCheckoutCustomerInput,
  ): Promise<{ customerId: string }> {
    if (input.existingCustomerId) {
      return { customerId: input.existingCustomerId };
    }

    const response = await this.postToStripe("/v1/customers", {
      email: input.contactEmail,
      name: input.organizationName,
      "metadata[organizationId]": input.organizationId,
    });
    const json = (await response.json()) as Record<string, unknown>;

    return { customerId: requireString(json.id, "customer.id") };
  }

  public async createCheckoutSession(
    input: BillingProviderCheckoutInput,
  ): Promise<BillingProviderCheckoutResult> {
    const response = await this.postToStripe("/v1/checkout/sessions", {
      mode: "subscription",
      customer: input.customerId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": "1",
      "metadata[organizationId]": input.organizationId,
      "metadata[planCode]": input.planCode,
      "metadata[priceId]": input.priceId,
      client_reference_id: input.organizationId,
    });
    const json = (await response.json()) as Record<string, unknown>;

    return {
      sessionId: requireString(json.id, "checkout_session.id"),
      url: requireString(json.url, "checkout_session.url"),
      customerId: input.customerId,
    };
  }

  public async createPortalSession(input: BillingProviderPortalInput): Promise<BillingProviderPortalResult> {
    const response = await this.postToStripe("/v1/billing_portal/sessions", {
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    const json = (await response.json()) as Record<string, unknown>;

    return {
      sessionId: requireString(json.id, "billing_portal_session.id"),
      url: requireString(json.url, "billing_portal_session.url"),
    };
  }

  public async verifyAndParseWebhook(input: BillingProviderWebhookInput): Promise<BillingWebhookEvent> {
    const webhookSecret = this.config.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new BillingProviderConfigurationError("STRIPE_WEBHOOK_SECRET is required for Stripe webhook handling.");
    }

    if (!input.signature) {
      throw new BillingWebhookVerificationError("Missing Stripe signature header.");
    }

    const { timestamp, signatures } = parseStripeSignature(input.signature);
    const signedPayload = `${timestamp}.${input.rawBody}`;
    const computedSignature = createHmac("sha256", webhookSecret).update(signedPayload, "utf8").digest("hex");

    const isSignatureValid = signatures.some((signature) => {
      const provided = Buffer.from(signature, "hex");
      const expected = Buffer.from(computedSignature, "hex");

      return provided.length === expected.length && timingSafeEqual(provided, expected);
    });

    if (!isSignatureValid) {
      throw new BillingWebhookVerificationError("Stripe signature verification failed.");
    }

    const parsedPayload = JSON.parse(input.rawBody) as unknown;
    return normalizeStripeWebhookEvent(parsedPayload);
  }

  private async postToStripe(path: string, body: Record<string, string>): Promise<Response> {
    const secretKey = this.config.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BillingProviderConfigurationError("STRIPE_SECRET_KEY is required for Stripe billing calls.");
    }

    return this.telemetryService.measureAsync(
      "billing.provider.http.duration_ms",
      async () => {
        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), this.config.EXTERNAL_REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(`${this.config.STRIPE_API_BASE_URL}${path}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${secretKey}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: buildStripeRequestBody(body),
            signal: abortController.signal,
          });
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            this.logger.warn(
              "Stripe billing request timed out.",
              { path, timeoutMs: this.config.EXTERNAL_REQUEST_TIMEOUT_MS },
              { module: "billing", operation: "stripeRequest" },
            );
            throw new BillingProviderRetryableError("Stripe billing request timed out.", {
              timeoutMs: this.config.EXTERNAL_REQUEST_TIMEOUT_MS,
            });
          }

          throw error;
        } finally {
          clearTimeout(timeout);
        }

        if (response.status >= 500) {
          const errorPayload = await response.text();
          this.logger.warn(
            "Stripe billing request failed with retryable status.",
            { path, statusCode: response.status, errorPayload },
            { module: "billing", operation: "stripeRequest" },
          );
          throw new BillingProviderRetryableError("Stripe billing request failed with a retryable error.", {
            statusCode: response.status,
          });
        }

        if (!response.ok) {
          const errorPayload = await response.text();
          throw new ExternalDependencyError("Stripe billing request failed.", {
            statusCode: response.status,
            errorPayload,
          });
        }

        return response;
      },
      {
        provider: this.providerName,
        path,
      },
    );
  }
}
