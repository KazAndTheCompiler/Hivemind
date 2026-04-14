// Watson Project — Inter-Agent Signal Schema
// Version: 1.0
// Purpose: Typed signals emitted by agents after task completion

export interface WatsonEmission {
  version: "1.0";
  emitter: "zoe" | "aria" | "bea";
  timestamp: string; // ISO-8601
  task_id: string;
  status: "done" | "blocked" | "escalate";
  summary: string; // Human-readable summary (max 200 chars)
  findings: Finding[];
  next_actions: NextAction[];
  blockers?: string[];
  confidence: number; // 0.0 - 1.0
}

export interface Finding {
  id: string; // Pattern: [A-Z][0-9]+ e.g. "P01", "T01"
  severity: "critical" | "high" | "medium" | "low";
  area: "frontend" | "backend" | "shared" | "tooling" | "architecture";
  title: string;
  file_refs: string[]; // e.g. ["backend/app/domains/packy/service.py"]
  evidence: string; // What was found
  action: string; // What to do about it
}

export interface NextAction {
  agent: "zoe" | "aria" | "bea" | "kaz";
  description: string;
  priority: "now" | "soon" | "later";
}

// Guard output
export interface GuardResult {
  pass: boolean;
  stage: "typescript" | "semantic" | "condense" | "pass";
  errors: string[];
  emission?: WatsonEmission;
}

// Signal floor for SemanticGuard
export const SIGNAL_FLOOR = {
  require_file_refs: true,
  require_action_verbs: true,
  min_findings: 0, // Can be 0 if status !== "done"
  allowed_action_verbs: [
    "fix", "add", "remove", "update", "create", "delete",
    "replace", "implement", "remove", "unify", "thread",
    "route", "wire", "delete", "deprecate", "audit"
  ]
};
