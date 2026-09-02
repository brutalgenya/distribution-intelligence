# Stuck Outcome Worker

## Symptoms

- outcome recomputation is delayed
- support reads show stale outcome or policy-effectiveness data

## Steps

1. Check `/support/worker-status` and recent `/support/outcomes`.
2. Restart `npm run worker:outcomes`.
3. If a specific window needs recomputation, call `POST /support/outcomes/recompute`.
4. Confirm the requested window is within the supported max duration.

## Verify

- the worker run status updates
- recent decision outcomes or summaries refresh for the requested window
