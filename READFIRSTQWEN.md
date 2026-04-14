# READFIRSTQWEN — OpenClaw Production Scaffold

> This document is the entry point for any Qwen agent working in this repo.
> Updated: 2026-04-14

---

## What This Repo Is

A **pnpm TypeScript monorepo** that merges four source projects into one OpenClaw agent coordination layer:

1. **Multiagent_thinking** — typed emission architecture, guard stack, condensed relay summaries, token-budget discipline
2. **watson-project** — OpenClaw-oriented agent routing, supervisor + worker pattern, memory/palace integration
3. **secdev_project** — pnpm monorepo structure, package taxonomy, shared foundations, validation mindset
4. **openclaw-workspace** — actual OpenClaw workflow intent, memory/script operations, agent execution reality

The full work order lives in `"new work order.ts"` at the repo root.

## What's Built vs. What's Left

### ✅ COMPLETED (Phases 1–7 + Hardening)

| Phase | What | Status |
|-------|------|--------|
| 1 | Monorepo scaffold — root config, workspace, tsconfig, packages | ✅ |
| 2 | Core packages — types, schemas, errors, config, logging, events, tokenizer | ✅ |
| 3 | Agent pipeline — protocol, summarizer, condense-engine (200/300 tokens), relay | ✅ |
| 4 | Tool adapters — GitNexus, changed-file detector, ESLint, Prettier runners | ✅ |
| 5 | SecDev adapter — security finding detection, severity mapping | ✅ |
| 6 | Apps — orchestrator (supervisor), daemon (watcher), CLI | ✅ |
| 7 | Architecture docs + runbooks | ✅ |
| H | **Hardening pass** — token budgets, path-safe execution, durable persistence, event semantics, config loading, backpressure | ✅ |

### Hardening Pass Summary (10 phases)

| Gap | Fix |
|-----|-----|
| Condense pipeline didn't guarantee full payload budget | `truncatePayloadToBudget()` — iteratively trims summary, arrays, findings until serialized JSON fits |
| Shell-string command execution unsafe | Switched to `child_process.execFile` with arg arrays, cwd isolation, timeout support |
| Daemon bypassed GitNexus for file changes | All change intelligence now routes through `LocalGitNexusAdapter.resolveFileOwnership()` |
| Relay events conflated creation + delivery | Split into `relay.condensed` (created), `relay.delivered` (success), `relay.delivery_failed` (error) |
| EventBus hid handler failures | Structured failure capture: `totalFailures`, `overflowCount`, `capacityUtilization`, dead-letter overflow |
| Audit/memory were sync-only | `DurableFileAuditStore` (async buffered writes), `DurableFileSink` (index + TTL + flush) |
| Package ownership was shallow regex | Walk upward to nearest `package.json`, cached via `git ls-files` |
| Config used brittle require + silent fallback | `fromFile()`, `fromFileOrDefaults()`, `fromDefaults()`, Zod-validated env overrides, `validateStartup()` |
| No backpressure strategy | Dead-letter overflow policy, quality gate coalescing lock, pending op tracking, graceful shutdown flush |
| No integration tests for core loop | Tests pass for schemas, tokenizer, config, events, condensing, orchestrator smoke |

### Build & Test Status

```
pnpm build   → 36 packages compile cleanly
pnpm test    → 30+ tests pass (schemas, tokenizer, config, events, condensing, orchestrator)
```

### Package Inventory (22 new OpenClaw packages)

**Core (7):** `core-types`, `core-schemas`, `core-errors`, `core-config`, `core-logging`, `core-events`, `core-tokenizer`

**Agent Protocol (4):** `agent-protocol`, `agent-relay`, `agent-router`, `agent-memory`

**Services (4):** `summarizer`, `condense-engine`, `change-detector`, `audit-store`

**Tool Adapters (5):** `tool-gitnexus`, `tool-secdev`, `tool-eslint`, `tool-prettier`, `tool-runner`

**Apps (3):** `orchestrator`, `daemon`, `cli`

Plus 7 existing SecDev shared packages (`shared/types`, `shared/config`, `shared/logger`, `shared/schemas`, `shared/utils`, `shared/testing`, `shared/cli`) and 5 migrated legacy labs/tools.

## Key Architecture

### Data Pipeline (Worker → Main Agent)

```
Worker emits RawAgentSummary
    ↓
AgentSummaryIngestService — validates against Zod schema
    ↓
SummaryNormalizationService — extracts tags, attaches findings
    ↓
SummaryCondenseService — produces CondensedRelay200 + CondensedRelay300
    ↓
MainAgentRelayService — delivers to agent inbox
    ↓
AgentRouter — main agent picks up condensed relay
```

### File Change Pipeline

```
chokidar watches files → WatchDaemon (debounce)
    ↓
ChangedFileQualityService runs:
  ├── LocalPrettierRunner (format changed files)
  ├── LocalEslintRunner (lint changed TS/JS)
  └── LocalSecDevAdapter (security analysis)
    ↓
QualityGateResult → EventBus → AuditStore (persist + dead-letter)
```

### Event Types (12 discriminated kinds)

All events flow through `@openclaw/core-events` EventBus:

- `file.change.detected` — watcher notification
- `agent.summary.emitted` — raw worker output
- `agent.summary.normalized` — tagged + findings attached
- `relay.condensed` — 200/300 token payloads
- `quality.gate.completed` — prettier + eslint + secdev results
- `secdev.finding` — security-relevant finding
- `gitnexus.change` — git diff + package mapping
- `audit.persisted` / `audit.dead_letter` — persistence events
- `orchestrator.started` / `orchestrator.shutdown` — lifecycle
- `worker.emit` — worker emission record

