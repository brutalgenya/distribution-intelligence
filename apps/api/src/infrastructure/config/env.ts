import { z } from "zod";

const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i;

const envSchema = z
  .object({
    APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    DEFAULT_INVITATION_TTL_HOURS: z.coerce.number().int().positive().default(168),
    DEFAULT_TRIAL_PERIOD_DAYS: z.coerce.number().int().positive().default(14),
    BILLING_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
    APP_BASE_URL: z.string().url().default("http://localhost:4000"),
    BILLING_CHECKOUT_SUCCESS_URL: z.string().url().default("http://localhost:4000/billing/success"),
    BILLING_CHECKOUT_CANCEL_URL: z.string().url().default("http://localhost:4000/billing/cancel"),
    BILLING_PORTAL_RETURN_URL: z.string().url().default("http://localhost:4000/settings/billing"),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_API_BASE_URL: z.string().url().default("https://api.stripe.com"),
    HTTP_BODY_LIMIT_BYTES: z.coerce.number().int().positive().max(5_000_000).default(262_144),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    HTTP_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().positive().default(72_000),
    EXTERNAL_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    BILLING_WEBHOOK_MAX_BYTES: z.coerce.number().int().positive().max(1_000_000).default(65_536),
    RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_BILLING_MUTATIONS: z.coerce.number().int().positive().default(12),
    RATE_LIMIT_AI_MUTATIONS: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_SYNC_MUTATIONS: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_EXECUTION_MUTATIONS: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_SUPPORT_MUTATIONS: z.coerce.number().int().positive().default(12),
    RATE_LIMIT_OUTCOME_MUTATIONS: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_FORECAST_MUTATIONS: z.coerce.number().int().positive().default(20),
    SUPPORT_MAX_MEASUREMENT_WINDOW_DAYS: z.coerce.number().int().positive().max(365).default(90),
    DEMO_BOOTSTRAP_ENABLED: z.coerce.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    const requireNonLocalUrls = value.APP_ENV === "staging" || value.APP_ENV === "production";

    if (value.APP_ENV === "local" && value.NODE_ENV !== "development") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NODE_ENV must be development when APP_ENV is local.",
        path: ["NODE_ENV"],
      });
    }

    if (value.APP_ENV === "test" && value.NODE_ENV !== "test") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NODE_ENV must be test when APP_ENV is test.",
        path: ["NODE_ENV"],
      });
    }

    if ((value.APP_ENV === "staging" || value.APP_ENV === "production") && value.NODE_ENV !== "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "NODE_ENV must be production when APP_ENV is staging or production.",
        path: ["NODE_ENV"],
      });
    }

    if (value.BILLING_PROVIDER === "stripe") {
      if (!value.STRIPE_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_SECRET_KEY is required when BILLING_PROVIDER is stripe.",
          path: ["STRIPE_SECRET_KEY"],
        });
      }

      if (!value.STRIPE_WEBHOOK_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "STRIPE_WEBHOOK_SECRET is required when BILLING_PROVIDER is stripe.",
          path: ["STRIPE_WEBHOOK_SECRET"],
        });
      }
    }

    if (value.APP_ENV === "production" && value.BILLING_PROVIDER !== "stripe") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Production requires BILLING_PROVIDER=stripe.",
        path: ["BILLING_PROVIDER"],
      });
    }

    if (requireNonLocalUrls) {
      for (const [key, url] of [
        ["APP_BASE_URL", value.APP_BASE_URL],
        ["BILLING_CHECKOUT_SUCCESS_URL", value.BILLING_CHECKOUT_SUCCESS_URL],
        ["BILLING_CHECKOUT_CANCEL_URL", value.BILLING_CHECKOUT_CANCEL_URL],
        ["BILLING_PORTAL_RETURN_URL", value.BILLING_PORTAL_RETURN_URL],
      ] as const) {
        if (localhostPattern.test(url)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${key} must not point to localhost in staging or production.`,
            path: [key],
          });
        }
      }
    }

    if (value.APP_ENV === "production" && value.DEMO_BOOTSTRAP_ENABLED) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "DEMO_BOOTSTRAP_ENABLED must be false in production.",
        path: ["DEMO_BOOTSTRAP_ENABLED"],
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export const loadConfig = (source: NodeJS.ProcessEnv): AppConfig => envSchema.parse(source);
