# Hivemind v2 Typed-State Scaffold

Status: draft scaffold
Date: 2026-04-22

## Placement

This scaffold lives inside the Hivemind repo because this workspace already has an obvious implementation target:

- `packages/core-types` for canonical transport types
- `packages/core-schemas` for Zod validation
- `docs/architecture` for migration notes tied to the repo's current summary-first pipeline

That keeps the first slice concrete without pretending the full reducer or supervisor runtime exists yet.

## First-slice artifacts

### 1. State bus draft

Added to `packages/core-types/src/index.ts` and `packages/core-schemas/src/index.ts`:

- `HivemindBaseSignal`
- `HivemindStateBus`
- `HivemindSignalDomain`
- `HivemindSignalSeverity`

Design notes:

- append-only signal shape
- evidence and refs stay attached
- progress is a typed lane, not prose-only metadata
- scope is intentionally narrow: task/code/ownership/quality/security/progress/review/meta

### 2. Supervisor verdict schema

Added:

- `HivemindSupervisorVerdict`
- `HivemindSupervisorVerdictSchema`

This matches ADR 0003 and the supervisor prompt pack: verdicts stay compact, operational, and evidence-oriented.

### 3. Builder progress schema

Added:

- `HivemindBuilderProgress`
- `HivemindBuilderProgressSchema`

This draft now also carries optional `supervisorOptions`, including a non-default `sanitize-and-ship.trufflehog` action for final secret scanning before push or release.

This is the structured replacement for narrative worker status updates.

### 4. Reducer packet schema

Added:

- `HivemindReducedStatePacket`
- `HivemindReducerPacket`
- matching Zod schemas

`HivemindReducedStatePacket` is the minimal reduced-state view.
`HivemindReducerPacket` is the transport packet a reducer/compiler can hand to the supervisor.

## Deliberate omissions

This scaffold does not yet add:

- a new event kind rollout across the bus
- reducer implementation logic
- supervisor runtime policy code
- migration of old `RawAgentSummary` producers

Those need a narrower follow-up once package ownership and runtime wiring are chosen.
