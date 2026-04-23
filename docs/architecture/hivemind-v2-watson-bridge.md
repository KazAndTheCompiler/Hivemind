# Hivemind v2 Watson Bridge

Status: implemented first slice
Date: 2026-04-22

## Purpose

This bridge is the first practical step from the current summary-first Hivemind flow toward typed-state supervision.

Instead of replacing Watson outright, it lets the current normalized summary path dual-write into Hivemind v2 typed-state artifacts:

- `HivemindBuilderProgress`
- `HivemindBaseSignal<BuilderProgress>`
- `HivemindReducedStatePacket`
- `HivemindReducerPacket`

## Why this slice

The repo already has a clear summary normalization and condensation path in `packages/watson`.
That makes Watson the lowest-risk place to add a typed-state bridge without inventing a second orchestration system.

This keeps the migration incremental:

1. existing producers can keep emitting normalized summaries
2. Watson can derive typed progress and reduced state from those summaries
3. supervisor-facing logic can start consuming reducer packets before the old summary relay is fully retired

## Current implementation

The first real bridge now lives in `packages/watson`.

### Deterministic builders

`packages/watson/src/hivemind-v2.ts` provides:

- `buildBuilderProgress(summary)`
- `buildProgressSignal(summary)`
- `buildReducedStatePacket(summary)`
- `buildReducerPacket(summary)`

These functions intentionally stay deterministic.
They do not perform LLM inference.
They only project already-normalized summary state into bounded typed-state artifacts.

### Dual-write service API

`packages/watson/src/index.ts` now exposes `projectHivemindState(summary)` on `SummaryCondenseService` / `WatsonFilter`.

It returns one in-process projection object containing:

- `relay200`
- `relay300`
- `progressSignal`
- `reducedState`
- `reducerPacket`

For completed, ship-ready work, the projection also carries a supervisor option for the `sanitize-and-ship` stage:

- `sanitize-and-ship.trufflehog`
- default off
- intended for the final secret-sanitization pass before push or release

This is the minimal usable phase-1 bridge:
existing callers can keep the current relay flow, while supervisor-oriented code can start consuming typed-state output from the same normalized summary input.

## What this enables

- dual-write migration instead of hard cutover
- compact supervisor-intake packets with evidence refs and touched files
- incremental guard-stack adoption against reducer packets
- lower token spend once supervisor prompts stop reparsing human-style summaries

## What it does not do yet

- emit new event-bus event kinds for typed-state artifacts
- persist typed-state packets in audit storage
- replace Watson's existing relay outputs
- implement a full conflict-aware reducer across multiple emitters
- collapse the runtime onto reducer packets as the sole supervisor input

## Recommended next step

Add one narrow runtime integration path where a current Watson caller takes `projectHivemindState(summary)` and writes both:

- existing relay artifacts
- `HivemindReducerPacket` (and optionally the progress signal)

That keeps this slice small while making the next migration step obvious: switch supervisor intake from reparsed condensed prose to deterministic reducer packets.
