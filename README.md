# Hivemind

**Two things that talk to each other through typed signals:**

1. **Watson** - coordinates worker agents, compresses their output
2. **Sherlock** - analyzes code, emits findings

That's it. No magic.

---

## How It Actually Works

### Watson's Job

Worker agents send summaries → Watson cleans them up → compresses to 200/300 tokens → sends to main agent.

```
Worker summary
    ↓
[ingest] ← validates the raw input
    ↓
[sanitize] ← truncates huge fields (summary max 5000 chars, files max 100, etc)
    ↓
[normalize] ← converts to standard shape
    ↓
[secdev analyze] ← looks for security issues
    ↓
[guard stack] ← checks quality: TypeScript valid? Semantic floor? Refs valid?
    ↓
[quality gate] ← runs prettier + eslint on changed files
    ↓
[condense] ← compresses to 200 or 300 tokens (NO LLM, just field priority)
    ↓
[relay] ← either:
         • "relay" → goes to main agent
         • "block" → too critical, stop
         • "review" → low confidence, needs human
    ↓
[memory] ← saves everything to disk
```

When work is complete and ready to ship, Hivemind v2 can surface an optional supervisor `sanitize-and-ship` action for TruffleHog so final secret scanning happens right before push or release.

### Sherlock's Job

File changes → Sherlock analyzes them → emits signals → Watson consumes them.

```
File changes (chokidar)
    ↓
[debounce] ← wait for changes to settle
    ↓
[gitnexus] ← figure out which package owns each file
    ↓
[quality gate] ← prettier + eslint + secdev
    ↓
[emit events] ← lint_event, tool_result, gitnexus_event signals
```

---

## The Signal Bus

Everything communicates through `EventBus`. Agents don't call each other directly - they emit signals and listen for signals.

```typescript
// Emit a signal
await eventBus.emit({
  kind: 'task_done',
  taskId: 'T001',
  summary: 'fixed the login bug',
  severity: 'low',
});

// Listen for a signal
eventBus.on('task_done', (event) => {
  console.log(event.taskId, event.summary);
});
```

Signals are typed discriminated unions. If you switch on `kind`, TypeScript knows the exact shape of each signal.

### Signal Types

| Signal | Who emits | What it means |
|--------|----------|---------------|
| `task_assign` | router | "do this task" |
| `task_done` | worker | "finished task X" |
| `lint_event` | eslint | "found lint issue in file Y" |
| `tool_result` | prettier/tsc | "tool ran on files" |
| `gitnexus_event` | gitnexus | "files changed, here's ownership" |
| `relay.condensed` | watson | " here's a compressed summary" |
| `relay.delivered` | relay | "summary reached main agent" |

### Backpressure & Failure

- Buffer max: 1000 events
- If buffer full: oldest events go to dead letter queue
- Every event audited to disk
- Idempotency: duplicate events ignored (hashed payload)

---

## Guard Stack

Before any summary gets relayed, it passes through validation:

1. **Semantic Guard** - does the summary have file references? Action verbs? No forbidden phrases?
2. **Retry Policy** - if failed, retry with backoff (1s, 2s, 4s...)
3. **Escalation Rules** - if too many failures, escalate

If guard fails 3 times consecutively → pipeline halts. Someone has to manually call `orchestrator.unhaltPipeline()`.

```
Guard failures increment driftCounter
Success resets driftCounter to 0
Drift counter >= 3 → pipeline halted
```

---

## Condenser (Watson's Brain)

Takes a normalized summary, compresses to 200 or 300 tokens.

No LLM. Just field priority:

| Field | Priority |
|-------|----------|
| summary | 10 |
| blockers | 9 |
| nextActions | 8 |
| topFindings | 7 |
| touchedFiles | 5 |

If over budget, it trims arrays from the bottom (removes lowest priority items first).

Example:
- 200 token relay: top 5 files, top 2 blockers, 1 next action
- 300 token relay: top 10 files, top 5 blockers, 5 next actions, top 3 findings

---

## Relay Decision

After condensing, `MainAgentRelayService` decides what happens:

```
if severity == critical → BLOCK
else if confidence < 0.5 → REVIEW_QUEUE (human needs to check)
else → RELAY to main agent
```

---

## Apps

| App | What it does |
|-----|--------------|
| `orchestrator` | Runs the full worker→main pipeline. Start this and feed it worker summaries. |
| `daemon` | Watches files, runs quality gates on changes. Emits signals. |
| `cli` | Starts either orchestrator or daemon |

---

## Quick Start

```bash
# Install
pnpm install

# Build
pnpm build

# Start watching files (daemon)
pnpm --filter @openclaw/daemon dev

# Or start orchestrator (waits for worker summaries)
pnpm --filter @openclaw/orchestrator dev
```

---

## Config

Config lives in `secdev.config.json` or env vars. See `packages/core-config/`.

Key settings:
- `workspace` - what to watch
- `audit.storePath` - where to save events
- `daemon.debounceMs` - how long to wait for file changes to settle
- `orchestrator.maxConcurrentWorkers` - how many parallel worker pipelines

---

## Directory Structure

