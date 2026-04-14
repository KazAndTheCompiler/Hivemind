import { EscalationSchema } from '../schemas/index.js';

export interface EscalationRule {
  condition: (done: string[], blockers: string[], phase: string) => boolean;
  urgency: EscalationSchema['urgency'];
  reason: string;
}

export const DEFAULT_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: (done, blockers) => blockers.length >= 3,
    urgency: 'high',
    reason: 'multiple blockers detected',
  },
  {
    condition: (done, blockers, phase) => phase === 'complete' && blockers.length > 0,
    urgency: 'medium',
    reason: 'complete phase with unresolved blockers',
  },
  {
    condition: (done) => done.length === 0,
    urgency: 'low',
    reason: 'no work completed',
  },
];

export function checkEscalation(
  done: string[],
  blockers: string[],
  phase: string,
  rules: EscalationRule[] = DEFAULT_ESCALATION_RULES
): EscalationSchema | null {
  for (const rule of rules) {
    if (rule.condition(done, blockers, phase)) {
      return {
        taskId: 'task-1',
        agent: 'worker-1',
        reason: rule.reason,
        urgency: rule.urgency,
        blockers,
        timestamp: new Date().toISOString(),
      };
    }
  }
  return null;
}

export class EscalationEngine {
  private rules: EscalationRule[];
  
  constructor(rules: EscalationRule[] = DEFAULT_ESCALATION_RULES) {
    this.rules = rules;
  }
  
  check(done: string[], blockers: string[], phase: string): EscalationSchema | null {
    return checkEscalation(done, blockers, phase, this.rules);
  }
  
  addRule(rule: EscalationRule): void {
    this.rules.push(rule);
  }
  
  clearRules(): void {
    this.rules = [];
  }
}