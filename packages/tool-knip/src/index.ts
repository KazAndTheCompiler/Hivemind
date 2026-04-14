// Knip unused code detector adapter for automation enforcement
// Detects unused files, exports, dependencies, and stale code paths
// Implements ToolAdapter interface from automation-core

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import { Logger } from '@openclaw/core-logging';
import type {
  ToolAdapter,
  ToolName,
  AutomationMode,
  ToolExecutionTarget,
  ToolExecutionResult,
  ToolIssue,
  EnforcementStatus,
} from '@openclaw/automation-core';

interface KnipJsonOutput {
  files?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  exports?: string[];
  types?: string[];
  issues?: Array<{
    file?: string;
    symbol?: string;
    type?: string;
    message: string;
  }>;
}

export class KnipAdapter implements ToolAdapter {
  readonly name: ToolName = 'knip';
  readonly supportedModes: AutomationMode[] = ['checkpoint', 'full_repo'];

  private logger: Logger;
  private cwd: string;

  constructor(logger: Logger, options?: { cwd?: string }) {
    this.logger = logger.child({ service: 'KnipAdapter' });
    this.cwd = options?.cwd ?? process.cwd();
  }

  buildCommand(_target: ToolExecutionTarget, mode: AutomationMode): string[] {
    const args = ['npx', 'knip'];

    if (mode === 'checkpoint') {
      args.push('--include', 'files,dependencies,exports');
    }

    args.push('--format', 'json', '--no-exit-code');

    return args;
  }

  async execute(
    target: ToolExecutionTarget,
    mode: AutomationMode,
    timeoutMs = 180_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const cmd = this.buildCommand(target, mode);

    this.logger.debug('knip.execute.start', {
      cmd,
      mode,
    });

    try {
      const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), {
        cwd: this.cwd,
        timeout: timeoutMs,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err) {
      const nodeErr = err as { code?: string | number; message: string; stderr?: string };
      const code = nodeErr.code;
      const isTimedOut = code === 'ETIMEDOUT' || code === 'ETIME' || nodeErr.message.includes('timed out');
      if (isTimedOut) {
        return { stdout: '', stderr: 'knip timed out', exitCode: null };
      }
      return { stdout: '', stderr: nodeErr.stderr ?? nodeErr.message, exitCode: typeof code === 'number' ? code : null };
    }
  }

  normalizeResult(
    stdout: string,
    stderr: string,
    exitCode: number | null,
    durationMs: number,
    target: ToolExecutionTarget,
    mode: AutomationMode,
    retryCount: number,
  ): ToolExecutionResult {
    const issues = this.parseKnipOutput(stdout, stderr);
    const blockerCount = issues.filter((i) => i.severity === 'blocker').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    let status: EnforcementStatus;
    if (exitCode === null) {
      status = 'timed_out';
    } else if (exitCode === 0 && issues.length === 0) {
      status = 'passed';
    } else if (issues.some((i) => i.severity === 'blocker')) {
      status = 'failed';
    } else if (issues.length > 0) {
      status = 'partial';
    } else {
      status = 'passed';
    }

    return {
      tool: 'knip',
      mode,
      status,
      durationMs,
      exitCode,
      target,
      blockerCount,
      warningCount,
      issues,
      stdout: stdout.slice(0, 5000),
      stderr: stderr.slice(0, 5000),
      retryCount,
      timestamp: new Date().toISOString(),
    };
  }

  private parseKnipOutput(stdout: string, stderr: string): ToolIssue[] {
    const issues: ToolIssue[] = [];

    if (!stdout.trim()) {
      return issues;
    }

    try {
      const data: KnipJsonOutput = JSON.parse(stdout);

      if (data.files) {
        for (const file of data.files) {
          issues.push({
            tool: 'knip',
            severity: 'warning',
            ruleId: 'unused-file',
            file,
            message: `Unused file: ${file}`,
          });
        }
      }

      if (data.dependencies) {
        for (const dep of data.dependencies) {
          issues.push({
            tool: 'knip',
            severity: 'blocker',
            ruleId: 'unused-dependency',
            message: `Unused dependency: ${dep}`,
          });
        }
      }

      if (data.devDependencies) {
        for (const dep of data.devDependencies) {
          issues.push({
            tool: 'knip',
            severity: 'warning',
            ruleId: 'unused-dev-dependency',
            message: `Unused dev dependency: ${dep}`,
          });
        }
      }

      if (data.exports) {
        for (const exp of data.exports) {
          issues.push({
            tool: 'knip',
            severity: 'warning',
            ruleId: 'unused-export',
            message: `Unused export: ${exp}`,
          });
        }
      }

      if (data.issues) {
        for (const issue of data.issues) {
          issues.push({
            tool: 'knip',
            severity: 'warning',
            file: issue.file,
            symbol: issue.symbol,
            message: issue.message,
          });
        }
      }
    } catch {
      if (stderr.trim()) {
        issues.push({
          tool: 'knip',
          severity: 'warning',
          message: `Failed to parse knip output: ${stderr.slice(0, 200)}`,
        });
      }
    }

    return issues;
  }
}

export const createKnipAdapter = (logger: Logger, options?: { cwd?: string }): ToolAdapter => {
  return new KnipAdapter(logger, options);
};