```
apps/
  orchestrator/   ← worker→main pipeline
  daemon/         ← file watcher + quality gates
  cli/            ← entry point

packages/
  watson/         ← 200/300 token compression
  guard-stack/    ← validation pipeline
  agent-relay/    ← relay decision logic
  agent-router/   ← task routing
  agent-memory/   ← persistence
  core-events/    ← EventBus
  core-types/     ← all TypeScript types
  summarizer/     ← normalization
  change-detector/← quality gate
  tool-eslint/   ← eslint adapter
  tool-prettier/ ← prettier adapter
  tool-gitnexus/ ← gitnexus adapter
  audit-store/    ← dead letter + event persistence
```

---

## If Something Breaks

1. Check the audit log at `audit.storePath/`
2. Dead letters go to `audit.deadLetterPath/`
3. Look at `event.buffer.full` in logs → backpressure issue
4. Look at `guard_stack.failed` → content quality issue
5. Look at `orchestrator.drift.halted` → too many failures, manual unhalt needed

```bash
# Manual unhalt (in code)
orchestrator.unhaltPipeline()
```

---

## Terms

- **Worker agent** - does the actual coding work
- **Main agent** - receives compressed summaries from workers, decides what to do next
- **Signal** - typed event on the bus
- **Relay** - compressed summary sent to main agent
- **Condense** - compress without LLM, just field priority trimming
- **Guard** - validation step
- **Drift** - when content quality degrades (too many guard failures)

---

## Production Operations

### Health Checks

```typescript
// Get full health status
const health = orchestrator.getHealth();

// Check if healthy
if (!health.healthy) {
  console.log('NOT HEALTHY:', health);
}

// Check circuit breakers
for (const [name, cb] of Object.entries(health.circuitBreakers)) {
  if (cb.state !== 'closed') {
    console.log(`Circuit ${name} is ${cb.state}`);
  }
}
```

### Circuit Breakers

The orchestrator has circuit breakers for `secdev` and `quality_gate`. If these services fail 5 times consecutively, the circuit opens and calls are skipped for 30 seconds.

```typescript
// Reset circuit breakers manually
orchestrator.resetCircuitBreakers();

// Or check status
const health = orchestrator.getHealth();
console.log(health.circuitBreakers);
```

### Graceful Shutdown

```typescript
// Clean shutdown - waits for pending operations (max 5s)
await orchestrator.shutdown('SIGTERM');

// Force shutdown
await orchestrator.shutdown('SIGKILL');
```

### Input Validation

`processSummary()` validates input:
- Rejects null/undefined
- Rejects non-objects
- Rejects arrays
- Generates taskId if missing

### Drift Detection

3 consecutive guard failures → pipeline halts.

```typescript
// Manual unhalt
orchestrator.unhaltPipeline();

// Or reset circuit breakers (doesn't affect drift counter)
// Service calls will work again, but if guards still fail, pipeline halts again
```

### Inbox Management

```typescript
// Drain delivered relays (for load balancing, maintenance)
const relays = orchestrator.drainInbox();

// Check review queue
const reviewItems = orchestrator.getReviewQueue();
```

### Logging

All events are logged to audit store. Dead letters are persisted separately for investigation.

```
audit.storePath/     ← JSONL audit logs
audit.deadLetterPath/ ← Failed event captures
```

---

## Changelog

### v0.2.0 — Production Hardening

**15 bug fixes** from prototype to production quality:

| Component | Bug | Fix |
|-----------|-----|-----|
| `DurableFileSink` | Timer leak - setTimeout never cleared | Added `flushing` flag, clearTimeout before setTimeout |
| `ToolExecutionQueue` | Deadlock risk - Promise.race on hung tasks | Added timeout to Promise.race |
| `audit-store` | Silent failure - duplicate resolve lines | Removed duplicate resolve, fixed confusing flush logic |
| `EventBus` | TOCTOU race - check and use not atomic | Added async mutex pattern with `_lockPromise` |
| `agent-relay` | Unbounded inbox - only removes 1 item when batch exceeds max | Changed `if` to `while` for draining |
| `audit-store` | Swallowed errors - returns empty array on any error | Now throws instead of returning `[]` |
| `tool-eslint` | Interval leak - cancel check interval not always cleared | Always clear interval on exit |
| `InMemorySink` | No TTL cleanup - expired entries only removed on get() | Added periodic cleanup timer with `scheduleCleanup()` |
| `core-events` | Slow cache cleanup - removes 1 item per overflow | Now removes ALL excess entries |
| `agent-relay` | Unbounded review queue - no max size limit | Added `maxReviewQueueSize` (default 500) |
| `audit-store` | No constructor error handling - mkdirSync can throw | Wrapped in try/catch with `AuditStoreError` |
| `tool-runner` | Swallowed renice error - empty catch block | Proper error handling with logging |
| `change-detector` | Malformed streamId - comma-joined file paths | Fixed path parsing |
| `automation-checkpoints` | Dead code - getState() result discarded | Removed unused getState method |
| `guard-stack` | Incomplete reset - doesn't reset sub-component state | Properly resets all state |

**New features:**
- Health checks (`orchestrator.getHealth()`)
- Circuit breakers for `secdev` and `quality_gate`
- Graceful shutdown with timeout
- Input validation on `processSummary()`
- `OrchestratorHaltedEvent` type for pipeline halts
- `daemon.getHealth()` with uptime tracking
- `CLI status` command

**Test fixes:**
- Fixed test files missing required fields (schemaVersion, sequence, streamId)
- Fixed EventBus sequence gap handling (discard out-of-order instead of infinite loop)
