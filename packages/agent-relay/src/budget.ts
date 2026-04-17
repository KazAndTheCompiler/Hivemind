// Relay budget enforcement — ensures payloads fit within token constraints
// Uses deterministic trimming order to enforce hard limits

import type { CondensedRelay200 } from '@openclaw/core-types';

export interface EnforceResult {
  enforced: boolean;
  originalTokens: number;
  finalTokens: number;
  trimmingApplied: string[];
  error?: string;
}

const tokenPerChar = 1 / 4; // Rough heuristic: 4 chars ≈ 1 token

function estimateTokens(obj: unknown): number {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
  return Math.ceil(json.length * tokenPerChar);
}

/**
 * Enforce strict relay budget constraints.
 * Trims non-critical fields in priority order until payload fits.
 * Throws if critical fields cannot be preserved.
 */
export function enforceBudget(
  payload: CondensedRelay200,
  budgetTokens: number,
): EnforceResult {
  // Deep copy to avoid mutation
  const working = JSON.parse(JSON.stringify(payload));
  const originalTokens = estimateTokens(working);
  const trimmingApplied: string[] = [];

  // Critical fields that MUST be preserved
  const criticalFields = new Set([
    'taskId',
    'agentId',
    'status',
    'severity',
    'confidence',
  ]);

  // Trimming priority (lowest removed first)
  const trimmingOrder = [
    { name: 'touchedFiles_tail', test: () => working.touchedFiles?.length > 1 },
    { name: 'low_severity_findings', test: () => working.findings?.filter((f: any) => f.severity === 'low').length > 0 },
    { name: 'extra_blockers', test: () => working.blockers?.length > 1 },
    { name: 'extra_nextActions', test: () => working.nextActions?.length > 1 },
    { name: 'summary_truncate', test: () => working.summary?.length > 50 },
    { name: 'medium_severity_findings', test: () => working.findings?.filter((f: any) => f.severity === 'medium').length > 0 },
  ];

  // Apply trimming until budget is satisfied
  while (estimateTokens(working) > budgetTokens) {
    let trimmed = false;

    for (const { name, test } of trimmingOrder) {
      if (!test()) continue;

      try {
        switch (name) {
          case 'touchedFiles_tail':
            if (working.touchedFiles && working.touchedFiles.length > 1) {
              working.touchedFiles = working.touchedFiles.slice(0, -1);
              trimmed = true;
              trimmingApplied.push(name);
            }
            break;

          case 'low_severity_findings':
            working.findings = (working.findings || []).filter(
              (f: any) => f.severity !== 'low',
            );
            trimmed = true;
            trimmingApplied.push(name);
            break;

          case 'extra_blockers':
            if (working.blockers && working.blockers.length > 1) {
              working.blockers = working.blockers.slice(0, 1);
              trimmed = true;
              trimmingApplied.push(name);
            }
            break;

          case 'extra_nextActions':
            if (working.nextActions && working.nextActions.length > 1) {
              working.nextActions = working.nextActions.slice(0, 1);
              trimmed = true;
              trimmingApplied.push(name);
            }
            break;

          case 'summary_truncate':
            if (working.summary && working.summary.length > 50) {
              working.summary = working.summary.substring(0, 100) + '...';
              trimmed = true;
              trimmingApplied.push(name);
            }
            break;

          case 'medium_severity_findings':
            working.findings = (working.findings || []).filter(
              (f: any) => f.severity !== 'medium',
            );
            trimmed = true;
            trimmingApplied.push(name);
            break;
        }
      } catch {
        // Skip if trimming fails
      }

      if (trimmed) break;
    }

    // Prevent infinite loops
    if (!trimmed) {
      const finalTokens = estimateTokens(working);
      return {
        enforced: false,
        originalTokens,
        finalTokens,
        trimmingApplied,
        error: `Unable to fit payload into ${budgetTokens} tokens (now ${finalTokens})`,
      };
    }
  }

  // Verify critical fields still exist
  for (const field of criticalFields) {
    if (!(field in working) || working[field] === undefined) {
      return {
        enforced: false,
        originalTokens,
        finalTokens: estimateTokens(working),
        trimmingApplied,
        error: `Critical field "${field}" was removed during trimming`,
      };
    }
  }

  const finalTokens = estimateTokens(working);

  if (finalTokens > budgetTokens) {
    return {
      enforced: false,
      originalTokens,
      finalTokens,
      trimmingApplied,
      error: `Final payload still exceeds budget: ${finalTokens} > ${budgetTokens}`,
    };
  }

  return {
    enforced: true,
    originalTokens,
    finalTokens,
    trimmingApplied,
  };
}
