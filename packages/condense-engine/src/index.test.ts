import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '@openclaw/core-events';
import { createLogger } from '@openclaw/core-logging';
import { SummaryCondenseService } from './index';
import type { NormalizedAgentSummary } from '@openclaw/core-types';

function createNormalizedSummary(
  overrides: Partial<NormalizedAgentSummary> = {},
): NormalizedAgentSummary {
  return {
    taskId: 'task-1',
    agentId: 'worker-1',
    status: 'done',
    conciseSummary: 'Task completed successfully with all checks passing',
    touchedFiles: ['src/foo.ts', 'src/bar.ts'],
    blockers: [],
    nextActions: ['Review the changes'],
    confidence: 0.95,
    tags: [],
    toolFindings: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('SummaryCondenseService', () => {
  let service: SummaryCondenseService;

  beforeEach(() => {
    const eventBus = new EventBus(createLogger());
    service = new SummaryCondenseService(eventBus, createLogger());
  });

  it('condenses to 200-token relay', () => {
    const summary = createNormalizedSummary();
    const { relay200 } = service.condense(summary);

    expect(relay200.version).toBe('relay.v1');
    expect(relay200.budget).toBe(200);
    expect(relay200.taskId).toBe('task-1');
    expect(relay200.agentId).toBe('worker-1');
    expect(relay200.status).toBe('done');
    expect(relay200.nextAction).toBe('Review the changes');
    expect(relay200.confidence).toBe(0.95);
  });

  it('condenses to 300-token relay with findings', () => {
    const summary = createNormalizedSummary({
      toolFindings: [
        {
          source: 'eslint',
          severity: 'high',
          code: 'ERR',
          message: 'Error found',
          fileRefs: ['src/a.ts'],
        },
        {
          source: 'secdev',
          severity: 'critical',
          code: 'SEC',
          message: 'Security issue',
          fileRefs: ['src/b.ts'],
        },
      ],
    });
    const { relay300 } = service.condense(summary);

    expect(relay300.version).toBe('relay.v1');
    expect(relay300.budget).toBe(300);
    expect(relay300.nextActions).toEqual(['Review the changes']);
    expect(relay300.topFindings.length).toBeGreaterThan(0);
    // Critical findings should be first
    expect(relay300.topFindings[0].severity).toBe('critical');
  });

  it('computes critical severity from findings', () => {
    const summary = createNormalizedSummary({
      toolFindings: [
        { source: 'secdev', severity: 'critical', code: 'X', message: 'X', fileRefs: [] },
      ],
    });
    const { relay200 } = service.condense(summary);
    expect(relay200.severity).toBe('critical');
  });

  it('computes medium severity for failed status', () => {
    const summary = createNormalizedSummary({ status: 'failed' });
    const { relay200 } = service.condense(summary);
    expect(relay200.severity).toBe('medium');
  });

  it('preserves critical fields in condensation', () => {
    const summary = createNormalizedSummary({
      taskId: 'preserve-me',
      agentId: 'worker-42',
      status: 'blocked',
      confidence: 0.3,
    });
    const { relay200, relay300 } = service.condense(summary);

    expect(relay200.taskId).toBe('preserve-me');
    expect(relay200.agentId).toBe('worker-42');
    expect(relay200.status).toBe('blocked');
    expect(relay200.confidence).toBe(0.3);

    expect(relay300.taskId).toBe('preserve-me');
    expect(relay300.agentId).toBe('worker-42');
  });

  it('limits touchedFiles in 200-token relay', () => {
    const summary = createNormalizedSummary({
      touchedFiles: Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`),
    });
    const { relay200 } = service.condense(summary);
    expect(relay200.touchedFiles.length).toBeLessThanOrEqual(5);
  });
});
