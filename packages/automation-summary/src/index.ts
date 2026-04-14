// Agent-facing summary emission
// Builds compact summaries for main agent handoff

import type {
  AutomationRun,
  GitNexusContextSummary,
} from '@openclaw/automation-core';

export interface SummaryEmitterOptions {
  includeRaw?: boolean;
  maxBlockers?: number;
  maxWarnings?: number;
}

export class SummaryEmitter {
  private options: Required<SummaryEmitterOptions>;

  constructor(options: SummaryEmitterOptions = {}) {
    this.options = {
      includeRaw: options.includeRaw ?? false,
      maxBlockers: options.maxBlockers ?? 5,
      maxWarnings: options.maxWarnings ?? 10,
    };
  }

  emitFastSummary(run: AutomationRun): string {
    const blockers = this.extractBlockers(run);
    const warnings = this.extractWarnings(run);

    if (blockers.length === 0) {
      return this.emitPassingSummary(run, warnings);
    }

    return this.emitFailingSummary(run, blockers, warnings);
  }

  emitCheckpointSummary(
    run: AutomationRun,
    gitNexusContext?: GitNexusContextSummary,
  ): string {
    const blockers = this.extractBlockers(run);
    const warnings = this.extractWarnings(run);
    const repoState = this.determineRepoState(run);

    let summary = `## Checkpoint Summary\n`;
    summary += `**Repo State:** ${repoState}\n`;
    summary += `**Mode:** ${run.mode}\n\n`;

    if (blockers.length > 0) {
      summary += `### Blockers (${blockers.length})\n`;
      for (const b of blockers.slice(0, this.options.maxBlockers)) {
        summary += `- ${b}\n`;
      }
    }

    if (warnings.length > 0) {
      summary += `\n### Warnings (${warnings.length})\n`;
      for (const w of warnings.slice(0, this.options.maxWarnings)) {
        summary += `- ${w}\n`;
      }
    }

    if (gitNexusContext) {
      summary += `\n### Context\n`;
      if (gitNexusContext.touchedAreas.length > 0) {
        summary += `**Touched Areas:** ${gitNexusContext.touchedAreas.join(', ')}\n`;
      }
      if (gitNexusContext.hotspots.length > 0) {
        summary += `**Hotspots:** ${gitNexusContext.hotspots.join(', ')}\n`;
      }
    }

    return summary;
  }

  emitFullRepoSummary(run: AutomationRun): string {
    const repoState = this.determineRepoState(run);

    let summary = `## Full Repo Validation\n`;
    summary += `**Repo State:** ${repoState}\n`;
    summary += `**Duration:** ${this.formatDuration(run)}\n\n`;

    for (const result of run.results) {
      const icon = result.status === 'passed' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌';
      summary += `${icon} **${result.tool}**: ${result.status}`;
      if (result.blockerCount > 0) summary += ` (${result.blockerCount} blockers)`;
      if (result.warningCount > 0) summary += ` (${result.warningCount} warnings)`;
      summary += '\n';
    }

    return summary;
  }

  private emitPassingSummary(run: AutomationRun, warnings: string[]): string {
    let summary = `✅ All checks passed`;
    if (warnings.length > 0) {
      summary += ` (${warnings.length} warnings)`;
    }
    summary += `\nMode: ${run.mode}`;
    return summary;
  }

  private emitFailingSummary(_run: AutomationRun, blockers: string[], warnings: string[]): string {
    let summary = `❌ Blocked: ${blockers.length} issue(s)\n`;
    for (const b of blockers.slice(0, this.options.maxBlockers)) {
      summary += `- ${b}\n`;
    }
    if (warnings.length > 0) {
      summary += `\n⚠️ ${warnings.length} warning(s)`;
    }
    return summary;
  }

  private extractBlockers(run: AutomationRun): string[] {
    const blockers: string[] = [];
    for (const result of run.results) {
      if (result.blockerCount > 0) {
        for (const issue of result.issues.filter((i) => i.severity === 'blocker')) {
          const location = issue.file ? ` at ${issue.file}` : '';
          blockers.push(`${result.tool}: ${issue.message}${location}`);
        }
      }
    }
    return blockers;
  }

  private extractWarnings(run: AutomationRun): string[] {
    const warnings: string[] = [];
    for (const result of run.results) {
      if (result.warningCount > 0) {
        warnings.push(`${result.tool}: ${result.warningCount} warning(s)`);
      }
    }
    return warnings;
  }

  private determineRepoState(run: AutomationRun): 'stable' | 'repairing' | 'drifting' {
    const failed = run.results.filter((r) => r.status === 'failed').length;
    const total = run.results.filter((r) => r.status !== 'skipped').length;
    if (total === 0) return 'stable';
    const ratio = failed / total;
    if (ratio >= 0.5) return 'drifting';
    if (ratio >= 0.25) return 'repairing';
    return 'stable';
  }

  private formatDuration(run: AutomationRun): string {
    if (!run.completedAt) return 'in progress';
    const start = new Date(run.startedAt).getTime();
    const end = new Date(run.completedAt).getTime();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

export const createSummaryEmitter = (options?: SummaryEmitterOptions): SummaryEmitter => {
  return new SummaryEmitter(options);
};