import type { PlanSubscriptionStatus } from "@prisma/client";

export interface BillingProviderCheckoutCustomerInput {
  existingCustomerId?: string | null;
  organizationId: string;
  organizationName: string;
  contactEmail: string;
}

export interface BillingProviderCheckoutInput {
  customerId: string;
  priceId: string;
  organizationId: string;
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}

export interface BillingProviderCheckoutResult {
  sessionId: string;
  url: string;
  customerId: string;
}

export interface BillingProviderPortalInput {
  customerId: string;
  returnUrl: string;
}

export interface BillingProviderPortalResult {
  sessionId: string;
  url: string;
}

export type NormalizedStripeEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_failed"
  | "invoice.paid";

export interface BillingWebhookEvent {
  eventId: string;
  eventType: NormalizedStripeEventType;
  organizationId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  subscriptionStatus: PlanSubscriptionStatus | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  payload: unknown;
}

export interface BillingProviderWebhookInput {
  rawBody: string;
  signature?: string | null;
}

export interface BillingProvider {
  readonly providerName: "mock" | "stripe";
  ensureCustomer(input: BillingProviderCheckoutCustomerInput): Promise<{ customerId: string }>;
  createCheckoutSession(input: BillingProviderCheckoutInput): Promise<BillingProviderCheckoutResult>;
  createPortalSession(input: BillingProviderPortalInput): Promise<BillingProviderPortalResult>;
  verifyAndParseWebhook(input: BillingProviderWebhookInput): Promise<BillingWebhookEvent>;
}
