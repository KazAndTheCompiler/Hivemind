// ESLint adapter for automation enforcement
// Wraps LocalEslintRunner to implement ToolAdapter interface

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

const TS_JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

interface EslintJsonMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
}

interface EslintJsonFile {
  filePath: string;
  messages: EslintJsonMessage[];
  errorCount: number;
  warningCount: number;
  fixed: boolean;
}

export class EslintAdapter implements ToolAdapter {
  readonly name: ToolName = 'eslint';
  readonly supportedModes: AutomationMode[] = ['changed_file', 'checkpoint', 'full_repo'];

  private logger: Logger;
  private cwd: string;
  private timeoutMs: number;

  constructor(logger: Logger, options?: { cwd?: string; timeoutMs?: number }) {
    this.logger = logger.child({ service: 'EslintAdapter' });
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  buildCommand(target: ToolExecutionTarget, _mode: AutomationMode): string[] {
    const files = this.filterApplicable(target.files);
    if (files.length === 0) {
      return ['echo', 'no files to lint'];
    }

    const args = ['npx', 'eslint', '--ext', '.ts,.tsx,.js,.jsx', '--format', 'json', ...files];
    return args;
  }

  async execute(
    target: ToolExecutionTarget,
    mode: AutomationMode,
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const cmd = this.buildCommand(target, mode);

    if (cmd[0] === 'echo') {
      return { stdout: '', stderr: '', exitCode: 0 };
    }

    this.logger.debug('eslint.execute.start', { cmd, mode });

    try {
      const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), {
        cwd: this.cwd,
        timeout: timeoutMs ?? this.timeoutMs,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err) {
      const nodeErr = err as { code?: string | number; message: string; stderr?: string };
      const code = nodeErr.code;
      const isTimedOut = code === 'ETIMEDOUT' || code === 'ETIME' || nodeErr.message.includes('timed out');
      if (isTimedOut) {
        return { stdout: '', stderr: 'eslint timed out', exitCode: null };
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
    const files = this.filterApplicable(target.files);

    let status: EnforcementStatus;
    if (exitCode === null) {
      status = 'timed_out';
    } else if (exitCode === 0) {
      status = 'passed';
    } else if (exitCode === 1) {
      status = 'failed';
    } else {
      status = 'failed';
    }

    const issues = this.parseOutput(stdout, files);
    const blockerCount = issues.filter((i) => i.severity === 'blocker').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    return {
      tool: 'eslint',
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

  private filterApplicable(files: string[]): string[] {
    return files.filter((f) => {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      return TS_JS_EXTENSIONS.includes(ext);
    });
  }

  private parseOutput(output: string, files: string[]): ToolIssue[] {
    const issues: ToolIssue[] = [];

    if (!output.trim()) {
      return issues;
    }

    try {
      const results: EslintJsonFile[] = JSON.parse(output);

      for (const file of results) {
        for (const msg of file.messages) {
          issues.push({
            tool: 'eslint',
            severity: msg.severity === 2 ? 'blocker' : msg.severity === 1 ? 'warning' : 'info',
            ruleId: msg.ruleId ?? undefined,
            file: file.filePath,
            message: msg.message,
            line: msg.line,
            column: msg.column,
          });
        }
      }
    } catch {
      for (const file of files) {
        issues.push({
          tool: 'eslint',
          severity: 'warning',
          ruleId: 'PARSE_ERROR',
          file,
          message: 'Failed to parse eslint output',
        });
      }
    }

    return issues;
  }
}

export const createEslintAdapter = (logger: Logger, options?: { cwd?: string; timeoutMs?: number }): ToolAdapter => {
  return new EslintAdapter(logger, options);
};