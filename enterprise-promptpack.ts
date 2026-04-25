/* eslint-disable */
/**
 * HIVEMIND — ENTERPRISE / PRODUCTION-GRADE EVOLUTION PROMPT PACK
 *
 * Companion to: minimaxpromptpack (evolution layer) and minimaxpromptpack2.
 *
 * Mission of THIS pack: take the current Hivemind monorepo (Watson + Sherlock +
 * orchestrator + daemon + 48 packages, single-process, file-backed) and harden
 * it into a multi-tenant, distributed, observable, durable, contract-versioned
 * multi-agent workflow orchestration platform — without breaking the existing
 * pipeline contracts, schema versions, audit guarantees, or guard stack.
 *
 * Three exports:
 *   1. HIVEMIND_ENTERPRISE_MASTER_PROMPT — single drop-in orchestrator prompt
 *   2. HIVEMIND_ENTERPRISE_100_POINT_PROMPT — 100 numbered, atomic deliverables
 *   3. HIVEMIND_ENTERPRISE_TRACK_PROMPTS — eleven focused track prompts for
 *      parallel agent execution (one agent per track)
 *
 * USAGE
 *   - Feed the MASTER prompt to a planning agent to produce the rollout plan.
 *   - Feed the 100_POINT prompt to an execution agent that ticks deliverables
 *     in dependency order.
 *   - Feed individual TRACK prompts to specialist agents working in parallel
 *     under Watson supervision.
 */

// =============================================================================
// 1) MASTER PROMPT
// =============================================================================

