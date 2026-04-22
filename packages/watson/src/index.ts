// Watson — schema-to-schema compression filter, no LLM inference
// Based on EMISSION_PAPER.md OllamaFilter spec:
// "Schema-to-schema conversion only. NO summarization. Prevents drift."

import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  HivemindBaseSignal,
  HivemindBuilderProgress,
  HivemindReducedStatePacket,
  HivemindReducerPacket,
  ToolFinding,
  Severity,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import { countTokensObject } from '@openclaw/core-tokenizer';
import {
  buildProgressSignal,
  buildReducedStatePacket,
  buildReducerPacket,
} from './hivemind-v2';

export const FIELD_PRIORITY_MATRIX = {
  summary: 10,
  blockers: 9,
  nextActions: 8,
  nextAction: 8,
  topFindings: 7,
  findings: 7,
  touchedFiles: 5,
  status: 6,
  severity: 6,
  confidence: 4,
  version: 3,
  budget: 3,
  taskId: 2,
  agentId: 1,
} as const;

export interface HivemindWatsonProjection {
  relay200: CondensedRelay200;
  relay300: CondensedRelay300;
  progressSignal: HivemindBaseSignal<HivemindBuilderProgress>;
  reducedState: HivemindReducedStatePacket;
  reducerPacket: HivemindReducerPacket;
}

export class WatsonFilter {
  private eventBus: EventBus;
  private logger: Logger;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'WatsonFilter' });
  }

  condense(normalized: NormalizedAgentSummary): {
    relay200: CondensedRelay200;
    relay300: CondensedRelay300;
  } {
    const relay200 = this.build200(normalized);
    const relay300 = this.build300(normalized);

    this.logger.info('summary.condensed', {
      taskId: normalized.taskId,
      tokens200: countTokensObject(relay200),
      tokens300: countTokensObject(relay300),
      severity: relay200.severity,
    });

    return { relay200, relay300 };
  }

  projectHivemindState(normalized: NormalizedAgentSummary): HivemindWatsonProjection {
    const { relay200, relay300 } = this.condense(normalized);
    const progressSignal = buildProgressSignal(normalized);
    const reducedState = buildReducedStatePacket(normalized, progressSignal);
    const reducerPacket = buildReducerPacket(normalized);

    return {
      relay200,
      relay300,
      progressSignal,
      reducedState,
      reducerPacket,
    };
  }

  async condenseAndEmit(
    normalized: NormalizedAgentSummary,
  ): Promise<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> {
    const { relay200, relay300 } = this.condense(normalized);

    await this.eventBus.emit({
      kind: 'relay.condensed',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: normalized.taskId,
      relay200,
      relay300,
      timestamp: new Date().toISOString(),
    });

    return { relay200, relay300 };
  }

  private build200(normalized: NormalizedAgentSummary): CondensedRelay200 {
    const nextAction = normalized.nextActions[0] ?? null;
    const severity = this.computeSeverity(normalized);

    const base: CondensedRelay200 = {
      version: 'relay.v1',
      budget: 200,
      taskId: normalized.taskId,
      agentId: normalized.agentId,
      status: normalized.status,
      summary: normalized.conciseSummary,
      touchedFiles: normalized.touchedFiles.slice(0, 5),
      blockers: normalized.blockers.slice(0, 2),
      nextAction,
      severity,
      confidence: normalized.confidence,
    };

    return truncatePayloadToBudgetWithPriority<CondensedRelay200>(base, 200, FIELD_PRIORITY_MATRIX);
  }

  private build300(normalized: NormalizedAgentSummary): CondensedRelay300 {
    const severity = this.computeSeverity(normalized);
    const rankedFindings = this.rankFindings(normalized.toolFindings);

    const base: CondensedRelay300 = {
      version: 'relay.v1',
      budget: 300,
      taskId: normalized.taskId,
      agentId: normalized.agentId,
      status: normalized.status,
      summary: normalized.conciseSummary,
      touchedFiles: normalized.touchedFiles.slice(0, 10),
      blockers: normalized.blockers.slice(0, 5),
      nextActions: normalized.nextActions.slice(0, 5),
      topFindings: rankedFindings.slice(0, 3),
      severity,
      confidence: normalized.confidence,
    };

    return truncatePayloadToBudgetWithPriority<CondensedRelay300>(base, 300, FIELD_PRIORITY_MATRIX);
  }

  computeSeverity(normalized: NormalizedAgentSummary): Severity {
    const hasCritical = normalized.toolFindings.some((f) => f.severity === 'critical');
    if (hasCritical) return 'critical';

    const hasHigh = normalized.toolFindings.some((f) => f.severity === 'high');
    if (hasHigh) return 'high';

    if (normalized.status === 'failed') return 'medium';
    if (normalized.status === 'blocked') return 'medium';

    if (normalized.confidence < 0.5 && normalized.blockers.length > 0) return 'low';

    return 'none';
  }

  rankFindings(findings: ToolFinding[]): ToolFinding[] {
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

function truncatePayloadToBudgetWithPriority<T extends object>(
  payload: T,
  budget: number,
  priority: Record<string, number>,
): T {
  let current = countTokensObject(payload);
  if (current <= budget) return payload;

  const sortedFields = Object.keys(priority).sort((a, b) => priority[a] - priority[b]);

  const result = { ...payload } as Record<string, unknown>;
  const arraysToTrim: string[] = [];
  const maxIterations = 100;
  let iterations = 0;

  for (const field of sortedFields) {
    if (Array.isArray(result[field])) {
      arraysToTrim.push(field);
    }
  }

  while (current > budget && iterations < maxIterations) {
    iterations++;
    let trimmed = false;

    for (const field of arraysToTrim) {
      const arr = result[field] as unknown[];
      if (arr.length > 0) {
        result[field] = arr.slice(0, -1);
        trimmed = true;
        current = countTokensObject(result);
        if (current <= budget) return result as T;
      }
    }

    if (!trimmed) break;
  }

  return result as T;
}

export { WatsonFilter as SummaryCondenseService };
export type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  HivemindBaseSignal,
  HivemindBuilderProgress,
  HivemindReducedStatePacket,
  HivemindReducerPacket,
};
export {
  buildBuilderProgress,
  buildProgressSignal,
  buildReducedStatePacket,
  buildReducerPacket,
} from './hivemind-v2';
