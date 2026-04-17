// Rollout Executor Service
// Executes staged rollouts with canary support and auto-rollback

import type { MutationCandidate, EvolutionStage, RolloutConfig } from '@openclaw/evolution-core';
import { DEFAULT_ROLLOUT_CONFIG } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface RolloutRecord {
  candidateId: string;
  stage: EvolutionStage;
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  outcome?: string;
  baselineVersion?: string;
  activatedVersion?: string;
}

export interface RollbackRecord {
  candidateId: string;
  fromStage: EvolutionStage;
  restoredVersion: string;
  reason: string;
  timestamp: string;
}

export class RolloutExecutorService {
  private logger: Logger;
  private config: RolloutConfig;
  private activeRollouts: Map<string, RolloutRecord> = new Map();
  private baselineVersions: Map<string, string> = new Map();
  private rollbackHistory: RollbackRecord[] = [];

  constructor(config?: Partial<RolloutConfig>) {
    this.logger = createLogger();
    this.config = { ...DEFAULT_ROLLOUT_CONFIG, ...config };
  }

  async startRollout(candidate: MutationCandidate, currentVersion: string): Promise<RolloutRecord> {
    const record: RolloutRecord = {
      candidateId: candidate.id,
      stage: 'draft',
      startedAt: new Date().toISOString(),
      baselineVersion: currentVersion,
    };

    this.activeRollouts.set(candidate.id, record);
    this.baselineVersions.set(candidate.id, currentVersion);

    this.logger.info('rollout.started', {
      candidateId: candidate.id,
      stage: record.stage,
      baselineVersion: currentVersion,
    });

    return record;
  }

  async promoteStage(candidateId: string, toStage: EvolutionStage): Promise<RolloutRecord | null> {
    const record = this.activeRollouts.get(candidateId);
    if (!record) {
      this.logger.warn('rollout.promote.not_found', { candidateId: candidateId });
      return null;
    }

    record.stage = toStage;
    record.completedAt = new Date().toISOString();

    this.logger.info('rollout.promoted', {
      candidateId: candidateId,
      toStage,
    });

    return record;
  }

  async completeRollout(candidateId: string, success: boolean, outcome?: string): Promise<void> {
    const record = this.activeRollouts.get(candidateId);
    if (!record) return;

    record.success = success;
    record.outcome = outcome;
    record.completedAt = new Date().toISOString();

    this.logger.info('rollout.completed', {
      candidateId: candidateId,
      success,
      outcome,
    });
  }

  async rollback(candidateId: string, reason: string): Promise<RollbackRecord | null> {
    const baseline = this.baselineVersions.get(candidateId);
    const record = this.activeRollouts.get(candidateId);

    if (!baseline || !record) {
      this.logger.warn('rollback.no_baseline', { candidateId });
      return null;
    }

    const rollbackRecord: RollbackRecord = {
      candidateId,
      fromStage: record.stage,
      restoredVersion: baseline,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.rollbackHistory.push(rollbackRecord);

    record.stage = 'rolled_back';
    record.completedAt = new Date().toISOString();
    record.success = false;
    record.outcome = `rolled_back: ${reason}`;

    this.logger.info('rollback.completed', {
      candidateId,
      restoredVersion: baseline,
      reason,
    });

    return rollbackRecord;
  }

  checkNegativeSignals(candidateId: string): boolean {
    if (!this.config.autoRollbackEnabled) return false;

    const record = this.activeRollouts.get(candidateId);
    if (!record || record.stage !== 'canary') return false;

    const elapsed = Date.now() - new Date(record.startedAt).getTime();
    if (elapsed < this.config.evaluationWindowMs) return false;

    return false;
  }

  getActiveRollout(candidateId: string): RolloutRecord | null {
    return this.activeRollouts.get(candidateId) ?? null;
  }

  getRolloutHistory(): RolloutRecord[] {
    return Array.from(this.activeRollouts.values());
  }

  getRollbackHistory(): RollbackRecord[] {
    return [...this.rollbackHistory];
  }

  getActiveCount(): number {
    return this.activeRollouts.size;
  }

  isCanaryActive(candidateId: string): boolean {
    const record = this.activeRollouts.get(candidateId);
    return record?.stage === 'canary';
  }

  isActive(candidateId: string): boolean {
    const record = this.activeRollouts.get(candidateId);
    return record?.stage === 'active';
  }
}
