// Guard Stack — Complete validation pipeline as per EMISSION_PAPER.md
// TypeScriptGuard → SemanticGuard → Retry Policy → Escalation Rules

import { TypeScriptGuard, ValidationResult, createTypeScriptGuard } from '@openclaw/typescript-guard';
import { SemanticGuard, SemanticResult, createSemanticGuard } from '@openclaw/semantic-guard';
import { RetryPolicy, RetryDecision, createRetryPolicy } from '@openclaw/retry-policy';
import { EscalationRules, EscalationType, FrontierAction, Failure, createEscalationRules } from '@openclaw/escalation-rules';

export interface GuardStackResult {
  passed: boolean;
  stage: 'typescript' | 'semantic' | 'retry' | 'escalation' | 'complete';
  issues: string[];
  validationResult?: ValidationResult;
  semanticResult?: SemanticResult;
  escalationMessage?: {
    type: EscalationType;
    action: FrontierAction;
    reason: string;
  };
  shouldRetry: boolean;
  shouldEscalate: boolean;
  attempt: number;
}

export interface GuardStackOptions {
  interfaceName?: string;
  maxRetries?: number;
  costThreshold?: number;
}

export class GuardStack {
  private typescriptGuard: TypeScriptGuard;
  private semanticGuard: SemanticGuard;
  private retryPolicy: RetryPolicy;
  private escalationRules: EscalationRules;
  private attempt = 0;
  private history: string[] = [];

  constructor(options: GuardStackOptions = {}) {
    this.typescriptGuard = createTypeScriptGuard({
      requiredInterface: options.interfaceName ?? 'Progress',
    });
    this.semanticGuard = createSemanticGuard();
    this.retryPolicy = createRetryPolicy({ maxRetries: options.maxRetries });
    this.escalationRules = createEscalationRules({ costThreshold: options.costThreshold });
  }

  validate(raw: string, semanticText: string = ''): GuardStackResult {
    this.attempt++;
    this.history.push(`attempt_${this.attempt}`);

    const tsResult = this.typescriptGuard.validate(raw);

    if (!tsResult.passed) {
      const shouldRetryResult = this.retryPolicy.shouldRetry(this.attempt, tsResult.issues.join(','));

      if (shouldRetryResult.decision === RetryDecision.Escalate) {
        const failure: Failure = {
          issue: 'typescript_guard_failure',
          task_id: 'unknown',
          history: [...this.history],
          reason: tsResult.issues.join(', '),
        };

        if (this.escalationRules.shouldEscalate(failure)) {
          return {
            passed: false,
            stage: 'escalation',
            issues: tsResult.issues,
            shouldRetry: false,
            shouldEscalate: true,
            attempt: this.attempt,
            escalationMessage: {
              type: EscalationType.TypeScriptGuardFailure,
              action: this.escalationRules.suggestAction(failure),
              reason: tsResult.issues.join(', '),
            },
          };
        }
      }

      return {
        passed: false,
        stage: 'typescript',
        issues: tsResult.issues,
        validationResult: tsResult,
        shouldRetry: shouldRetryResult.decision === RetryDecision.Retry,
        shouldEscalate: false,
        attempt: this.attempt,
      };
    }

    if (semanticText) {
      const semanticResult = this.semanticGuard.validateFromText(semanticText, []);

      if (!semanticResult.passed) {
        const shouldRetryResult = this.retryPolicy.shouldRetry(this.attempt, semanticResult.issues.join(','));

        if (shouldRetryResult.decision === RetryDecision.Escalate) {
          const failure: Failure = {
            issue: 'semantic_violation',
            task_id: 'unknown',
            history: [...this.history],
            reason: semanticResult.issues.join(', '),
          };

          if (this.escalationRules.shouldEscalate(failure)) {
            return {
              passed: false,
              stage: 'escalation',
              issues: semanticResult.issues,
              semanticResult,
              shouldRetry: false,
              shouldEscalate: true,
              attempt: this.attempt,
              escalationMessage: {
                type: EscalationType.SemanticViolation,
                action: this.escalationRules.suggestAction(failure),
                reason: semanticResult.issues.join(', '),
              },
            };
          }
        }

        return {
          passed: false,
          stage: 'semantic',
          issues: semanticResult.issues,
          semanticResult,
          shouldRetry: shouldRetryResult.decision === RetryDecision.Retry,
          shouldEscalate: false,
          attempt: this.attempt,
        };
      }
    }

    return {
      passed: true,
      stage: 'complete',
      issues: [],
      validationResult: tsResult,
      shouldRetry: false,
      shouldEscalate: false,
      attempt: this.attempt,
    };
  }

  validateSummary(summary: string, touchedFiles: string[], blockers: string[], nextActions: string[]): GuardStackResult {
    const semanticResult = this.semanticGuard.validateSummary(summary, touchedFiles, blockers, nextActions);

    if (!semanticResult.passed) {
      const shouldRetryResult = this.retryPolicy.shouldRetry(this.attempt, semanticResult.issues.join(','));

      if (shouldRetryResult.decision === RetryDecision.Escalate) {
        const failure: Failure = {
          issue: 'semantic_violation',
          task_id: 'unknown',
          history: [...this.history],
          reason: semanticResult.issues.join(', '),
        };

        if (this.escalationRules.shouldEscalate(failure)) {
          return {
            passed: false,
            stage: 'escalation',
            issues: semanticResult.issues,
            semanticResult,
            shouldRetry: false,
            shouldEscalate: true,
            attempt: this.attempt,
            escalationMessage: {
              type: EscalationType.SemanticViolation,
              action: this.escalationRules.suggestAction(failure),
              reason: semanticResult.issues.join(', '),
            },
          };
        }
      }

      return {
        passed: false,
        stage: 'semantic',
        issues: semanticResult.issues,
        semanticResult,
        shouldRetry: shouldRetryResult.decision === RetryDecision.Retry,
        shouldEscalate: false,
        attempt: this.attempt,
      };
    }

    return {
      passed: true,
      stage: 'complete',
      issues: [],
      semanticResult,
      shouldRetry: false,
      shouldEscalate: false,
      attempt: this.attempt,
    };
  }

  reset(): void {
    this.attempt = 0;
    this.history = [];
  }

  getBackoffMs(attempt: number): number {
    return this.retryPolicy.getBackoffMs(attempt);
  }

  getAttempt(): number {
    return this.attempt;
  }

  getHistory(): string[] {
    return [...this.history];
  }
}

export const createGuardStack = (options?: GuardStackOptions): GuardStack => {
  return new GuardStack(options);
};

export { TypeScriptGuard, SemanticGuard, RetryPolicy, EscalationRules };
export { ValidationResult, SemanticResult, RetryDecision, EscalationType, FrontierAction };