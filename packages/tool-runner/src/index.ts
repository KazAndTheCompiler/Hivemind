// Tool execution queue with bounded concurrency, timeout, and cancellation support
// Prevents runaway tool execution under load

import { Logger } from '@openclaw/core-logging';

export interface ToolTask {
  name: string;
  execute: () => Promise<unknown>;
}

export interface ToolTaskResult {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
  cancelled?: boolean;
  timedOut?: boolean;
}

/** Cancellation token for aborting tasks */
export class CancelToken {
  private _cancelled = false;
  cancel(): void { this._cancelled = true; }
  get isCancelled(): boolean { return this._cancelled; }
}

export class ToolExecutionQueue {
  private maxConcurrent: number;
  private defaultTimeoutMs: number;
  private activeTasks = new Set<Promise<unknown>>();
  private cancelTokens = new Map<string, CancelToken>();

  constructor(
    _logger: Logger,
    options?: { maxConcurrent?: number; defaultTimeoutMs?: number },
  ) {
    this.maxConcurrent = options?.maxConcurrent ?? 4;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 15_000;
  }

  /**
   * Execute a tool task with bounded concurrency.
   * Returns when the task completes or is rejected if the queue is full.
   */
  async enqueue(task: ToolTask): Promise<ToolTaskResult> {
    // Wait if at capacity
    while (this.activeTasks.size >= this.maxConcurrent) {
      // Wait for at least one active task to complete
      await Promise.race(this.activeTasks);
    }

    const cancelToken = new CancelToken();
    this.cancelTokens.set(task.name, cancelToken);

    const start = Date.now();
    const taskPromise = this.executeWithTimeout(task, cancelToken, this.defaultTimeoutMs)
      .finally(() => {
        this.activeTasks.delete(taskPromise);
        this.cancelTokens.delete(task.name);
      });

    this.activeTasks.add(taskPromise);

    try {
      await taskPromise;
      return {
        name: task.name,
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.message.includes('timeout');
      const cancelled = cancelToken.isCancelled;
      return {
        name: task.name,
        success: false,
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
        cancelled,
        timedOut,
      };
    }
  }

  /** Cancel all active tasks */
  cancelAll(): void {
    for (const token of this.cancelTokens.values()) {
      token.cancel();
    }
  }

  /** Get the number of currently active tasks */
  get activeCount(): number {
    return this.activeTasks.size;
  }

  /** Get the number of cancelled tasks */
  get pendingCancell(): number {
    return this.cancelTokens.size;
  }

  private async executeWithTimeout(
    task: ToolTask,
    cancelToken: CancelToken,
    timeoutMs: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          cancelToken.cancel();
          reject(new Error(`Task '${task.name}' timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      task.execute()
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(result);
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(err);
          }
        });
    });
  }
}
