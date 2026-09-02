# Tenant Onboarding And Demo Reset

## Demo reset

Use this only outside production.

1. Set `APP_ENV` to `local`, `test`, or `staging`.
2. Confirm `DEMO_BOOTSTRAP_ENABLED=true`.
3. Run `npm run bootstrap:demo`.
4. Use the printed ids for headers and sample API calls.

## Tenant onboarding

1. Create or confirm the target organization and owner membership.
2. Confirm the tenant subscription and entitlements.
3. Load starter catalog, location, and supplier data.
4. Run a small integration sync or manual import to validate the tenant boundary.
