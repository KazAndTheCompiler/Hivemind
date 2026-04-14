// File change detection service — maps files to packages, triggers quality gates

import type {
  QualityGateResult,
  ToolFinding,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import type { EslintRunner } from '@openclaw/tool-eslint';
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
    const supportedFiles = files.filter((f) =>
      /\.(ts|tsx|js|jsx|json|md|css|scss|html)$/.test(f),
    );

    // Run prettier on supported files
    const prettierResult = await this.prettierRunner.run(supportedFiles);

    // Run eslint on TS/JS files
    const eslintResult = await this.eslintRunner.run(tsFiles);

    // Collect findings from all tools
    const findings: ToolFinding[] = [
      ...eslintResult.findings,
      ...prettierResult.findings,
    ];

    // Check for security-relevant changes via SecDev
    const secdevFindings = await this.secdevAdapter.analyzeFiles(files);
    findings.push(...secdevFindings);

    const result: QualityGateResult = {
      kind: 'quality.gate.completed',
      changedFiles: files,
      prettier: prettierResult,
      eslint: eslintResult,
      findings,
      timestamp: new Date().toISOString(),
    };

    this.logger.info('quality.gate.complete', {
      fileCount: files.length,
      prettierFormatted: prettierResult.formattedFiles.length,
      prettierFailed: prettierResult.failedFiles.length,
      eslintFixed: eslintResult.fixedFiles.length,
      eslintFailed: eslintResult.failedFiles.length,
      eslintWarnings: eslintResult.warnings,
      eslintErrors: eslintResult.errors,
      findingCount: findings.length,
    });

    await this.eventBus.emit(result);

    return result;
  }
}
