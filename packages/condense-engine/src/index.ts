// Deterministic condensing pipeline — 200/300 token relay summaries

import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  ToolFinding,
  Severity,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import { countTokens, truncateToBudget } from '@openclaw/core-tokenizer';

// ---------------------------------------------------------------------------
// SummaryCondenseService — normalized → 200/300 token relay
// ---------------------------------------------------------------------------

export class SummaryCondenseService {
  private eventBus: EventBus;
  private logger: Logger;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'SummaryCondenseService' });
  }

  condense(normalized: NormalizedAgentSummary): { relay200: CondensedRelay200; relay300: CondensedRelay300 } {
    const relay200 = this.build200(normalized);
    const relay300 = this.build300(normalized);

    this.logger.info('summary.condensed', {
      taskId: normalized.taskId,
      tokens200: countTokens(JSON.stringify(relay200)),
      tokens300: countTokens(JSON.stringify(relay300)),
      severity: relay200.severity,
    });

    return { relay200, relay300 };
  }

  async condenseAndEmit(normalized: NormalizedAgentSummary): Promise<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> {
    const { relay200, relay300 } = this.condense(normalized);

    await this.eventBus.emit({
      kind: 'relay.condensed',
      relay200,
      relay300,
      timestamp: new Date().toISOString(),
    });

    return { relay200, relay300 };
  }

  private build200(normalized: NormalizedAgentSummary): CondensedRelay200 {
    // Optimize for fast relay: single nextAction, critical findings only in severity
    const nextAction = normalized.nextActions[0] ?? null;
    const severity = this.computeSeverity(normalized);

    // Truncate summary to fit 200 token budget
    const summaryBudget = 120; // reserve tokens for metadata
    const truncatedSummary = truncateToBudget(normalized.conciseSummary, summaryBudget);

    return {
      version: 'relay.v1',
      budget: 200,
      taskId: normalized.taskId,
      agentId: normalized.agentId,
      status: normalized.status,
      summary: truncatedSummary,
      touchedFiles: normalized.touchedFiles.slice(0, 5),
      blockers: normalized.blockers.slice(0, 2),
      nextAction,
      severity,
      confidence: normalized.confidence,
    };
  }

  private build300(normalized: NormalizedAgentSummary): CondensedRelay300 {
    // Preserve more evidence: full nextActions, top findings
    const severity = this.computeSeverity(normalized);

    const summaryBudget = 200;
    const truncatedSummary = truncateToBudget(normalized.conciseSummary, summaryBudget);

    const topFindings = this.rankFindings(normalized.toolFindings).slice(0, 3);

    return {
      version: 'relay.v1',
      budget: 300,
      taskId: normalized.taskId,
      agentId: normalized.agentId,
      status: normalized.status,
      summary: truncatedSummary,
      touchedFiles: normalized.touchedFiles.slice(0, 10),
      blockers: normalized.blockers,
      nextActions: normalized.nextActions,
      topFindings,
      severity,
      confidence: normalized.confidence,
    };
  }

  private computeSeverity(normalized: NormalizedAgentSummary): Severity {
    // Critical findings → critical
    const hasCritical = normalized.toolFindings.some(
      (f) => f.severity === 'critical',
    );
    if (hasCritical) return 'critical';

    // High findings → high
    const hasHigh = normalized.toolFindings.some(
      (f) => f.severity === 'high',
    );
    if (hasHigh) return 'high';

    // Failed status → medium
    if (normalized.status === 'failed') return 'medium';

    // Blocked → medium
    if (normalized.status === 'blocked') return 'medium';

    // Low-confidence + blockers → low
    if (normalized.confidence < 0.5 && normalized.blockers.length > 0) return 'low';

    return 'none';
  }

  private rankFindings(findings: ToolFinding[]): ToolFinding[] {
    const severityOrder: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };

    return [...findings].sort(
      (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5),
    );
  }
}
