# Hivemind v2 Watson Bridge

Status: draft
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

Added helper builders in `packages/watson/src/hivemind-v2.ts`:

- `buildBuilderProgress(summary)`
- `buildProgressSignal(summary)`
- `buildReducedStatePacket(summary)`
- `buildReducerPacket(summary)`

These functions intentionally stay deterministic.
They do not perform LLM inference.
They only project already-normalized summary state into bounded typed-state artifacts.

## What this enables

- dual-write migration instead of hard cutover
- compact supervisor-intake packets with evidence refs and touched files
- incremental guard-stack adoption against reducer packets
- lower token spend once supervisor prompts stop reparsing human-style summaries

## What it does not do yet

- emit new event-bus event kinds
- persist typed-state packets in audit storage
- replace Watson's existing relay outputs
- implement a full conflict-aware reducer across multiple emitters

## Recommended next step

Add one narrow integration path where a current summary producer or Watson caller writes both:

- existing relay artifacts
- `HivemindReducerPacket`

That will let the supervisor path begin consuming reduced typed state before the rest of the runtime is migrated.
