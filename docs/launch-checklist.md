# Launch Checklist

## Before deploy

- Confirm `APP_ENV`, `DATABASE_URL`, URL settings, rate-limit settings, and timeout settings are correct for the target tier.
- For production, confirm `BILLING_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` are present.
- Run `npm run prisma:generate`, `npm run prisma:migrate:deploy`, `npm test`, and `npm run build`.
- Review the runbooks under `docs/runbooks`.

## Deploy order

1. Apply database migrations.
2. Start or update the API.
3. Start or restart the forecast, execution, outcomes, and integration workers.
4. Verify `/observability/live`, `/observability/ready`, and `/observability/health`.

## Pilot readiness

- Run `npm run bootstrap:demo` only in local, test, or staging demo environments.
- Confirm the seeded demo tenant has sample catalog, inventory, sales, order, supplier, and purchase-order state.
- Verify support reads, billing entitlements, and integration sync controls for the pilot tenant.

## Do not launch until

- health endpoints are green
- workers are processing normally
- Stripe webhooks are verified in staging or production
- backup and rollback steps are agreed on for the deploy window
