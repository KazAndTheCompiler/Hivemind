// Observation Ingest Service
// Collects and normalizes evidence from all system sources

import type { EvidenceRef } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface ObservationIngestConfig {
  maxQueueSize: number;
  coalesceWindowMs: number;
}

const DEFAULT_CONFIG: ObservationIngestConfig = {
  maxQueueSize: 1000,
  coalesceWindowMs: 100,
};

export class ObservationIngestService {
  private logger: Logger;
  private config: ObservationIngestConfig;
  private queue: EvidenceRef[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<ObservationIngestConfig>) {
    this.logger = createLogger();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async ingest(evidence: EvidenceRef): Promise<void> {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.logger.warn('observation.queue.full', { size: this.queue.length });
      this.queue.shift();
    }

    const normalized = this.normalizeEvidence(evidence);
    this.queue.push(normalized);

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.config.coalesceWindowMs);
    }
  }

  async ingestTaskOutcome(
    taskId: string,
    agentId: string,
    status: 'success' | 'failed' | 'blocked',
    summary?: string,
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'task_outcome',
      timestamp: new Date().toISOString(),
      taskId,
      agentId,
      summary: summary ?? `Task ${taskId} ${status}`,
    };
    await this.ingest(evidence);
  }

  async ingestQualityGate(
    taskId: string,
    passed: boolean,
    details: {
      prettierFailed?: number;
      eslintFailed?: number;
      secdevFindings?: number;
    },
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'quality_gate',
      timestamp: new Date().toISOString(),
      taskId,
      summary: `Quality gate ${passed ? 'passed' : 'failed'}`,
      refs: [
        `prettierFailed:${details.prettierFailed ?? 0}`,
        `eslintFailed:${details.eslintFailed ?? 0}`,
        `secdevFindings:${details.secdevFindings ?? 0}`,
      ],
    };
    await this.ingest(evidence);
  }

  async ingestSecDevFinding(
    taskId: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    code: string,
    message: string,
    fileRefs: string[],
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'secdev_finding',
      timestamp: new Date().toISOString(),
      taskId,
      summary: `[${severity.toUpperCase()}] ${code}: ${message}`,
      refs: fileRefs,
    };
    await this.ingest(evidence);
  }

  async ingestRelayDelivery(taskId: string, success: boolean, reason?: string): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'relay_delivery',
      timestamp: new Date().toISOString(),
      taskId,
      summary: `Relay ${success ? 'delivered' : 'failed'}${reason ? `: ${reason}` : ''}`,
    };
    await this.ingest(evidence);
  }

  async ingestManualReview(
    taskId: string,
    agentId: string,
    outcome: 'approved' | 'rejected' | 'modified',
    notes?: string,
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'manual_review',
      timestamp: new Date().toISOString(),
      taskId,
      agentId,
      summary: `Manual review ${outcome}${notes ? `: ${notes}` : ''}`,
    };
    await this.ingest(evidence);
  }

  async ingestRollbackEvent(
    targetId: string,
    scope: string,
    reason: string,
    restoredVersion: string,
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'rollback_event',
      timestamp: new Date().toISOString(),
      summary: `Rolled back ${scope} ${targetId} to ${restoredVersion}: ${reason}`,
      refs: [targetId, restoredVersion],
    };
    await this.ingest(evidence);
  }

  async ingestMemoryFeedback(
    lessonId: string,
    feedback: 'helpful' | 'not_helpful' | 'outdated' | 'incorrect',
    agentId?: string,
  ): Promise<void> {
    const evidence: EvidenceRef = {
      id: this.generateId(),
      kind: 'memory_feedback',
      timestamp: new Date().toISOString(),
      agentId,
      summary: `Lesson ${lessonId} feedback: ${feedback}`,
      refs: [lessonId],
    };
    await this.ingest(evidence);
  }

  flush(): EvidenceRef[] {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const batch = [...this.queue];
    this.queue = [];
    return batch;
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  private normalizeEvidence(evidence: EvidenceRef): EvidenceRef {
    return {
      id: evidence.id || this.generateId(),
      kind: evidence.kind,
      timestamp: evidence.timestamp || new Date().toISOString(),
      taskId: evidence.taskId,
      agentId: evidence.agentId,
      summary: evidence.summary?.slice(0, 500),
      refs: evidence.refs?.slice(0, 50),
    };
  }

  private generateId(): string {
    return `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
