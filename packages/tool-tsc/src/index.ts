// TypeScript compiler (tsc) adapter for automation enforcement
// Runs typechecking in noEmit mode with incremental support
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

export class TscAdapter implements ToolAdapter {
  readonly name: ToolName = 'tsc';
  readonly supportedModes: AutomationMode[] = ['changed_file', 'checkpoint', 'full_repo'];

  private logger: Logger;
  private cwd: string;

  constructor(logger: Logger, options?: { cwd?: string }) {
    this.logger = logger.child({ service: 'TscAdapter' });
    this.cwd = options?.cwd ?? process.cwd();
  }

  buildCommand(target: ToolExecutionTarget, mode: AutomationMode): string[] {
    const args = ['npx', 'tsc', '--noEmit'];

    if (mode === 'changed_file' && target.files.length > 0) {
      const projectRefs = this.resolveProjectRefs(target.files);
      if (projectRefs.length > 0) {
        args.push('--project', ...projectRefs);
      }
    } else if (mode === 'checkpoint' || mode === 'full_repo') {
      args.push('--build');
    }

    args.push('--incremental');

    return args;
  }

  async execute(
    target: ToolExecutionTarget,
    mode: AutomationMode,
    timeoutMs = 120_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const cmd = this.buildCommand(target, mode);

    this.logger.debug('tsc.execute.start', {
      cmd,
      target,
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
      const isTimedOut =
        code === 'ETIMEDOUT' || code === 'ETIME' || nodeErr.message.includes('timed out');
      if (isTimedOut) {
        return { stdout: '', stderr: 'tsc timed out', exitCode: null };
      }
      return {
        stdout: '',
        stderr: nodeErr.stderr ?? nodeErr.message,
        exitCode: typeof code === 'number' ? code : null,
      };
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
    const status = this.determineStatus(exitCode, stderr);
    const issues = this.parseTscOutput(stderr, stdout);

    const blockerCount = issues.filter((i) => i.severity === 'blocker').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      tool: 'tsc',
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

  private determineStatus(exitCode: number | null, stderr: string): EnforcementStatus {
    if (exitCode === null) return 'timed_out';
    if (exitCode === 0) return 'passed';
    if (stderr.includes('error TS')) return 'failed';
    return 'failed';
  }

  private parseTscOutput(stderr: string, stdout: string): ToolIssue[] {
    const issues: ToolIssue[] = [];
    const combined = stderr + stdout;
    const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error TS(\d+):\s+(.+)$/gm;
    const warningRegex = /^(.+?)\((\d+),(\d+)\):\s+warning TS(\d+):\s+(.+)$/gm;

    let match;

    while ((match = errorRegex.exec(combined)) !== null) {
      const [, file, lineStr, colStr, code, message] = match;
      issues.push({
        tool: 'tsc',
        severity: 'blocker',
        ruleId: `TS${code}`,
        file: file.trim(),
        message: message.trim(),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
      });
    }

    while ((match = warningRegex.exec(combined)) !== null) {
      const [, file, lineStr, colStr, code, message] = match;
      issues.push({
        tool: 'tsc',
        severity: 'warning',
        ruleId: `TS${code}`,
        file: file.trim(),
        message: message.trim(),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
      });
    }

    return issues;
  }

  private resolveProjectRefs(files: string[]): string[] {
    const projects = new Set<string>();
    for (const file of files) {
      const parts = file.split('/');
      for (let i = 0; i < parts.length; i++) {
        const pathPrefix = parts.slice(0, i + 1).join('/');
        const tsconfigPath = `${pathPrefix}/tsconfig.json`;
        try {
          require.resolve(tsconfigPath);
          projects.add(tsconfigPath);
        } catch {
          // Not a project root
        }
      }
    }
    return Array.from(projects);
  }
}

export const createTscAdapter = (logger: Logger, options?: { cwd?: string }): ToolAdapter => {
  return new TscAdapter(logger, options);
};
