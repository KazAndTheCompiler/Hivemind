# Watson Project — ADR-001: Production Architecture

**Status:** Draft  
**Date:** 2026-04-12  
**Authors:** Zoe (orchestrator), Kaz (architect)

---

## Context

OpenClaw's context window bloats with session history across 16+ sessions. Agents (Zoe, Aria, Bea) operate in silos — no shared memory, no cross-agent coordination, decisions lost when sessions end. The system broke during a multi-agent Discord routing attempt because context was being stuffed through a single conductor instead of structured coordination.

Two repositories provide the building blocks:
- **MemPalace** (`milla-jovovich/mempalace`) — 96.6% R@5 semantic memory on local ChromaDB. Wings/rooms/closets/drawers structure. Zero cloud dependency.
- **Multiagent_thinking** (`KazAndTheCompiler/Multiagent_thinking`) — TypeScript emission protocol with guard stack. 59% token savings vs verbose prose. 100% TypeScript compliance on free-tier models (vs 0% JSON compliance).

---

## Decision

Integrate MemPalace as the **persistent memory substrate** and Multiagent_thinking's emission protocol as the **coordination layer**, controlled by a **Watson supervisor** that routes tasks to task-specific agents via cron + emissions, not via central context-stuffing.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    WATSON SUPERVISOR (Zoe)                     │
│  - Task routing (keyword → agent specialty)                     │
│  - Emission validation (guard stack)                            │
│  - Memory consolidation (periodic palace sweep)                │
│  - Human escalation point                                      │
└──────────────┬───────────────────────────┬────────────────────┘
               │                           │
    ┌──────────▼──────────┐    ┌───────────▼────────────┐
    │  Aria (secdev)       │    │  Bea (coder)          │
    │  Cron: security      │    │  Cron: coding tasks   │
    │  audit every 6h      │    │  5-min heartbeat      │
    │  Emits → palace      │    │  Emits → palace        │
    └──────────┬───────────┘    └───────────┬────────────┘
               │                            │
    ┌──────────▼────────────────────────────▼────────────┐
    │                    MEMPALACE PALACE                   │
    │  Wing: zoe | Wing: aria | Wing: bea | Wing: kaz       │
    │  Wing: dopaflow | Wing: packy                        │
    │  Halls: facts | events | discoveries | preferences   │
    │  Rooms: auth-migration, regression-results, etc.     │
    │  ChromaDB (local) + drawer verbatim storage          │
    └──────────────────────────────────────────────────────┘
               │
    ┌──────────▼──────────────────────────────────────┐
    │              GUARD STACK (TypeScript)              │
    │  TypeScriptGuard → SemanticGuard → CondenseGuard   │
    │  Validates emissions before palace写入              │
    └──────────────────────────────────────────────────┘
```

---

## Key Decisions

### 1. Memory = MemPalace, not OpenClaw session context
OpenClaw sessions areephemeral. MemPalace is persistent. Agents write findings to palace, read from palace on wake-up instead of relying on session context. This fixes the memory bloat.

### 2. Coordination = TypeScript Emissions, not JSON
Multiagent_thinking proved JSON compliance fails at 0-60% on free-tier models. TypeScript structural contracts achieve 100% compliance. All inter-agent signals use TypeScript interfaces.

### 3. No central routing through Zoe
Zoe assigns tasks and routes results, but does not act as a context proxy. Agents emit to palace, Zoe reads from palace. Direct agent-to-agent communication via palace context breadcrumbs, not through Zoe's context window.

### 4. Cron-driven, not event-driven (initially)
Full event-driven with webhooks adds complexity. Start with cron-scheduled agents (Aria every 6h, Bea every 5min) that emit results. Watson supervisor runs on demand or scheduled consolidation.

### 5. Pixie (Ollama local) handles toolshed emissions
Pixie is the "data emitter" — runs the toolshed scripts, produces structured output, writes to palace. Not a conversation agent. Quantized model (Q4_K_M) to fit in RAM alongside other agents.

### 6. Each agent has ONE Discord bot
No agent routing through a central bot. Each agent (Zoe, Aria, Bea, etc.) has its own Discord bot token. Private channel per bot. Bots run as separate gateway processes.

---

## Memory Palace Structure

### Wings

| Wing | Owner | Purpose |
|------|-------|---------|
| `wing_zoe` | Zoe | Orchestrator decisions, task routing logs |
| `wing_aria` | Aria | Security findings, audit results, hardening logs |
| `wing_bea` | Bea | Coding tasks, regression status, code decisions |
| `wing_pixie` | Pixie | Toolshed emissions, system metrics, data outputs |
| `wing_kaz` | Kaz | User preferences, project context, personal notes |
| `wing_dopaflow` | Shared | DopaFlow project memory, ADR changes |
| `wing_packy` | Shared | Packy2 project memory, GPT2 decisions |

### Hall Types (per wing)
- `hall_facts` — decisions locked in (permanent)
- `hall_events` — sessions, milestones (permanent)
- `hall_discoveries` — breakthroughs, findings (permanent)
- `hall_preferences` — preferences, opinions (permanent)
- `hall_advice` — recommendations (permanent)

### Rooms
Named per topic: `auth-migration`, `regression-results`, `packy-nlp`, `ci-pipeline`

### Tunnels
Auto-created when same room appears in multiple wings.

---

## Guard Stack

```typescript
// Stage 1: TypeScriptGuard — structural validation
// Stage 2: SemanticGuard — signal floor (file refs + action verbs)
// Stage 3: CondenseGuard — Ollama-style schema condensation
```

Every emission passes through all 3 guards before写入 palace. Failed emissions are returned to the agent for correction.

---

## Token Economics

| Approach | Tokens | Annual Cost |
|----------|--------|-------------|
| Paste everything | 19.5M | Impossible |
| LLM summaries | ~650K | ~$507 |
| MemPalace wake-up | ~170 | ~$0.70 |
| MemPalace + 5 searches | ~13,500 | ~$10 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| ChromaDB bloat (issue #525) | Monitor with `mempalace status`, periodic compaction |
| Shell injection in hooks (issue #110) | Sanitize all hook paths, use safe eval |
| macOS ARM64 segfault (issue #74) | N/A — Linux VPS only |
| Agent memory divergence | Periodic consolidation cron (Zoe sweeps palace weekly) |
| Guard stack false positives | Test on sample emissions before production |

---

## Out of Scope

- GitHub integration (needs token + gh cli)
- Multi-machine deployment (VPS-only for now)
- Real-time event-driven (using cron initially)
- AAAKcloset encoding (future v3.0 update)

---

## References

- MemPalace: https://github.com/MemPalace/mempalace
- Multiagent_thinking: https://github.com/KazAndTheCompiler/Multiagent_thinking
- Watson Protocol: `~/watson-protocol/`
- MemPalace SKILL: `~/.openclaw-bea/workspace/mempalace/.claude-plugin/skills/mempalace/SKILL.md`