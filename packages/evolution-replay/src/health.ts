// Evolution Health Service
// Health checks for evolution subsystem

import type { EvolutionHealth } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface HealthConfig {
  maxStaleLessons: number;
  maxPendingCandidates: number;
  maxQueueDepth: number;
  staleLessonAgeDays: number;
}

const DEFAULT_CONFIG: HealthConfig = {
  maxStaleLessons: 100,
  maxPendingCandidates: 50,
  maxQueueDepth: 1000,
  staleLessonAgeDays: 30,
};

export class EvolutionHealthService {
  private logger: Logger;
  private config: HealthConfig;
  private lastSuccessfulValidation: string | null = null;
  private lastRolloutTime: string | null = null;
  private queueDepth = 0;

  constructor(config?: Partial<HealthConfig>, logger?: Logger) {
    this.logger = logger ?? createLogger();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  setQueueDepth(depth: number): void {
    this.queueDepth = depth;
  }

  recordValidation(success: boolean): void {
    if (success) {
      this.lastSuccessfulValidation = new Date().toISOString();
    }
  }

  recordRollout(): void {
    this.lastRolloutTime = new Date().toISOString();
  }

  check(staleLessonsCount: number, pendingCandidates: number): EvolutionHealth {
    const issues: string[] = [];

    if (this.queueDepth > this.config.maxQueueDepth) {
      issues.push(`queue_depth_exceeded:${this.queueDepth}`);
    }

    if (staleLessonsCount > this.config.maxStaleLessons) {
      issues.push(`stale_lessons_exceeded:${staleLessonsCount}`);
    }

    if (pendingCandidates > this.config.maxPendingCandidates) {
      issues.push(`pending_candidates_exceeded:${pendingCandidates}`);
    }

    let status: EvolutionHealth['replayConsistencyStatus'] = 'consistent';
    if (issues.length > 0) {
      status = 'unknown';
      this.logger.warn('evolution.health.issues', { issues });
    }

    return {
      queueDepth: this.queueDepth,
      lastSuccessfulValidation: this.lastSuccessfulValidation,
      lastRolloutTime: this.lastRolloutTime,
      pendingCandidates,
      staleLessonsCount,
      replayConsistencyStatus: status,
    };
  }

  isHealthy(health: EvolutionHealth): boolean {
    return health.replayConsistencyStatus === 'consistent';
  }

  getLastValidationTime(): string | null {
    return this.lastSuccessfulValidation;
  }

  getLastRolloutTime(): string | null {
    return this.lastRolloutTime;
  }
}
