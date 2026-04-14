// Phase 2: Agent Emission Integration
// Adapted for single-agent (Zoe only) — no multi-agent coordination
// In full deployment, this pattern extends to Aria, Bea, and other agents

export const PHASE2_GOAL = "Zoe emits structured status reports to palace on cron schedule";
export const PHASE2_DURATION = "~2 hours";
export const PHASE2_EXIT_GATE = "E2E test confirms: emission lands in palace → retrievable → guard validated";

// Step 2.1: Zoe heartbeat emitter - periodic status emission to palace
// Step 2.2: Palace retrieve - read back and display recent emissions
// Step 2.3: Guard validation - emissions validated before palace write
// Step 2.4: E2E test - full emit → guard → palace → retrieve cycle

export const EMISSION_INTERVAL_MINUTES = 30;

export interface Phase2Emission {
  version: "1.0";
  emitter: "zoe";
  timestamp: string;
  task_id: string;
  status: "done" | "in_progress" | "blocked";
  summary: string;
  findings: Finding[];
  next_actions: NextAction[];
  confidence: number;
}

export interface Finding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  area: string;
  title: string;
  file_refs: string[];
  evidence: string;
  action: string;
}

export interface NextAction {
  agent: string;
  description: string;
  priority: "soon" | "eventual" | "when_free";
}