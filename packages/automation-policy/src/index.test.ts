// Tests for automation-policy

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPolicyEvaluator } from '../src/index';
import type { ToolExecutionResult, EnforcementPolicy } from '@openclaw/automation-core';
import { DEFAULT_ENFORCEMENT_POLICY } from '@openclaw/automation-core';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const createMockResult = (tool: string, status: string, blockerCount = 0, warningCount = 0): ToolExecutionResult => ({
  tool: tool as any,
  mode: 'changed_file' as const,
  status: status as any,
  durationMs: 100,
  exitCode: status === 'passed' ? 0 : 1,
  target: { files: [], packages: [], patterns: [] },
  blockerCount,
  warningCount,
  issues: [],
  retryCount: 0,
  timestamp: new Date().toISOString(),
});

describe('PolicyEvaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('evaluate', () => {
    it('returns canProceed when no blockers', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const results = [
        createMockResult('prettier', 'passed'),
        createMockResult('eslint', 'passed'),
        createMockResult('tsc', 'passed'),
      ];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(true);
      expect(decision.blockingTools).toHaveLength(0);
    });

    it('returns cannotProceed when eslint fails', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const results = [
        createMockResult('prettier', 'passed'),
        createMockResult('eslint', 'failed', 1),
        createMockResult('tsc', 'passed'),
      ];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(false);
      expect(decision.blockingTools).toContain('eslint');
    });

    it('returns cannotProceed when tsc fails', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const results = [
        createMockResult('prettier', 'passed'),
        createMockResult('tsc', 'failed', 1),
      ];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(false);
      expect(decision.blockingTools).toContain('tsc');
    });

    it('records warnings from prettier', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const results = [
        createMockResult('prettier', 'partial', 0, 3),
        createMockResult('eslint', 'passed'),
      ];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(true);
      expect(decision.warningTools).toContain('prettier');
    });

    it('skips tools not in allowed mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const results = [
        createMockResult('knip', 'skipped'),
        createMockResult('eslint', 'passed'),
      ];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(true);
    });
  });

  describe('isToolRequired', () => {
    it('returns true for eslint in changed_file mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.isToolRequired('eslint', 'changed_file')).toBe(true);
    });

    it('returns false for knip in changed_file mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.isToolRequired('knip', 'changed_file')).toBe(false);
    });

    it('returns true for knip in checkpoint mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.isToolRequired('knip', 'checkpoint')).toBe(true);
    });
  });

  describe('getRequiredTools', () => {
    it('returns required tools for changed_file mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const required = evaluator.getRequiredTools('changed_file');
      expect(required).toContain('eslint');
      expect(required).toContain('tsc');
      expect(required).not.toContain('knip');
    });

    it('returns required tools for checkpoint mode', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      const required = evaluator.getRequiredTools('checkpoint');
      expect(required).toContain('knip');
    });
  });

  describe('shouldRetry', () => {
    it('returns true when under max retries', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.shouldRetry('eslint', 0)).toBe(true);
      expect(evaluator.shouldRetry('eslint', 1)).toBe(true);
    });

    it('returns false when at max retries', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.shouldRetry('eslint', 2)).toBe(false);
    });

    it('returns false for tools not in policy', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.shouldRetry('gitnexus', 0)).toBe(false);
    });
  });

  describe('getTimeout', () => {
    it('returns configured timeout per tool', () => {
      const evaluator = createPolicyEvaluator(mockLogger as any);
      expect(evaluator.getTimeout('eslint')).toBe(60_000);
      expect(evaluator.getTimeout('tsc')).toBe(120_000);
      expect(evaluator.getTimeout('knip')).toBe(180_000);
    });
  });

  describe('with custom policy', () => {
    it('uses custom policy when provided', () => {
      const customPolicy: EnforcementPolicy = {
        ...DEFAULT_ENFORCEMENT_POLICY,
        eslint: {
          ...DEFAULT_ENFORCEMENT_POLICY.eslint,
          blockerOnFailure: false,
          warnOnFailure: true,
        },
      };

      const evaluator = createPolicyEvaluator(mockLogger as any, customPolicy);
      const results = [createMockResult('eslint', 'failed', 1)];

      const decision = evaluator.evaluate(results, 'changed_file');

      expect(decision.canProceed).toBe(true);
      expect(decision.warningTools).toContain('eslint');
    });
  });
});