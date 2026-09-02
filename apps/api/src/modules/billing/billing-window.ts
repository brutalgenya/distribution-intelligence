import type { PlanSubscription } from "@prisma/client";

import type { UsageWindow } from "./billing.types.js";

const getStartOfCurrentUtcMonth = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));

const getStartOfNextUtcMonth = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1, 0, 0, 0, 0));

export const resolveUsageWindow = (
  subscription: Pick<PlanSubscription, "currentPeriodStart" | "currentPeriodEnd"> | null,
  now: Date,
): UsageWindow => {
  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) {
    return {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
    };
  }

  return {
    start: getStartOfCurrentUtcMonth(now),
    end: getStartOfNextUtcMonth(now),
  };
};
