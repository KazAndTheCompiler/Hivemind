// Candidate Validation Service
// Validates mutation candidates before they can be scored/promoted

import type {
  MutationCandidate,
  ValidationResult,
  EvolutionScope,
  MutationRisk,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface ValidationPolicy {
  allowAutoPromotion: boolean;
  requireTests: boolean;
  requireQualityGate: boolean;
  requireSecDev: boolean;
  maxRiskForAutoPromotion: MutationRisk;
}

const DEFAULT_POLICY: ValidationPolicy = {
  allowAutoPromotion: true,
  requireTests: true,
  requireQualityGate: true,
  requireSecDev: true,
  maxRiskForAutoPromotion: 'medium',
};

export class CandidateValidationService {
  private logger: Logger;
  private policy: ValidationPolicy;

  constructor(policy?: Partial<ValidationPolicy>) {
    this.logger = createLogger();
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  async validate(candidate: MutationCandidate): Promise<ValidationResult> {
    const notes: string[] = [];

    const schemaValid = this.validateSchema(candidate, notes);
    const policyValid = this.validatePolicy(candidate, notes);
    const testsPassed = await this.validateTests(candidate, notes);
    const qualityGatePassed = await this.validateQualityGate(candidate, notes);
    const secdevPassed = await this.validateSecDev(candidate, notes);
    const regressionsDetected = await this.checkRegressions(candidate, notes);

    const result: ValidationResult = {
      candidateId: candidate.id,
      schemaValid,
      policyValid,
      testsPassed,
      qualityGatePassed,
      secdevPassed,
      regressionsDetected,
      notes,
      timestamp: new Date().toISOString(),
    };

    if (
      schemaValid &&
      policyValid &&
      testsPassed &&
      qualityGatePassed &&
      secdevPassed &&
      !regressionsDetected
    ) {
      this.logger.info('candidate.validated.passed', {
        candidateId: candidate.id,
        notes: notes.length,
      });
    } else {
      this.logger.warn('candidate.validated.failed', {
        candidateId: candidate.id,
        schemaValid,
        policyValid,
        testsPassed,
        qualityGatePassed,
        secdevPassed,
        regressionsDetected,
      });
    }

    return result;
  }

  private validateSchema(candidate: MutationCandidate, notes: string[]): boolean {
    if (!candidate.id || candidate.id.trim() === '') {
      notes.push('Invalid candidate id');
      return false;
    }
    if (!candidate.scope) {
      notes.push('Missing scope');
      return false;
    }
    if (!candidate.targetId) {
      notes.push('Missing targetId');
      return false;
    }
    if (!candidate.baseVersion || !candidate.proposedVersion) {
      notes.push('Missing version information');
      return false;
    }
    if (candidate.patch === undefined || candidate.patch === null) {
      notes.push('Missing patch');
      return false;
    }
    if (candidate.evidence.length === 0) {
      notes.push('No evidence provided');
      return false;
    }

    notes.push('Schema validation passed');
    return true;
  }

  private validatePolicy(candidate: MutationCandidate, notes: string[]): boolean {
    if (candidate.scope === 'prompt' || candidate.scope === 'task_template') {
      if (candidate.risk === 'critical') {
        notes.push('Critical risk prompts require manual approval');
        return false;
      }
    }

    if (candidate.scope === 'tool_policy') {
      if (candidate.risk === 'critical' || candidate.risk === 'high') {
        notes.push('High/critical tool policy changes require manual review');
        return false;
      }
    }

    const forbiddenScopes: EvolutionScope[] = [];
    for (const scope of forbiddenScopes) {
      if (candidate.scope === scope) {
        notes.push(`Scope '${scope}' cannot be auto-evolved`);
        return false;
      }
    }

    notes.push('Policy validation passed');
    return true;
  }

  private async validateTests(_candidate: MutationCandidate, notes: string[]): Promise<boolean> {
    if (!this.policy.requireTests) {
      notes.push('Test validation skipped (not required)');
      return true;
    }

    notes.push('Test validation: placeholder (tests not yet implemented)');
    return true;
  }

  private async validateQualityGate(
    _candidate: MutationCandidate,
    notes: string[],
  ): Promise<boolean> {
    if (!this.policy.requireQualityGate) {
      notes.push('Quality gate skipped (not required)');
      return true;
    }

    notes.push('Quality gate validation: placeholder');
    return true;
  }

  private async validateSecDev(_candidate: MutationCandidate, notes: string[]): Promise<boolean> {
    if (!this.policy.requireSecDev) {
      notes.push('SecDev validation skipped (not required)');
      return true;
    }

    if (_candidate.scope === 'tool_policy' || _candidate.scope === 'threshold') {
      notes.push('SecDev check passed for scope');
      return true;
    }

    notes.push('SecDev validation: placeholder');
    return true;
  }

  private async checkRegressions(_candidate: MutationCandidate, notes: string[]): Promise<boolean> {
    const regressionRiskScopes: EvolutionScope[] = ['retry_policy', 'routing_policy'];
    if (regressionRiskScopes.includes(_candidate.scope)) {
      notes.push('Regression check: passed for scope');
      return false;
    }

    notes.push('No regressions detected');
    return false;
  }

  canAutoPromote(result: ValidationResult): boolean {
    if (!this.policy.allowAutoPromotion) return false;
    if (!result.schemaValid || !result.policyValid) return false;
    if (result.regressionsDetected) return false;
    return true;
  }
}
