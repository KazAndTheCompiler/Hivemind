// Tests for automation-runner

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationRunner, LocalToolAdapterRegistry } from '../src/index';
import type { ToolAdapter, EnforcementPolicy, ToolExecutionTarget } from '@openclaw/automation-core';
import { DEFAULT_ENFORCEMENT_POLICY } from '@openclaw/automation-core';

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

const createMockAdapter = (name: string, supportedModes: string[] = ['changed_file', 'checkpoint', 'full_repo']): ToolAdapter => ({
  name: name as any,
  supportedModes: supportedModes as any,
  buildCommand: vi.fn().mockReturnValue(['echo', name]),
  normalizeResult: vi.fn().mockReturnValue({
    tool: name,
    mode: 'changed_file',
    status: 'passed',
    durationMs: 100,
    exitCode: 0,
    target: { files: [], packages: [], patterns: [] },
    blockerCount: 0,
    warningCount: 0,
    issues: [],
    retryCount: 0,
    timestamp: new Date().toISOString(),
  }),
});

describe('LocalToolAdapterRegistry', () => {
  it('registers and retrieves adapters', () => {
    const registry = new LocalToolAdapterRegistry();
    const adapter = createMockAdapter('prettier');
    registry.register(adapter);
    expect(registry.get('prettier')).toBe(adapter);
  });

  it('returns undefined for unknown tool', () => {
    const registry = new LocalToolAdapterRegistry();
    expect(registry.get('unknown')).toBeUndefined();
  });

  it('lists all registered adapters', () => {
    const registry = new LocalToolAdapterRegistry();
    registry.register(createMockAdapter('prettier'));
    registry.register(createMockAdapter('eslint'));
    const tools = registry.list();
    expect(tools).toHaveLength(2);
  });
});

describe('AutomationRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs fast loop with registered tools', async () => {
    const registry = new LocalToolAdapterRegistry();
    registry.register(createMockAdapter('prettier'));
    registry.register(createMockAdapter('eslint'));

    const runner = new AutomationRunner(mockLogger as any, registry);
    const target: ToolExecutionTarget = {
      files: ['src/index.ts'],
      packages: [],
      patterns: [],
    };

    const run = await runner.runFastLoop(target, DEFAULT_ENFORCEMENT_POLICY);

    expect(run.mode).toBe('changed_file');
    expect(run.results).toHaveLength(2);
    expect(run.decision).toBeDefined();
    expect(mockLogger.info).toHaveBeenCalled();
  });

  it('runs checkpoint loop', async () => {
    const registry = new LocalToolAdapterRegistry();
    registry.register(createMockAdapter('prettier'));
    registry.register(createMockAdapter('eslint'));
    registry.register(createMockAdapter('tsc'));
    registry.register(createMockAdapter('knip'));

    const runner = new AutomationRunner(mockLogger as any, registry);
    const target: ToolExecutionTarget = {
      files: [],
      packages: [],
      patterns: [],
    };

    const run = await runner.runCheckpoint(target, DEFAULT_ENFORCEMENT_POLICY);

    expect(run.mode).toBe('checkpoint');
  });

  it('runs full repo loop', async () => {
    const registry = new LocalToolAdapterRegistry();
    registry.register(createMockAdapter('prettier'));

    const runner = new AutomationRunner(mockLogger as any, registry);
    const target: ToolExecutionTarget = {
      files: [],
      packages: [],
      patterns: ['**/*.ts'],
    };

    const run = await runner.runFullRepo(target, DEFAULT_ENFORCEMENT_POLICY);

    expect(run.mode).toBe('full_repo');
  });

  it('excludes tools not supported in mode', async () => {
    const registry = new LocalToolAdapterRegistry();
    const knipAdapter = createMockAdapter('knip', ['checkpoint', 'full_repo']);
    registry.register(knipAdapter);

    const runner = new AutomationRunner(mockLogger as any, registry);
    const target: ToolExecutionTarget = {
      files: ['src/index.ts'],
      packages: [],
      patterns: [],
    };

    const run = await runner.runFastLoop(target, DEFAULT_ENFORCEMENT_POLICY);

    const knipResult = run.results.find((r) => r.tool === 'knip');
    expect(knipResult).toBeUndefined();
  });

  it('generates unique run IDs', async () => {
    const registry = new LocalToolAdapterRegistry();
    registry.register(createMockAdapter('prettier'));

    const runner = new AutomationRunner(mockLogger as any, registry);
    const target: ToolExecutionTarget = {
      files: [],
      packages: [],
      patterns: [],
    };

    const run1 = await runner.runFastLoop(target, DEFAULT_ENFORCEMENT_POLICY);
    const run2 = await runner.runFastLoop(target, DEFAULT_ENFORCEMENT_POLICY);

    expect(run1.id).not.toBe(run2.id);
  });
});