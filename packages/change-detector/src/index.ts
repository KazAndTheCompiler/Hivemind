// File change detection and quality gate service
// Runs Prettier, ESLint, and SecDev on changed files

import type { QualityGateResult, ToolFinding } from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import type { EslintRunner, EslintRunResult } from '@openclaw/tool-eslint';
import type { PrettierRunner } from '@openclaw/tool-prettier';
import type { SecDevAdapter } from '@openclaw/tool-secdev';

export class ChangedFileQualityService {
  private eventBus: EventBus;
  private logger: Logger;
  private eslintRunner: EslintRunner;
  private prettierRunner: PrettierRunner;
  private secdevAdapter: SecDevAdapter;

  constructor(
    eventBus: EventBus,
    logger: Logger,
    eslintRunner: EslintRunner,
    prettierRunner: PrettierRunner,
    secdevAdapter: SecDevAdapter,
  ) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'ChangedFileQualityService' });
    this.eslintRunner = eslintRunner;
    this.prettierRunner = prettierRunner;
    this.secdevAdapter = secdevAdapter;
  }

  async runQualityGate(files: string[]): Promise<QualityGateResult> {
    this.logger.info('quality.gate.start', { fileCount: files.length });

    const tsFiles = files.filter((f) => /\.(ts|tsx|js|jsx)$/.test(f));
    const supportedFiles = files.filter((f) => /\.(ts|tsx|js|jsx|json|md|css|scss|html)$/.test(f));

    // Run prettier on supported files
    const prettierResult = await this.prettierRunner.run(supportedFiles);

    // Run eslint on TS/JS files
    const eslintResult = await this.eslintRunner.run(tsFiles);

    // Collect findings from all tools
    const findings: ToolFinding[] = [...eslintResult.findings, ...prettierResult.findings];

    // Add error findings when tools crash
    if (prettierResult.crashed) {
      findings.push({
        source: 'prettier',
        severity: 'high',
        code: 'TOOL_CRASH',
        message: `Prettier crashed: ${prettierResult.crashMessage ?? 'unknown error'}`,
        fileRefs: prettierResult.formattedFiles,
      });
    }

    if (eslintResult.crashed) {
      findings.push({
        source: 'eslint',
        severity: 'high',
        code: 'TOOL_CRASH',
        message: `ESLint crashed: ${eslintResult.crashMessage ?? 'unknown error'}`,
        fileRefs: eslintResult.fixedFiles,
      });
    }

    // Check for security-relevant changes via SecDev
    const secdevFindings = await this.secdevAdapter.analyzeFiles(files);
    findings.push(...secdevFindings);

    const result: QualityGateResult = {
      kind: 'quality.gate.completed',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: files.join(','),
      changedFiles: files,
      prettier: {
        ran: prettierResult.ran,
        formattedFiles: prettierResult.formattedFiles,
        failedFiles: prettierResult.failedFiles,
      },
      eslint: eslintResultToSummary(eslintResult),
      findings,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('quality.gate.complete', {
      fileCount: files.length,
      prettierFormatted: prettierResult.formattedFiles.length,
      prettierFailed: prettierResult.failedFiles.length,
      prettierCrashed: prettierResult.crashed,
      eslintFixed: eslintResult.fixedFiles.length,
      eslintFailed: eslintResult.failedFiles.length,
      eslintCrashed: eslintResult.crashed,
      eslintWarnings: eslintResult.warnings,
      eslintErrors: eslintResult.errors,
      findingCount: findings.length,
    });

    await this.eventBus.emit(result);

    return result;
  }
}

function eslintResultToSummary(result: EslintRunResult): QualityGateResult['eslint'] {
  return {
    ran: result.ran,
    fixedFiles: result.fixedFiles,
    failedFiles: result.failedFiles,
    warnings: result.warnings,
    errors: result.errors,
  };
}
