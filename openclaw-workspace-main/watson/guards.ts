// Watson Guard Stack — Signal validation for inter-agent emissions
// Stage 1: TypeScript structural validation
// Stage 2: Semantic signal floor
// Stage 3: Schema condensation (Ollama-style)

import type { WatsonEmission, GuardResult, Finding } from "./schema.ts";

/**
 * Stage 1: TypeScriptGuard
 * Extracts and validates a typed emission block from raw model output.
 * Uses lightweight structural checks rather than full TS compilation.
 */
export function typescriptGuard(raw: string): GuardResult {
  const errors: string[] = [];

  // Try to extract a JSON or TS object block
  const extracted = extractBlock(raw);
  if (!extracted) {
    return { pass: false, stage: "typescript", errors: ["No structured block found in output"] };
  }

  // Lightweight structural validation (no full TS compiler needed)
  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    return { pass: false, stage: "typescript", errors: ["Block is not valid JSON"] };
  }

  const e = parsed as Record<string, unknown>;

  // Required fields
  if (!e.version || e.version !== "1.0") errors.push('version must be "1.0"');
  if (!["zoe", "aria", "bea", "pixie", "kaz", "dopaflow", "packy"].includes(e.emitter as string)) errors.push('emitter must be "zoe" | "aria" | "bea"');
  if (!e.task_id || typeof e.task_id !== "string") errors.push("task_id required");
  if (!["done", "blocked", "escalate"].includes(e.status as string)) errors.push("status must be done|blocked|escalate");
  if (!e.findings || !Array.isArray(e.findings)) errors.push("findings must be an array");
  if (!e.next_actions || !Array.isArray(e.next_actions)) errors.push("next_actions must be an array");
  if (typeof e.confidence !== "number" || e.confidence < 0 || e.confidence > 1) {
    errors.push("confidence must be number 0-1");
  }

  if (errors.length > 0) {
    return { pass: false, stage: "typescript", errors };
  }

  return { pass: true, stage: "typescript", errors: [], emission: parsed as WatsonEmission };
}

/**
 * Extract the first {...} block that looks like a signal
 * Uses proper bracket matching to find the outermost closing brace
 */
function extractBlock(raw: string): string | null {
  // Match markdown code blocks first
  const codeMatch = raw.match(/```(?:json|typescript)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeMatch) return codeMatch[1];

  // For bare JSON, use bracket matching to find the outermost braces
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && !inString) { escaped = true; continue; }
    if (c === '"' && !escaped) { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return trimmed.slice(0, i + 1); }
  }
  return null;
}

/**
 * Stage 2: SemanticGuard
 * Validates signal quality — file refs, action verbs, no placeholder filler.
 */
export function semanticGuard(emission: WatsonEmission): GuardResult {
  const errors: string[] = [];
  const action_verbs = [
    "fix", "add", "remove", "update", "create", "delete",
    "replace", "implement", "remove", "unify", "thread",
    "route", "wire", "delete", "deprecate", "audit", "build",
    "test", "verify", "check", "unwire", "split"
  ];

  for (const finding of emission.findings) {
    // File refs check
    if (!finding.file_refs || finding.file_refs.length === 0) {
      errors.push(`Finding ${finding.id}: no file references`);
    }

    // Action verb check
    const hasVerb = action_verbs.some(v => finding.action.toLowerCase().includes(v));
    if (!hasVerb) {
      errors.push(`Finding ${finding.id}: action "${finding.action}" lacks an action verb`);
    }

    // Finding ID pattern
    if (!/^[A-Z][0-9]+$/.test(finding.id)) {
      errors.push(`Finding ${finding.id}: ID must match [A-Z][0-9]+ pattern`);
    }
  }

  // Summary can't be filler
  const filler = ["completed", "no issues", "nothing", "n/a", "none"];
  if (filler.some(f => emission.summary.toLowerCase().includes(f)) && emission.findings.length === 0) {
    errors.push("Summary is filler but no findings reported");
  }

  if (errors.length > 0) {
    return { pass: false, stage: "semantic", errors };
  }

  return { pass: true, stage: "semantic", errors: [] };
}

/**
 * Stage 3: Condense (Ollama-style filter)
 * Truncate to schema-to-schema extraction. No freeform summarization.
 * Caps output at ~500 tokens for LLM context efficiency.
 */
export function condense(emission: WatsonEmission): WatsonEmission {
  // Light truncation — keep structure, trim long strings
  return {
    ...emission,
    summary: emission.summary.slice(0, 200),
    findings: emission.findings.slice(0, 20).map(f => ({
      ...f,
      evidence: f.evidence.slice(0, 150),
      action: f.action.slice(0, 100)
    })),
    next_actions: emission.next_actions.slice(0, 5)
  };
}

/**
 * Full guard stack — run emission through all stages.
 */
export function runGuards(raw: string): GuardResult {
  const tsResult = typescriptGuard(raw);
  if (!tsResult.pass) return tsResult;

  const semResult = semanticGuard(tsResult.emission!);
  if (!semResult.pass) return semResult;

  // Condense is not a pass/fail — it transforms
  const condensed = condense(tsResult.emission!);
  return { pass: true, stage: "pass", errors: [], emission: condensed };
}