export const HIVEMIND_ENTERPRISE_MASTER_PROMPT = `
You are evolving the Hivemind monorepo (Watson + Sherlock multi-agent
orchestration scaffold) from "production-hardened single-process prototype"
(v0.2.0) into an enterprise-grade, multi-tenant, distributed multi-agent
workflow orchestration platform.

This is NOT a rewrite.
This is NOT a re-brand.
This is NOT a vague "make it scale" exercise.

This is a disciplined, reversible enterprise-hardening pass.

The repo today already has:
- pnpm monorepo with 48 packages and 3 apps (orchestrator / daemon / cli)
- typed signal bus (\`core-events.EventBus\`) with idempotency, audit, DLQ
- Watson condense pipeline (200 / 300 token relay)
- Sherlock daemon (chokidar + quality gates + gitnexus ownership)
- guard stack (semantic guard, retry policy, escalation, drift halt)
- audit-store (JSONL with durable file sink + TTL in-memory sink)
- circuit breakers for secdev and quality_gate
- input validation on processSummary()
- graceful shutdown, health checks
- evolution-core scaffolding from minimaxpromptpack

Your job in THIS pack is to add an ENTERPRISE LAYER on top of that, organised
into eleven tracks. Every track is shipped behind a feature flag, with
schema-versioned payloads, with reversible migrations, and with no regression
of existing tests.

================================================================================
PRIMARY MISSION
================================================================================

Deliver a Hivemind release line (v1.0.0) that can:

  1.  Run multiple orchestrator replicas behind a load balancer with no split-brain.
  2.  Carry typed signals across processes, hosts, and clusters with at-least-once
      delivery and exactly-once effects.
  3.  Isolate tenants — events, audit, memory, lessons, and quotas.
  4.  Enforce identity, authentication, and authorisation on every signal,
      every tool call, every relay.
  5.  Emit OpenTelemetry traces, metrics, and structured logs across the whole
      Watson → Sherlock → main-agent pipeline.
  6.  Persist durable workflow state (DAG / saga) with replay, resume, and
      compensation semantics — agents cannot lose work on crash.
  7.  Version every contract (signal, summary, lesson, prompt, tool result)
      with deprecation windows and dual-read support.
  8.  Manage secrets, signing keys, and supply-chain integrity (SBOM + sigstore).
  9.  Enforce SLOs with bulkheads, timeouts, rate limits, and error budgets.
 10.  Deploy reproducibly via OCI images, Helm charts, and IaC modules.
 11.  Recover from disaster: backups, PITR, region failover, runbooks.

================================================================================
NON-NEGOTIABLE RULES
================================================================================

R1. Do not break existing public APIs. Add new APIs alongside; deprecate old
    ones with explicit JSDoc \`@deprecated\` and migration notes.

R2. Every new event payload MUST extend \`BaseSignal\` (schemaVersion, sequence,
    streamId, traceparent, tenantId, principalId, signature).

R3. Every new package MUST ship: package.json, tsconfig, vitest config,
    README, schema (Zod), error types extending \`HivemindError\`, and at
    least 80 % statement coverage on its public exports.

R4. No silent failures. Every catch must either log structured + rethrow or
    explicitly route to dead-letter. No \`catch {}\`, no \`catch (_) {}\`.

R5. No new global state. All state lives in injected services with explicit
    lifecycle (\`init\`, \`start\`, \`stop\`, \`drain\`, \`dispose\`).

R6. No clock or randomness without injection. Use \`Clock\` and \`Random\`
    interfaces from \`@openclaw/core-clock\` (create if missing) — needed for
    deterministic replay and testing.

R7. Feature flags gate every enterprise capability. Default = OFF. Existing
    single-process behaviour MUST remain the fallback path.

R8. Migrations must be reversible. Every schema migration ships with an
    \`up\` and \`down\` script and a smoke test running both directions.

R9. No regression in:
       - guard-stack drift counter
       - watson 200/300 token relay budget
       - sherlock debounce semantics
       - audit-store durability invariants
       - circuit breaker behaviour
       - graceful shutdown timing

R10. Every track must include: design doc under \`docs/enterprise/<track>.md\`,
     ADR under \`docs/adr/NNNN-<title>.md\`, integration test, and runbook
     stub under \`docs/runbooks/<track>.md\`.

================================================================================
ELEVEN ENTERPRISE TRACKS
================================================================================

T1. DISTRIBUTED EVENT BUS
T2. DURABLE WORKFLOWS & SAGAS
T3. MULTI-TENANCY & ISOLATION
T4. IDENTITY, AUTHN & AUTHZ
T5. OBSERVABILITY (OTel: traces, metrics, logs)
T6. CONTRACT VERSIONING & SCHEMA EVOLUTION
T7. SECRETS, SIGNING & SUPPLY-CHAIN
T8. SLOs, BULKHEADS, RATE LIMITING & COST CONTROLS
T9. CHAOS, LOAD & GOLDEN-REPLAY TESTING
T10. DEPLOYMENT, IaC & DISASTER RECOVERY
T11. AGENT PROTOCOL & CAPABILITY REGISTRY

Each track has its own atomic deliverables (see HIVEMIND_ENTERPRISE_100_POINT_PROMPT).
Each track has its own focused track prompt (see HIVEMIND_ENTERPRISE_TRACK_PROMPTS).

================================================================================
EXECUTION DISCIPLINE
================================================================================

Before editing any symbol:
  - Run \`gitnexus_impact({ target, direction: "upstream" })\`
  - Report blast radius. Halt if HIGH/CRITICAL without user ack.

Before committing:
  - Run \`gitnexus_detect_changes({ scope: "staged" })\`
  - Confirm changes match the track's stated scope.

For each deliverable:
  1. Open an ADR. State problem, options, decision, consequences.
  2. Land schema + types first. Land code that uses them second.
  3. Add tests in the same PR as the change.
  4. Add a feature flag. Default OFF. Wire flag through config.
  5. Add observability hooks (trace span, metric, structured log).
  6. Add a runbook entry: how to detect, diagnose, and roll back.
  7. Update CHANGELOG with one line under \`## [Unreleased] / Enterprise\`.

Definition of Done for the whole pack:
  - All 100 deliverables green.
  - \`pnpm build\` clean. \`pnpm test\` clean. \`pnpm lint\` clean.
  - Coverage ≥ 80 % statements on all new packages.
  - One full integration run: 3 orchestrator replicas, NATS bus, Postgres
    audit, OTel collector, two tenants, one chaos kill, one rolling deploy —
    no message loss, no double-execution, no SLO breach.
  - Rollback drill: revert v1.0.0 to v0.2.0 in staging, prove pipeline still
    drains pending relays.

You are not done until the rollback drill passes.
`;

