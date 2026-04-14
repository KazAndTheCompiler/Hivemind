import { SemanticResult } from '../schemas/index.js';

const FILE_PATTERNS = [
  /\.ts$/, /\.js$/, /\.tsx$/, /\.jsx$/, /\.rs$/, /\.py$/,
  /\.html$/, /\.css$/, /\.json$/, /\.md$/,
  /src\//, /tests?\//, /lib\//, /components\//, /scripts\//,
];

const ACTION_VERBS = [
  "create", "update", "delete", "fix", "add", "remove",
  "implement", "initialize", "configure", "refactor", "modify",
  "build", "run", "test", "deploy", "setup", "write", "read",
  "parse", "validate", "check", "extract", "condense", "compress",
];

const FORBIDDEN_PHRASES = [
  "completed task", "done with work", "finished task", "as requested",
  "i have completed", "i have done", "everything is fine", "no issues",
  "all good", "task completed", "work done", "finished work",
  "no blockers", "nothing to report", "all done", "done",
  "successfully completed", "task finished", "no problems",
];

const MIN_SIGNAL_DENSITY = 0.3;

export function containsFileReference(text: string): boolean {
  return FILE_PATTERNS.some(p => p.test(text));
}

export function containsActionVerb(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_VERBS.some(v => lower.includes(v));
}

export function validateSemanticGuard(done: string[], blockers: string[]): SemanticResult {
  const result: SemanticResult = {
    passed: false,
    issues: [],
    signalDensity: 0,
    fileRefs: 0,
    actionVerbs: 0,
  };
  
  if (done.length === 0 && blockers.length === 0) {
    result.issues.push("empty_done_no_blockers");
    return result;
  }
  
  for (const item of done) {
    if (containsFileReference(item)) {
      result.fileRefs++;
    }
  }
  
  if (result.fileRefs === 0) {
    result.issues.push("no_file_references");
  }
  
  for (const item of done) {
    if (containsActionVerb(item)) {
      result.actionVerbs++;
    }
  }
  
  if (result.actionVerbs === 0) {
    result.issues.push("no_action_verbs");
  }
  
  for (const item of done) {
    const lower = item.toLowerCase();
    if (FORBIDDEN_PHRASES.some(p => lower.includes(p))) {
      result.issues.push(`forbidden_phrase:${item.slice(0, 30)}`);
    }
  }
  
  const totalItems = done.length;
  if (totalItems > 0) {
    result.signalDensity = (result.fileRefs + result.actionVerbs) / (totalItems * 2);
  }
  
  if (result.signalDensity < MIN_SIGNAL_DENSITY && totalItems > 0) {
    result.issues.push("low_signal_density");
  }
  
  result.passed = result.issues.length === 0;
  return result;
}

export function extractDoneFromRaw(raw: string): string[] {
  const doneMatch = raw.match(/done:\s*\[([^\]]*)\]/);
  if (!doneMatch) return [];
  
  const content = doneMatch[1];
  const items = content.split(',').map(s => s.trim()).filter(s => s && s !== '""' && s !== "''");
  
  return items.map(item => item.replace(/^["']|["']$/g, ''));
}

export function extractBlockersFromRaw(raw: string): string[] {
  const blockersMatch = raw.match(/blockers:\s*\[([^\]]*)\]/);
  if (!blockersMatch) return [];
  
  const content = blockersMatch[1];
  const items = content.split(',').map(s => s.trim()).filter(s => s && s !== '""' && s !== "''");
  
  return items.map(item => item.replace(/^["']|["']$/g, ''));
}

export class SemanticGuard {
  validate(done: string[], blockers: string[]): SemanticResult {
    return validateSemanticGuard(done, blockers);
  }
  
  validateFromRaw(raw: string): SemanticResult {
    const done = extractDoneFromRaw(raw);
    const blockers = extractBlockersFromRaw(raw);
    return validateSemanticGuard(done, blockers);
  }
}