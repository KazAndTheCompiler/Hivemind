// SecDev adapter — security finding detection, severity mapping, audit events
// Stub/local pipeline implementation with typed finding schema

import type { ToolFinding } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';

export interface SecDevAdapter {
  analyzeFiles(files: string[]): Promise<ToolFinding[]>;
  analyzeSummary(summary: string): Promise<ToolFinding[]>;
}

// Security-relevant file patterns
const SECURITY_PATTERNS: Array<{ pattern: RegExp; severity: 'info' | 'low' | 'medium' | 'high' | 'critical'; code: string; message: string }> = [
  { pattern: /\.env$/, severity: 'high', code: 'SECRISK_ENV_FILE', message: 'Environment file detected — may contain secrets' },
  { pattern: /private[_-]?key/i, severity: 'critical', code: 'SECRISK_PRIVATE_KEY', message: 'Private key file detected' },
  { pattern: /credential/i, severity: 'high', code: 'SECRISK_CREDENTIAL_FILE', message: 'Credential file detected' },
  { pattern: /\.pem$/, severity: 'high', code: 'SECRISK_PEM_FILE', message: 'PEM certificate/key file detected' },
  { pattern: /password/i, severity: 'medium', code: 'SECRISK_PASSWORD_REF', message: 'Password reference in filename' },
  { pattern: /secret/i, severity: 'high', code: 'SECRISK_SECRET_REF', message: 'Secret reference in filename' },
  { pattern: /token/i, severity: 'medium', code: 'SECRISK_TOKEN_REF', message: 'Token reference in filename' },
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

  async analyzeSummary(summary: string): Promise<ToolFinding[]> {
    // Simple heuristic — in production, this would use more sophisticated analysis
    const findings: ToolFinding[] = [];

    const riskWords = ['secret', 'password', 'key', 'token', 'credential', 'auth'];
    for (const word of riskWords) {
      if (summary.toLowerCase().includes(word)) {
        findings.push({
          source: 'secdev',
          severity: 'low',
          code: 'SECSUMMARY_RISK_KEYWORD',
          message: `Summary contains security-related keyword: "${word}"`,
          fileRefs: [],
          suggestedAction: 'Review summary for potential security impact',
        });
      }
    }

    return findings;
  }
}
