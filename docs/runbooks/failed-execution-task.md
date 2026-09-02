# Failed Execution Task

## When to use

Use this when an execution task is stuck in `failed` or `dead_lettered`.

## Steps

1. Check `/support/executions`, `/support/executions/:id`, and `/support/executions/:id/attempts`.
2. Confirm whether the adapter failure is retryable or non-retryable.
3. Verify whether a downstream side effect already happened by checking idempotency state and linked purchase orders.
4. If safe, call `POST /support/executions/:id/requeue` with a reason.
5. Monitor `/support/executions/:id` until it leaves `pending` or `running`.

## Escalate when

- the task repeatedly returns to `failed`
- the linked external side effect is ambiguous
- the task lands in `dead_lettered`
