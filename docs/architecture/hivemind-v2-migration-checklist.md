# Hivemind v2 Migration Checklist

Short checklist against the current summary-first assumptions in this repo.

## Current assumption to unwind

- workers emit `RawAgentSummary`
- Watson normalizes and condenses prose
- `relay.condensed` is the primary supervision artifact
- guard stack mostly validates summary quality, not state evidence

## Minimal migration steps

- [ ] Keep `EventBus`, but introduce typed-state payloads as first-class artifacts beside summary events.
- [ ] Treat `packages/core-types` and `packages/core-schemas` as the source of truth for v2 supervision payloads.
- [ ] Add builder progress emission at task boundaries before replacing existing worker summaries.
- [ ] Rename condenser/reducer responsibilities in docs and code paths, even if the runtime still uses old names temporarily.
- [ ] Make evidence and refs required by policy for high-confidence code, ownership, quality, and security claims.
- [ ] Change supervisor inputs from condensed prose to reducer packets once a deterministic reducer exists.
- [ ] Keep human-readable summaries as projections only, not the transport substrate.
- [ ] Update guard checks to enforce ownership, drift, evidence density, and conflict handling on typed packets.

## Immediate compatibility note

For now, v1 summary types and v2 typed-state types should coexist. The safest first rollout is dual-write:

1. existing summary flow still runs
2. builder emits structured progress in parallel
3. reducer packet becomes the new supervisor input once coverage is good enough
