# OpenClaw Production Wiring Prompt

## Context

This project combines two architectural insights:

### 1. Multiagent_thinking: Emission-Driven Architecture
- Agents emit **typed signals** (TypeScript interfaces), not prose
- **Guard stack**: TypeScriptGuard (structure) → SemanticGuard (meaning) → condense
- Key insight: "Compile pressure beats instruction pressure" - LLMs obey structural contracts
- Token efficiency: 59% savings by removing frontier monitoring
- Ollama filter (local) replaces expensive frontier summarization

### 2. Watson Project: Supervisor/Worker Coordination  
- Supervisor (Zoe) assigns tasks → validates emissions → routes work
- Guard stack validates every agent emission before relay
- Agents: Zoe (orch), Aria (route), Bea (coder), dopaflow (shared)
- MemPalace: persistent semantic memory with temporal knowledge graph

## Current Architecture (Partial)

```
Agent emits RawAgentSummary
    │
    ▼
Orchestrator.processSummary(raw)
    │
    ├──► ingest (validates structure)
    │
    ├──► normalize (validates semantics)
    │        │
    │        └──► secdev.analyzeEmission() ← WE ADDED THIS but not wired
    │
    ├──► condense (200/300 token schemas)
    │
    └──► relay (deliver to main agent)

change-detector: NOT WIRED (stub)
automation-enforcement: SEPARATE from main pipeline
```

## What's Broken

1. **SecDev findings don't flow into NormalizedAgentSummary** - `toolFindings` array exists but `processSummary` never populates it
2. **change-detector exists but isn't called** - quality gate is a stub
3. **Automation enforcement is separate** - should integrate at normalize stage
4. **Guard stack isn't implemented** - SemanticGuard (signal floor, file refs, action verbs) missing

## What to Wire

### Critical Path (must fix)

1. **Wire SecDev into normalization**
   - After `normalizeAndEmit()`, call `secdev.analyzeEmission({ kind: 'normalized', summary: normalized })`
   - Merge findings into `normalized.toolFindings`
   - Findings affect severity and confidence

2. **Wire change-detector into pipeline**
   - In `processSummary()`, call `changeDetector.runQualityGate(touchedFiles)` 
   - Merge prettier/eslint findings into `toolFindings`
   - Blocking failures escalate to critical

3. **Implement SemanticGuard logic**
   - Reject if no file refs AND no action verbs (signal floor)
   - Reject if empty done + empty blockers (anomaly)
   - This lives in the normalization service or a new guard service

4. **Wire automation-enforcement at checkpoint**
   - After N mutations or milestone, run slow loop
   - Use `SummaryEmitter` to produce 300-token checkpoint summary

### Secondary (important but can defer)

5. **MemPalace integration** - save emissions to persistent memory
6. **Review queue UI** - show blocked items needing attention
7. **Escalation rules** - when to call frontier vs handle locally

## Semantic Guard Specification

From SCHEMA_GUARD_v1.md, implement in normalization service:

```
Rule 1: No empty done without blockers
  → if (done.length === 0 && blockers.length === 0) → flag anomaly

Rule 2: Must have file references  
  → count file refs in done + nextActions
  → if (fileCount < 1) → flag low_signal

Rule 3: Action verb presence
  → done/nextActions must contain: create|update|delete|fix|implement|refactor|test

Rule 4: No forbidden filler
  → "completed task", "worked on", "made changes" → flag low_density
```

## Token Budget Discipline

- relay200: 200 tokens max (main agent handoff)
- relay300: 300 tokens max (checkpoint summary)
- Normalization: preserve signal, truncate noise
- No LLM inference in compression - tool extraction only

## Testing

```
1. Agent emits: { summary: "did stuff", touchedFiles: [], blockers: [], nextActions: [] }
   Expected: SemanticGuard flags "no file refs"

2. Agent emits: { summary: "completed task", touchedFiles: [], blockers: [], nextActions: [] }
   Expected: SemanticGuard flags "forbidden filler"

3. Agent emits with .env file touched
   Expected: SecDev finds SECRISK_ENV_FILE, severity=high

4. Normalized summary with critical findings
   Expected: relay200.severity = 'critical', pipeline halts
```

## Success Criteria

- [ ] `processSummary()` runs SecDev and merges findings
- [ ] `processSummary()` runs change-detector and merges findings  
- [ ] SemanticGuard logic rejects low-signal emissions
- [ ] relay200/relay300 respect token budgets
- [ ] Critical severity halts pipeline
- [ ] All new code has tests