// =============================================================================
// 2) 100-POINT ATOMIC DELIVERABLES
// =============================================================================

export const HIVEMIND_ENTERPRISE_100_POINT_PROMPT = `
HIVEMIND — ENTERPRISE 100-POINT EVOLUTION CHECKLIST

Read HIVEMIND_ENTERPRISE_MASTER_PROMPT first. Honour every non-negotiable rule.
Tick each item only when:
  - code merged
  - tests added and passing
  - ADR / design doc / runbook stub written
  - feature flag wired (default OFF)
  - gitnexus impact + detect_changes both clean
  - CHANGELOG updated

Items are listed in dependency-respecting order. Do not skip ahead.

────────────────────────────────────────────────────────────────────────────────
TRACK 1 — DISTRIBUTED EVENT BUS
────────────────────────────────────────────────────────────────────────────────
  1. Add \`@openclaw/bus-contract\` package: abstract Bus interface, Codec,
     DeliveryReceipt, AckHandle, ConsumerGroup types.
  2. Refactor existing in-process EventBus to implement \`Bus\` (adapter pattern,
     no behaviour change).
  3. Add \`@openclaw/bus-nats\` adapter: JetStream-backed Bus with at-least-once
     delivery, durable consumers, replay-from-sequence.
  4. Add \`@openclaw/bus-redis\` adapter (Streams + consumer groups) as
     alternate transport for environments without NATS.
  5. Define cross-process envelope: BaseSignal + traceparent + tenantId +
     principalId + signature + producerId + producedAt.
  6. Add idempotency-key store (Postgres or Redis) consulted before effectful
     handlers run. 24-hour TTL by default, configurable per tenant.
  7. Add ConsumerGroup primitive: named cohort with delivery isolation,
     lag metrics, and pause/resume operations.
  8. Add bus-level dead-letter topic with replay tooling
     (\`hivemind bus replay --topic <t> --from <ts> --to <ts>\`).
  9. Add per-topic backpressure: high-watermark pause, low-watermark resume,
     metrics for buffer depth, slow-consumer detection.
 10. Smoke test: 3 orchestrator replicas, 1k events/s, 0 loss, 0 dupes
     observed past idempotency layer; chaos kill any replica mid-run.

────────────────────────────────────────────────────────────────────────────────
TRACK 2 — DURABLE WORKFLOWS & SAGAS
────────────────────────────────────────────────────────────────────────────────
 11. Add \`@openclaw/workflow-core\` package: WorkflowDefinition, StepDefinition,
     SagaDefinition, CompensationStep, ExecutionId, AttemptId.
 12. Add \`@openclaw/workflow-engine\`: durable executor backed by Postgres
     (advisory locks for fencing). Supports parallel branches, fan-out / fan-in,
     timers, signals, cancellation, retries with backoff.
 13. Implement deterministic replay: workflow code re-runs from event log on
     resume; non-deterministic IO must go through engine APIs.
 14. Implement saga compensation: each step declares an idempotent inverse;
     engine runs compensations in reverse order on failure.
 15. Migrate existing orchestrator pipeline to a \`workflowDefinition('relay')\`
     with steps: ingest → sanitize → normalize → secdev → guard → quality →
     condense → relay → memory. Old code path remains behind flag.
 16. Add \`workflow-cli\`: \`hivemind wf list / inspect / retry / cancel /
     replay\` against running and historical executions.
 17. Add timer-driven steps for SLA enforcement (e.g. relay must complete in
     N seconds or escalate).
 18. Add child-workflow support so worker pipelines can be spawned and joined.
 19. Add fairness scheduler: per-tenant + per-priority quotas, no head-of-line
     blocking under load.
 20. Golden test: kill engine mid-step on every step boundary; resume; verify
     exactly-once effect under idempotency contract.

────────────────────────────────────────────────────────────────────────────────
TRACK 3 — MULTI-TENANCY & ISOLATION
────────────────────────────────────────────────────────────────────────────────
 21. Add \`TenantId\` type to \`@openclaw/core-types\`. Required on every signal,
     workflow, audit row, lesson, prompt version, and tool invocation.
 22. Add tenant registry package: tenant CRUD, status (active / paused /
     archived), feature toggles, quotas, retention policy.
 23. Enforce tenant scoping at the Bus, AuditStore, Memory, EvolutionMemory,
     and PromptRegistry layers — no cross-tenant reads possible by API shape.
 24. Add per-tenant audit partitioning: \`audit.storePath/<tenantId>/...\`
     and Postgres tablespace / row-level-security policies.
 25. Add per-tenant rate limits and concurrency caps wired into the workflow
     fairness scheduler.
 26. Add tenant-scoped configuration overlay: tenant config inherits from
     defaults, overrides only on explicit set.
 27. Add data-residency tag per tenant; route storage to region-pinned
     backends; refuse writes that violate residency.
 28. Add retention policy enforcement: per-tenant TTL on audit, lessons,
     observations, dead letters; nightly compactor with metrics.
 29. Add tenant-archive flow: pause, freeze, export tarball, purge.
 30. Cross-tenant leakage test: synthetic high-load run with two tenants,
     fuzz on tenantId; assert zero cross-reads at every layer.

────────────────────────────────────────────────────────────────────────────────
TRACK 4 — IDENTITY, AUTHN & AUTHZ
────────────────────────────────────────────────────────────────────────────────
 31. Add \`@openclaw/identity\` package: Principal, Subject, Capability,
     Role, CapabilityToken (signed JWT-ish, short-TTL).
 32. Add OIDC / SPIFFE-compatible authenticator: orchestrator and daemon
     verify caller identity; agents bring SVIDs.
 33. Add capability-based authorisation: every API takes a CapabilityToken;
     Watson, Sherlock, tools, and relay all check required capabilities.
 34. Sign every signal with the producer's key; verify on consumption;
     reject unsigned in enforcement mode.
 35. Add mTLS across all internal transports (NATS, Postgres, OTel collector).
 36. Add admin-action audit: every privileged operation (unhalt, drain inbox,
     reset breakers) records actor, capability, reason.
 37. Add break-glass capability with mandatory ticket reference and time-box.
 38. Add RBAC for human users via the future console: viewer, operator,
     tenant-admin, platform-admin.
 39. Add prompt-injection defence layer: tool-result content is treated as
     untrusted; structured fields only escape sandbox via allow-list.
 40. Penetration test: red-team an unsigned orchestrator → assert refusal;
     replay captured signal from another tenant → assert refusal.

────────────────────────────────────────────────────────────────────────────────
TRACK 5 — OBSERVABILITY (OTel: TRACES, METRICS, LOGS)
────────────────────────────────────────────────────────────────────────────────
 41. Add \`@openclaw/otel\` package: tracer + meter + logger factories,
     resource attributes (service, version, tenant, region).
 42. Propagate \`traceparent\` through every signal, every workflow step,
     every tool invocation. One trace per relay end-to-end.
 43. Instrument Watson: spans for ingest, sanitize, normalize, secdev, guard,
     condense, relay, memory. Metric on duration, drop-rate, drift.
 44. Instrument Sherlock: spans for debounce, gitnexus, eslint, prettier,
     secdev. Metric on file count, latency, fail-rate.
 45. Define core metrics: \`hivemind_relay_total\`, \`hivemind_relay_blocked_total\`,
     \`hivemind_guard_failures_total\`, \`hivemind_workflow_duration_seconds\`,
     \`hivemind_circuit_state\`, \`hivemind_bus_lag_seconds\`,
     \`hivemind_dead_letters_total\`, \`hivemind_token_budget_used_total\`.
 46. Switch logger to OTel logs SDK; preserve current JSON shape; add
     trace correlation fields automatically.
 47. Ship dashboards (Grafana JSON committed under \`ops/dashboards/\`):
     Pipeline health, Workflow engine, Bus lag, Tenant SLOs, Cost.
 48. Ship alert rules (Prometheus YAML committed under \`ops/alerts/\`):
     drift halt fired, breaker open > 1m, dead-letter rate, SLO burn.
 49. Add exemplar links in metrics → traces → logs.
 50. Synthetic probe: continuous canary tenant emits a relay every minute;
     dashboards verify end-to-end <2 s p95.

────────────────────────────────────────────────────────────────────────────────
TRACK 6 — CONTRACT VERSIONING & SCHEMA EVOLUTION
────────────────────────────────────────────────────────────────────────────────
 51. Add \`@openclaw/contracts\` package: registry of all wire schemas with
     semver, hash, owner, deprecation status.
 52. Add Buf-style breaking-change checker in CI: PRs touching contracts must
     pass compatibility rules.
 53. Adopt versioned topic names (\`relay.v1\`, \`relay.v2\`); ConsumerGroups
     subscribe to a version range.
 54. Add dual-read / dual-write capability: producers can emit on multiple
     versions during migration windows.
 55. Add upcaster registry: any reader can upcast older versions to current.
 56. Generate JSON-Schema and language SDKs (TypeScript first, optional Python)
     from Zod schemas during build.
 57. Add deprecation telemetry: every emit/consume of a deprecated version
     increments a metric tagged with caller; we alert when usage hits zero.
 58. Add automatic deprecation sunset: a deprecated version that has had zero
     traffic for N days is auto-removed in the next release.
 59. Document the contract review process: ADR template, owner sign-off,
     rollout window, deprecation timeline.
 60. Migration drill: introduce v3 of \`relay.condensed\`, run dual-write for
     one week, cut readers over, verify zero loss.

────────────────────────────────────────────────────────────────────────────────
TRACK 7 — SECRETS, SIGNING & SUPPLY-CHAIN
────────────────────────────────────────────────────────────────────────────────
 61. Replace ad-hoc env reads with a \`SecretsProvider\` interface;
     implementations: env (dev), Vault, AWS Secrets Manager, GCP SM.
 62. Rotate signing keys via the provider; signature verification accepts
     overlap window; key id is part of the signal envelope.
 63. Generate SBOM (CycloneDX) on every build; commit to release artefacts.
 64. Sign images and SBOMs with sigstore / cosign; verify in deploy pipeline.
 65. Pin all dependencies; enable provenance attestations (SLSA L3 target).
 66. Add secret-scanning pre-commit hook (gitleaks); block commits with
     high-confidence findings.
 67. Add LLM prompt + tool-output redactor: PII patterns replaced before
     persistence; redaction policy is tenant-scoped.
 68. Add KMS-encrypted-at-rest for audit, memory, evolution stores.
 69. Add periodic secrets rotation drill: monthly, automated, alerts on
     drift between expected and active key id.
 70. Supply-chain incident exercise: simulate a compromised upstream package;
     verify image signature gate blocks deploy.

────────────────────────────────────────────────────────────────────────────────
TRACK 8 — SLOs, BULKHEADS, RATE LIMITING & COST CONTROLS
────────────────────────────────────────────────────────────────────────────────
 71. Define SLOs in code under \`ops/slos.yaml\`: relay latency p95 < 2 s,
     relay success > 99.5 %, guard drift halt MTTR < 15 min, bus lag p95 < 1 s.
 72. Compute error budget burn rates; alert at 2 %/h and 14 %/d.
 73. Add bulkheads: separate executor pools for Watson, Sherlock, tool-runner,
     evolution; one pool's saturation cannot starve another.
 74. Add hard timeouts at every IO boundary; no caller waits indefinitely.
 75. Add token-bucket rate limits per tenant per signal kind.
 76. Add LLM token-budget tracker (per task, per tenant, per workflow):
     refuses dispatch when budget exceeded; surfaces remainder in relays.
 77. Add cost telemetry: \`hivemind_cost_usd_total\` with tenant + tool labels;
     daily report; per-tenant invoice export.
 78. Add adaptive concurrency control on tool-runner: AIMD against observed
     latency; protects downstream tools from thundering herds.
 79. Add scheduled load-shedding policy: define which signal kinds are
     droppable under sustained pressure (lowest-priority first).
 80. Soak test: 24-hour run at 80 % of provisioned capacity; verify no SLO
     breach, no memory leak, no event loss, no breaker flap.

────────────────────────────────────────────────────────────────────────────────
TRACK 9 — CHAOS, LOAD & GOLDEN-REPLAY TESTING
────────────────────────────────────────────────────────────────────────────────
 81. Add \`@openclaw/testing-chaos\` package: fault injectors for bus, store,
     tools, clock, and network. Wired only when \`HIVEMIND_CHAOS=1\`.
 82. Add scenario suite: kill orchestrator mid-step; partition NATS for 30 s;
     pause Postgres; corrupt single audit page; throttle eslint adapter.
 83. Add load-test harness using k6 or autocannon; reproducible workloads
     committed under \`ops/load/\`.
 84. Add golden-replay corpus: anonymised real relays captured from staging;
     re-run on every PR; assert byte-identical post-condense output where
     determinism applies.
 85. Add property-based tests on guard-stack, condense-engine, retry-policy
     using fast-check.
 86. Add mutation testing on \`@openclaw/watson\`, \`@openclaw/guard-stack\`,
     \`@openclaw/condense-engine\`; mutation score floor 60 %.
 87. Add fuzzing on signal envelopes (boundary lengths, malformed unicode,
     forged signatures); assert no crash, no auth bypass.
 88. Add long-running soak rig in CI nightly: 8 h, two tenants, mixed load.
 89. Add deterministic-replay assertion in workflow-engine tests: identical
     inputs → identical event log.
 90. Publish a chaos-day runbook; rehearse quarterly; record findings.

────────────────────────────────────────────────────────────────────────────────
TRACK 10 — DEPLOYMENT, IaC & DISASTER RECOVERY
────────────────────────────────────────────────────────────────────────────────
 91. Provide reproducible OCI images per app (orchestrator, daemon, cli),
     multi-arch, distroless base, non-root, healthcheck endpoints.
 92. Provide Helm chart with values for replicas, resources, OTel endpoint,
     bus URL, secrets provider, tenants config.
 93. Provide Terraform modules for AWS + GCP reference deployments
     (Postgres, NATS/Redis, KMS, OTel collector, dashboards, alerts).
 94. Wire blue/green or canary release pipeline: progressive rollout by
     tenant cohort; automatic rollback on SLO burn alert.
 95. Implement online schema migrations with zero-downtime contracts; CI
     runs migrate-up + migrate-down on every PR that touches schema.
 96. Define backups: continuous WAL for Postgres, hourly snapshot for audit;
     retention 30 days hot / 1 year cold.
 97. Implement point-in-time-recovery drill: weekly automated restore into
     a sandbox; smoke-test restored cluster runs the canary tenant.
 98. Implement cross-region failover plan: documented RTO < 30 min,
     RPO < 5 min; rehearse semiannually.
 99. Provide \`hivemind doctor --enterprise\`: end-to-end readiness check
     covering bus, store, secrets, tracing, breakers, SLOs.
100. Cut v1.0.0 release: signed images, SBOM, release notes, migration
     guide v0.2.0 → v1.0.0, runbooks complete, rollback drill green.

DONE WHEN every item above is checked, the integration test in the master
prompt is green, and the rollback drill from v1.0.0 → v0.2.0 succeeds.
`;

