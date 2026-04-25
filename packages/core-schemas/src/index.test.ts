import { describe, it, expect } from 'vitest';
import {
  RawAgentSummarySchema,
  CondensedRelay200Schema,
  OpenClawEventSchema,
  OpenClawConfigSchema,
  HivemindStateBusSchema,
  HivemindSupervisorVerdictSchema,
  HivemindBuilderProgressSchema,
  HivemindReducerPacketSchema,
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
      schemaVersion: 'v1' as const,
      sequence: 1,
      streamId: 'test',
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
      schemaVersion: 'v1' as const,
      sequence: 1,
      streamId: 'test',
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

describe('Hivemind v2 typed-state schemas', () => {
  it('validates a progress-aware state bus draft', () => {
    const stateBus = {
      task: [],
      code: [],
      ownership: [],
      quality: [],
      security: [],
      progress: [
        {
          id: 'sig-1',
          taskId: 'task-1',
          domain: 'progress',
          kind: 'builder.progress',
          source: 'builder',
          ts: '2026-04-22T14:00:00Z',
          value: {
            taskId: 'task-1',
            phase: 'implementation',
            done: ['added draft schema types'],
            blockers: [],
            touchedFiles: ['packages/core-types/src/index.ts'],
            proposedNext: ['add zod schemas'],
            needsReview: false,
            evidence: ['diff:packages/core-types/src/index.ts'],
            supervisorOptions: [],
          },
          refs: ['packages/core-types/src/index.ts'],
          evidence: ['diff:packages/core-types/src/index.ts'],
        },
      ],
      review: [],
      meta: [],
    };

    expect(HivemindStateBusSchema.safeParse(stateBus).success).toBe(true);
  });

  it('validates supervisor verdict draft', () => {
    const verdict = {
      taskId: 'task-1',
      action: 'retry',
      confidence: 0.71,
      reasons: ['missing ownership evidence'],
      blockers: [],
      nextActions: ['attach gitnexus ownership signal'],
      rejectedSignals: ['sig-2'],
    };

    expect(HivemindSupervisorVerdictSchema.safeParse(verdict).success).toBe(true);
  });

  it('rejects blocked progress without blocker details only if schema shape is wrong', () => {
    const invalid = {
      taskId: 'task-1',
      phase: 'blocked',
      done: [],
      blockers: 'ownership unknown',
      touchedFiles: [],
      proposedNext: [],
      needsReview: true,
      evidence: [],
      supervisorOptions: [],
    };

    expect(HivemindBuilderProgressSchema.safeParse(invalid).success).toBe(false);
  });

  it('validates reducer packet draft', () => {
    const packet = {
      packetId: 'pkt-1',
      taskId: 'task-1',
      signalIds: ['sig-1', 'sig-2'],
      summary: ['builder updated typed-state drafts'],
      blockers: [],
      approvedFacts: ['changes limited to core-types and core-schemas'],
      conflicts: [],
      touchedFiles: ['packages/core-types/src/index.ts', 'packages/core-schemas/src/index.ts'],
      evidenceRefs: ['diff:core-types', 'diff:core-schemas'],
      supervisorOptions: [
        {
          id: 'sanitize-and-ship.trufflehog',
          stage: 'sanitize-and-ship',
          label: 'Run TruffleHog before push or release',
          tool: 'trufflehog',
          enabledByDefault: false,
          rationale: 'Optional pre-ship secret scan',
          command: ['trufflehog', 'git', 'file://.', '--results=verified,unknown', '--fail'],
          activationHints: ['Run before push'],
        },
      ],
      risk: 'medium',
      recommendedAction: 'accept',
    };

    expect(HivemindReducerPacketSchema.safeParse(packet).success).toBe(true);
  });
});
