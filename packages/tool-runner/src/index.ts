// Subprocess execution service with timeout/error handling
// Uses child_process to avoid ESM/CJS conflicts

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import { Logger } from '@openclaw/core-logging';

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export class ToolRunner {
  private logger: Logger;
  private defaultTimeoutMs: number;

  constructor(logger: Logger, defaultTimeoutMs = 120_000) {
    this.logger = logger.child({ service: 'ToolRunner' });
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  async run(
    command: string,
    args: string[] = [],
    options?: { timeoutMs?: number; cwd?: string },
  ): Promise<ExecutionResult> {
    const timeout = options?.timeoutMs ?? this.defaultTimeoutMs;
    const cmd = `${command} ${args.join(' ')}`;
    const start = Date.now();

    this.logger.debug('tool.run.start', { command, args, timeout, cwd: options?.cwd });

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout,
        cwd: options?.cwd,
      });

      const duration = Date.now() - start;

      this.logger.info('tool.run.complete', {
        command,
        durationMs: duration,
        stdoutLen: stdout.length,
        stderrLen: stderr.length,
      });

      return {
        exitCode: 0,
        stdout,
        stderr,
        durationMs: duration,
        timedOut: false,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const timedOut = err instanceof Error && err.message.includes('timed out');
      const exitCode = timedOut ? 124 : 1;

      this.logger.error('tool.run.error', {
        command,
        durationMs: duration,
        timedOut,
        error: err instanceof Error ? err.message : String(err),
      });

      return {
        exitCode,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: duration,
        timedOut,
      };
    }
  }
}
