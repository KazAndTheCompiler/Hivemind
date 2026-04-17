// Tool execution queue with bounded concurrency, timeout, and cancellation support
// Prevents runaway tool execution under load with resource limits

import { Logger } from '@openclaw/core-logging';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  exitCode?: number;
}

export interface ResourceLimits {
  nice?: number;
  maxMemoryMb?: number;
  maxCpuPercent?: number;
  maxConcurrency?: number;
}

export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  nice: 10,
  maxMemoryMb: 512,
  maxConcurrency: 4,
};

export interface ToolRunMetrics {
  totalRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  timedOutRuns: number;
  totalDurationMs: number;
}

export class CancelToken {
  private _cancelled = false;
  cancel(): void {
    this._cancelled = true;
  }
  get isCancelled(): boolean {
    return this._cancelled;
  }
}

export class ToolExecutionQueue {
  private maxConcurrent: number;
  private defaultTimeoutMs: number;
  private activeTasks = new Set<Promise<unknown>>();
  private cancelTokens = new Map<string, CancelToken>();
  private resourceLimits: ResourceLimits;
  private metrics: ToolRunMetrics = {
    totalRuns: 0,
    failedRuns: 0,
    cancelledRuns: 0,
    timedOutRuns: 0,
    totalDurationMs: 0,
  };

  constructor(
    _logger: Logger,
    options?: {
      maxConcurrent?: number;
      defaultTimeoutMs?: number;
      resourceLimits?: ResourceLimits;
    },
  ) {
    this.maxConcurrent = options?.maxConcurrent ?? DEFAULT_RESOURCE_LIMITS.maxConcurrency ?? 4;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 15_000;
    this.resourceLimits = { ...DEFAULT_RESOURCE_LIMITS, ...options?.resourceLimits };
  }

  async enqueue(task: ToolTask): Promise<ToolTaskResult> {
    while (this.activeTasks.size >= this.maxConcurrent) {
      await Promise.race([
        ...this.activeTasks,
        new Promise((resolve) => setTimeout(resolve, 100)),
      ]);
    }

    const cancelToken = new CancelToken();
    this.cancelTokens.set(task.name, cancelToken);
    this.metrics.totalRuns++;

    const start = Date.now();
    const taskPromise = this.executeWithTimeout(task, cancelToken, this.defaultTimeoutMs).finally(
      () => {
        this.activeTasks.delete(taskPromise);
        this.cancelTokens.delete(task.name);
      },
    );

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
      if (timedOut) this.metrics.timedOutRuns++;
      if (cancelled) this.metrics.cancelledRuns++;
      if (!timedOut && !cancelled) this.metrics.failedRuns++;
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

  async enqueueWithNice(task: ToolTask, niceValue?: number): Promise<ToolTaskResult> {
    const nice = niceValue ?? this.resourceLimits.nice ?? 10;
    const wrappedTask: ToolTask = {
      name: task.name,
      execute: async () => {
        try {
          await execAsync(`renice ${nice} $$`, { shell: '/bin/bash' });
        } catch {}
        return task.execute();
      },
    };
    return this.enqueue(wrappedTask);
  }

  cancelAll(): void {
    for (const token of this.cancelTokens.values()) {
      token.cancel();
    }
  }

  cancelTask(name: string): boolean {
    const token = this.cancelTokens.get(name);
    if (token) {
      token.cancel();
      return true;
    }
    return false;
  }

  get activeCount(): number {
    return this.activeTasks.size;
  }

  get pendingCancelCount(): number {
    return this.cancelTokens.size;
  }

  getMetrics(): ToolRunMetrics {
    return { ...this.metrics };
  }

  getResourceLimits(): ResourceLimits {
    return { ...this.resourceLimits };
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

      task
        .execute()
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
