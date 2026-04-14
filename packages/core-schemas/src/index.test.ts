import { describe, it, expect } from 'vitest';
import {
  RawAgentSummarySchema,
  CondensedRelay200Schema,
  OpenClawEventSchema,
  OpenClawConfigSchema,
} from './index';

describe('RawAgentSummarySchema', () => {
  it('validates a valid raw summary', () => {
    const valid = {
      taskId: 'task-1',
      agentId: 'worker-1',
      status: 'done',
      summary: 'Completed the task',
      touchedFiles: ['src/foo.ts'],
      blockers: [],
      nextActions: [],
      confidence: 0.95,
      timestamp: '2026-04-14T00:00:00Z',
    };
    const result = RawAgentSummarySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid confidence', () => {
    const invalid = {
      taskId: 'task-1',
      agentId: 'worker-1',
      status: 'done',
      summary: 'test',
      confidence: 1.5,
      timestamp: '2026-04-14T00:00:00Z',
    };
    const result = RawAgentSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects missing taskId', () => {
    const invalid = {
      agentId: 'worker-1',
      status: 'done',
      summary: 'test',
      confidence: 0.5,
      timestamp: '2026-04-14T00:00:00Z',
    };
    const result = RawAgentSummarySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('CondensedRelay200Schema', () => {
  it('validates a valid 200-token relay', () => {
    const valid = {
      version: 'relay.v1' as const,
      budget: 200 as const,
      taskId: 'task-1',
      agentId: 'worker-1',
      status: 'done' as const,
      summary: 'Task complete',
      touchedFiles: [],
      blockers: [],
      nextAction: null,
      severity: 'none' as const,
      confidence: 0.9,
    };
    const result = CondensedRelay200Schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects wrong budget value', () => {
    const invalid = {
      version: 'relay.v1',
      budget: 300,
      taskId: 'task-1',
      agentId: 'worker-1',
      status: 'done',
      summary: 'test',
      touchedFiles: [],
      blockers: [],
      nextAction: null,
      severity: 'none',
      confidence: 0.9,
    };
    const result = CondensedRelay200Schema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe('OpenClawEventSchema', () => {
  it('discriminates file.change.detected', () => {
    const event = {
      kind: 'file.change.detected' as const,
      files: ['src/a.ts'],
      packageNames: ['@openclaw/core-types'],
      timestamp: '2026-04-14T00:00:00Z',
    };
    const result = OpenClawEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('discriminates agent.summary.emitted', () => {
    const event = {
      kind: 'agent.summary.emitted' as const,
      raw: {
        taskId: 't1',
        agentId: 'w1',
        status: 'done',
        summary: 'done',
        touchedFiles: [],
        blockers: [],
        nextActions: [],
        confidence: 0.9,
        timestamp: '2026-04-14T00:00:00Z',
      },
      timestamp: '2026-04-14T00:00:00Z',
    };
    const result = OpenClawEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });
});

describe('OpenClawConfigSchema', () => {
  it('loads defaults from empty input', () => {
    const result = OpenClawConfigSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.orchestrator.maxConcurrentWorkers).toBe(4);
      expect(result.data.logging.level).toBe('info');
    }
  });

  it('accepts full config override', () => {
    const config = {
      workspace: '/app',
      orchestrator: { maxConcurrentWorkers: 8, relayBudget200: 250, relayBudget300: 350, retryAttempts: 5, retryDelayMs: 2000 },
      daemon: { watchPaths: ['/app/src'], debounceMs: 300 },
      tools: { gitnexus: { enabled: true }, secdev: { enabled: false }, eslint: { enabled: true }, prettier: { enabled: true } },
      audit: { storePath: '/tmp/audit', retentionDays: 7, deadLetterPath: '/tmp/dl' },
      logging: { level: 'debug', format: 'human' },
    };
    const result = OpenClawConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });
});
