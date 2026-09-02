import { PlanSubscriptionStatus } from "@prisma/client";
import { z } from "zod";

import type { BillingWebhookEvent, NormalizedStripeEventType } from "./billing-provider.types.js";

const supportedEventTypeSchema = z.enum([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.paid",
]);

const stripeEventEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: supportedEventTypeSchema,
  data: z.object({
    object: z.record(z.unknown()),
  }),
});

type SupportedEventType = z.infer<typeof supportedEventTypeSchema>;

const toNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const toNullableBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;

const toNullableDateFromUnixSeconds = (value: unknown): Date | null =>
  typeof value === "number" && Number.isFinite(value) ? new Date(value * 1000) : null;

const toNullableStatus = (value: unknown): PlanSubscriptionStatus | null => {
  switch (value) {
    case "trialing":
      return PlanSubscriptionStatus.trialing;
    case "active":
      return PlanSubscriptionStatus.active;
    case "past_due":
      return PlanSubscriptionStatus.past_due;
    case "canceled":
    case "cancelled":
      return PlanSubscriptionStatus.cancelled;
    case "incomplete":
      return PlanSubscriptionStatus.incomplete;
    case "unpaid":
      return PlanSubscriptionStatus.unpaid;
    default:
      return null;
  }
};

const getMetadataValue = (record: Record<string, unknown>, key: string): string | null => {
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return toNullableString(value);
};

const getFirstLineItemPriceId = (record: Record<string, unknown>): string | null => {
  const items = record.items;
  if (!items || typeof items !== "object" || Array.isArray(items)) {
    return null;
  }

  const data = (items as Record<string, unknown>).data;
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const firstItem = data[0];
  if (!firstItem || typeof firstItem !== "object" || Array.isArray(firstItem)) {
    return null;
  }

  const price = (firstItem as Record<string, unknown>).price;
  if (!price || typeof price !== "object" || Array.isArray(price)) {
    return null;
  }

  return toNullableString((price as Record<string, unknown>).id);
};

const buildNormalizedEvent = (
  eventType: SupportedEventType,
  eventId: string,
  record: Record<string, unknown>,
): BillingWebhookEvent => {
  const organizationId =
    getMetadataValue(record, "organizationId") ??
    toNullableString(record.client_reference_id);
  const customerId = toNullableString(record.customer);
  const subscriptionId = toNullableString(record.subscription) ?? toNullableString(record.id);
  const priceId = getMetadataValue(record, "priceId") ?? getFirstLineItemPriceId(record);
  const subscriptionStatus =
    eventType === "checkout.session.completed"
      ? null
      : eventType === "customer.subscription.created" ||
          eventType === "customer.subscription.updated" ||
          eventType === "customer.subscription.deleted"
        ? toNullableStatus(record.status)
        : null;

  return {
    eventId,
    eventType: eventType satisfies NormalizedStripeEventType,
    organizationId,
    customerId,
    subscriptionId,
    priceId,
    subscriptionStatus:
      eventType === "customer.subscription.deleted" ? PlanSubscriptionStatus.cancelled : subscriptionStatus,
    currentPeriodStart: toNullableDateFromUnixSeconds(record.current_period_start),
    currentPeriodEnd: toNullableDateFromUnixSeconds(record.current_period_end),
    cancelAtPeriodEnd: toNullableBoolean(record.cancel_at_period_end),
    payload: {
      id: eventId,
      type: eventType,
      data: {
        object: record,
      },
    },
  };
};

export const normalizeStripeWebhookEvent = (payload: unknown): BillingWebhookEvent => {
  const parsedPayload = stripeEventEnvelopeSchema.parse(payload);

  return buildNormalizedEvent(parsedPayload.type, parsedPayload.id, parsedPayload.data.object);
};
