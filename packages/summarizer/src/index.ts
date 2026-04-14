// Agent summary ingestion, normalization, and validation services

import type {
  RawAgentSummary,
  NormalizedAgentSummary,
  ToolFinding,
  SchemaVersion,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import { validateRawSummary, validateNormalizedSummary } from '@openclaw/agent-protocol';

const DEFAULT_SCHEMA_VERSION: SchemaVersion = 'v1';

export class AgentSummaryIngestService {
  private eventBus: EventBus;
  private logger: Logger;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'AgentSummaryIngestService' });
  }

  async ingest(raw: unknown): Promise<RawAgentSummary> {
    const validated = validateRawSummary(raw);
    this.logger.info('summary.ingested', {
      taskId: validated.taskId,
      agentId: validated.agentId,
      status: validated.status,
    });

    await this.eventBus.emit({
      kind: 'agent.summary.emitted',
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      sequence: 0,
      streamId: validated.taskId,
      raw: validated,
      timestamp: new Date().toISOString(),
    });

    return validated;
  }
}

export class SummaryNormalizationService {
  private eventBus: EventBus;
  private logger: Logger;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'SummaryNormalizationService' });
  }

  normalize(raw: RawAgentSummary, findings?: ToolFinding[]): NormalizedAgentSummary {
    const tags = this.extractTags(raw);

    const normalized: NormalizedAgentSummary = {
      taskId: raw.taskId,
      agentId: raw.agentId,
      status: raw.status,
      conciseSummary: this.truncateSummary(raw.summary, 500),
      touchedFiles: raw.touchedFiles,
      blockers: raw.blockers,
      nextActions: raw.nextActions,
      confidence: raw.confidence,
      tags,
      toolFindings: findings ?? [],
      timestamp: raw.timestamp,
    };

    const validated = validateNormalizedSummary(normalized);

    this.logger.debug('summary.normalized', {
      taskId: validated.taskId,
      tagCount: validated.tags.length,
      findingCount: validated.toolFindings.length,
    });

    return validated;
  }

  async normalizeAndEmit(
    raw: RawAgentSummary,
    findings?: ToolFinding[],
  ): Promise<NormalizedAgentSummary> {
    const normalized = this.normalize(raw, findings);

    await this.eventBus.emit({
      kind: 'agent.summary.normalized',
      schemaVersion: DEFAULT_SCHEMA_VERSION,
      sequence: 0,
      streamId: raw.taskId,
      normalized,
      timestamp: new Date().toISOString(),
    });

    return normalized;
  }

  private extractTags(raw: RawAgentSummary): string[] {
    const tags: string[] = [];

    if (raw.status === 'blocked') tags.push('blocked');
    if (raw.blockers.length > 0) tags.push('has-blockers');
    if (raw.confidence < 0.5) tags.push('low-confidence');
    if (raw.touchedFiles.length > 10) tags.push('large-change');
    if (raw.nextActions.length === 0 && raw.status !== 'done') tags.push('no-next-action');

    return tags;
  }

  private truncateSummary(summary: string, maxLen: number): string {
    if (summary.length <= maxLen) return summary;
    return summary.slice(0, maxLen - 3) + '...';
  }
}
