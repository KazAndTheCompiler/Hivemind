// Scoped Prettier runner — runs only on changed supported files
// Uses child_process to avoid ESM/CJS conflicts

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';

export interface PrettierResult {
  ran: boolean;
  formattedFiles: string[];
  failedFiles: string[];
  findings: ToolFinding[];
}

export interface PrettierRunner {
  run(files: string[]): Promise<PrettierResult>;
}

export class LocalPrettierRunner implements PrettierRunner {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'PrettierRunner' });
  }

  async run(files: string[]): Promise<PrettierResult> {
    if (files.length === 0) {
      return { ran: false, formattedFiles: [], failedFiles: [], findings: [] };
    }

    const supportedExt = /\.(ts|tsx|js|jsx|json|md|css|scss|html|yaml|yml)$/;
    const supported = files.filter((f) => supportedExt.test(f));

    if (supported.length === 0) {
      return { ran: false, formattedFiles: [], failedFiles: [], findings: [] };
    }

    const filesArg = supported.join(' ');
    const cmd = `npx prettier --write ${filesArg}`;

    try {
      await execAsync(cmd, { timeout: 60_000 });

      this.logger.info('prettier.formatted', { fileCount: supported.length });

      return {
        ran: true,
        formattedFiles: supported,
        failedFiles: [],
        findings: [],
      };
    } catch (err) {
      this.logger.error('prettier.error', {
        failedFiles: supported,
        error: err instanceof Error ? err.message : String(err),
      });

      return {
        ran: true,
        formattedFiles: [],
        failedFiles: supported,
        findings: supported.map((f) => ({
          source: 'prettier' as const,
          severity: 'medium' as const,
          code: 'PRETTIER_FORMAT_FAILED',
          message: `Prettier failed to format: ${f}`,
          fileRefs: [f],
        })),
      };
    }
  }
}
