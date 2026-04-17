// Candidate Generation Service
// Converts lessons into typed mutation candidates

import type {
  ExtractedLesson,
  MutationCandidate,
  EvolutionScope,
  MutationRisk,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface PromptMutation {
  type:
    | 'instruction_block'
    | 'constraint_block'
    | 'output_format'
    | 'retry_guidance'
    | 'tool_usage';
  targetSection: string;
  currentContent: string;
  proposedContent: string;
}

export interface PolicyMutation {
  type: 'threshold_adjust' | 'retry_count' | 'routing_weight' | 'timeout_config';
  policyId: string;
  currentValue: unknown;
  proposedValue: unknown;
}

export interface CandidateGenerationConfig {
  minEvidenceCount: number;
  minConfidenceThreshold: number;
}

const DEFAULT_CONFIG: CandidateGenerationConfig = {
  minEvidenceCount: 1,
  minConfidenceThreshold: 0.4,
};

export class CandidateGenerationService {
  private logger: Logger;
  private config: CandidateGenerationConfig;

  constructor(config?: Partial<CandidateGenerationConfig>) {
    this.logger = createLogger();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  generateCandidate(lesson: ExtractedLesson, baseVersion: string): MutationCandidate | null {
    if (lesson.evidence.length < this.config.minEvidenceCount) {
      this.logger.debug('candidate.skipped.insufficient_evidence', {
        lessonId: lesson.id,
        evidenceCount: lesson.evidence.length,
      });
      return null;
    }

    if (lesson.confidence < this.config.minConfidenceThreshold) {
      this.logger.debug('candidate.skipped.low_confidence', {
        lessonId: lesson.id,
        confidence: lesson.confidence,
      });
      return null;
    }

    const patch = this.buildPatch(lesson);
    const proposedVersion = this.incrementVersion(baseVersion);
    const risk = this.assessRisk(lesson);

    const candidate: MutationCandidate = {
      id: this.generateCandidateId(),
      scope: lesson.scope,
      targetId: this.getTargetId(lesson.scope),
      baseVersion,
      proposedVersion,
      rationale: lesson.hypothesis,
      patch,
      expectedOutcome: lesson.recommendedChange,
      risk,
      evidence: lesson.evidence,
      createdAt: new Date().toISOString(),
    };

    this.logger.info('candidate.created', {
      candidateId: candidate.id,
      scope: candidate.scope,
      risk: candidate.risk,
      evidenceCount: candidate.evidence.length,
    });

    return candidate;
  }

  generateFromBatch(
    lessons: ExtractedLesson[],
    baseVersions: Record<EvolutionScope, string>,
  ): MutationCandidate[] {
    const candidates: MutationCandidate[] = [];

    for (const lesson of lessons) {
      const baseVersion = baseVersions[lesson.scope] ?? 'v1';
      const candidate = this.generateCandidate(lesson, baseVersion);
      if (candidate) {
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private buildPatch(lesson: ExtractedLesson): PromptMutation | PolicyMutation {
    switch (lesson.scope) {
      case 'prompt':
        return {
          type: 'instruction_block',
          targetSection: 'task_guidance',
          currentContent: 'Default task guidance',
          proposedContent: `Improved: ${lesson.recommendedChange}`,
        };
      case 'threshold':
        return {
          type: 'threshold_adjust',
          policyId: lesson.scope,
          currentValue: 0.5,
          proposedValue: this.deriveThresholdFromLesson(lesson),
        };
      case 'retry_policy':
        return {
          type: 'retry_count',
          policyId: 'retry_policy',
          currentValue: 3,
          proposedValue: this.deriveRetryCountFromLesson(lesson),
        };
      case 'routing_policy':
        return {
          type: 'routing_weight',
          policyId: 'routing_policy',
          currentValue: 1.0,
          proposedValue: this.deriveRoutingWeightFromLesson(lesson),
        };
      default:
        return {
          type: 'constraint_block',
          targetSection: 'default',
          currentContent: 'Default',
          proposedContent: lesson.recommendedChange,
        };
    }
  }

  private deriveThresholdFromLesson(lesson: ExtractedLesson): number {
    if (lesson.priority === 'critical') return 0.8;
    if (lesson.priority === 'high') return 0.7;
    if (lesson.priority === 'medium') return 0.6;
    return 0.5;
  }

  private deriveRetryCountFromLesson(lesson: ExtractedLesson): number {
    const highFailureEvidence = lesson.evidence.filter(
      (e) => e.kind === 'task_outcome' && e.summary?.includes('failed'),
    ).length;
    if (highFailureEvidence >= 3) return 5;
    if (highFailureEvidence >= 2) return 4;
    return 3;
  }

  private deriveRoutingWeightFromLesson(lesson: ExtractedLesson): number {
    if (lesson.confidence > 0.8) return 1.2;
    if (lesson.confidence > 0.6) return 1.0;
    return 0.8;
  }

  private assessRisk(lesson: ExtractedLesson): MutationRisk {
    if (lesson.scope === 'prompt' && lesson.confidence >= 0.7) return 'low';
    if (lesson.scope === 'tool_policy' || lesson.scope === 'routing_policy') return 'medium';
    if (lesson.priority === 'critical') return 'critical';
    if (lesson.priority === 'high') return 'high';
    return 'medium';
  }

  private getTargetId(scope: EvolutionScope): string {
    const targetMap: Record<EvolutionScope, string> = {
      prompt: 'worker_prompt',
      routing_policy: 'routing_policy',
      retry_policy: 'retry_policy',
      threshold: 'confidence_threshold',
      memory_rule: 'lesson_weighting',
      tool_policy: 'tool_trigger_policy',
      task_template: 'task_decomposition',
    };
    return targetMap[scope] ?? 'unknown';
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.');
    const patch = parseInt(parts[1] ?? '0', 10) + 1;
    return `v${patch}`;
  }

  private generateCandidateId(): string {
    return `candidate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
