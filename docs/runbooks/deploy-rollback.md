# Deploy Rollback

## Safe deploy order

1. Apply migrations.
2. Deploy the API.
3. Restart forecast, execution, outcomes, and integration workers.

## Rollback guidance

- If the deploy fails before migrations run, roll back the API only.
- If migrations already ran, do not hand-edit production tables.
- Roll back application code first if the schema is still backward compatible.
- If a schema change is not backward compatible, prepare a forward fix migration instead of an ad hoc revert.

## After rollback

- verify `/observability/ready`
- verify workers reconnect cleanly
- verify no execution task or Stripe event is left in an ambiguous state
