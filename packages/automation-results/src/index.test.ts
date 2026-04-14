// Tests for automation-results

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResultsNormalizer, createSummaryCondenser } from '../src/index';
import type { AutomationRun, ToolExecutionResult } from '@openclaw/automation-core';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const createMockResult = (tool: string, status: string, blockerCount = 0, warningCount = 0, files: string[] = [], issues: any[] = []): ToolExecutionResult => ({
  tool: tool as any,
  mode: 'changed_file' as const,
  status: status as any,
  durationMs: 100,
  exitCode: status === 'passed' ? 0 : 1,
  target: { files, packages: [], patterns: [] },
  blockerCount,
  warningCount,
  issues,
  retryCount: 0,
  timestamp: new Date().toISOString(),
});

const createMockRun = (results: ToolExecutionResult[]): AutomationRun => ({
  id: 'test-run',
  mode: 'changed_file',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  results,
  decision: {
    canProceed: true,
    blockingTools: [],
    warningTools: [],
    rationale: 'No blocking failures',
  },
  mutationCount: 5,
});

describe('ResultsNormalizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractBlockers', () => {
    it('extracts blockers from failed results with issues', () => {
      const normalizer = createResultsNormalizer(mockLogger as any);
      const run = createMockRun([
        createMockResult('eslint', 'failed', 2, 0, ['src/index.ts'], [
          { tool: 'eslint', severity: 'blocker', message: 'Error 1' },
          { tool: 'eslint', severity: 'blocker', message: 'Error 2' },
        ]),
      ]);

      const blockers = normalizer.extractBlockers(run.results);

      expect(blockers).toHaveLength(2);
      expect(blockers[0].message).toBe('Error 1');
    });

    it('returns empty for passed results', () => {
      const normalizer = createResultsNormalizer(mockLogger as any);
      const run = createMockRun([
        createMockResult('prettier', 'passed', 0, 0, [], []),
      ]);

      const blockers = normalizer.extractBlockers(run.results);

      expect(blockers).toHaveLength(0);
    });
  });

  describe('extractWarnings', () => {
    it('extracts warnings from results', () => {
      const normalizer = createResultsNormalizer(mockLogger as any);
      const run = createMockRun([
        createMockResult('prettier', 'passed', 0, 3, ['src/index.ts'], [
          { tool: 'prettier', severity: 'warning', message: 'Warning 1' },
          { tool: 'prettier', severity: 'warning', message: 'Warning 2' },
          { tool: 'prettier', severity: 'warning', message: 'Warning 3' },
        ]),
      ]);

      const warnings = normalizer.extractWarnings(run.results);

      expect(warnings).toHaveLength(3);
    });
  });
});

describe('SummaryCondenser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condenseTo200', () => {
    it('returns stable repo state when all pass', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('prettier', 'passed', 0, 0, ['src/index.ts'], []),
        createMockResult('eslint', 'passed', 0, 0, ['src/index.ts'], []),
      ]);

      const summary = condenser.condenseTo200(run);

      expect(summary.repoState).toBe('stable');
      expect(summary.tokenBudget).toBe(200);
    });

    it('returns drifting when majority fail', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('eslint', 'failed', 1, 0, ['src/index.ts'], [
          { tool: 'eslint', severity: 'blocker', message: 'Error' },
        ]),
        createMockResult('tsc', 'failed', 1, 0, ['src/index.ts'], [
          { tool: 'tsc', severity: 'blocker', message: 'Type error' },
        ]),
      ]);

      const summary = condenser.condenseTo200(run);

      expect(summary.repoState).toBe('drifting');
    });

    it('returns repairing when some fail', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('eslint', 'failed', 1, 0, ['src/index.ts'], [
          { tool: 'eslint', severity: 'blocker', message: 'Error' },
        ]),
        createMockResult('prettier', 'passed', 0, 0, ['src/index.ts'], []),
        createMockResult('tsc', 'passed', 0, 0, ['src/index.ts'], []),
      ]);

      const summary = condenser.condenseTo200(run);

      expect(summary.repoState).toBe('repairing');
    });
  });

  describe('buildRepairInstructions', () => {
    it('builds instructions for failed tools with issues', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('eslint', 'failed', 1, 0, ['src/index.ts'], [
          { tool: 'eslint', severity: 'blocker', message: 'Unused variable', file: 'src/index.ts' },
        ]),
      ]);

      const instructions = condenser.buildRepairInstructions(run);

      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions[0]).toContain('eslint');
    });

    it('returns empty instructions when no blockers', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('prettier', 'passed', 0, 0, ['src/index.ts'], []),
      ]);

      const instructions = condenser.buildRepairInstructions(run);

      expect(instructions).toHaveLength(0);
    });
  });

  describe('condenseTo300', () => {
    it('uses 300 token budget', () => {
      const condenser = createSummaryCondenser(mockLogger as any);
      const run = createMockRun([
        createMockResult('prettier', 'passed', 0, 0, ['src/index.ts'], []),
      ]);

      const summary = condenser.condenseTo300(run);

      expect(summary.tokenBudget).toBe(300);
    });
  });
});