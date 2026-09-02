import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import {
  billingPlanIdParamsSchema,
  createCheckoutSessionBodySchema,
  createPortalSessionBodySchema,
  listStripeEventLogsQuerySchema,
  listUsageQuerySchema,
  stripeEventLogIdParamsSchema,
} from "../../../modules/billing/billing.schemas.js";
import { PayloadTooLargeError } from "../../../shared/errors.js";
import { activeOrganizationMiddleware } from "../middleware/active-organization.js";

const getSingleHeader = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const registerBillingRoutes = async (app: FastifyInstance): Promise<void> => {
  await app.register(async (billingWebhookApp) => {
    billingWebhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "string" },
      (_request, body, done) => done(null, body),
    );

    billingWebhookApp.post("/billing/webhooks/stripe", async (request, reply) => {
      const rawBody = typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
      if (Buffer.byteLength(rawBody, "utf8") > request.server.container.config.BILLING_WEBHOOK_MAX_BYTES) {
        throw new PayloadTooLargeError("Stripe webhook payload exceeds the configured limit.", {
          limit: request.server.container.config.BILLING_WEBHOOK_MAX_BYTES,
        });
      }
      const signature = getSingleHeader(request.headers["stripe-signature"]);
      const correlationId = getSingleHeader(request.headers["x-correlation-id"]) ?? randomUUID();

      const result = await request.server.container.services.stripeWebhookService.handleWebhook({
        rawBody,
        signature: signature ?? null,
        correlationId,
      });

      reply.status(200).send(result);
    });
  });

  await app.register(async (billingApp) => {
    billingApp.addHook("preHandler", activeOrganizationMiddleware);

    billingApp.get("/billing/plans", async (request) =>
      request.server.container.services.billingPlanService.listPlans(request.requestContext),
    );

    billingApp.get("/billing/plans/:id", async (request) => {
      const params = billingPlanIdParamsSchema.parse(request.params);
      return request.server.container.services.billingPlanService.getPlan(request.requestContext, params.id);
    });

    billingApp.get("/billing/subscription", async (request) =>
      request.server.container.services.billingEntitlementService.getCurrentSubscription(request.requestContext),
    );

    billingApp.get("/billing/entitlements", async (request) =>
      request.server.container.services.billingEntitlementService.getEffectiveEntitlements(request.requestContext),
    );

    billingApp.get("/billing/usage", async (request) => {
      const query = listUsageQuerySchema.parse(request.query);
      return request.server.container.services.usageMeterService.listUsageMeters(request.requestContext, {
        ...(query.meterType ? { meterType: query.meterType } : {}),
      });
    });

    billingApp.post("/billing/checkout-session", async (request, reply) => {
      const body = createCheckoutSessionBodySchema.parse(request.body);
      const result = await request.server.container.services.billingCheckoutService.createCheckoutSession(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    billingApp.post("/billing/portal-session", async (request, reply) => {
      const body = createPortalSessionBodySchema.parse(request.body);
      const result = await request.server.container.services.billingPortalService.createPortalSession(
        request.requestContext,
        body,
      );

      reply.status(201).send(result);
    });

    billingApp.get("/billing/stripe-events", async (request) => {
      const query = listStripeEventLogsQuerySchema.parse(request.query);
      return request.server.container.services.stripeWebhookService.listStripeEventLogs(
        request.requestContext,
        {
          ...(query.processingStatus ? { processingStatus: query.processingStatus } : {}),
        },
      );
    });

    billingApp.get("/billing/stripe-events/:id", async (request) => {
      const params = stripeEventLogIdParamsSchema.parse(request.params);
      return request.server.container.services.stripeWebhookService.getStripeEventLog(
        request.requestContext,
        params.id,
      );
    });
  });
};
