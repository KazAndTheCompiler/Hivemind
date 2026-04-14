// Tests for automation-core types and schemas

import { describe, it, expect } from 'vitest';
import {
  AutomationModeSchema,
  ToolNameSchema,
  EnforcementSeveritySchema,
  EnforcementStatusSchema,
  ToolExecutionTargetSchema,
  ToolIssueSchema,
  ToolExecutionResultSchema,
  EnforcementDecisionSchema,
  CondensedAgentSummarySchema,
  GitNexusContextSummarySchema,
  DEFAULT_ENFORCEMENT_POLICY,
  RepoStateSchema,
} from '../src/index';

describe('AutomationModeSchema', () => {
  it('accepts valid modes', () => {
    expect(AutomationModeSchema.parse('changed_file')).toBe('changed_file');
    expect(AutomationModeSchema.parse('checkpoint')).toBe('checkpoint');
    expect(AutomationModeSchema.parse('full_repo')).toBe('full_repo');
  });

  it('rejects invalid modes', () => {
    expect(() => AutomationModeSchema.parse('invalid')).toThrow();
  });
});

describe('ToolNameSchema', () => {
  it('accepts valid tool names', () => {
    expect(ToolNameSchema.parse('prettier')).toBe('prettier');
    expect(ToolNameSchema.parse('eslint')).toBe('eslint');
    expect(ToolNameSchema.parse('tsc')).toBe('tsc');
    expect(ToolNameSchema.parse('knip')).toBe('knip');
    expect(ToolNameSchema.parse('gitnexus')).toBe('gitnexus');
  });

  it('rejects invalid tool names', () => {
    expect(() => ToolNameSchema.parse('invalid')).toThrow();
  });
});

describe('EnforcementSeveritySchema', () => {
  it('accepts valid severities', () => {
    expect(EnforcementSeveritySchema.parse('info')).toBe('info');
    expect(EnforcementSeveritySchema.parse('warning')).toBe('warning');
    expect(EnforcementSeveritySchema.parse('blocker')).toBe('blocker');
  });
});

describe('EnforcementStatusSchema', () => {
  it('accepts valid statuses', () => {
    expect(EnforcementStatusSchema.parse('passed')).toBe('passed');
    expect(EnforcementStatusSchema.parse('failed')).toBe('failed');
    expect(EnforcementStatusSchema.parse('partial')).toBe('partial');
    expect(EnforcementStatusSchema.parse('skipped')).toBe('skipped');
    expect(EnforcementStatusSchema.parse('timed_out')).toBe('timed_out');
  });
});

describe('ToolExecutionTargetSchema', () => {
  it('accepts valid target', () => {
    const target = {
      files: ['src/index.ts'],
      packages: ['@openclaw/core'],
      patterns: ['**/*.ts'],
    };
    expect(ToolExecutionTargetSchema.parse(target)).toEqual(target);
  });

  it('accepts empty target', () => {
    expect(ToolExecutionTargetSchema.parse({ files: [], packages: [], patterns: [] })).toEqual({
      files: [],
      packages: [],
      patterns: [],
    });
  });
});

describe('ToolIssueSchema', () => {
  it('accepts valid issue', () => {
    const issue = {
      tool: 'eslint' as const,
      severity: 'blocker' as const,
      ruleId: 'no-unused-vars',
      file: 'src/index.ts',
      message: 'Unused variable',
      line: 10,
      column: 5,
    };
    expect(ToolIssueSchema.parse(issue)).toEqual(issue);
  });

  it('accepts minimal issue', () => {
    const issue = {
      tool: 'prettier' as const,
      severity: 'warning' as const,
      message: 'Formatting issue',
    };
    expect(ToolIssueSchema.parse(issue)).toEqual(issue);
  });
});

