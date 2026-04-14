// Prettier adapter for automation enforcement
// Wraps LocalPrettierRunner to implement ToolAdapter interface

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

const PRETTIER_SUPPORTED_EXTS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.json', '.md', '.css', '.scss',
  '.html', '.yaml', '.yml',
];

export class PrettierAdapter implements ToolAdapter {
  readonly name: ToolName = 'prettier';
  readonly supportedModes: AutomationMode[] = ['changed_file', 'checkpoint', 'full_repo'];

  private logger: Logger;
  private cwd: string;
  private timeoutMs: number;

  constructor(logger: Logger, options?: { cwd?: string; timeoutMs?: number }) {
    this.logger = logger.child({ service: 'PrettierAdapter' });
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  buildCommand(target: ToolExecutionTarget, _mode: AutomationMode): string[] {
    const files = this.filterSupported(target.files);
    if (files.length === 0) {
      return ['echo', 'no files to format'];
    }
    return ['npx', 'prettier', '--write', ...files];
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

    this.logger.debug('prettier.execute.start', { cmd, mode });

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
        return { stdout: '', stderr: 'prettier timed out', exitCode: null };
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
    const supported = this.filterSupported(target.files);

    let status: EnforcementStatus;
    if (exitCode === null) {
      status = 'timed_out';
    } else if (exitCode === 0 && !stderr) {
      status = 'passed';
    } else {
      status = 'partial';
    }

    const issues: ToolIssue[] = [];
    if (stderr && !stderr.includes('timed out')) {
      for (const file of supported) {
        if (stderr.includes(file)) {
          issues.push({
            tool: 'prettier',
            severity: 'warning',
            ruleId: 'PRETTIER_FORMAT_FAILED',
            file,
            message: `Prettier failed to format: ${file}`,
          });
        }
      }
    }

    return {
      tool: 'prettier',
      mode,
      status,
      durationMs,
      exitCode,
      target,
      blockerCount: 0,
      warningCount: issues.length,
      issues,
      stdout: stdout.slice(0, 5000),
      stderr: stderr.slice(0, 5000),
      retryCount,
      timestamp: new Date().toISOString(),
    };
  }

  private filterSupported(files: string[]): string[] {
    return files.filter((f) => {
      const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
      return PRETTIER_SUPPORTED_EXTS.includes(ext);
    });
  }
}

export const createPrettierAdapter = (logger: Logger, options?: { cwd?: string; timeoutMs?: number }): ToolAdapter => {
  return new PrettierAdapter(logger, options);
};