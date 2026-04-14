// SemanticGuard v2 — Signal Floor Validation
// Based on SCHEMA_GUARD_v1.md and TYPESCRIPT_GUARD_v2.md
// Reject if: no file refs AND no action verbs (signal floor)
// Also: empty done without blockers, forbidden phrases, low signal density

export interface SemanticResult {
  passed: boolean;
  issues: string[];
  signalDensity: number;
  fileRefs: number;
  actionVerbs: number;
}

export const FORBIDDEN_PHRASES = [
  'completed task',
  'done with work',
  'finished task',
  'as requested',
  'no issues',
  'all good',
  'did stuff',
  'made changes',
  'worked on',
];

export const FILE_PATTERNS = [
  /\.ts$/,
  /\.js$/,
  /\.tsx$/,
  /\.jsx$/,
  /\.rs$/,
  /\.py$/,
  /src\//,
  /tests?\//,
  /lib\//,
  /components\//,
  /packages\//,
];

export const ACTION_VERBS = [
  'create',
  'update',
  'delete',
  'fix',
  'add',
  'remove',
  'implement',
  'initialize',
  'configure',
  'refactor',
  'test',
  'patch',
  'modify',
];

export interface SemanticGuardOptions {
  minFileRefs?: number;
  minSignalDensity?: number;
  forbiddenPhrases?: string[];
  filePatterns?: RegExp[];
  actionVerbs?: string[];
}

export class SemanticGuard {
  private options: Required<SemanticGuardOptions>;

  constructor(options: SemanticGuardOptions = {}) {
    this.options = {
      minFileRefs: options.minFileRefs ?? 1,
      minSignalDensity: options.minSignalDensity ?? 0.3,
      forbiddenPhrases: options.forbiddenPhrases ?? FORBIDDEN_PHRASES,
      filePatterns: options.filePatterns ?? FILE_PATTERNS,
      actionVerbs: options.actionVerbs ?? ACTION_VERBS,
    };
  }

  validateFromText(text: string, blockers: string[]): SemanticResult {
    const result: SemanticResult = {
      passed: false,
      issues: [],
      signalDensity: 0,
      fileRefs: 0,
      actionVerbs: 0,
    };

    if (text.trim().length === 0 && blockers.length === 0) {
      result.issues.push('empty_done_no_blockers');
      return result;
    }

    for (const pattern of this.options.filePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        result.fileRefs += matches.length;
      }
    }

    const lowerText = text.toLowerCase();
    for (const verb of this.options.actionVerbs) {
      if (lowerText.includes(verb)) {
        result.actionVerbs++;
      }
    }

    for (const phrase of this.options.forbiddenPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        result.issues.push(`forbidden_phrase:${phrase}`);
      }
    }

    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (words > 0) {
      result.signalDensity = Math.min(1, (result.fileRefs + result.actionVerbs * 2) / (words * 0.5));
    }

    if (result.issues.length > 0) {
      result.passed = false;
      return result;
    }

    if (result.fileRefs < this.options.minFileRefs) {
      result.issues.push('no_file_references');
    }

    if (result.signalDensity < this.options.minSignalDensity && result.fileRefs > 0 && result.actionVerbs === 0) {
      result.issues.push('no_action_verbs');
    }

    result.passed = result.issues.length === 0;
    return result;
  }

  validateDoneItems(done: string[], blockers: string[]): SemanticResult {
    const allText = done.join(' ');
    return this.validateFromText(allText, blockers);
  }

  validateSummary(summary: string, touchedFiles: string[], blockers: string[], nextActions: string[]): SemanticResult {
    const allText = [summary, ...nextActions].join(' ');
    const result = this.validateFromText(allText, blockers);

    if (touchedFiles.length === 0 && result.fileRefs === 0) {
      if (!result.issues.includes('no_file_references')) {
        result.issues.push('no_file_references');
        result.passed = false;
      }
    }

    return result;
  }
}

export const createSemanticGuard = (options?: SemanticGuardOptions): SemanticGuard => {
  return new SemanticGuard(options);
};