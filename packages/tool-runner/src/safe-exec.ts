// Safe command execution — prevents shell injection and resource exhaustion
// Uses Node.js child_process with proper argument handling

import { spawn } from 'child_process';
import type { Logger } from '@openclaw/core-logging';

export interface ExecOptions {
  timeoutMs?: number;
  maxStdoutBytes?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  error?: string;
}

const DEFAULT_TIMEOUT = 30_000; // 30 seconds
const DEFAULT_MAX_STDOUT = 1_000_000; // 1MB

/**
 * Safely execute a command with proper argument escaping.
 * Prevents shell injection by passing args as array (never through shell).
 */
export async function safeExec(
  command: string,
  args: string[],
  logger: Logger,
  options: ExecOptions = {},
): Promise<ExecResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const maxStdoutBytes = options.maxStdoutBytes ?? DEFAULT_MAX_STDOUT;

  return new Promise((resolve) => {
    try {
      logger.debug('safe_exec.start', { command, argsCount: args.length, timeoutMs });

      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ? { ...process.env, ...options.env } : undefined,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (chunk: Buffer) => {
        if (stdout.length < maxStdoutBytes) {
          const remaining = maxStdoutBytes - stdout.length;
          stdout += chunk.toString().substring(0, remaining);
        }
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        clearTimeout(timeoutHandle);

        const execResult: ExecResult = {
          success: !timedOut && code === 0,
          stdout: stdout.length > maxStdoutBytes ? stdout.substring(0, maxStdoutBytes) : stdout,
          stderr,
          exitCode: code ?? 1,
          timedOut,
          error: timedOut ? `Timed out after ${timeoutMs}ms` : undefined,
        };

        if (timedOut) {
          logger.warn('safe_exec.timeout', { command, timeoutMs });
        } else {
          logger.debug('safe_exec.complete', {
            command,
            exitCode: execResult.exitCode,
            signal,
            stdoutLen: execResult.stdout.length,
          });
        }

        resolve(execResult);
      });

      child.on('error', (err: Error) => {
        clearTimeout(timeoutHandle);
        logger.error('safe_exec.error', { command, error: err.message });
        resolve({
          success: false,
          stdout: '',
          stderr: err.message,
          exitCode: 1,
          timedOut: false,
          error: err.message,
        });
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('safe_exec.unexpected_error', { command, error: errorMsg });
      resolve({
        success: false,
        stdout: '',
        stderr: errorMsg,
        exitCode: 1,
        timedOut: false,
        error: errorMsg,
      });
    }
  });
}

/**
 * Execute a tool on specific files (prettier, eslint, etc).
 * Filters to only relevant files before execution.
 */
export async function executeToolOnFiles(
  tool: 'prettier' | 'eslint' | 'secdev',
  files: string[],
  logger: Logger,
  options: ExecOptions = {},
): Promise<ExecResult> {
  if (files.length === 0) {
    return {
      success: true,
      stdout: 'No files to process',
      stderr: '',
      exitCode: 0,
      timedOut: false,
    };
  }

  // Filter files by tool relevance
  const relevantFiles = filterByToolType(tool, files);

  if (relevantFiles.length === 0) {
    logger.debug(`execute_tool.no_relevant_files`, { tool, filesCount: files.length });
    return {
      success: true,
      stdout: `No relevant files for ${tool}`,
      stderr: '',
      exitCode: 0,
      timedOut: false,
    };
  }

  // Build command args
  const args = buildToolArgs(tool, relevantFiles);

  logger.info(`execute_tool.start`, {
    tool,
    filesCount: relevantFiles.length,
  });

  return safeExec(tool, args, logger, options);
}

/**
 * Filter files based on tool type.
 */
function filterByToolType(tool: string, files: string[]): string[] {
  if (tool === 'eslint') {
    return files.filter(f => /\.(js|jsx|ts|tsx)$/.test(f));
  }

  if (tool === 'prettier') {
    return files.filter(f =>
      /\.(js|jsx|ts|tsx|json|md|yaml|yml|css|scss)$/.test(f),
    );
  }

  if (tool === 'secdev') {
    return files; // secdev handles filtering
  }

  return files;
}

/**
 * Build tool-specific command arguments.
 */
function buildToolArgs(tool: string, files: string[]): string[] {
  if (tool === 'eslint') {
    return ['--format', 'json', ...files];
  }

  if (tool === 'prettier') {
    return ['--check', '--write', ...files];
  }

  if (tool === 'secdev') {
    return ['validate', '--files', files.join(',')];
  }

  return files;
}
