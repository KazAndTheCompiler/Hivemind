// Scoped ESLint runner — runs only on changed TS/JS files
// Uses child_process.execFile with arg arrays for path-safe subprocess execution

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';
import * as path from 'path';

export interface EslintRunResult {
  ran: boolean;
  fixedFiles: string[];
  failedFiles: string[];
  warnings: number;
  errors: number;
  findings: ToolFinding[];
  crashed: boolean;
  crashMessage?: string;
}

export interface EslintRunner {
  run(files: string[]): Promise<EslintRunResult>;
}

const TS_JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Filter files to only TS/JS/JSX/TSX extensions */
function filterApplicable(files: string[]): string[] {
  return files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return TS_JS_EXTENSIONS.includes(ext);
  });
}

export class LocalEslintRunner implements EslintRunner {
  private logger: Logger;
  private configFile?: string;
  private cwd: string;
  private timeoutMs: number;

  constructor(
    logger: Logger,
    options?: { configFile?: string; cwd?: string; timeoutMs?: number },
  ) {
    this.logger = logger.child({ service: 'EslintRunner' });
    this.configFile = options?.configFile;
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 60_000;
  }

  async run(files: string[]): Promise<EslintRunResult> {
    const applicable = filterApplicable(files);

    if (applicable.length === 0) {
      return {
        ran: false,
        fixedFiles: [],
        failedFiles: [],
        warnings: 0,
        errors: 0,
        findings: [],
        crashed: false,
      };
    }

    const args = [
      '--ext', '.ts,.tsx,.js,.jsx',
      '--format', 'json',
      ...applicable,
    ];

    if (this.configFile) {
      args.splice(0, 0, '-c', this.configFile);
    }

    this.logger.debug('eslint.run.start', {
      fileCount: applicable.length,
      files: applicable,
      cwd: this.cwd,
    });

    try {
      const { stdout } = await execFileAsync('npx', ['eslint', ...args], {
        cwd: this.cwd,
        timeout: this.timeoutMs,
      });

      // Parse JSON output from stdout
      return this.parseEslintOutput(stdout, applicable);
    } catch (err) {
      const nodeErr = err as { code?: string | number; stdout?: string; stderr?: string; message: string };
      const timedOut = nodeErr.code === 'ETIMEDOUT' || nodeErr.message.includes('timed out');

      if (nodeErr.code === 2 || nodeErr.code === 'ERR_CHILD_PROCESS_FAILED' || (nodeErr.stderr && nodeErr.stderr.includes('ESLint'))) {
        // ESLint config/runtime error — report as crashed
        this.logger.error('eslint.crashed', {
          code: nodeErr.code,
          stderr: nodeErr.stderr?.slice(0, 500),
        });
        return {
          ran: false,
          fixedFiles: [],
          failedFiles: applicable,
          warnings: 0,
          errors: 0,
          findings: [],
          crashed: true,
          crashMessage: nodeErr.stderr?.slice(0, 500),
        };
      }

      // ESLint found issues (exit 1) — stdout may still have JSON output
      const output = nodeErr.stdout || '';
      if (output.trim()) {
        return this.parseEslintOutput(output, applicable);
      }

      this.logger.error('eslint.execution.error', {
        timedOut,
        error: nodeErr.message,
      });
      return {
        ran: false,
        fixedFiles: [],
        failedFiles: applicable,
        warnings: 0,
        errors: 0,
        findings: [],
        crashed: true,
        crashMessage: nodeErr.message,
      };
    }
  }

  private parseEslintOutput(output: string, files: string[]): EslintRunResult {
    try {
      const results = JSON.parse(output) as Array<{
        filePath: string;
        messages: Array<{
          ruleId: string | null;
          severity: number;
          message: string;
          line: number;
          column: number;
        }>;
        errorCount: number;
        warningCount: number;
        fixed: boolean;
      }>;

      let totalWarnings = 0;
      let totalErrors = 0;
      const failedFiles: string[] = [];
      const fixedFiles: string[] = [];
      const findings: ToolFinding[] = [];

      for (const file of results) {
        totalWarnings += file.warningCount;
        totalErrors += file.errorCount;

        if (file.errorCount > 0) {
          failedFiles.push(file.filePath);
        }
        if (file.fixed) {
          fixedFiles.push(file.filePath);
        }

        for (const msg of file.messages) {
          findings.push({
            source: 'eslint',
            severity: msg.severity === 2 ? 'high' : msg.severity === 1 ? 'medium' : 'info',
            code: msg.ruleId ?? 'unknown',
            message: msg.message,
            fileRefs: [file.filePath],
            suggestedAction: `Line ${msg.line}, Col ${msg.column}`,
          });
        }
      }

      return {
        ran: true,
        fixedFiles,
        failedFiles,
        warnings: totalWarnings,
        errors: totalErrors,
        findings,
        crashed: false,
      };
    } catch {
      return {
        ran: true,
        fixedFiles: [],
        failedFiles: files,
        warnings: 0,
        errors: 0,
        findings: [],
        crashed: false,
      };
    }
  }
}
