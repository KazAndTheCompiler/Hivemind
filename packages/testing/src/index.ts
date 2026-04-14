// Test fixtures and helpers for OpenClaw packages

import type {
  RawAgentSummary,
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  ToolFinding,
} from '@openclaw/core-types';

export function createRawSummary(overrides: Partial<RawAgentSummary> = {}): RawAgentSummary {
  return {
    taskId: 'test-task-1',
    agentId: 'test-worker-1',
    status: 'done',
    summary: 'Task completed successfully',
    touchedFiles: ['src/test.ts'],
    blockers: [],
    nextActions: [],
    confidence: 0.95,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createNormalizedSummary(overrides: Partial<NormalizedAgentSummary> = {}): NormalizedAgentSummary {
  return {
    taskId: 'test-task-1',
    agentId: 'test-worker-1',
    status: 'done',
    conciseSummary: 'Task completed',
    touchedFiles: ['src/test.ts'],
    blockers: [],
    nextActions: [],
    confidence: 0.95,
    tags: [],
    toolFindings: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export function createRelay200(overrides: Partial<CondensedRelay200> = {}): CondensedRelay200 {
  return {
    version: 'relay.v1',
    budget: 200,
    taskId: 'test-task-1',
    agentId: 'test-worker-1',
    status: 'done',
    summary: 'Done',
    touchedFiles: [],
    blockers: [],
    nextAction: null,
    severity: 'none',
    confidence: 0.95,
    ...overrides,
  };
}

export function createRelay300(overrides: Partial<CondensedRelay300> = {}): CondensedRelay300 {
  return {
    version: 'relay.v1',
    budget: 300,
    taskId: 'test-task-1',
    agentId: 'test-worker-1',
    status: 'done',
    summary: 'Task completed',
    touchedFiles: ['src/test.ts'],
    blockers: [],
    nextActions: [],
    topFindings: [],
    severity: 'none',
    confidence: 0.95,
    ...overrides,
  };
}

export function createFinding(overrides: Partial<ToolFinding> = {}): ToolFinding {
  return {
    source: 'system',
    severity: 'info',
    code: 'TEST_FINDING',
    message: 'Test finding',
    fileRefs: [],
    ...overrides,
  };
}
