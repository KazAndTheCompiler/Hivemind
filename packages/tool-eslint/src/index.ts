// Scoped ESLint runner — runs only on changed TS/JS files
// Uses child_process to avoid ESM/CJS conflicts with execa

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';

export interface EslintResult {
  ran: boolean;
  fixedFiles: string[];
  failedFiles: string[];
  warnings: number;
  errors: number;
  findings: ToolFinding[];
}

export interface EslintRunner {
  run(files: string[]): Promise<EslintResult>;
}

export class LocalEslintRunner implements EslintRunner {
  private logger: Logger;
  private configFile?: string;

  constructor(logger: Logger, configFile?: string) {
    this.logger = logger.child({ service: 'EslintRunner' });
    this.configFile = configFile;
  }

  async run(files: string[]): Promise<EslintResult> {
    if (files.length === 0) {
      return { ran: false, fixedFiles: [], failedFiles: [], warnings: 0, errors: 0, findings: [] };
    }

    const args = files.join(' ');
    const configFlag = this.configFile ? `-c ${this.configFile}` : '';
    const cmd = `npx eslint --ext .ts,.tsx,.js,.jsx --format json ${configFlag} ${args}`;

    try {
      const { stdout } = await execAsync(cmd, { timeout: 60_000 });
      return this.parseEslintOutput(stdout, files);
    } catch (err) {
      this.logger.error('eslint.execution.error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        ran: false,
        fixedFiles: [],
        failedFiles: files,
        warnings: 0,
        errors: 0,
        findings: [],
      };
    }
  }

  private parseEslintOutput(stdout: string, files: string[]): EslintResult {
    try {
      const results = JSON.parse(stdout) as Array<{
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
      }>;

      let totalWarnings = 0;
      let totalErrors = 0;
      const failedFiles: string[] = [];
      const findings: ToolFinding[] = [];

      for (const file of results) {
        totalWarnings += file.warningCount;
        totalErrors += file.errorCount;

        if (file.errorCount > 0) {
          failedFiles.push(file.filePath);
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
        fixedFiles: [],
        failedFiles,
        warnings: totalWarnings,
        errors: totalErrors,
        findings,
      };
    } catch {
      return {
        ran: true,
        fixedFiles: [],
        failedFiles: files,
        warnings: 0,
        errors: 0,
        findings: [],
      };
    }
  }
}
