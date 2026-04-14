// Subprocess execution service with timeout/error handling
// Uses child_process.execFile with argument arrays for path-safe execution

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import { Logger } from '@openclaw/core-logging';

export interface ExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  killed: boolean;
}

export class ToolRunner {
  private logger: Logger;
  private defaultTimeoutMs: number;
  private cwd: string;

  constructor(
    logger: Logger,
    options?: { defaultTimeoutMs?: number; cwd?: string },
  ) {
    this.logger = logger.child({ service: 'ToolRunner' });
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 120_000;
    this.cwd = options?.cwd ?? process.cwd();
  }

  async run(
    command: string,
    args: string[] = [],
    options?: { timeoutMs?: number; cwd?: string },
  ): Promise<ExecutionResult> {
    const timeout = options?.timeoutMs ?? this.defaultTimeoutMs;
    const cwd = options?.cwd ?? this.cwd;
    const start = Date.now();

    this.logger.debug('tool.run.start', { command, args, timeout, cwd });

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout,
        cwd,
      });

      const duration = Date.now() - start;

      this.logger.info('tool.run.complete', {
        command,
        args,
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
        killed: false,
      };
    } catch (err) {
      const duration = Date.now() - start;
      const nodeErr = err as { code?: string; stdout?: string; stderr?: string; message: string };
      const timedOut = nodeErr.code === 'ETIMEDOUT' || nodeErr.message.includes('timed out');
      const killed = nodeErr.code === 'ABORT_ERR';

      this.logger.error('tool.run.error', {
        command,
        args,
        durationMs: duration,
        timedOut,
        killed,
        error: nodeErr.message,
      });

      return {
        exitCode: timedOut ? 124 : killed ? 137 : 1,
        stdout: nodeErr.stdout ?? '',
        stderr: nodeErr.stderr ?? nodeErr.message,
        durationMs: duration,
        timedOut,
        killed,
      };
    }
  }
}
