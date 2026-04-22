# OpenClaw Production Scaffold — Architecture

## Overview

OpenClaw is a TypeScript-first agent coordination layer that sits between worker agents and a main agent router. It provides:

1. **Typed emission pipeline** — worker summaries are validated, normalized, condensed to 200/300 tokens, and relayed
2. **Quality automation** — file changes trigger scoped prettier/eslint runs with typed findings
3. **GitNexus integration** — git-aware change detection, file classification, package mapping
4. **SecDev integration** — security-relevant change detection, severity mapping, audit events
5. **Audit trail** — all events persisted with dead-letter queue for failure capture

## Package Map

### Core (Foundation)

| Package | Purpose |
|---------|---------|
| `@openclaw/core-types` | All canonical TypeScript types, enums, interfaces |
| `@openclaw/core-schemas` | Zod runtime validation schemas (discriminated unions) |
| `@openclaw/core-errors` | Typed error hierarchy (SchemaValidationError, CondenseError, etc.) |
| `@openclaw/core-config` | Environment-based config with Zod validation |
| `@openclaw/core-logging` | Structured logging via pino (JSON + human modes) |
| `@openclaw/core-events` | Typed EventBus with discriminated union event handling |
| `@openclaw/core-tokenizer` | Token counting and budget enforcement |

### Agent Protocol

| Package | Purpose |
|---------|---------|
| `@openclaw/agent-protocol` | Canonical schemas + validation helpers for summaries/relays |
| `@openclaw/agent-relay` | Main agent relay service — inbox, delivery, pickup |
| `@openclaw/agent-router` | Event router — listens for worker emissions, manages inbox |
| `@openclaw/agent-memory` | Memory sink abstraction — InMemorySink + AgentMemory |

### Services

| Package | Purpose |
|---------|---------|
| `@openclaw/summarizer` | AgentSummaryIngestService + SummaryNormalizationService |
| `@openclaw/watson` | WatsonFilter — schema-to-schema compression, no LLM inference |
| `@openclaw/change-detector` | ChangedFileQualityService — runs quality gate on changed files |
| `@openclaw/audit-store` | AuditStore — persistence + dead-letter queue |

### Tool Adapters

| Package | Purpose |
|---------|---------|
| `@openclaw/tool-gitnexus` | GitNexusAdapter contract + LocalGitNexusAdapter |
| `@openclaw/tool-secdev` | SecDevAdapter contract + LocalSecDevAdapter |
| `@openclaw/tool-eslint` | EslintRunner contract + LocalEslintRunner |
| `@openclaw/tool-prettier` | PrettierRunner contract + LocalPrettierRunner |
| `@openclaw/tool-runner` | ToolRunner — subprocess execution with timeout |

### Apps

| App | Purpose |
|-----|---------|
| `@openclaw/orchestrator` | OrchestratorService — supervisor, full pipeline |
| `@openclaw/daemon` | WatchDaemon — file watcher, quality gate trigger |
| `@openclaw/cli` | CLI entry point — start, daemon, status |

## Data Flow

```
Worker Agent
    │
    ▼
RawAgentSummary ──► AgentSummaryIngestService (validate)
    │
    ▼
NormalizedAgentSummary ──► SummaryNormalizationService (tags, findings)
    │
    ▼
SummaryCondenseService ──► CondensedRelay200 + CondensedRelay300
    │
    ▼
MainAgentRelayService ──► AgentRouter (inbox)
    │
    ▼
Main Agent picks up condensed relay
```

## File Change Flow

```
File Change (chokidar/watcher)
    │
    ▼
WatchDaemon (debounce)
    │
    ▼
ChangedFileQualityService
    ├── LocalPrettierRunner (format changed files)
    ├── LocalEslintRunner (lint changed TS/JS)
    └── LocalSecDevAdapter (security analysis)
    │
    ▼
QualityGateResult ──► EventBus ──► AuditStore
```

## Event Types (Discriminated Union)

All events flow through the EventBus with a `kind` discriminator:

- `file.change.detected` — file change detected by watcher
- `agent.summary.emitted` — raw worker summary
- `agent.summary.normalized` — normalized summary with tags/findings
- `relay.condensed` — 200/300 token relay payloads
- `quality.gate.completed` — prettier + eslint + secdev results
- `secdev.finding` — security finding
- `gitnexus.change` — git diff results
- `audit.persisted` — audit record stored
- `audit.dead_letter` — failed event captured
- `orchestrator.started` / `orchestrator.shutdown` — lifecycle
- `worker.emit` — worker emission

## Key Design Decisions

- **No ESM dependencies**: Uses `child_process` instead of `execa` to avoid CJS/ESM conflicts
- **Backpressure-safe**: EventBus caps buffer at 1000 events, drops to dead-letter on overflow
- **Idempotent**: All event handlers are safe to re-run
- **Graceful shutdown**: All apps handle SIGTERM/SIGINT/SIGHUP
- **No `any` types**: Strict TypeScript with `noImplicitAny`
- **Zod validation**: All external data validated at boundaries

## Hivemind v2 typed-state draft

An initial typed-state supervision scaffold now exists for the planned summary-first → state-first migration.

- Types live in `packages/core-types/src/index.ts`
- Zod schemas live in `packages/core-schemas/src/index.ts`
- A first deterministic Watson bridge lives in `packages/watson/src/hivemind-v2.ts`
- Repo-specific notes live in:
  - `docs/architecture/hivemind-v2-typed-state-scaffold.md`
  - `docs/architecture/hivemind-v2-watson-bridge.md`
  - `docs/architecture/hivemind-v2-migration-checklist.md`
  - `docs/architecture/adr-0004-design-output-minimums.md`
  - `docs/runbooks/secrets-and-binds.md`

This is intentionally a draft substrate, not a full runtime cutover.
