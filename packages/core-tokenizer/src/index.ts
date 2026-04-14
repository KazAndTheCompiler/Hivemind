// Token counting and budget enforcement for relay summaries
// Uses a simple whitespace/word-based heuristic. For production,
// integrate a real tokenizer (tiktoken, etc.)

import type { TokenBudget } from '@openclaw/core-types';

export const AVG_TOKENS_PER_WORD = 1.3;
export const TOKEN_OVERHEAD_PER_LINE = 1;
// JSON structural overhead per key-value pair (braces, quotes, commas)
export const JSON_OVERHEAD_PER_FIELD = 3;

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
  topFindings?: Array<{ severity: string }>;
}

/**
 * Iteratively trims a relay payload until it fits within the token budget.
 * Applies trimming in priority order:
 * 1. Shorten summary text
 * 2. Trim touchedFiles (preserve first N)
 * 3. Trim blockers (preserve first N)
 * 4. Trim nextActions (preserve first N)
 * 5. Trim topFindings (preserve only critical/high)
 * Truncates arrays to minimum (1 element) and summary to 10 words as floor.
 */
export function truncatePayloadToBudget<T extends RelayPayload>(
  payload: T,
  maxTokens: number,
): T {
  const mutable: RelayPayload = { ...payload };

  // Already fits?
  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 1: Truncate summary field
  if (typeof mutable.summary === 'string') {
    let words = mutable.summary.split(/\s+/);
    while (words.length > 10 && countTokensObject(mutable) > maxTokens) {
      words = words.slice(0, Math.max(10, words.length - 5));
      mutable.summary = words.join(' ');
    }
  }

  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 2: Trim touchedFiles (preserve first 3)
  if (Array.isArray(mutable.touchedFiles) && mutable.touchedFiles.length > 3) {
    mutable.touchedFiles = mutable.touchedFiles.slice(0, 3);
  }

  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 3: Trim blockers (preserve first 2)
  if (Array.isArray(mutable.blockers) && mutable.blockers.length > 2) {
    mutable.blockers = mutable.blockers.slice(0, 2);
  }

  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 4: Trim nextActions (preserve first 2)
  if (Array.isArray(mutable.nextActions) && mutable.nextActions.length > 2) {
    mutable.nextActions = mutable.nextActions.slice(0, 2);
  }

  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 5: Trim topFindings — keep only critical/high, then at most 2
  if (Array.isArray(mutable.topFindings) && mutable.topFindings.length > 0) {
    const criticalAndHigh = mutable.topFindings.filter(
      (f) => f.severity === 'critical' || f.severity === 'high',
    );
    mutable.topFindings = criticalAndHigh.length > 0 ? criticalAndHigh.slice(0, 2) : mutable.topFindings.slice(0, 1);
  }

  if (countTokensObject(mutable) <= maxTokens) return mutable as T;

  // Phase 6: Nuclear — strip findings entirely, truncate summary to 10 words
  if (Array.isArray(mutable.topFindings)) {
    mutable.topFindings = [];
  }

  if (typeof mutable.summary === 'string') {
    const words = mutable.summary.split(/\s+/).slice(0, 10);
    mutable.summary = words.join(' ');
  }

  return mutable as T;
}
