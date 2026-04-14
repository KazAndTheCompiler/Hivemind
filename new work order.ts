export const OPENCLAW_PRODUCTION_SCAFFOLD_PROMPT = `
You are building a production-grade TypeScript scaffolding project for OpenClaw by merging the strongest parts of these four source projects:

1. Multiagent_thinking
   - typed emission architecture
   - guard stack
   - condensed relay summaries
   - token-budget discipline
   - schema-first coordination between agents

2. watson-project
   - OpenClaw-oriented agent routing
   - supervisor + worker pattern
   - memory/palace integration shape
   - emission lifecycle
   - security/coding agent separation

3. secdev_project
   - pnpm monorepo structure
   - package taxonomy
   - shared foundations
   - validation mindset
   - production repo hygiene

4. openclaw-workspace
   - actual OpenClaw workflow intent
   - memory and script operations
   - agent execution reality
   - summary and progress emission use cases

Your job is NOT to polish docs first.
Your job is to scaffold a real, evolvable, production-ready TypeScript project that can later be plugged into OpenClaw.

NON-NEGOTIABLE OUTCOME

Build a monorepo scaffold that provides:

- a TypeScript-first coordination layer for OpenClaw agents
- secdev and gitnexus tool adapters running automatically
- a summary emission pipeline
- automatic schema condensation for main-agent handoff
- automatic prettier + eslint on changed files
- strict runtime validation
- testable, modular architecture
- production-quality dev ergonomics
- extensibility for future agents and tools

CORE PRODUCT BEHAVIOR

Whenever any worker/agent emits a summary:
1. capture the raw emission
2. validate it against strict TypeScript + runtime schemas
3. normalize it into canonical internal schema
4. produce condensed relay outputs in TWO sizes:
   - short relay target: ~200 tokens
   - medium relay target: ~300 tokens
5. send the condensed result to the main agent channel/router
6. persist both raw and normalized forms for auditability
7. emit tool events so secdev and gitnexus can react automatically

Whenever files are changed:
1. gitnexus detects changed files
2. run prettier only on changed supported files
3. run eslint only on changed TS/JS files
4. collect diagnostics
5. emit a typed tooling summary back into the relay system
6. fail safely without corrupting agent flow

REALISM RULES

- Do not pretend missing integrations exist.
- If gitnexus is not implemented yet, create a GitNexusAdapter contract + local fallback implementation.
- If secdev tooling is partial, create a SecDevAdapter contract + no-op/mock-safe production stub.
- Do not call anything “production-grade” unless it has:
  - typed interfaces
  - runtime validation
  - logging
  - error handling
  - tests
  - configuration boundaries
  - documented extension points

DO NOT:
- write fluffy manifesto prose
- over-focus on branding
- build speculative magic memory systems first
- hide hardcoded assumptions in random scripts
- keep shell glue where TypeScript services should exist
- use loose any types
- use unvalidated JSON blobs as trusted data
- make the main agent parse arbitrary prose from workers

BUILD TARGET

Create a pnpm TypeScript monorepo with this shape or a clearly superior equivalent:

/apps
  /orchestrator
  /cli
  /daemon

/packages
  /core-types
  /core-schemas
  /core-config
  /core-logging
  /core-events
  /core-errors
  /core-tokenizer
  /agent-protocol
  /agent-router
  /agent-relay
  /agent-memory
  /tool-gitnexus
  /tool-secdev
  /tool-eslint
  /tool-prettier
  /tool-runner
  /summarizer
  /condense-engine
  /change-detector
  /audit-store
  /testing

/docs
  architecture
  adr
  runbooks

/config
  eslint
  prettier
  vitest
  tsup or tsdown
  tsconfig

MINIMUM ARCHITECTURAL REQUIREMENTS

1. MONOREPO FOUNDATION
- pnpm workspace
- strict tsconfig hierarchy
- shared lint config
- shared prettier config
- build/test/lint/typecheck scripts from root
- clean package boundaries
- path aliases only where justified
- no circular dependencies

2. CANONICAL AGENT PROTOCOL
Create strict canonical schemas for:
- raw agent summary
- normalized agent summary
- condensed relay summary
- main agent handoff payload
- tool event payload
- quality gate result
- file change event
- secdev event
- gitnexus event

Use:
- TypeScript interfaces/types
- Zod runtime schemas
- branded identifiers where useful
- discriminated unions for event kinds

3. CONDENSING PIPELINE
Build a deterministic condensing pipeline:
- raw summary in
- validated summary out
- condensed 200-token relay
- condensed 300-token relay

Requirements:
- preserve task id
- preserve agent id
- preserve status
- preserve touched files
- preserve blockers
- preserve next action
- preserve confidence
- preserve tool findings
- never lose critical security findings
- use priority ranking for finding retention
- use stable field ordering

The 200-token schema should be optimized for fast relay.
The 300-token schema should preserve slightly more evidence and next steps.

4. GITNEXUS INTEGRATION
Assume GitNexus is the git-aware change intelligence layer.
If no implementation exists, create:
- GitNexusAdapter interface
- LocalGitNexusAdapter implementation
- event emitter contract
- changed-file discovery
- file classification
- diff metadata
- changed package detection

GitNexus responsibilities:
- detect changed files
- map files to package ownership
- trigger prettier/eslint only for touched files
- emit structured quality events
- feed changed-file metadata into relay summaries

5. SECDEV INTEGRATION
Assume SecDev is the security/dev quality tool channel.
If full implementation is absent, create:
- SecDevAdapter interface
- LocalSecDevAdapter stub
- security finding schema
- severity mapping
- audit event schema
- optional future hook points

SecDev responsibilities:
- analyze changed files or emitted summaries
- detect security-relevant change classes
- emit typed findings
- annotate relay payloads with severity + action guidance

6. QUALITY AUTOMATION
On changed files:
- prettier --write only changed supported files
- eslint with fix mode where safe
- capture results without crashing orchestrator
- report changed, fixed, failed, skipped files
- emit typed QualityGateResult

Design this as a service, not random shell scripts.

7. OPENCLAW SCaffOLDING
Create the scaffold so OpenClaw can consume it later:
- agent-facing prompt contracts
- output contracts
- event router
- main agent inbox abstraction
- worker emission API
- memory sink abstraction
- supervisor/orchestrator service
- daemon/watch mode for local/VPS use
- systemd-friendly process layout

8. PRODUCTION ENGINEERING
Must include:
- structured logging
- environment-based config
- startup validation
- graceful shutdown
- retry policy
- backpressure-safe queues or simple bounded buffering
- idempotent event handling where practical
- dead-letter or failure capture path
- test fixtures
- unit tests for schemas and condensing
- integration tests for changed-file workflow

9. ESLINT + PRETTIER AUTO-RUN
Must be triggered automatically from changed-file detection.
This is required.
Do not run globally across the whole repo unless explicitly in CI fallback.
Prefer changed-file scoped runs.

10. OUTPUT DISCIPLINE
Every service must emit typed outputs.
No prose-only handoffs.
No hidden side effects.

IMPLEMENTATION DETAILS TO FAVOR

- TypeScript 5+
- Node 20+
- pnpm workspaces
- Zod
- Vitest
- tsup/tsdown or equivalent minimal build tool
- pino or equivalent structured logger
- execa for subprocess execution
- chokidar only if watch mode is justified
- never use class-heavy abstraction unless it improves testability

REQUIRED SCHEMAS

You must implement at least these canonical types:

type AgentStatus = "working" | "blocked" | "done" | "failed" | "needs_review";

interface RawAgentSummary {
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface NormalizedAgentSummary {
  taskId: string;
  agentId: string;
  status: AgentStatus;
  conciseSummary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  confidence: number;
  tags: string[];
  toolFindings: ToolFinding[];
  timestamp: string;
}

interface CondensedRelay200 {
  version: "relay.v1";
  budget: 200;
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextAction: string | null;
  severity: "none" | "low" | "medium" | "high" | "critical";
  confidence: number;
}

interface CondensedRelay300 {
  version: "relay.v1";
  budget: 300;
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  topFindings: ToolFinding[];
  severity: "none" | "low" | "medium" | "high" | "critical";
  confidence: number;
}

interface ToolFinding {
  source: "secdev" | "gitnexus" | "eslint" | "prettier" | "system";
  severity: "info" | "low" | "medium" | "high" | "critical";
  code: string;
  message: string;
  fileRefs: string[];
  suggestedAction?: string;
}

interface FileChangeEvent {
  kind: "file.change.detected";
  files: string[];
  packageNames: string[];
  timestamp: string;
}

interface QualityGateResult {
  kind: "quality.gate.completed";
  changedFiles: string[];
  prettier: {
    ran: boolean;
    formattedFiles: string[];
    failedFiles: string[];
  };
  eslint: {
    ran: boolean;
    fixedFiles: string[];
    failedFiles: string[];
    warnings: number;
    errors: number;
  };
  findings: ToolFinding[];
  timestamp: string;
}

REQUIRED SERVICES

Implement these services/modules:

- ConfigService
- LoggerService
- EventBus
- AgentSummaryIngestService
- SummaryNormalizationService
- SummaryCondenseService
- MainAgentRelayService
- GitNexusAdapter
- SecDevAdapter
- ChangedFileQualityService
- AuditStore
- WatchDaemon
- OrchestratorService

WORK ORDER

Execute in this order:

PHASE 1
- create monorepo scaffold
- root package.json
- workspace config
- tsconfig structure
- eslint/prettier configs
- vitest config
- package boundaries

PHASE 2
- implement core-types
- implement core-schemas
- implement core-errors
- implement core-config
- implement core-logging
- implement core-events

PHASE 3
- implement agent protocol package
- implement summary ingest/normalize/condense services
- implement 200/300 token relay generators
- add tests proving critical fields survive condensation

PHASE 4
- implement GitNexusAdapter contract and local fallback
- implement changed-file detector
- implement prettier/eslint scoped runner
- emit typed quality results

PHASE 5
- implement SecDevAdapter contract and stub/local pipeline
- attach findings to normalized summaries and relay payloads

PHASE 6
- implement orchestrator, relay service, daemon/watch mode, CLI
- make it systemd-friendly
- add integration tests and example flows

PHASE 7
- write concise architecture docs and runbooks AFTER scaffold exists

CODING STANDARDS

- strict mode on
- no implicit any
- no silent catches
- no untyped event payloads
- no business logic in CLI layer
- no ad hoc JSON parsing without schema validation
- every subprocess call must have timeout/error handling
- every adapter returns typed results
- every package exports clean public APIs

TEST REQUIREMENTS

You must add:
- schema validation tests
- condense engine tests
- changed-file detection tests
- prettier/eslint scoped runner tests
- relay preservation tests
- adapter contract tests
- orchestrator smoke test

SUCCESS CRITERIA

The result is successful only if:
- the repo boots as a pnpm monorepo
- packages compile
- strict typing works
- agent summary -> normalized schema -> 200/300 relay path works
- changed files trigger prettier/eslint automatically
- gitnexus emits typed change intelligence
- secdev emits typed findings
- main agent handoff receives condensed relay payloads
- test suite covers the critical flow
- docs reflect the actual implementation, not fantasy architecture

DELIVERABLE FORMAT

Return work in this format:

1. REPO TREE
2. ROOT CONFIG FILES
3. PACKAGE-BY-PACKAGE IMPLEMENTATION
4. KEY TYPE DEFINITIONS
5. KEY SERVICES
6. TESTS
7. SYSTEMD/DAEMON NOTES
8. REMAINING GAPS
9. NEXT BUILD STEPS

DO NOT stop after planning.
Start scaffolding the actual project structure and code immediately.
Prefer complete, minimal, correct building blocks over broad but fake completeness.
`;