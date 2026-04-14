# Watson Project — Architecture Plan
**Last updated:** 2026-04-12
**Name origin:** Sherlock's sidekick — MemPalace evokes Holmes, Watson completes the duo.

---

## Overview

Watson Project integrates two systems into a coherent multi-agent memory and coordination layer:

1. **MemPalace** — persistent semantic memory with temporal knowledge graph
2. **Multiagent_thinking** — TypeScript emission protocol with guard stack

Combined: agents that remember, emit structured signals, and coordinate without verbose messaging.

---

## Status

- [x] MemPalace installed → `/home/openclaw/.watson-venv/`
- [x] Palace initialized → `/home/openclaw/watson-palace/`
- [x] TypeScript schema defined → `watson/schema.ts`
- [x] Guard stack built → `watson/guards.ts`
- [ ] Wing setup script (define wings for zoe/aria/bea/dopaflow/kaz)
- [ ] Supervisor session that routes Bea's regression results through guards
- [ ] Test full loop

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Watson Project                    │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │   Zoe    │   │   Aria   │   │   Bea    │        │
│  │ (orch)   │   │ (route)  │   │ (coder)  │        │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘        │
│       │               │               │              │
│  ┌────▼───────────────▼───────────────▼────┐        │
│  │         Guard Stack (TypeScript)          │        │
│  │  TypeScriptGuard → SemanticGuard → condense │ │
│  └────┬───────────────┬───────────────┬────┘        │
│       │               │               │              │
│  ┌────▼───────────────▼───────────────▼────┐        │
│  │           MemPalace Palace                │        │
│  │  Wing: zoe   Wing: aria   Wing: bea      │        │
│  │  Wing: dopaflow (shared project)          │        │
│  │  Hall: facts | events | discoveries      │        │
│  └──────────────────────────────────────────┘       │
│                                                      │
│  ┌──────────────────────────────────────────┐      │
│  │         Supervisor (Zoe)                   │      │
│  │  Assigns tasks → Validates emissions      │      │
│  │  Routes completed work → next agent       │      │
│  └──────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

---

## MemPalace Structure

### Wings

| Wing | Owner | Purpose |
|------|-------|---------|
| `wing_zoe` | Zoe | Zoe's conversation memory, preferences, decisions |
| `wing_aria` | Aria | Aria's routing memory, task history |
| `wing_bea` | Bea | Bea's coding context, code decisions, DopaFlow work |
| `wing_dopaflow` | Shared | Project memory — ADR changes, code decisions, regressions |
| `wing_kaz` | Kaz | User preferences, project context |

### Hall Types (per wing)
- `hall_facts` — decisions locked in
- `hall_events` — sessions, milestones
- `hall_discoveries` — breakthroughs, findings
- `hall_preferences` — preferences, opinions
- `hall_advice` — recommendations

### Tunnels
Cross-wing connections when the same room appears:
- `dopaflow/packy-nlp` ↔ `bea/dopaflow` → Bea's regression work connected to project context

---

## Emission Contract

Every agent emits a typed signal when work is done:

```typescript
interface WatsonEmission {
  version: "1.0";
  emitter: "zoe" | "aria" | "bea";
  timestamp: string; // ISO-8601
  task_id: string;
  status: "done" | "blocked" | "escalate";
  summary: string;
  findings: Finding[];
  next_actions: NextAction[];
  blockers?: string[];
  confidence: number; // 0-1
}
```

---

## Guard Stack

| Stage | What | Fails on |
|-------|------|---------|
| **TypeScriptGuard** | Structural extraction + JSON validation | Missing fields, wrong types, no block found |
| **SemanticGuard** | File refs + action verbs + finding ID pattern | Finding without file refs, no action verb, bad ID |
| **condense** | Truncate to schema, cap tokens | Never fails — transforms |

Retry on fail: 2 retries, then escalate to supervisor.

---

## Key Files

```
watson/
├── WATSON.md     ← this file
├── schema.ts     ← WatsonEmission, Finding, NextAction types
├── guards.ts     ← TypeScriptGuard → SemanticGuard → condense
└── palace/
    └── init.sh   ← (to write) wing + room setup
```

---

## Priority Order

1. **Write wing setup script** — create zoe/aria/bea/dopaflow/kaz wings
2. **Send Bea's regression results through guard stack** as test
3. **Mine results into palace**
4. **Write supervisor loop** — Zoe routes Bea's emission to MemPalace and responds to Kaz
5. **Wire Bea into Watson** for ongoing DopaFlow regression tasks