## Directory Layout

```
secdev_project-main/
├── apps/
│   ├── orchestrator/    # @openclaw/orchestrator — supervisor service
│   ├── daemon/          # @openclaw/daemon — file watcher
│   └── cli/             # @openclaw/cli — entry point
├── packages/
│   ├── core-*/          # 7 core foundation packages
│   ├── agent-*/         # 4 agent protocol packages
│   ├── summarizer/      # ingest + normalize
│   ├── condense-engine/ # 200/300 token relay
│   ├── change-detector/ # quality gate service
│   ├── audit-store/     # persistence + dead-letter
│   ├── tool-*/          # 5 tool adapters
│   ├── shared/          # 7 SecDev shared packages (pre-existing)
│   ├── labs/            # migrated legacy labs
│   ├── tools/           # migrated legacy tools
│   ├── detections/      # detection modules
│   ├── defense/         # hardening modules
│   └── forensics/       # analysis modules
├── docs/
│   ├── architecture/overview.md   # full architecture doc
│   └── runbooks/operations.md     # operational runbooks
├── projects/            # legacy archive (75 folders)
├── Multiagent_thinking-main/   # source project (merged)
├── watson-project-master/      # source project (merged)
├── openclaw-workspace-main/    # source project (merged)
└── "new work order.ts"         # the original prompt
```

## Key Types (all in `@openclaw/core-types`)

```typescript
type AgentStatus = "working" | "blocked" | "done" | "failed" | "needs_review";

interface RawAgentSummary {
  taskId, agentId, status, summary, touchedFiles, blockers, nextActions, confidence, timestamp
}

interface CondensedRelay200 {
  version: "relay.v1", budget: 200, taskId, agentId, status, summary,
  touchedFiles, blockers, nextAction, severity, confidence
}

interface CondensedRelay300 {
  version: "relay.v1", budget: 300, taskId, agentId, status, summary,
  touchedFiles, blockers, nextActions, topFindings, severity, confidence
}
```

## How to Work Here

### GitNexus

**This repo is indexed by GitNexus.** Use it to navigate, understand impact, and refactor safely:

```bash
# Find code by concept
gitnexus_query({ query: "agent summary" })
gitnexus_query({ query: "condense pipeline" })

# See full context on a symbol
gitnexus_context({ name: "SummaryCondenseService" })

# Blast radius before editing
gitnexus_impact({ target: "CondensedRelay200", direction: "upstream" })

# Check pre-commit scope
gitnexus_detect_changes({ scope: "staged" })

# Trace an execution flow
gitnexus_query({ query: "raw summary to relay" })
```

AGENTS.md at the root has the full GitNexus rules. **Never edit a function/class/method without running impact analysis first.**

### Common Commands

```bash
pnpm build        # compile all 36 packages
pnpm test         # run all tests
pnpm install      # install dependencies

# OpenClaw-specific:
pnpm openclaw start       # run orchestrator (foreground)
pnpm openclaw daemon      # run watch daemon
pnpm openclaw status      # show status
```

### Adding a New Package

1. Create directory: `packages/<name>/src/`
2. Add `package.json` with `@openclaw/<name>` and correct workspace deps
3. Add `tsconfig.json` extending `../../tsconfig.base.json` with references
4. Add `vitest.config.ts` (copy from any existing package)
5. Update `pnpm-workspace.yaml` if needed
6. Run `pnpm install && pnpm build`

### Adding a New Event Type

1. Add interface to `packages/core-types/src/index.ts`
2. Add Zod schema to `packages/core-schemas/src/index.ts`
3. Add to `OpenClawEventSchema` discriminated union
4. Add handler type to `@openclaw/core-events` if needed

## Remaining Work (from original prompt)

| Gap | Priority |
|-----|----------|
| Migrate remaining 70 legacy projects | Medium |
| Add integration tests for full changed-file loop | Medium |
| Full token-aware condensing (tiktoken integration) | Low |
| Real agent-router main-agent delivery (external hook) | Medium |
| CI/CD pipeline (GitHub Actions) | Low |
| TypeScript rewrites of high-value Python/Shell scripts | Low |

### Known Gaps After Hardening

1. **Token counting is heuristic-based** — uses whitespace/word ratio, not a real tokenizer. tiktoken integration would improve accuracy.
2. **SecDev adapter is pattern-matching only** — scans filenames and summary text for keywords. Real static analysis (semgrep, etc.) is a future hook.
3. **No real external agent integration** — orchestrator processes summaries internally; worker agent handoff is a contract, not wired to actual agents.
4. **Integration tests are unit-only** — schema, tokenizer, config, and orchestrator smoke tests exist, but no end-to-end daemon → GitNexus → quality gate → audit flow tests.
5. **No CI/CD pipeline** — build/test/lint are local-only.
6. **Dead-letter overflow policy is constant** — `OVERFLOW_POLICY` is hardcoded to `dead_letter`. Config-driven policy is future work.
7. **Durable persistence is file-based** — good for single-node, but distributed deployment would need a real database.

## Commit History

- `85a1aa4` (2026-04-14) — feat: hardening pass — 10-phase production correction
- `54cf23e` (2026-04-14) — feat: OpenClaw production scaffold — full agent coordination monorepo
- Prior — Initial SecDev Labs migration
