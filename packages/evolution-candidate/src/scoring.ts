// Evolution Scoring Service
// Deterministic scoring of mutation candidates

import type {
  MutationCandidate,
  ValidationResult,
  EvolutionScore,
  ScoringWeights,
} from '@openclaw/evolution-core';
import { DEFAULT_SCORING_WEIGHTS } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export class EvolutionScoringService {
  private logger: Logger;
  private weights: ScoringWeights;

  constructor(weights?: Partial<ScoringWeights>) {
    this.logger = createLogger();
    this.weights = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  }

  score(
    candidate: MutationCandidate,
    _validation: ValidationResult,
    baselineMetrics?: {
      successRate?: number;
      failureRate?: number;
      avgConfidence?: number;
    },
  ): EvolutionScore {
    const evidenceCount = candidate.evidence.length;
    const confidenceScore = Math.min(1, evidenceCount * 0.1 + candidate.risk === 'low' ? 0.2 : 0);

    const successDelta = this.computeSuccessDelta(candidate, baselineMetrics);
    const failureReduction = this.computeFailureReduction(candidate, baselineMetrics);
    const securityScore = this.computeSecurityScore(candidate);
    const regressionRisk = this.computeRegressionRisk(candidate);
    const complexityCost = this.computeComplexityCost(candidate);

    const overallScore = this.computeOverallScore({
      successDelta,
      failureReduction,
      securityScore,
      regressionRisk,
      complexityCost,
      confidenceScore,
    });

    const score: EvolutionScore = {
      candidateId: candidate.id,
      successDelta,
      failureReduction,
      securityScore,
      regressionRisk,
      complexityCost,
      confidenceScore,
      overallScore,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('candidate.scored', {
      candidateId: candidate.id,
      overallScore,
      successDelta,
      failureReduction,
      regressionRisk,
    });

    return score;
  }

  rankCandidates(scores: EvolutionScore[]): EvolutionScore[] {
    return [...scores].sort((a, b) => {
      if (Math.abs(a.overallScore - b.overallScore) < 0.001) {
        return b.confidenceScore - a.confidenceScore;
      }
      return b.overallScore - a.overallScore;
    });
  }

  getMinimumScoreThreshold(): number {
    return 0.6;
  }

  isPromotable(score: EvolutionScore): boolean {
    return score.overallScore >= this.getMinimumScoreThreshold();
  }

  private computeSuccessDelta(
    candidate: MutationCandidate,
    baseline?: { successRate?: number },
  ): number {
    const baseRate = baseline?.successRate ?? 0.8;

    if (candidate.scope === 'prompt') {
      return baseRate * 0.1;
    }
    if (candidate.scope === 'retry_policy') {
      return baseRate * 0.15;
    }
    if (candidate.scope === 'tool_policy') {
      return baseRate * 0.05;
    }

    return baseRate * 0.05;
  }

  private computeFailureReduction(
    candidate: MutationCandidate,
    baseline?: { failureRate?: number },
  ): number {
    const baseRate = baseline?.failureRate ?? 0.2;

    if (candidate.scope === 'retry_policy') {
      return baseRate * 0.2;
    }
    if (candidate.scope === 'routing_policy') {
      return baseRate * 0.15;
    }

    return baseRate * 0.1;
  }

  private computeSecurityScore(candidate: MutationCandidate): number {
    const riskPenalty: Record<string, number> = {
      critical: 0.5,
      high: 0.25,
      medium: 0.1,
      low: 0.0,
    };

    const penalty = riskPenalty[candidate.risk] ?? 0.1;
    return Math.max(0, 1 - penalty);
  }

  private computeRegressionRisk(candidate: MutationCandidate): number {
    const scopeRisk: Record<string, number> = {
      prompt: 0.1,
      threshold: 0.2,
      routing_policy: 0.3,
      retry_policy: 0.25,
      tool_policy: 0.15,
      memory_rule: 0.05,
      task_template: 0.1,
    };

    return scopeRisk[candidate.scope] ?? 0.2;
  }

  private computeComplexityCost(candidate: MutationCandidate): number {
    let complexity = 0;

    if (candidate.scope === 'prompt') {
      const patch = candidate.patch as { proposedContent?: string };
      complexity = (patch.proposedContent?.length ?? 0) / 1000;
    } else if (candidate.scope === 'threshold') {
      complexity = 0.05;
    } else if (candidate.scope === 'retry_policy') {
      complexity = 0.1;
    }

    return Math.min(1, complexity);
  }

  private computeOverallScore(scores: {
    successDelta: number;
    failureReduction: number;
    securityScore: number;
    regressionRisk: number;
    complexityCost: number;
    confidenceScore: number;
  }): number {
    const raw =
      scores.successDelta * this.weights.weightSuccess +
      scores.failureReduction * this.weights.weightFailureReduction +
      scores.securityScore * this.weights.weightSecurity +
      scores.confidenceScore * this.weights.weightConfidence -
      scores.regressionRisk * this.weights.weightRegression -
      scores.complexityCost * this.weights.weightComplexity;

    return Math.max(0, Math.min(1, raw));
  }
}
