import { describe, it, expect } from 'vitest';
import { countTokens, checkBudget, truncateToBudget } from './index';

describe('countTokens', () => {
  it('counts tokens for simple text', () => {
    const tokens = countTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  it('counts more tokens for longer text', () => {
    const short = countTokens('hello');
    const long = countTokens('hello world this is a longer text with more words');
    expect(long).toBeGreaterThan(short);
  });
});

describe('checkBudget', () => {
  it('returns not exceeded for short text', () => {
    const budget = checkBudget('short text', 200);
    expect(budget.exceeded).toBe(false);
    expect(budget.remainingTokens).toBeGreaterThan(0);
  });

  it('returns exceeded for very long text', () => {
    const longText = 'word '.repeat(500);
    const budget = checkBudget(longText, 200);
    expect(budget.exceeded).toBe(true);
  });
});

describe('truncateToBudget', () => {
  it('returns same text when within budget', () => {
    const text = 'short text';
    const result = truncateToBudget(text, 200);
    expect(result).toBe(text);
  });

  it('truncates text that exceeds budget', () => {
    const longText = 'word '.repeat(500);
    const result = truncateToBudget(longText, 200);
    expect(countTokens(result)).toBeLessThanOrEqual(200);
  });
});
