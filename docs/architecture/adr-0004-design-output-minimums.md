# ADR 0004: Design House Rule for Minimum Structured Output

- Status: Proposed
- Date: 2026-04-22
- Owners: Henry / Supervisor-Agent

## Context

Hivemind is moving from summary-first relay toward typed-state supervision.
That architectural shift only works if agents and components share a minimum output discipline.

Without a house rule, teams drift back into:
- long narrative recap instead of machine-checkable output
- completion claims without file or evidence linkage
- inconsistent handoff shapes between agents
- expensive supervisor re-parsing of prose

The new Hivemind v2 prompt pack and ADR 0003 already define the direction.
This ADR sets the minimum output floor so the rule is visible and reusable across builders, supervisors, reducers, and legacy adapters.

## Decision

All meaningful Hivemind work outputs must satisfy a minimum structured-output rule.

### Minimum requirements

Every meaningful output must include, either directly or via typed schema:

1. **Task identity**
   - task id or equivalent work identifier

2. **Current phase or status**
   - example: analysis, implementation, verification, blocked, complete

3. **Concrete work done**
   - factual completed actions, not self-evaluation

4. **Touched files or scope refs**
   - exact file paths when code or docs changed
   - explicit empty list if nothing changed

5. **Blockers**
   - must be non-empty when blocked
   - should identify what stopped progress

6. **Next action**
   - bounded follow-up step, not generic advice

7. **Evidence**
   - tests run, findings, symbols changed, file refs, diff refs, or tool results

## Design rule

Structured fields outrank prose.
If a schema exists, agents should fill the schema instead of writing a summary paragraph.

Human-readable prose may exist as a side artifact, but it must not replace the minimum structured output.

## Applies to

- Builder progress emissions
- Supervisor verdicts
- Reducer packets
- Legacy summary adapters
- Handoff artifacts that claim task progress or completion

## Does not require

This rule does not require every output to use the exact same schema.
It requires that outputs preserve the same operational minimums.

## Enforcement guidance

### Builders
- must not claim completion without evidence and touched scope
- must emit blockers instead of improvising outside scope

### Supervisors
- should reject or retry outputs missing file refs or evidence for strong claims
- should prefer narrow corrective instructions over narrative feedback

### Reducers and adapters
- must preserve blockers, touched files, and evidence refs
- must not flatten uncertainty away just to make output prettier

## Accepted tradeoff

We accept a little more schema friction in exchange for:
- lower token burn
- easier verification
- better replayability
- less narrative drift

## Immediate implication

When introducing new Hivemind v2 flows, the first question is not "what summary should this write?"
The first question is "what minimum structured state must survive this step?"
