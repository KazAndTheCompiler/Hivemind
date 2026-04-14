// SecDev adapter — security finding detection, severity mapping, audit events
// Schema-native emission analysis for agent summaries

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';
import type { RawAgentSummary, NormalizedAgentSummary, AgentStatus } from '@openclaw/core-types';

export type SecDevAnalyzableEmission =
  | { kind: 'raw'; summary: RawAgentSummary }
  | { kind: 'normalized'; summary: NormalizedAgentSummary };

export interface SecDevAdapter {
  analyzeFiles(files: string[]): Promise<ToolFinding[]>;
  analyzeEmission(emission: SecDevAnalyzableEmission): Promise<ToolFinding[]>;
}

// Security-relevant file patterns
const SECURITY_PATTERNS: Array<{
  pattern: RegExp;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  code: string;
  message: string;
}> = [
  {
    pattern: /\.env$/,
    severity: 'high',
    code: 'SECRISK_ENV_FILE',
    message: 'Environment file detected — may contain secrets',
  },
  {
    pattern: /private[_-]?key/i,
    severity: 'critical',
    code: 'SECRISK_PRIVATE_KEY',
    message: 'Private key file detected',
  },
  {
    pattern: /credential/i,
    severity: 'high',
    code: 'SECRISK_CREDENTIAL_FILE',
    message: 'Credential file detected',
  },
  {
    pattern: /\.pem$/,
    severity: 'high',
    code: 'SECRISK_PEM_FILE',
    message: 'PEM certificate/key file detected',
  },
  {
    pattern: /password/i,
    severity: 'medium',
    code: 'SECRISK_PASSWORD_REF',
    message: 'Password reference in filename',
  },
  {
    pattern: /secret/i,
    severity: 'high',
    code: 'SECRISK_SECRET_REF',
    message: 'Secret reference in filename',
  },
  {
    pattern: /token/i,
    severity: 'medium',
    code: 'SECRISK_TOKEN_REF',
    message: 'Token reference in filename',
  },
];

export class LocalSecDevAdapter implements SecDevAdapter {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'LocalSecDevAdapter' });
  }

  async analyzeFiles(files: string[]): Promise<ToolFinding[]> {
    const findings: ToolFinding[] = [];

    for (const file of files) {
      for (const rule of SECURITY_PATTERNS) {
        if (rule.pattern.test(file)) {
          findings.push({
            source: 'secdev',
            severity: rule.severity,
            code: rule.code,
            message: rule.message,
            fileRefs: [file],
          });
        }
      }
    }

    if (findings.length > 0) {
      this.logger.warn('secdev.file.findings', {
        findingCount: findings.length,
        findings: findings.map((f) => ({ code: f.code, severity: f.severity })),
      });
    }

    return findings;
  }

  async analyzeEmission(emission: SecDevAnalyzableEmission): Promise<ToolFinding[]> {
    const findings: ToolFinding[] = [];
    const seen = new Set<string>();

    const emitFinding = (finding: ToolFinding) => {
      const key = `${finding.code}:${finding.fileRefs.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push(finding);
      }
    };

    if (emission.kind === 'raw') {
      this.analyzeRawSummary(emission.summary, emitFinding);
    } else {
      this.analyzeNormalizedSummary(emission.summary, emitFinding);
    }

    if (findings.length > 0) {
      this.logger.warn('secdev.emission.findings', {
        findingCount: findings.length,
        findings: findings.map((f) => ({ code: f.code, severity: f.severity })),
      });
    }

    return findings;
  }

  private analyzeRawSummary(summary: RawAgentSummary, emit: (f: ToolFinding) => void): void {
    const text = [summary.summary, ...summary.blockers, ...summary.nextActions]
      .join(' ')
      .toLowerCase();

    this.checkRiskKeywords(text, emit);
    this.checkStatusAnomalies(summary.status, summary.blockers, emit);
    this.checkTouchedFilesAnomalies(summary.touchedFiles, emit);
  }

  private analyzeNormalizedSummary(
    summary: NormalizedAgentSummary,
    emit: (f: ToolFinding) => void,
  ): void {
    const text = [summary.conciseSummary, ...summary.blockers, ...summary.nextActions]
      .join(' ')
      .toLowerCase();

    this.checkRiskKeywords(text, emit);
    this.checkStatusAnomalies(summary.status, summary.blockers, emit);
    this.checkTouchedFilesAnomalies(summary.touchedFiles, emit);

    if (summary.toolFindings.length > 0) {
      const criticalFindings = summary.toolFindings.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      );
      if (criticalFindings.length > 3) {
        emit({
          source: 'secdev',
          severity: 'medium',
          code: 'SECRISK_MULTIPLE_CRITICAL',
          message: `Multiple critical/high findings detected: ${criticalFindings.length}`,
          fileRefs: criticalFindings.flatMap((f) => f.fileRefs),
          suggestedAction: 'Review and remediate critical security findings',
        });
      }
    }
  }

  private checkRiskKeywords(text: string, emit: (f: ToolFinding) => void): void {
    const riskWords: Array<{ word: string; severity: ToolFinding['severity'] }> = [
      { word: 'secret', severity: 'high' },
      { word: 'password', severity: 'medium' },
      { word: 'private key', severity: 'critical' },
      { word: 'api key', severity: 'high' },
      { word: 'token', severity: 'medium' },
      { word: 'credential', severity: 'high' },
      { word: 'auth bypass', severity: 'critical' },
      { word: 'sql injection', severity: 'critical' },
      { word: 'xss', severity: 'high' },
      { word: 'csrf', severity: 'medium' },
    ];

    for (const { word, severity } of riskWords) {
      if (text.includes(word)) {
        emit({
          source: 'secdev',
          severity,
          code: 'SECRISK_KEYWORD_DETECTED',
          message: `Security-relevant keyword detected: "${word}"`,
          fileRefs: [],
          suggestedAction: 'Review context for potential security issue',
        });
      }
    }
  }

  private checkStatusAnomalies(
    status: AgentStatus,
    blockers: string[],
    emit: (f: ToolFinding) => void,
  ): void {
    if (status === 'failed' && blockers.length === 0) {
      emit({
        source: 'secdev',
        severity: 'low',
        code: 'SEC_ANOMALY_UNSPECIFIED_FAILURE',
        message: 'Agent failed without specific blockers identified',
        fileRefs: [],
        suggestedAction: 'Investigate root cause of unspecified failure',
      });
    }
  }

  private checkTouchedFilesAnomalies(touchedFiles: string[], emit: (f: ToolFinding) => void): void {
    for (const file of touchedFiles) {
      for (const rule of SECURITY_PATTERNS) {
        if (rule.pattern.test(file)) {
          emit({
            source: 'secdev',
            severity: rule.severity,
            code: rule.code,
            message: rule.message,
            fileRefs: [file],
          });
        }
      }
    }
  }
}
