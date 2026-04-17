// Evolution Metrics Service
// Observability metrics for evolution subsystem

import type { EvolutionMetrics } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export class EvolutionMetricsService {
  private logger: Logger;
  private metrics: EvolutionMetrics;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger();
    this.metrics = this.initMetrics();
  }

  private initMetrics(): EvolutionMetrics {
    return {
      observationsIngestedTotal: 0,
      lessonsExtractedTotal: 0,
      candidatesCreatedTotal: 0,
      candidatesValidatedTotal: 0,
      candidatesPromotedTotal: 0,
      candidatesRejectedTotal: 0,
      rollbacksTotal: 0,
      canaryFailuresTotal: 0,
      promptVersionsTotal: 0,
      policyVersionsTotal: 0,
      lastMetricsUpdated: new Date().toISOString(),
    };
  }

  incrementObservationIngested(count = 1): void {
    this.metrics.observationsIngestedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementLessonsExtracted(count = 1): void {
    this.metrics.lessonsExtractedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementCandidatesCreated(count = 1): void {
    this.metrics.candidatesCreatedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementCandidatesValidated(count = 1): void {
    this.metrics.candidatesValidatedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementCandidatesPromoted(count = 1): void {
    this.metrics.candidatesPromotedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementCandidatesRejected(count = 1): void {
    this.metrics.candidatesRejectedTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementRollbacks(count = 1): void {
    this.metrics.rollbacksTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementCanaryFailures(count = 1): void {
    this.metrics.canaryFailuresTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementPromptVersions(count = 1): void {
    this.metrics.promptVersionsTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  incrementPolicyVersions(count = 1): void {
    this.metrics.policyVersionsTotal += count;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  getMetrics(): EvolutionMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.metrics = this.initMetrics();
    this.logger.info('evolution.metrics.reset');
  }

  logSummary(): void {
    this.logger.info('evolution.metrics.summary', {
      observationsIngestedTotal: this.metrics.observationsIngestedTotal,
      lessonsExtractedTotal: this.metrics.lessonsExtractedTotal,
      candidatesCreatedTotal: this.metrics.candidatesCreatedTotal,
      candidatesValidatedTotal: this.metrics.candidatesValidatedTotal,
      candidatesPromotedTotal: this.metrics.candidatesPromotedTotal,
      candidatesRejectedTotal: this.metrics.candidatesRejectedTotal,
      rollbacksTotal: this.metrics.rollbacksTotal,
      canaryFailuresTotal: this.metrics.canaryFailuresTotal,
    });
  }
}
