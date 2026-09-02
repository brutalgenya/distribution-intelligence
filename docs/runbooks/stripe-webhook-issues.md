# Stripe Webhook Issues

## Symptoms

- subscriptions stop updating
- Stripe event logs remain `failed`

## Steps

1. Confirm `BILLING_PROVIDER=stripe`.
2. Verify `STRIPE_WEBHOOK_SECRET` matches the Stripe endpoint configuration.
3. Check `/billing/stripe-events` for the failing event and error message.
4. Confirm the webhook payload size is below `BILLING_WEBHOOK_MAX_BYTES`.
5. Replay the event from Stripe only after the signature/config issue is fixed.

## Verify

- new events process successfully
- `/billing/subscription` reflects the expected lifecycle state
