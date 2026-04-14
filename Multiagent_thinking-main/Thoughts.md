1. Frontier Layer (Planner / Auditor)

Responsibilities:

Interpret user intent
Define output (target state)
Emit machine-readable ADRs
Partition work into isolated tasks
Perform final validation (after tooling)

Constraints:

❌ No continuous supervision
❌ No babysitting agents
❌ No unnecessary tool calls
✅ Only re-enter on result gates
2. Framework Layer (The Real "Senior Dev")

Responsibilities:

Maintain authoritative task memory
Enforce schemas and constraints
Route tasks to agents
Run verification automatically
Control escalation

This layer replaces:

prompt engineering
manual coordination
human-in-the-loop mechanics
3. Agent Layer (Small Models)

Responsibilities:

Execute strictly bounded tasks
Stay within owned files
Emit structured progress
Never narrate unless required

Constraints:

❌ No global reasoning
❌ No cross-agent interference
❌ No prose output
✅ Schema-only communication
4. Tooling Layer (Automation Engine)

Responsibilities:

lint
typecheck
test
format
diff validation
ownership enforcement

Rule:

Never spend tokens on something a shell command can prove.
Memory Model (Critical)
Two-Stage Memory
1. Framework Memory (Authoritative)
2. Emission Memory (Dynamic)
Framework Memory (Stable)
{
  "goal": "implement oauth support",
  "ownership": ["auth/persistence.ts"],
  "constraints": ["no schema changes"],
  "definition_of_done": ["tests pass", "typecheck pass"]
}
Emission Memory (Dynamic / Filtered)
{
  "other_agents": [
    "provider enum updated",
    "tests scaffold added"
  ],
  "touched_files": [
    "config/schema.ts",
    "tests/oauth-provider.test.ts"
  ],
  "relevance": [
    "schema now expects oauth provider",
    "tests depend on persistence layer"
  ]
}
Core Design Principles
1. No Prose Rule
If a schema can express it, prose is forbidden.
2. Ownership Isolation
Each agent owns files.
No overlap.
No shared mutation.
3. Result-Based Validation
We do not verify reasoning.
We verify outputs.
4. No Babysitting
Frontier model is not allowed to monitor execution.
Only enters after result gates.
5. Replaceable Workers
Continuity lives in the framework, not the model.
Core Schemas (v1)
assignment_schema_v1
{
  "task_id": "string",
  "agent": "string",
  "objective": "string",
  "owned_files": ["string"],
  "forbidden_files": ["string"],
  "constraints": ["string"],
  "definition_of_done": ["string"],
  "emit_format": "progress_v1"
}
progress_schema_v1
{
  "task_id": "string",
  "agent": "string",
  "phase": "string",
  "done": ["string"],
  "blockers": ["string"],
  "next": "string",
  "touched_files": ["string"],
  "needs_escalation": false
}
verification_schema_v1
{
  "task_id": "string",
  "scope": ["string"],
  "lint": "pass|fail",
  "typecheck": "pass|fail",
  "tests": "pass|fail",
  "failure_class": "string|null",
  "escalation_needed": false
}
emission_schema_v1 (Ollama Output)
{
  "agent": "string",
  "relevant_updates": ["string"],
  "conflict_risk": ["string"],
  "next_focus": "string"
}
Execution Flow
1. Frontier model emits ADR + assignments
2. Framework distributes tasks
3. Agents execute + emit progress
4. Tooling layer auto-validates
5. Ollama condenses cross-agent state
6. Agents receive filtered updates
7. Repeat until done
8. Frontier model performs final audit
Cost Strategy
Explicit Goals
- minimize frontier usage
- eliminate tool-call token waste
- compress communication to schemas
- maximize free-tier / cheap-tier usage
Hard Guardrails
- no auto model upgrades
- no “equivalent model” routing
- max tool calls per task
- max frontier invocations per task
Risks (Realistic)
1. Schema Drift

Small models may still ignore constraints.

Mitigation:

strict validation
reject non-compliant outputs
2. Fake Passing (Test Gaming)

Mitigation:

mutation tests (later)
diff inspection
random audit by frontier model
3. Overhead Complexity

Framework may become too complex to maintain.

Mitigation:

start with minimal schemas
prove loop before scaling
4. Latency vs Cost Tradeoff

Multi-agent parallelism vs coordination overhead.

MVP Scope (Do This First)
- single task
- two agents max
- one file each
- one verification loop
- one emission cycle
ADR Prompt (Frontier Model)

Use this to generate machine-usable plans:

You are the planning layer of an emission-driven multi-agent coding system.

Your job is NOT to explain.
Your job is to emit structured decisions.

Output ONLY JSON.

Define:

1. product_intent
2. implementation_decisions
3. work_partition
4. constraints
5. definition_of_done

Rules:
- No prose explanations
- No markdown
- No commentary
- Keep all fields minimal and explicit
- Optimize for small-model execution

Schema:

{
  "product_intent": {
    "goal": "",
    "quality_bar": []
  },
  "implementation_decisions": {
    "accepted": [],
    "rejected": []
  },
  "work_partition": {
    "agent_name": ["file1", "file2"]
  },
  "constraints": [],
  "definition_of_done": []
}
Final Note

This project is not about making LLMs smarter.

It is about making them cheaper, more predictable, and harder to misuse.

If successful:

multi-agent coding becomes viable without depending on expensive frontier models.