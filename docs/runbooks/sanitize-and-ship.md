# Sanitize and Ship

Use this stage when a task is complete and the next move is to push, publish, or hand off the repo.

## Supervisor option: TruffleHog

Hivemind v2 now exposes an optional supervisor action for this stage:

- option id: `sanitize-and-ship.trufflehog`
- tool: `trufflehog`
- default: off
- surfaced when Watson projects a completed, high-confidence change into a reducer packet

This keeps secret scanning available at ship time without forcing it on every intermediate iteration.

## Activation

Run from the repository root:

```bash
trufflehog git file://. --results=verified,unknown --fail
```

If the scan exits clean, the supervisor can proceed with push or release.
If it reports findings, stop and sanitize before shipping.

## Where it appears

The option is attached to:

- `HivemindBuilderProgress.supervisorOptions`
- `HivemindReducedStatePacket.supervisorOptions`
- `HivemindReducerPacket.supervisorOptions`

## Suggested supervisor policy

1. finish implementation and verification
2. when the task is about to ship, enable the TruffleHog option
3. block push/release on findings
4. only ship after the scan returns clean
