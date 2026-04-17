// Lesson Extraction Service
// Converts observations into typed lessons deterministically

import type {
  EvidenceRef,
  ExtractedLesson,
  EvolutionScope,
  LessonPriority,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface ExtractionRule {
  scope: EvolutionScope;
  condition: (evidence: EvidenceRef) => boolean;
  titleTemplate: string;
  problemTemplate: string;
  hypothesisTemplate: string;
  recommendedChangeTemplate: string;
  priorityMapper: (evidence: EvidenceRef) => LessonPriority;
  confidenceBase: number;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    scope: 'tool_policy',
    condition: (e) => e.kind === 'quality_gate' && e.summary?.includes('failed') === true,
    titleTemplate: 'Quality gate failures suggest tool policy issue',
    problemTemplate: 'Quality gate has failing checks',
    hypothesisTemplate: 'Adjusting tool invocation thresholds may reduce failures',
    recommendedChangeTemplate: 'Review and adjust tool trigger policy for failing tools',
    priorityMapper: (e) => {
      if (e.refs?.some((r) => r.startsWith('eslintFailed'))) return 'high';
      return 'medium';
    },
    confidenceBase: 0.7,
  },
  {
    scope: 'retry_policy',
    condition: (e) => e.kind === 'task_outcome' && e.summary?.includes('failed') === true,
    titleTemplate: 'Task failures indicate retry policy needs review',
    problemTemplate: 'Tasks are failing on first attempt',
    hypothesisTemplate: 'Current retry attempts may be insufficient or excessive',
    recommendedChangeTemplate: 'Review retry count and delay configuration',
    priorityMapper: () => 'medium',
    confidenceBase: 0.6,
  },
  {
    scope: 'threshold',
    condition: (e) => e.kind === 'secdev_finding',
    titleTemplate: 'Security findings detected',
    problemTemplate: 'SecDev has flagged potential security issues',
    hypothesisTemplate: 'Lowering secdev trigger threshold may catch issues earlier',
    recommendedChangeTemplate: 'Review security threshold configuration',
    priorityMapper: (e) => {
      if (e.summary?.includes('critical')) return 'critical';
      if (e.summary?.includes('high')) return 'high';
      return 'medium';
    },
    confidenceBase: 0.8,
  },
  {
    scope: 'routing_policy',
    condition: (e) => e.kind === 'relay_delivery' && e.summary?.includes('failed') === true,
    titleTemplate: 'Relay delivery failures suggest routing issue',
    problemTemplate: 'Relay delivery is failing',
    hypothesisTemplate: 'Confidence threshold or routing logic may need adjustment',
    recommendedChangeTemplate: 'Review relay routing and confidence thresholds',
    priorityMapper: () => 'medium',
    confidenceBase: 0.65,
  },
  {
    scope: 'prompt',
    condition: (e) => e.kind === 'manual_review' && e.summary?.includes('modified') === true,
    titleTemplate: 'Manual prompt modifications suggest prompt quality issue',
    problemTemplate: 'Prompts required manual intervention',
    hypothesisTemplate: 'Prompt instructions may be unclear or missing context',
    recommendedChangeTemplate: 'Review and improve prompt instructions',
    priorityMapper: () => 'low',
    confidenceBase: 0.5,
  },
];

export class LessonExtractionService {
  private logger: Logger;
  private extractedLessons: Map<string, ExtractedLesson> = new Map();
  private evidenceToLesson: Map<string, string> = new Map();

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger();
  }

  extractLesson(evidence: EvidenceRef): ExtractedLesson | null {
    for (const rule of EXTRACTION_RULES) {
      if (rule.condition(evidence)) {
        const signature = this.computeSignature(evidence, rule.scope);
        if (this.evidenceToLesson.has(signature)) {
          const existingId = this.evidenceToLesson.get(signature)!;
          const existing = this.extractedLessons.get(existingId);
          if (existing) {
            existing.evidence.push(evidence);
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
            this.logger.debug('lesson.evidence_appended', {
              lessonId: existingId,
              evidenceId: evidence.id,
              newConfidence: existing.confidence,
            });
            return null;
          }
        }

        const lesson = this.buildLesson(evidence, rule);
        this.extractedLessons.set(lesson.id, lesson);
        this.evidenceToLesson.set(signature, lesson.id);

        this.logger.info('lesson.extracted', {
          lessonId: lesson.id,
          scope: lesson.scope,
          priority: lesson.priority,
          evidenceCount: lesson.evidence.length,
        });

        return lesson;
      }
    }

    return null;
  }

  extractFromBatch(evidence: EvidenceRef[]): ExtractedLesson[] {
    const lessons: ExtractedLesson[] = [];
    for (const e of evidence) {
      const lesson = this.extractLesson(e);
      if (lesson) {
        lessons.push(lesson);
      }
    }
    return lessons;
  }

  deduplicateLessons(lessons: ExtractedLesson[]): ExtractedLesson[] {
    const bySignature = new Map<string, ExtractedLesson>();

    for (const lesson of lessons) {
      const key = this.normalizeSignature(lesson);
      const existing = bySignature.get(key);

      if (!existing) {
        bySignature.set(key, lesson);
      } else {
        if (lesson.confidence > existing.confidence) {
          bySignature.set(key, lesson);
        }
        existing.evidence.push(...lesson.evidence);
        existing.confidence = Math.min(0.95, (existing.confidence + lesson.confidence) / 2);
      }
    }

    return Array.from(bySignature.values());
  }

  decayLesson(lesson: ExtractedLesson, ageDays: number): ExtractedLesson {
    const decayFactor = Math.max(0.1, 1 - ageDays * 0.05);
    return {
      ...lesson,
      confidence: lesson.confidence * decayFactor,
    };
  }

  private buildLesson(evidence: EvidenceRef, rule: ExtractionRule): ExtractedLesson {
    const title = rule.titleTemplate;
    const problem = rule.problemTemplate;
    const hypothesis = rule.hypothesisTemplate;
    const recommendedChange = rule.recommendedChangeTemplate;
    const priority = rule.priorityMapper(evidence);
    const confidence = rule.confidenceBase;

    const tags = this.inferTags(evidence);

    return {
      id: this.generateLessonId(),
      scope: rule.scope,
      title,
      problem,
      hypothesis,
      recommendedChange,
      confidence,
      priority,
      evidence: [evidence],
      tags,
      createdAt: new Date().toISOString(),
      sourceVersion: 'v1',
    };
  }

  private computeSignature(evidence: EvidenceRef, scope: EvolutionScope): string {
    const parts = [scope, evidence.kind, evidence.taskId ?? '', evidence.agentId ?? ''].join('|');

    let hash = 0;
    for (let i = 0; i < parts.length; i++) {
      const char = parts.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private normalizeSignature(lesson: ExtractedLesson): string {
    const key = [
      lesson.scope,
      lesson.problem.toLowerCase().trim(),
      lesson.recommendedChange.toLowerCase().trim(),
    ].join('|');
    return key;
  }

  private inferTags(evidence: EvidenceRef): string[] {
    const tags: string[] = [evidence.kind];

    if (evidence.taskId) tags.push(`task:${evidence.taskId}`);
    if (evidence.agentId) tags.push(`agent:${evidence.agentId}`);
    if (evidence.summary) {
      if (evidence.summary.includes('security') || evidence.summary.includes('SEC'))
        tags.push('security');
      if (evidence.summary.includes('quality')) tags.push('quality');
      if (evidence.summary.includes('relay')) tags.push('relay');
    }

    return tags;
  }

  private generateLessonId(): string {
    return `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
