// Result normalization and summary condensation
// Converts tool execution results into compact agent-readable summaries

import { Logger } from '@openclaw/core-logging';
import type {
  AutomationRun,
  ToolExecutionResult,
  CondensedAgentSummary,
  GitNexusContextSummary,
  RepoState,
  ToolIssue,
} from '@openclaw/automation-core';

export class ResultsNormalizer {
  constructor(_logger: Logger) {
    void _logger;
  }

  normalizeResult(result: ToolExecutionResult): ToolExecutionResult {
    return {
      ...result,
      issues: result.issues.map((issue) => this.normalizeIssue(issue)),
      stdout: result.stdout?.slice(0, 10000),
      stderr: result.stderr?.slice(0, 5000),
    };
  }

  private normalizeIssue(issue: ToolIssue): ToolIssue {
    return {
      ...issue,
      message: issue.message.trim().slice(0, 500),
      suggestion: issue.suggestion?.slice(0, 200),
    };
  }

  extractBlockers(results: ToolExecutionResult[]): ToolIssue[] {
    const blockers: ToolIssue[] = [];
    for (const result of results) {
      if (result.status === 'failed' || result.status === 'timed_out') {
        blockers.push(...result.issues.filter((i) => i.severity === 'blocker'));
      }
    }
    return blockers;
  }

  extractWarnings(results: ToolExecutionResult[]): ToolIssue[] {
    const warnings: ToolIssue[] = [];
    for (const result of results) {
      warnings.push(...result.issues.filter((i) => i.severity === 'warning'));
    }
    return warnings;
  }
}

export class SummaryCondenser {
  constructor(_logger: Logger) {
    void _logger;
  }

  condenseTo200(run: AutomationRun, gitNexusContext?: GitNexusContextSummary): CondensedAgentSummary {
    const blockers = this.extractBlockerSummaries(run.results);
    const warnings = this.extractWarningSummaries(run.results);
    const nextActions = this.buildNextActions(run.results, blockers);
    const repoState = this.determineRepoState(run);

    return {
      mode: run.mode,
      repoState,
      blockers: blockers.slice(0, 3),
      warnings: warnings.slice(0, 3),
      nextActions: nextActions.slice(0, 2),
      touchedAreas: gitNexusContext?.touchedAreas ?? this.extractTouchedAreas(run.results),
      tokenBudget: 200,
    };
  }

  condenseTo300(run: AutomationRun, gitNexusContext?: GitNexusContextSummary): CondensedAgentSummary {
    const blockers = this.extractBlockerSummaries(run.results);
    const warnings = this.extractWarningSummaries(run.results);
    const nextActions = this.buildNextActions(run.results, blockers);
    const repoState = this.determineRepoState(run);

    return {
      mode: run.mode,
      repoState,
      blockers: blockers.slice(0, 5),
      warnings: warnings.slice(0, 5),
      nextActions: nextActions.slice(0, 3),
      touchedAreas: gitNexusContext?.touchedAreas ?? this.extractTouchedAreas(run.results),
      tokenBudget: 300,
    };
  }

  buildRepairInstructions(run: AutomationRun): string[] {
    const instructions: string[] = [];

    for (const result of run.results) {
      if (result.status === 'failed' || result.status === 'timed_out') {
        const blockerIssues = result.issues.filter((i) => i.severity === 'blocker');
        for (const issue of blockerIssues) {
          const location = issue.file ? `${issue.file}${issue.line ? `:${issue.line}` : ''}` : '';
          const suggestion = issue.suggestion ? ` (${issue.suggestion})` : '';
          instructions.push(`[${result.tool}] ${issue.message}${location}${suggestion}`);
        }
      }
    }

    return instructions;
  }

  private extractBlockerSummaries(results: ToolExecutionResult[]): string[] {
    const blockers: string[] = [];
    for (const result of results) {
      if (result.blockerCount > 0) {
        const topIssue = result.issues.find((i) => i.severity === 'blocker');
        if (topIssue) {
          const location = topIssue.file ? ` in ${topIssue.file}` : '';
          blockers.push(`${result.tool}: ${topIssue.message}${location}`);
        } else {
          blockers.push(`${result.tool}: ${result.blockerCount} blocker(s)`);
        }
      }
    }
    return blockers;
  }

  private extractWarningSummaries(results: ToolExecutionResult[]): string[] {
    const warnings: string[] = [];
    for (const result of results) {
      if (result.warningCount > 0) {
        warnings.push(`${result.tool}: ${result.warningCount} warning(s)`);
      }
    }
    return warnings;
  }

  private buildNextActions(results: ToolExecutionResult[], blockers: string[]): string[] {
    if (blockers.length === 0) {
      return ['Continue to next task'];
    }

    const actions: string[] = [];
    const failedTools = results.filter((r) => r.status === 'failed').map((r) => r.tool);

    if (failedTools.includes('eslint')) {
      actions.push('Fix ESLint errors in changed files');
    }
    if (failedTools.includes('tsc')) {
      actions.push('Fix TypeScript type errors');
    }
    if (failedTools.includes('prettier')) {
      actions.push('Run prettier to fix formatting');
    }
    if (failedTools.includes('knip')) {
      actions.push('Remove unused code/dependencies flagged by knip');
    }

    if (actions.length === 0) {
      actions.push('Review blocker details and fix accordingly');
    }

    return actions;
  }

  private determineRepoState(run: AutomationRun): RepoState {
    const failedCount = run.results.filter((r) => r.status === 'failed').length;
    const totalCount = run.results.filter((r) => r.status !== 'skipped').length;

    if (totalCount === 0) return 'stable';

    const failureRatio = failedCount / totalCount;

    if (failureRatio >= 0.5) return 'drifting';
    if (failureRatio >= 0.25) return 'repairing';
    return 'stable';
  }

  private extractTouchedAreas(results: ToolExecutionResult[]): string[] {
    const areas = new Set<string>();

    for (const result of results) {
      for (const file of result.target.files) {
        const parts = file.split('/');
        if (parts.length >= 2) {
          areas.add(`${parts[0]}/${parts[1]}`);
        } else {
          areas.add(parts[0]);
        }
      }
    }

    return Array.from(areas).slice(0, 10);
  }
}

export const createResultsNormalizer = (logger: Logger): ResultsNormalizer => {
  return new ResultsNormalizer(logger);
};

export const createSummaryCondenser = (logger: Logger): SummaryCondenser => {
  return new SummaryCondenser(logger);
};