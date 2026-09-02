# Stuck Forecast Worker

## Symptoms

- forecast jobs remain `pending` or `failed`
- `/support/worker-status` shows forecast backlog growing

## Steps

1. Check `/support/forecast-jobs` and `/support/worker-status`.
2. Restart `npm run worker:forecast`.
3. Requeue specific failed jobs with `POST /support/forecast-jobs/:id/requeue` if needed.
4. Confirm `/observability/ready` is healthy and database connectivity is up.

## Verify

- forecast backlog stops growing
- a requeued job moves from `pending` to `completed`
