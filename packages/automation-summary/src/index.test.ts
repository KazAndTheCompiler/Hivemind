// Tests for automation-summary

import { describe, it, expect } from 'vitest';
import { SummaryEmitter, createSummaryEmitter } from '../src/index';
import type { AutomationRun } from '@openclaw/automation-core';

const createMockRun = (overrides: Partial<AutomationRun> = {}): AutomationRun => ({
  id: 'test-run',
  mode: 'changed_file',
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  results: [],
  decision: { canProceed: true, blockingTools: [], warningTools: [], rationale: 'No blocking failures' },
  ...overrides,
});

describe('SummaryEmitter', () => {
  describe('emitFastSummary', () => {
    it('emits passing summary when all pass', () => {
      const emitter = createSummaryEmitter();
      const run = createMockRun({
        results: [
          { tool: 'prettier', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] },
          { tool: 'eslint', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] },
        ],
      });

      const summary = emitter.emitFastSummary(run);

      expect(summary).toContain('All checks passed');
    });

    it('emits failing summary when blockers exist', () => {
      const emitter = createSummaryEmitter();
      const run = createMockRun({
        results: [
          {
            tool: 'eslint',
            status: 'failed',
            blockerCount: 1,
            issues: [{ tool: 'eslint', severity: 'blocker', message: 'Unused variable' }],
          },
        ],
        decision: { canProceed: false, blockingTools: ['eslint'], warningTools: [], rationale: 'Blocked' },
      });

      const summary = emitter.emitFastSummary(run);

      expect(summary).toContain('Blocked');
      expect(summary).toContain('eslint');
    });
  });

  describe('emitCheckpointSummary', () => {
    it('includes repo state', () => {
      const emitter = createSummaryEmitter();
      const run = createMockRun({
        mode: 'checkpoint',
        results: [{ tool: 'knip', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] }],
      });

      const summary = emitter.emitCheckpointSummary(run);

      expect(summary).toContain('Checkpoint Summary');
      expect(summary).toContain('stable');
    });

    it('includes GitNexus context when provided', () => {
      const emitter = createSummaryEmitter();
      const run = createMockRun({
        mode: 'checkpoint',
        results: [{ tool: 'knip', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] }],
      });

      const summary = emitter.emitCheckpointSummary(run, {
        touchedAreas: ['packages/core'],
        hotspots: ['packages/core/src/index.ts'],
        architecturalNotes: ['Well structured'],
        suspectedRisks: [],
        summary: 'Healthy codebase',
      });

      expect(summary).toContain('Touched Areas');
      expect(summary).toContain('packages/core');
    });
  });

  describe('emitFullRepoSummary', () => {
    it('shows all tool results with icons', () => {
      const emitter = createSummaryEmitter();
      const run = createMockRun({
        mode: 'full_repo',
        results: [
          { tool: 'prettier', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] },
          { tool: 'eslint', status: 'failed', blockerCount: 2, warningCount: 0, issues: [] },
          { tool: 'tsc', status: 'passed', blockerCount: 0, warningCount: 0, issues: [] },
        ],
      });

      const summary = emitter.emitFullRepoSummary(run);

      expect(summary).toContain('Full Repo Validation');
      expect(summary).toContain('✅');
      expect(summary).toContain('❌');
    });
  });

  describe('options', () => {
    it('respects maxBlockers option', () => {
      const emitter = createSummaryEmitter({ maxBlockers: 2 });
      const run = createMockRun({
        results: [
          {
            tool: 'eslint',
            status: 'failed',
            blockerCount: 5,
            issues: Array(5).fill(null).map((_, i) => ({
              tool: 'eslint',
              severity: 'blocker',
              message: `Error ${i}`,
            })),
          },
        ],
      });

      const summary = emitter.emitFailingSummary!(run, Array(5).fill('blocker'), []);

      expect(summary).toContain('5 issue(s)');
    });
  });
});