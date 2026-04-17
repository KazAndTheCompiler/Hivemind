// Rollout Decision Service
// Manages evolution stage transitions with governance

import type {
  MutationCandidate,
  ValidationResult,
  EvolutionScore,
  RolloutDecision,
  EvolutionStage,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface ApprovalPolicy {
  mode: 'manual' | 'auto';
  requireManualApprovalScopes?: EvolutionStage[];
  skipValidationApproval?: boolean;
  skipScoringApproval?: boolean;
}

export interface RolloutDecisionConfig {
  minScoreForDraft: number;
  minScoreForExperimental: number;
  minScoreForCanary: number;
  minScoreForActive: number;
  allowDraftToActive: boolean;
}

const DEFAULT_CONFIG: RolloutDecisionConfig = {
  minScoreForDraft: 0.3,
  minScoreForExperimental: 0.4,
  minScoreForCanary: 0.6,
  minScoreForActive: 0.75,
  allowDraftToActive: false,
};

const STAGE_ORDER: EvolutionStage[] = [
  'draft',
  'experimental',
  'canary',
  'active',
  'rolled_back',
  'rejected',
];

export class RolloutDecisionService {
  private logger: Logger;
  private config: RolloutDecisionConfig;
  private approvalPolicy: ApprovalPolicy;
  private decisions: Map<string, RolloutDecision> = new Map();
  private candidateStages: Map<string, EvolutionStage> = new Map();

  constructor(config?: Partial<RolloutDecisionConfig>, approvalPolicy?: ApprovalPolicy) {
    this.logger = createLogger();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.approvalPolicy = approvalPolicy ?? { mode: 'auto' };
  }

  async decide(
    candidate: MutationCandidate,
    validation: ValidationResult,
    score: EvolutionScore,
  ): Promise<RolloutDecision> {
    const stage = this.computeNextStage(candidate, validation, score);

    const decision: RolloutDecision = {
      candidateId: candidate.id,
      stage,
      approved: stage !== 'rejected',
      reason: this.buildReason(candidate, validation, score, stage),
      timestamp: new Date().toISOString(),
    };

    this.decisions.set(candidate.id, decision);
    this.candidateStages.set(candidate.id, stage);

    this.logger.info('rollout.decision', {
      candidateId: candidate.id,
      stage,
      approved: decision.approved,
      score: score.overallScore,
    });

    return decision;
  }

  getDecision(candidateId: string): RolloutDecision | null {
    return this.decisions.get(candidateId) ?? null;
  }

  getStage(candidateId: string): EvolutionStage | null {
    return this.candidateStages.get(candidateId) ?? null;
  }

  canPromote(candidateId: string, toStage: EvolutionStage): boolean {
    const currentStage = this.candidateStages.get(candidateId);
    if (!currentStage) return false;

    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    const targetIndex = STAGE_ORDER.indexOf(toStage);

    if (targetIndex <= currentIndex) return false;

    for (let i = currentIndex + 1; i <= targetIndex; i++) {
      if (!this.isValidTransition(currentStage, STAGE_ORDER[i])) {
        return false;
      }
    }

    return true;
  }

  getPromotableCandidates(
    candidates: Array<{ id: string; score: EvolutionScore }>,
    minStage?: EvolutionStage,
  ): string[] {
    const minIndex = minStage ? STAGE_ORDER.indexOf(minStage) : 0;

    return candidates
      .filter((c) => {
        const stage = this.candidateStages.get(c.id);
        if (!stage) return false;
        return STAGE_ORDER.indexOf(stage) >= minIndex;
      })
      .filter((c) => c.score.overallScore >= this.config.minScoreForCanary)
      .map((c) => c.id);
  }

  private computeNextStage(
    candidate: MutationCandidate,
    validation: ValidationResult,
    score: EvolutionScore,
  ): EvolutionStage {
    if (!validation.schemaValid || !validation.policyValid) {
      return 'rejected';
    }

    if (validation.regressionsDetected) {
      return 'rejected';
    }

    if (candidate.risk === 'critical') {
      return 'rejected';
    }

    if (score.overallScore < this.config.minScoreForDraft) {
      return 'rejected';
    }

    if (score.overallScore < this.config.minScoreForExperimental) {
      return 'draft';
    }

    if (score.overallScore < this.config.minScoreForCanary) {
      return 'experimental';
    }

    if (score.overallScore < this.config.minScoreForActive) {
      return 'canary';
    }

    if (this.approvalPolicy.mode === 'manual') {
      return 'draft';
    }

    if (!this.config.allowDraftToActive && score.overallScore >= this.config.minScoreForActive) {
      return 'canary';
    }

    return 'active';
  }

  private isValidTransition(from: EvolutionStage, to: EvolutionStage): boolean {
    if (from === 'rejected' || from === 'rolled_back') {
      return to === 'draft';
    }

    if (from === 'active') {
      return to === 'rolled_back';
    }

    if (from === 'draft' && to === 'experimental') return true;
    if (from === 'draft' && to === 'rejected') return true;
    if (from === 'experimental' && to === 'canary') return true;
    if (from === 'experimental' && to === 'active') return this.config.allowDraftToActive;
    if (from === 'canary' && to === 'active') return true;
    if (from === 'canary' && to === 'rolled_back') return true;

    return false;
  }

  private buildReason(
    candidate: MutationCandidate,
    validation: ValidationResult,
    score: EvolutionScore,
    stage: EvolutionStage,
  ): string {
    const parts: string[] = [];

    parts.push(`score=${score.overallScore.toFixed(2)}`);

    if (!validation.schemaValid) parts.push('schema_invalid');
    if (!validation.policyValid) parts.push('policy_invalid');
    if (validation.regressionsDetected) parts.push('regressions');
    if (candidate.risk === 'critical') parts.push('critical_risk');

    parts.push(`stage=${stage}`);

    return parts.join(' | ');
  }
}
