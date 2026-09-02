# Degraded AI Provider

## Symptoms

- AI runs show `degraded` or `failed`
- forecast enhancement falls back to baseline-only results

## Steps

1. Check `/support/ai-runs` for run type, model, and error state.
2. Confirm the platform is still using deterministic baseline behavior where applicable.
3. If the provider is intentionally mocked in the current tier, no action is needed.
4. If the provider should be live, verify the provider credentials and network path.

## Verify

- AI runs move back to `succeeded`
- deterministic baseline behavior remains intact during the incident
