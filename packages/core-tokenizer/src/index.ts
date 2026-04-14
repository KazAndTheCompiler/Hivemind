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
