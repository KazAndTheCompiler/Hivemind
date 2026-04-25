// Scoped ESLint runner — runs only on changed TS/JS files
// Uses child_process.execFile with arg arrays for path-safe subprocess execution
// Integrated with ToolExecutionQueue for concurrency control

import { execFile } from 'child_process';

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
  run(files: string[], cancelToken?: CancelToken): Promise<EslintRunResult>;
}

const TS_JS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

/** Cancellation token for aborting long-running tool execution */
export class CancelToken {
  private _cancelled = false;
  cancel(): void {
    this._cancelled = true;
  }
  get isCancelled(): boolean {
    return this._cancelled;
  }
}

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
  private killTimer: NodeJS.Timeout | null = null;

  constructor(logger: Logger, options?: { configFile?: string; cwd?: string; timeoutMs?: number }) {
    this.logger = logger.child({ service: 'EslintRunner' });
    this.configFile = options?.configFile;
    this.cwd = options?.cwd ?? process.cwd();
    this.timeoutMs = options?.timeoutMs ?? 15_000;
  }

  /**
   * @note Testing the SIGKILL fallback is impractical in unit tests because it requires
   * spawning a real child process that ignores SIGTERM, then verifying that SIGKILL
   * is eventually sent. This would involve mocking execFile at a deep level or using
   * integration tests with a purposefullystubborn subprocess. The logic is kept
   * simple and structurally sound so it can be validated manually or via integration test.
   */
  async run(files: string[], cancelToken?: CancelToken): Promise<EslintRunResult> {
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

    const args = ['--ext', '.ts,.tsx,.js,.jsx', '--format', 'json', ...applicable];

    if (this.configFile) {
      args.splice(0, 0, '-c', this.configFile);
    }

    this.logger.debug('eslint.run.start', {
      fileCount: applicable.length,
      files: applicable,
      cwd: this.cwd,
    });

    try {
      const child = execFile('npx', ['eslint', ...args], {
        cwd: this.cwd,
        timeout: this.timeoutMs,
      });

      // Support cancellation
      if (cancelToken) {
      const checkCancel = setInterval(() => {
        if (cancelToken.isCancelled) {
          child.kill('SIGTERM');
          clearInterval(checkCancel);
          const SIGKILL_TIMEOUT_MS = 2000;
          this.killTimer = setTimeout(() => {
            if (!child.killed) {
              process.kill(child.pid!, 'SIGKILL');
              this.logger.warn('process did not exit after SIGTERM — sending SIGKILL', { pid: child.pid });
            }
          }, SIGKILL_TIMEOUT_MS);
        }
      }, 100);
      child.on('exit', () => {
        clearInterval(checkCancel);
        if (this.killTimer) {
          clearTimeout(this.killTimer);
          this.killTimer = null;
        }
      });
      }

      const { stdout } = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          let stdout = '';
          let stderr = '';
          child.stdout?.on('data', (d: Buffer) => {
            stdout += d.toString();
          });
          child.stderr?.on('data', (d: Buffer) => {
            stderr += d.toString();
          });
          child.on('close', (code) => {
            if (code === 0 || code === 1) {
              resolve({ stdout, stderr });
            } else {
              const err = new Error(`ESLint exited ${code ?? 'unknown'}`) as Error & {
                code?: number;
                stderr?: string;
              };
              err.code = code ?? undefined;
              err.stderr = stderr;
              reject(err);
            }
          });
          child.on('error', reject);
        },
      );

      return this.parseEslintOutput(stdout, applicable);
    } catch (err) {
      if (this.killTimer) {
        clearTimeout(this.killTimer);
        this.killTimer = null;
      }
      const nodeErr = err as {
        code?: string | number;
        stdout?: string;
        stderr?: string;
        message: string;
      };
      const timedOut = nodeErr.code === 'ETIMEDOUT' || nodeErr.message.includes('timed out');
      const cancelled = nodeErr.message.includes('SIGTERM');

      if (cancelled) {
        return {
          ran: false,
          fixedFiles: [],
          failedFiles: applicable,
          warnings: 0,
          errors: 0,
          findings: [],
          crashed: false,
        };
      }

      if (
        nodeErr.code === 2 ||
        nodeErr.code === 'ERR_CHILD_PROCESS_FAILED' ||
        (nodeErr.stderr && nodeErr.stderr.includes('ESLint'))
      ) {
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

      const output = nodeErr.stdout || '';
      if (output.trim()) {
        return this.parseEslintOutput(output, applicable);
      }

      this.logger.error('eslint.execution.error', { timedOut, error: nodeErr.message });
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
        if (file.errorCount > 0) failedFiles.push(file.filePath);
        if (file.fixed) fixedFiles.push(file.filePath);

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
