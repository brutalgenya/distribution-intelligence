# Integration Sync Failures

## Symptoms

- sync runs show `failed` or `partial`
- failed records appear under `/integrations/failed-records`

## Steps

1. Check `/integrations/syncs` and open the specific sync run.
2. Review `/integrations/failed-records` for invalid payloads or replay conflicts.
3. Fix the upstream record shape or reference data.
4. Re-run the sync with the same connection and corrected payload.
5. If needed, restart `npm run worker:integration`.

## Notes

- catalog and location imports are mutable upserts
- order, sale, and inventory snapshot imports are replay-protected and conflicting replays will dead-letter
