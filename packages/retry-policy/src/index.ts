// Retry Policy — Bounded retries with exponential backoff
// MAX_RETRIES = 3, BASE_BACKOFF = 500ms, MAX_BACKOFF = 4000ms

export enum RetryDecision {
  Retry = 'retry',
  Escalate = 'escalate',
}

export interface RetryPolicyOptions {
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
}

export class RetryPolicy {
  private maxRetries: number;
  private baseBackoffMs: number;
  private maxBackoffMs: number;

  constructor(options: RetryPolicyOptions = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseBackoffMs = options.baseBackoffMs ?? 500;
    this.maxBackoffMs = options.maxBackoffMs ?? 4000;
  }

  shouldRetry(attempt: number, reason: string): { decision: RetryDecision; backoffMs?: number } {
    if (attempt >= this.maxRetries) {
      return { decision: RetryDecision.Escalate };
    }

    if (reason.includes('rate_limit') || reason.includes('RateLimitError')) {
      return { decision: RetryDecision.Escalate };
    }

    if (reason.includes('unauthorized') || reason.includes('auth_failed')) {
      return { decision: RetryDecision.Escalate };
    }

    if (reason.includes('timeout') && attempt >= 2) {
      return { decision: RetryDecision.Escalate };
    }

    const backoff = Math.min(
      this.baseBackoffMs * Math.pow(2, attempt),
      this.maxBackoffMs,
    );

    return { decision: RetryDecision.Retry, backoffMs: backoff };
  }

  getBackoffMs(attempt: number): number {
    return Math.min(this.baseBackoffMs * Math.pow(2, attempt), this.maxBackoffMs);
  }

  canRetry(attempt: number): boolean {
    return attempt < this.maxRetries;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }

  getBaseBackoffMs(): number {
    return this.baseBackoffMs;
  }

  getMaxBackoffMs(): number {
    return this.maxBackoffMs;
  }
}

export const createRetryPolicy = (options?: RetryPolicyOptions): RetryPolicy => {
  return new RetryPolicy(options);
};

export const DEFAULT_RETRY_POLICY = new RetryPolicy();