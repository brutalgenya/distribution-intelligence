# Backup And Recovery

## Database expectations

- take regular PostgreSQL backups before production deploys
- keep point-in-time recovery enabled where supported
- test restore into a staging environment before design-partner rollout

## Recovery order

1. Restore the database.
2. Start the API.
3. Restart forecast, execution, outcomes, and integration workers.
4. Verify health/readiness endpoints.
5. Review support timelines for partial external side effects.

## Partial side effects

- execution is idempotent, but external confirmation should still be checked before requeueing failed work
- Stripe events are idempotent by persisted event id, so replay only after restore is stable