// =============================================================================
// 3) PER-TRACK FOCUSED PROMPTS
// =============================================================================

export const HIVEMIND_ENTERPRISE_TRACK_PROMPTS = {
  T1_DISTRIBUTED_BUS: `
You own Track 1 — Distributed Event Bus.

Goal: turn the in-process EventBus into a transport-agnostic, at-least-once,
exactly-once-effects event substrate suitable for N orchestrator replicas.

Constraints:
- Existing core-events.EventBus must keep working as a default in-process
  adapter behind the new Bus interface.
- BaseSignal additions (traceparent, tenantId, principalId, signature) are
  REQUIRED on every cross-process emit. Validate at the codec layer.
- Idempotency keys persist outside the bus; the bus only DELIVERS — effects
  decide whether they FIRE.

Deliverables: items 1–10 of the 100-point list.

Ship behind flag \`hivemind.bus.transport\` ∈ { in_process | nats | redis }.
Default in_process. Smoke test in CI for in_process; integration test in
nightly for nats and redis.
`,

  T2_DURABLE_WORKFLOWS: `
You own Track 2 — Durable Workflows & Sagas.

Goal: relays survive process death. The Watson pipeline becomes a workflow
definition; saga compensation handles partial failures; replay is deterministic.

Constraints:
- Use Postgres advisory locks for fencing — exactly one engine instance owns
  a given execution at a time.
- Reject non-deterministic IO inside workflow code at lint time
  (custom ESLint rule under @openclaw/eslint-plugin-hivemind).
- Old single-process pipeline stays as fallback under flag
  \`hivemind.workflow.engine\` = legacy | durable.

Deliverables: items 11–20.

The "kill mid-step" golden test (item 20) is the must-pass gate.
`,

  T3_MULTI_TENANCY: `
You own Track 3 — Multi-Tenancy & Isolation.

Goal: Hivemind serves multiple tenants without leakage at any layer.

Constraints:
- TenantId is non-optional everywhere it appears. Compile error if missing.
- Storage layers refuse cross-tenant reads via API shape, not runtime checks.
- Residency tag is enforced at write time, not read time.

Deliverables: items 21–30.

Cross-tenant leakage test (item 30) is the gate. Use property-based tests
with random TenantId fuzzing.
`,

  T4_IDENTITY_AUTHZ: `
You own Track 4 — Identity, AuthN & AuthZ.

Goal: every signal, every tool call, every relay carries verified identity
and is authorised against capabilities.

Constraints:
- Capabilities are tokens, not strings — short-TTL, signed, rotated.
- Enforcement mode is the default in v1.0.0; permissive mode exists for
  one minor version then is removed.
- Break-glass requires ticket reference and emits a high-priority audit event.

Deliverables: items 31–40.

Pen-test (item 40) is the gate.
`,

  T5_OBSERVABILITY: `
You own Track 5 — Observability.

Goal: complete traces, metrics, logs across Watson + Sherlock + workflow
engine + bus + storage. One end-to-end relay = one trace.

Constraints:
- No print-debug. Use the OTel logger.
- Every span has tenant + workflow + step attributes.
- Cardinality budget: never label a metric with userId, taskId, or anything
  unbounded — use trace exemplars instead.

Deliverables: items 41–50.

Canary tenant (item 50) drives the SLO dashboard from day one.
`,

  T6_CONTRACT_VERSIONING: `
You own Track 6 — Contract Versioning & Schema Evolution.

Goal: any wire schema can evolve without breaking running clients.

Constraints:
- Breaking-change checker runs in CI, blocks merges.
- Deprecation telemetry tracks every old-version use; release-blocker if a
  version slated for removal still has traffic.
- Upcasters are pure functions, unit-tested, and registered centrally.

Deliverables: items 51–60.

Migration drill (item 60) on \`relay.condensed.v3\` is the gate.
`,

  T7_SECRETS_SUPPLYCHAIN: `
You own Track 7 — Secrets, Signing & Supply-Chain.

Goal: no plaintext secrets in env, no unsigned binaries in production, no
unverified dependencies in the build.

Constraints:
- SecretsProvider is the only sanctioned path to a secret. Direct env reads
  for secrets fail lint.
- Signing is sigstore-based; verification is enforced in deploy.
- Redactor runs before any persistence layer touches a payload.

Deliverables: items 61–70.

Supply-chain incident exercise (item 70) is the gate.
`,

  T8_SLOS_BULKHEADS_COST: `
You own Track 8 — SLOs, Bulkheads, Rate Limiting & Cost Controls.

Goal: predictable latency, no noisy-neighbour cost surprises, graceful
degradation under load.

Constraints:
- SLOs live in code; alert rules are generated, not hand-written.
- Token budgets are enforced before dispatch, not after consumption.
- Load-shedding policy is explicit: which signal kinds are droppable, by
  whom, under what condition.

Deliverables: items 71–80.

24-hour soak (item 80) is the gate.
`,

  T9_CHAOS_LOAD_REPLAY: `
You own Track 9 — Chaos, Load & Golden-Replay Testing.

Goal: regressions surface in CI, not in production. Determinism is provable.

Constraints:
- Chaos hooks are off by default; zero overhead when \`HIVEMIND_CHAOS\` is unset.
- Golden corpus is anonymised at capture time; re-anonymisation never weakens.
- Mutation testing uses Stryker; mutants tied to specific mutation score gates.

Deliverables: items 81–90.

Quarterly chaos day rehearsal (item 90) is the standing gate.
`,

  T10_DEPLOYMENT_DR: `
You own Track 10 — Deployment, IaC & Disaster Recovery.

Goal: the platform deploys reproducibly, rolls back safely, and survives
region loss.

Constraints:
- Images are distroless, non-root, scanned, signed.
- Helm chart and Terraform modules are versioned alongside the codebase.
- DR drill cadence is encoded in the runbook and tracked in CI.

Deliverables: items 91–100 (excluding 100, which is the release-cut).

Cross-region failover rehearsal (item 98) is the gate before v1.0.0.
`,

  T11_AGENT_PROTOCOL: `
You own Track 11 — Agent Protocol & Capability Registry.

Goal: third-party and internal agents speak a single, versioned protocol.
Watson can discover what an agent can do, negotiate version, route work
accordingly, and refuse what it doesn't trust.

Constraints:
- Protocol is wire-stable (Track 6 rules apply).
- Capability declarations are signed by the agent's identity (Track 4).
- Discovery is pull-based with a TTL cache; no Watson restart needed when
  a new agent joins.

Deliverables (cross-cutting; sit alongside the 100-point list):
  A1. Define AgentManifest: identity, capabilities, supported signal versions,
      cost tier, residency, sandbox class.
  A2. Add capability-registry package with sign + verify + cache.
  A3. Extend agent-router to consult registry, score candidates, and pick
      under fairness scheduler constraints.
  A4. Add negotiation handshake: Watson asks "can you produce relay.v3?";
      agent answers signed yes/no.
  A5. Add capability-mismatch escalation path: if no agent can serve a task,
      the workflow routes to review queue with explicit reason.
  A6. Add manifest-change audit: any registry mutation produces an audit row.
  A7. Add "trusted set" policy: per-tenant allow-list of agent identities;
      registration outside the set is rejected unless break-glass.

Item A7 is the gate. No untrusted agent can join a tenant's pool by accident.
`,
};

// =============================================================================
// 4) USAGE NOTE
// =============================================================================

/**
 * Recommended rollout order:
 *   T6 (contracts) and T1 (bus) first — they are the substrate.
 *   T2 (workflows), T5 (observability), T3 (multi-tenancy) next, in parallel.
 *   T4 (authz), T7 (supply-chain), T8 (SLOs/cost) follow.
 *   T9 (chaos), T10 (deploy/DR), T11 (agent protocol) last, before release.
 *
 * Cut v1.0.0 only after item 100 lights green and the v0.2.0 rollback drill
 * passes in staging.
 */
