import type { FastifyReply, FastifyRequest } from "fastify";

import type { AppConfig } from "../../config/env.js";
import { TooManyRequestsError } from "../../../shared/errors.js";

export interface RateLimitPolicy {
  name: string;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  public constructor(private readonly now: () => number = () => Date.now()) {}

  public consume(key: string, policy: RateLimitPolicy): RateLimitDecision {
    const now = this.now();
    const existingBucket = this.buckets.get(key);

    if (!existingBucket || existingBucket.resetAtMs <= now) {
      const resetAtMs = now + policy.windowMs;
      this.buckets.set(key, {
        count: 1,
        resetAtMs,
      });

      return {
        allowed: true,
        remaining: Math.max(policy.maxRequests - 1, 0),
        resetAt: new Date(resetAtMs),
        retryAfterSeconds: Math.max(Math.ceil(policy.windowMs / 1000), 1),
      };
    }

    if (existingBucket.count >= policy.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(existingBucket.resetAtMs),
        retryAfterSeconds: Math.max(Math.ceil((existingBucket.resetAtMs - now) / 1000), 1),
      };
    }

    existingBucket.count += 1;
    this.buckets.set(key, existingBucket);

    return {
      allowed: true,
      remaining: Math.max(policy.maxRequests - existingBucket.count, 0),
      resetAt: new Date(existingBucket.resetAtMs),
      retryAfterSeconds: Math.max(Math.ceil((existingBucket.resetAtMs - now) / 1000), 1),
    };
  }

  public reset(): void {
    this.buckets.clear();
  }
}

const matchesRoute = (routePath: string, patterns: readonly string[]): boolean =>
  patterns.includes(routePath);

export const resolveRateLimitPolicy = (
  request: FastifyRequest,
  config: AppConfig,
): RateLimitPolicy | null => {
  if (!config.RATE_LIMIT_ENABLED || request.method !== "POST") {
    return null;
  }

  if (request.url.startsWith("/billing/webhooks/stripe")) {
    return null;
  }

  const routePath = request.routeOptions.url ?? request.url;
  const windowMs = config.RATE_LIMIT_WINDOW_SECONDS * 1000;

  if (matchesRoute(routePath, ["/billing/checkout-session", "/billing/portal-session"])) {
    return {
      name: "billing_mutation",
      maxRequests: config.RATE_LIMIT_BILLING_MUTATIONS,
      windowMs,
    };
  }

  if (
    matchesRoute(routePath, [
      "/ai/forecasting/enhance",
      "/ai/anomalies/score",
      "/ai/decisions/:decisionId/explain",
    ])
  ) {
    return {
      name: "ai_mutation",
      maxRequests: config.RATE_LIMIT_AI_MUTATIONS,
      windowMs,
    };
  }

  if (
    matchesRoute(routePath, [
      "/integrations/connections",
      "/integrations/syncs",
      "/integrations/syncs/:id/process",
    ])
  ) {
    return {
      name: "integration_mutation",
      maxRequests: config.RATE_LIMIT_SYNC_MUTATIONS,
      windowMs,
    };
  }

  if (matchesRoute(routePath, ["/forecasting/jobs", "/forecasting/jobs/:id/process"])) {
    return {
      name: "forecast_mutation",
      maxRequests: config.RATE_LIMIT_FORECAST_MUTATIONS,
      windowMs,
    };
  }

  if (
    matchesRoute(routePath, [
      "/workflow/approvals",
      "/workflow/approvals/:id/approve",
      "/workflow/approvals/:id/reject",
      "/workflow/executions",
      "/workflow/executions/:id/process",
      "/workflow/executions/:id/retry",
      "/workflow/executions/:id/cancel",
      "/workflow/overrides",
      "/workflow/decisions/:id/request-approval",
      "/workflow/decisions/:id/request-execution",
    ])
  ) {
    return {
      name: "workflow_mutation",
      maxRequests: config.RATE_LIMIT_EXECUTION_MUTATIONS,
      windowMs,
    };
  }

  if (
    matchesRoute(routePath, [
      "/support/executions/:id/requeue",
      "/support/forecast-jobs/:id/requeue",
      "/support/outcomes/recompute",
    ])
  ) {
    return {
      name: "support_mutation",
      maxRequests: config.RATE_LIMIT_SUPPORT_MUTATIONS,
      windowMs,
    };
  }

  if (
    matchesRoute(routePath, [
      "/outcomes/stockouts/compute",
      "/outcomes/fill-rate/compute",
      "/outcomes/forecast-error/compute",
      "/outcomes/decisions/compute",
      "/outcomes/policies/compute",
    ])
  ) {
    return {
      name: "outcome_mutation",
      maxRequests: config.RATE_LIMIT_OUTCOME_MUTATIONS,
      windowMs,
    };
  }

  return null;
};

const buildRateLimitScope = (request: FastifyRequest, policy: RateLimitPolicy): string => {
  const organizationId = request.requestContext?.activeOrganizationId;
  const userId = request.requestContext?.user.id;

  return [
    policy.name,
    organizationId ? `org:${organizationId}` : null,
    userId ? `user:${userId}` : null,
    `ip:${request.ip}`,
  ]
    .filter((value): value is string => Boolean(value))
    .join("|");
};

export const createRateLimitMiddleware =
  (rateLimiter: InMemoryRateLimiter, config: AppConfig) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const policy = resolveRateLimitPolicy(request, config);
    if (!policy) {
      return;
    }

    const decision = rateLimiter.consume(buildRateLimitScope(request, policy), policy);

    reply.header("x-rate-limit-limit", policy.maxRequests);
    reply.header("x-rate-limit-remaining", decision.remaining);
    reply.header("x-rate-limit-reset", decision.resetAt.toISOString());

    if (decision.allowed) {
      return;
    }

    reply.header("retry-after", String(decision.retryAfterSeconds));
    request.server.container.services.telemetryService.incrementCounter("http.rate_limit.exceeded", 1, {
      policy: policy.name,
      route: request.routeOptions.url,
    });

    throw new TooManyRequestsError(`Rate limit exceeded for ${policy.name}.`, {
      policy: policy.name,
      retryAfterSeconds: decision.retryAfterSeconds,
      resetAt: decision.resetAt.toISOString(),
    });
  };