describe('ToolExecutionResultSchema', () => {
  it('accepts valid result', () => {
    const result = {
      tool: 'tsc' as const,
      mode: 'changed_file' as const,
      status: 'passed' as const,
      durationMs: 1500,
      exitCode: 0,
      target: { files: ['src/index.ts'], packages: [], patterns: [] },
      blockerCount: 0,
      warningCount: 0,
      issues: [],
      retryCount: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    expect(ToolExecutionResultSchema.parse(result)).toEqual(result);
  });

  it('accepts result with issues', () => {
    const result = {
      tool: 'eslint' as const,
      mode: 'changed_file' as const,
      status: 'failed' as const,
      durationMs: 500,
      exitCode: 1,
      target: { files: ['src/index.ts'], packages: [], patterns: [] },
      blockerCount: 1,
      warningCount: 2,
      issues: [
        {
          tool: 'eslint' as const,
          severity: 'blocker' as const,
          ruleId: 'no-unused-vars',
          message: 'Unused variable',
        },
      ],
      retryCount: 0,
      timestamp: '2024-01-01T00:00:00.000Z',
    };
    expect(ToolExecutionResultSchema.parse(result)).toEqual(result);
  });
});

describe('EnforcementDecisionSchema', () => {
  it('accepts proceed decision', () => {
    const decision = {
      canProceed: true,
      blockingTools: [],
      warningTools: ['prettier'],
      rationale: 'No blocking failures',
    };
    expect(EnforcementDecisionSchema.parse(decision)).toEqual(decision);
  });

  it('accepts blocked decision', () => {
    const decision = {
      canProceed: false,
      blockingTools: ['eslint', 'tsc'],
      warningTools: ['prettier'],
      rationale: 'Blocked by: eslint, tsc',
    };
    expect(EnforcementDecisionSchema.parse(decision)).toEqual(decision);
  });
});

describe('CondensedAgentSummarySchema', () => {
  it('accepts valid summary with 200 token budget', () => {
    const summary = {
      mode: 'changed_file' as const,
      repoState: 'stable' as const,
      blockers: [],
      warnings: [],
      nextActions: ['Continue to next task'],
      touchedAreas: ['packages/core'],
      tokenBudget: 200 as const,
    };
    expect(CondensedAgentSummarySchema.parse(summary)).toEqual(summary);
  });

  it('accepts summary with blockers', () => {
    const summary = {
      mode: 'checkpoint' as const,
      repoState: 'repairing' as const,
      blockers: ['eslint: Fix unused variables', 'tsc: Type error at line 10'],
      warnings: ['prettier: 2 formatting issues'],
      nextActions: ['Fix ESLint errors', 'Run typecheck'],
      touchedAreas: ['packages/automation-core'],
      tokenBudget: 300 as const,
    };
    expect(CondensedAgentSummarySchema.parse(summary)).toEqual(summary);
  });
});

describe('GitNexusContextSummarySchema', () => {
  it('accepts valid context summary', () => {
    const context = {
      touchedAreas: ['packages/core', 'packages/automation-core'],
      hotspots: ['packages/core/src/index.ts'],
      architecturalNotes: ['Monorepo structure stable'],
      suspectedRisks: [],
      summary: 'Codebase is healthy',
    };
    expect(GitNexusContextSummarySchema.parse(context)).toEqual(context);
  });
});

describe('RepoStateSchema', () => {
  it('accepts valid repo states', () => {
    expect(RepoStateSchema.parse('stable')).toBe('stable');
    expect(RepoStateSchema.parse('repairing')).toBe('repairing');
    expect(RepoStateSchema.parse('drifting')).toBe('drifting');
  });

  it('rejects invalid repo states', () => {
    expect(() => RepoStateSchema.parse('invalid')).toThrow();
  });
});

describe('DEFAULT_ENFORCEMENT_POLICY', () => {
  it('has required tools configured', () => {
    expect(DEFAULT_ENFORCEMENT_POLICY.prettier).toBeDefined();
    expect(DEFAULT_ENFORCEMENT_POLICY.eslint).toBeDefined();
    expect(DEFAULT_ENFORCEMENT_POLICY.tsc).toBeDefined();
    expect(DEFAULT_ENFORCEMENT_POLICY.knip).toBeDefined();
    expect(DEFAULT_ENFORCEMENT_POLICY.gitnexus).toBeDefined();
  });

  it('has failClosed enabled', () => {
    expect(DEFAULT_ENFORCEMENT_POLICY.failClosed).toBe(true);
  });

  it('eslint and tsc are blockers', () => {
    expect(DEFAULT_ENFORCEMENT_POLICY.eslint.blockerOnFailure).toBe(true);
    expect(DEFAULT_ENFORCEMENT_POLICY.tsc.blockerOnFailure).toBe(true);
  });

  it('prettier only warns on failure', () => {
    expect(DEFAULT_ENFORCEMENT_POLICY.prettier.blockerOnFailure).toBe(false);
    expect(DEFAULT_ENFORCEMENT_POLICY.prettier.warnOnFailure).toBe(true);
  });

  it('knip only runs on checkpoint and full_repo', () => {
    expect(DEFAULT_ENFORCEMENT_POLICY.knip.allowedModes).toEqual(['checkpoint', 'full_repo']);
  });
});