// Scoped Prettier runner — runs only on changed supported files
// Uses child_process.execFile with arg arrays for path-safe subprocess execution

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';
import * as path from 'path';

export interface PrettierRunResult {
  ran: boolean;
  formattedFiles: string[];
  failedFiles: string[];
  skippedFiles: string[];
  findings: ToolFinding[];
  crashed: boolean;
  crashMessage?: string;
}

export interface PrettierRunner {
  run(files: string[]): Promise<PrettierRunResult>;
}

const PRETTIER_SUPPORTED_EXTS = [
  '.ts', '.tsx', '.js', '.jsx',
  '.json', '.md', '.css', '.scss',
  '.html', '.yaml', '.yml',
];

/** Filter files to Prettier-supported extensions */
function filterSupported(files: string[]): string[] {
  return files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return PRETTIER_SUPPORTED_EXTS.includes(ext);
  });
}

export class LocalPrettierRunner implements PrettierRunner {
  private logger: Logger;
  private cwd: string;
  private timeoutMs: number;

  constructor(
    logger: Logger,
    options?: { cwd?: string; timeoutMs?: number },
  ) {
    this.logger = logger.child({ service: 'PrettierRunner' });
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  async run(files: string[]): Promise<PrettierRunResult> {
    if (files.length === 0) {
      return {
        ran: false,
        formattedFiles: [],
        failedFiles: [],
        skippedFiles: [],
        findings: [],
        crashed: false,
      };
    }

    const supported = filterSupported(files);
    const skipped = files.filter((f) => !supported.includes(f));

    if (supported.length === 0) {
      return {
        ran: false,
        formattedFiles: [],
        failedFiles: [],
        skippedFiles: skipped,
        findings: [],
        crashed: false,
      };
    }

    this.logger.debug('prettier.run.start', {
      fileCount: supported.length,
      files: supported,
      cwd: this.cwd,
    });

    try {
      await execFileAsync('npx', ['prettier', '--write', ...supported], {
        cwd: this.cwd,
        timeout: this.timeoutMs,
      });

      this.logger.info('prettier.formatted', {
        fileCount: supported.length,
        skippedCount: skipped.length,
      });

      return {
        ran: true,
        formattedFiles: supported,
        failedFiles: [],
        skippedFiles: skipped,
        findings: [],
        crashed: false,
      };
    } catch (err) {
      const nodeErr = err as { code?: string; message: string };
      const timedOut = nodeErr.code === 'ETIMEDOUT' || nodeErr.message.includes('timed out');

      this.logger.error('prettier.error', {
        timedOut,
        failedFiles: supported,
        error: nodeErr.message,
      });

      return {
        ran: true,
        formattedFiles: [],
        failedFiles: supported,
        skippedFiles: skipped,
        findings: supported.map((f) => ({
          source: 'prettier' as const,
          severity: 'medium' as const,
          code: 'PRETTIER_FORMAT_FAILED',
          message: `Prettier failed to format: ${f}`,
          fileRefs: [f],
        })),
        crashed: true,
        crashMessage: nodeErr.message,
      };
    }
  }
}
