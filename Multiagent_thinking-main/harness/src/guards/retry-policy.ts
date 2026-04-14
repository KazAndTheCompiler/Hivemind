import { RetryResult, RetryPolicy } from '../schemas/index.js';

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (attempt: number, error: Error) => void
): Promise<RetryResult & { result?: T }> {
  let attempt = 0;
  let delay = policy.baseDelayMs;
  
  while (attempt <= policy.maxRetries) {
    try {
      const result = await fn();
      return {
        success: true,
        retryCount: attempt,
        result,
      };
    } catch (error) {
      attempt++;
      
      if (onRetry && error instanceof Error) {
        onRetry(attempt, error);
      }
      
      if (attempt > policy.maxRetries) {
        return {
          success: false,
          retryCount: attempt,
          reason: error instanceof Error ? error.message : 'unknown',
          costEstimate: attempt * 100,
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * policy.backoffMultiplier, policy.maxDelayMs);
    }
  }
  
  return {
    success: false,
    retryCount: attempt,
    reason: 'exhausted retries',
  };
}

export function createRetryPolicy(overrides: Partial<RetryPolicy>): RetryPolicy {
  return { ...DEFAULT_RETRY_POLICY, ...overrides };
}

export class RetryRunner {
  private policy: RetryPolicy;
  
  constructor(policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.policy = policy;
  }
  
  async run<T>(fn: () => Promise<T>): Promise<RetryResult & { result?: T }> {
    return withRetry(fn, this.policy);
  }
  
  setPolicy(policy: RetryPolicy): void {
    this.policy = policy;
  }
  
  getPolicy(): RetryPolicy {
    return { ...this.policy };
  }
}