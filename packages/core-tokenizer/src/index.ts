// Token counting and budget enforcement for relay summaries
// Uses a simple whitespace/word-based heuristic. For production,
// integrate a real tokenizer (tiktoken, etc.)

import type { TokenBudget } from '@openclaw/core-types';

export const AVG_TOKENS_PER_WORD = 1.3;
export const TOKEN_OVERHEAD_PER_LINE = 1;

export function countTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  const lines = text.split('\n').length;
  return Math.ceil(words * AVG_TOKENS_PER_WORD + lines * TOKEN_OVERHEAD_PER_LINE);
}

/** Count tokens for a serialized JSON object payload */
export function countTokensObject(obj: unknown): number {
  const serialized = JSON.stringify(obj);
  return countTokens(serialized);
}

export function checkBudget(text: string, maxTokens: number): TokenBudget {
  const used = countTokens(text);
  return {
    maxTokens,
    usedTokens: used,
    remainingTokens: Math.max(0, maxTokens - used),
    exceeded: used > maxTokens,
  };
}

export function truncateToBudget(text: string, maxTokens: number): string {
  const budget = checkBudget(text, maxTokens);
  if (!budget.exceeded) return text;

  const words = text.split(/\s+/);
  const targetWords = Math.floor(maxTokens / AVG_TOKENS_PER_WORD);
  return words.slice(0, targetWords).join(' ');
}

/** Relay payload shape used for budget truncation */
export interface RelayPayload {
  summary?: string;
  touchedFiles?: string[];
  blockers?: string[];
  nextActions?: string[];
  nextAction?: string | null;
  topFindings?: Array<{ severity: string }>;
}

/** Result of budget enforcement */
export interface BudgetResult {
  fits: boolean;
  tokens: number;
  overflow: number;
}

/** Check if a payload fits within the token budget */
export function fitsBudget(payload: RelayPayload, maxTokens: number): BudgetResult {
  const tokens = countTokensObject(payload);
  return {
    fits: tokens <= maxTokens,
    tokens,
    overflow: Math.max(0, tokens - maxTokens),
  };
}

/**
 * Trim the lowest-priority field from a payload.
 * Priority order (lowest to highest):
 * 1. touchedFiles (remove last element)
 * 2. nextActions (remove last element)
 * 3. blockers (remove last element)
 * 4. topFindings (remove lowest severity)
 * 5. summary (truncate to shorter)
 */
function trimLowestPriorityField(payload: RelayPayload): RelayPayload {
  const trimmed: RelayPayload = { ...payload };

  // Trim touchedFiles if more than 1
  if (trimmed.touchedFiles && trimmed.touchedFiles.length > 1) {
    trimmed.touchedFiles = trimmed.touchedFiles.slice(0, -1);
    return trimmed;
  }

  // Trim nextActions if more than 0
  if (trimmed.nextActions && trimmed.nextActions.length > 0) {
    trimmed.nextActions = trimmed.nextActions.slice(0, -1);
    return trimmed;
  }

  // Trim nextAction (set to null)
  if (trimmed.nextAction !== undefined && trimmed.nextAction !== null) {
    trimmed.nextAction = null;
    return trimmed;
  }

  // Trim blockers if more than 0
  if (trimmed.blockers && trimmed.blockers.length > 0) {
    trimmed.blockers = trimmed.blockers.slice(0, -1);
    return trimmed;
  }

  // Trim topFindings (remove lowest severity first)
  if (trimmed.topFindings && trimmed.topFindings.length > 0) {
    const severityOrder: Record<string, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
    const sorted = [...trimmed.topFindings].sort(
      (a, b) => (severityOrder[a.severity] ?? -1) - (severityOrder[b.severity] ?? -1),
    );
    trimmed.topFindings = sorted.slice(1);
    return trimmed;
  }

  // Nuclear: truncate summary
  if (typeof trimmed.summary === 'string' && trimmed.summary.length > 10) {
    const words = trimmed.summary.split(/\s+/);
    trimmed.summary = words.slice(0, Math.max(1, Math.floor(words.length * 0.7))).join(' ');
    return trimmed;
  }

  return trimmed;
}

/**
 * Iteratively enforces the token budget on a relay payload.
 * Trims lowest-priority fields until the payload fits.
 * Throws if even the absolute minimum payload doesn't fit.
 */
export function enforceBudget<T extends RelayPayload>(payload: T, maxTokens: number): T {
  const result = fitsBudget(payload, maxTokens);
  if (result.fits) return payload;

  let current: RelayPayload = { ...payload };
  let iterations = 0;
  const MAX_ITERATIONS = 100;

  while (iterations < MAX_ITERATIONS) {
    current = trimLowestPriorityField(current);
    const check = fitsBudget(current, maxTokens);
    if (check.fits) return current as T;
    iterations++;
  }

  // Final assertion — budget violation
  const final = fitsBudget(current, maxTokens);
  throw new Error(
    `Relay budget violation: ${final.tokens} tokens > ${maxTokens} max. ` +
    `Payload could not be trimmed within ${MAX_ITERATIONS} iterations.`,
  );
}

/**
 * Iteratively trims a relay payload until it fits within the token budget.
 * Legacy wrapper around enforceBudget for backward compatibility.
 */
export function truncatePayloadToBudget<T extends RelayPayload>(
  payload: T,
  maxTokens: number,
): T {
  return enforceBudget(payload, maxTokens);
}
