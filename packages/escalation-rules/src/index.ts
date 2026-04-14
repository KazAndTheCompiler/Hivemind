// Escalation Rules — When to Call Frontier vs Handle Locally
// Based on SCHEMA_GUARD_v1.md EscalationRules spec

export enum EscalationType {
  SchemaViolation = 'schema_violation',
  SemanticViolation = 'semantic_violation',
  TypeScriptGuardFailure = 'typescript_guard_failure',
  MaxRetriesExceeded = 'max_retries_exceeded',
  CrossAgentConflict = 'cross_agent_conflict',
  DependencyBreak = 'dependency_break',
  DriftThresholdExceeded = 'drift_threshold_exceeded',
  Unknown = 'unknown',
}

export enum FrontierAction {
  Retry = 'retry',
  Abort = 'abort',
  Investigate = 'investigate',
  ManualIntervention = 'manual_intervention',
  AdjustStrategy = 'adjust_strategy',
}

export interface EscalationMessage {
  escalation_type: EscalationType;
  task_id: string;
  agent_id?: string;
  attempted_actions: string[];
  reason: string;
  cost_so_far?: number;
  frontier_action: FrontierAction;
  timestamp: string;
}

export interface Failure {
  issue: string;
  task_id: string;
  agent_id?: string;
  history: string[];
  reason: string;
  cumulative_cost?: number;
}

export interface EscalationRulesOptions {
  costThreshold?: number;
}

export class EscalationRules {
  private costThreshold: number;

  constructor(options: EscalationRulesOptions = {}) {
    this.costThreshold = options.costThreshold ?? 1000;
  }

  shouldEscalate(failure: Failure): boolean {
    switch (failure.issue) {
      case 'max_retries_exceeded':
      case 'cross_agent_conflict':
      case 'dependency_break':
      case 'drift_threshold_exceeded':
        return true;

      case 'tool_failure':
      case 'test_failure_known_fix':
      case 'syntax_error':
        return false;

      default:
        return (failure.cumulative_cost ?? 0) > this.costThreshold;
    }
  }

  suggestAction(failure: Failure): FrontierAction {
    switch (failure.issue) {
      case 'max_retries_exceeded':
        return FrontierAction.AdjustStrategy;
      case 'cross_agent_conflict':
        return FrontierAction.Investigate;
      case 'dependency_break':
        return FrontierAction.Abort;
      case 'schema_violation':
      case 'typescript_guard_failure':
        return FrontierAction.Retry;
      case 'semantic_violation':
        return FrontierAction.Investigate;
      case 'drift_threshold_exceeded':
        return FrontierAction.ManualIntervention;
      default:
        return FrontierAction.Investigate;
    }
  }

  createEscalation(failure: Failure): EscalationMessage {
    return {
      escalation_type: failure.issue as EscalationType,
      task_id: failure.task_id,
      agent_id: failure.agent_id,
      attempted_actions: failure.history,
      reason: failure.reason,
      cost_so_far: failure.cumulative_cost,
      frontier_action: this.suggestAction(failure),
      timestamp: new Date().toISOString(),
    };
  }

  getEscalationType(issue: string): EscalationType {
    switch (issue) {
      case 'schema_violation':
        return EscalationType.SchemaViolation;
      case 'semantic_violation':
        return EscalationType.SemanticViolation;
      case 'typescript_guard_failure':
        return EscalationType.TypeScriptGuardFailure;
      case 'max_retries_exceeded':
        return EscalationType.MaxRetriesExceeded;
      case 'cross_agent_conflict':
        return EscalationType.CrossAgentConflict;
      case 'dependency_break':
        return EscalationType.DependencyBreak;
      case 'drift_threshold_exceeded':
        return EscalationType.DriftThresholdExceeded;
      default:
        return EscalationType.Unknown;
    }
  }
}

export const createEscalationRules = (options?: EscalationRulesOptions): EscalationRules => {
  return new EscalationRules(options);
};

export const DEFAULT_ESCALATION_RULES = new EscalationRules();