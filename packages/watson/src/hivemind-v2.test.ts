import { describe, expect, it } from 'vitest';
import type { NormalizedAgentSummary } from '@openclaw/core-types';
import {
  buildBuilderProgress,
  buildProgressSignal,
  buildReducedStatePacket,
  buildReducerPacket,
} from './hivemind-v2';

function createNormalizedSummary(
  overrides: Partial<NormalizedAgentSummary> = {},
): NormalizedAgentSummary {
  return {
    taskId: 'task-42',
    agentId: 'builder-1',
    status: 'done',
    conciseSummary: 'Implemented the bounded change and verified the result',
    touchedFiles: ['src/foo.ts', 'src/bar.ts'],
    blockers: [],
    nextActions: ['Supervisor review'],
    confidence: 0.92,
    tags: ['bounded', 'verified'],
    toolFindings: [
      {
        source: 'eslint',
        severity: 'low',
        code: 'clean',
        message: 'Lint passed',
        fileRefs: ['src/foo.ts'],
      },
    ],
    timestamp: '2026-04-22T14:00:00.000Z',
    ...overrides,
  };
}

describe('hivemind v2 watson bridge', () => {
  it('builds builder progress from a normalized summary', () => {
    const progress = buildBuilderProgress(createNormalizedSummary());

    expect(progress.phase).toBe('complete');
    expect(progress.done).toContain('Implemented the bounded change and verified the result');
    expect(progress.touchedFiles).toEqual(['src/foo.ts', 'src/bar.ts']);
    expect(progress.proposedNext).toEqual(['Supervisor review']);
    expect(progress.needsReview).toBe(false);
    expect(progress.supervisorOptions[0]?.tool).toBe('trufflehog');
    expect(progress.supervisorOptions[0]?.enabledByDefault).toBe(false);
  });

  it('builds a progress signal with evidence and refs', () => {
    const signal = buildProgressSignal(createNormalizedSummary());

    expect(signal.domain).toBe('progress');
    expect(signal.kind).toBe('builder.progress');
    expect(signal.refs).toContain('src/foo.ts');
    expect(signal.evidence?.some((entry) => entry.includes('eslint:clean'))).toBe(true);
  });

  it('builds a reduced packet for supervisor intake', () => {
    const packet = buildReducedStatePacket(createNormalizedSummary());

    expect(packet.taskId).toBe('task-42');
    expect(packet.summary[0]).toContain('Implemented the bounded change');
    expect(packet.approvedFacts).toContain('status:done');
    expect(packet.touchedFiles).toEqual(['src/foo.ts', 'src/bar.ts']);
    expect(packet.supervisorOptions[0]?.stage).toBe('sanitize-and-ship');
    expect(packet.risk).toBe('low');
  });

  it('recommends retry when blocked progress exists', () => {
    const reducerPacket = buildReducerPacket(
      createNormalizedSummary({
        status: 'blocked',
        blockers: ['Missing ownership approval for src/baz.ts'],
        nextActions: ['Request ownership decision'],
      }),
    );

    expect(reducerPacket.blockers).toContain('Missing ownership approval for src/baz.ts');
    expect(reducerPacket.recommendedAction).toBe('retry');
    expect(reducerPacket.risk).toBe('high');
    expect(reducerPacket.supervisorOptions).toEqual([]);
  });
});
