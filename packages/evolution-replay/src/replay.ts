// Evolution Replay Service
// Replay evidence and re-score past candidates

import type {
  EvidenceRef,
  ExtractedLesson,
  MutationCandidate,
  EvolutionScore,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface ReplayRecord {
  id: string;
  timestamp: string;
  events: EvidenceRef[];
  lessons: ExtractedLesson[];
  candidates: MutationCandidate[];
  scores: Map<string, EvolutionScore>;
  divergences: string[];
}

export class EvolutionReplayService {
  private logger: Logger;
  private replayHistory: ReplayRecord[] = [];

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger();
  }

  async replayEvents(
    events: EvidenceRef[],
    extractor: (evidence: EvidenceRef) => ExtractedLesson | null,
    candidateGenerator: (lesson: ExtractedLesson) => MutationCandidate | null,
    scorer: (candidate: MutationCandidate) => EvolutionScore,
  ): Promise<{
    lessons: ExtractedLesson[];
    candidates: MutationCandidate[];
    scores: Map<string, EvolutionScore>;
    divergences: string[];
  }> {
    const lessons: ExtractedLesson[] = [];
    const lessonMap = new Map<string, ExtractedLesson>();
    const candidates: MutationCandidate[] = [];
    const scores = new Map<string, EvolutionScore>();
    const divergences: string[] = [];

    for (const event of events) {
      const lesson = extractor(event);
      if (lesson) {
        const existing = lessonMap.get(lesson.id);
        if (existing) {
          divergences.push(`Duplicate lesson ${lesson.id} found`);
        } else {
          lessonMap.set(lesson.id, lesson);
          lessons.push(lesson);
        }
      }
    }

    for (const lesson of lessons) {
      const candidate = candidateGenerator(lesson);
      if (candidate) {
        candidates.push(candidate);
        const score = scorer(candidate);
        scores.set(candidate.id, score);
      }
    }

    this.logger.info('evolution.replay.completed', {
      eventCount: events.length,
      lessonCount: lessons.length,
      candidateCount: candidates.length,
      divergenceCount: divergences.length,
    });

    return { lessons, candidates, scores, divergences };
  }

  async replayAndCompare(
    events: EvidenceRef[],
    recordedLessons: ExtractedLesson[],
    recordedScores: Map<string, EvolutionScore>,
    extractor: (evidence: EvidenceRef) => ExtractedLesson | null,
    candidateGenerator: (lesson: ExtractedLesson) => MutationCandidate | null,
    scorer: (candidate: MutationCandidate) => EvolutionScore,
  ): Promise<{
    replayedLessons: ExtractedLesson[];
    replayedScores: Map<string, EvolutionScore>;
    lessonDivergences: string[];
    scoreDivergences: string[];
    consistent: boolean;
  }> {
    const { lessons, scores } = await this.replayEvents(
      events,
      extractor,
      candidateGenerator,
      scorer,
    );

    const lessonDivergences: string[] = [];
    const scoreDivergences: string[] = [];

    if (lessons.length !== recordedLessons.length) {
      lessonDivergences.push(
        `Lesson count mismatch: replayed=${lessons.length}, recorded=${recordedLessons.length}`,
      );
    }

    for (const [id, score] of scores) {
      const recordedScore = recordedScores.get(id);
      if (!recordedScore) {
        scoreDivergences.push(`Missing recorded score for candidate ${id}`);
      } else if (Math.abs(score.overallScore - recordedScore.overallScore) > 0.001) {
        scoreDivergences.push(
          `Score divergence for ${id}: replayed=${score.overallScore}, recorded=${recordedScore.overallScore}`,
        );
      }
    }

    const consistent =
      lessonDivergences.length === 0 && (scoreDivergences as string[]).length === 0;

    this.logger.info('evolution.replay.compare', {
      consistent,
      lessonDivergences: lessonDivergences.length,
      scoreDivergences: (scoreDivergences as string[]).length,
    });

    return {
      replayedLessons: lessons,
      replayedScores: scores,
      lessonDivergences,
      scoreDivergences: scoreDivergences as string[],
      consistent,
    };
  }

  saveReplayRecord(record: ReplayRecord): void {
    this.replayHistory.push(record);
    if (this.replayHistory.length > 100) {
      this.replayHistory = this.replayHistory.slice(-100);
    }
  }

  getReplayHistory(): ReplayRecord[] {
    return [...this.replayHistory];
  }

  getLastReplay(): ReplayRecord | null {
    return this.replayHistory[this.replayHistory.length - 1] ?? null;
  }
}
