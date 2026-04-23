// Watch daemon — monitors file changes, routes through GitNexus, triggers quality gates
// Flow: fs → debounce → gitnexus → canonical change event → pipeline
// systemd-friendly with graceful shutdown

import chokidar, { FSWatcher } from 'chokidar';
import { ConfigService } from '@openclaw/core-config';
import { createLogger, Logger } from '@openclaw/core-logging';
import { EventBus } from '@openclaw/core-events';
import type { OpenClawConfig } from '@openclaw/core-types';
import { LocalEslintRunner, CancelToken } from '@openclaw/tool-eslint';
import { LocalPrettierRunner } from '@openclaw/tool-prettier';
import { LocalSecDevAdapter } from '@openclaw/tool-secdev';
import { LocalGitNexusAdapter, type GitNexusResult } from '@openclaw/tool-gitnexus';
import { ChangedFileQualityService } from '@openclaw/change-detector';
import { ToolExecutionQueue } from '@openclaw/tool-runner';
import { DurableFileAuditStore } from '@openclaw/audit-store';

const TOOL_TIMEOUT = 15_000;
const MAX_CONCURRENT_TOOLS = 4;

// Circuit breaker constants
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 30_000;

type CircuitState = 'closed' | 'half-open' | 'open';

export class WatchDaemon {
  private config: OpenClawConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingFiles = new Set<string>();
  private qualityService: ChangedFileQualityService;
  private auditStore: DurableFileAuditStore;
  private gitNexus: LocalGitNexusAdapter;
  private toolQueue: ToolExecutionQueue;
  private running = false;
  private startTime = Date.now();
  private pipelineRunPromise: Promise<void> | null = null; // Run coalescing
  private cancelToken: CancelToken | null = null; // Cancellation support
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureAt: number | null = null;

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLogger(config.logging);
    this.eventBus = new EventBus(this.logger);

    // Initialize GitNexus adapter as authoritative change intelligence layer
    this.gitNexus = new LocalGitNexusAdapter(this.eventBus, this.logger);

    // Tool execution queue with bounded concurrency
    this.toolQueue = new ToolExecutionQueue(this.logger, {
      maxConcurrent: MAX_CONCURRENT_TOOLS,
      defaultTimeoutMs: TOOL_TIMEOUT,
    });

    // Wire up tool adapters
    const eslintRunner = new LocalEslintRunner(this.logger, {
      configFile: this.config.tools.eslint.configFile,
      timeoutMs: TOOL_TIMEOUT,
    });
    const prettierRunner = new LocalPrettierRunner(this.logger, {
      timeoutMs: TOOL_TIMEOUT,
    });
    const secdevAdapter = new LocalSecDevAdapter(this.logger);

    this.qualityService = new ChangedFileQualityService(
      this.eventBus,
      this.logger,
      eslintRunner,
      prettierRunner,
      secdevAdapter,
    );

    // Use durable file-backed audit store with JSONL logs
    this.auditStore = new DurableFileAuditStore(
      config.audit.storePath,
      config.audit.deadLetterPath,
      this.logger,
    );

    // Audit all events
    this.eventBus.onAny(async (event: unknown) => {
      try {
        await this.auditStore.persist(event as Parameters<typeof this.auditStore.persist>[0]);
      } catch (err) {
        this.logger.error('daemon.audit.persist_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Set up dead-letter handler
    this.eventBus.setDeadLetterHandler(async (event: unknown, reason: string) => {
      try {
        await this.auditStore.persistDeadLetter(
          event as Parameters<typeof this.auditStore.persistDeadLetter>[0],
          reason,
        );
      } catch (err) {
        this.logger.error('daemon.dead_letter.persist_error', {
          reason,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.logger.info('daemon.initialized', {
      watchPaths: this.config.daemon.watchPaths,
      debounceMs: this.config.daemon.debounceMs,
      gitNexusEnabled: this.config.tools.gitnexus.enabled,
      toolTimeout: TOOL_TIMEOUT,
      maxConcurrentTools: MAX_CONCURRENT_TOOLS,
    });
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('daemon.already.running', {});
      return;
    }

    this.running = true;
    this.logger.info('daemon.starting', {});

    // Circuit breaker: skip watch if circuit is open
    if (this.circuitState === 'open') {
      const retryIn = this.lastFailureAt !== null
        ? Math.max(0, CIRCUIT_OPEN_DURATION_MS - (Date.now() - this.lastFailureAt))
        : CIRCUIT_OPEN_DURATION_MS;
      this.logger.warn('circuit breaker OPEN — skipping watch', { circuitState: 'open', retryInMs: retryIn });
      return;
    }

    try {
      await this._startWatcher();
    } catch (err) {
      this._recordWatchFailure(err);
    }

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGHUP', () => this.reload());
  }

  private async _startWatcher(): Promise<void> {
    this.watcher = chokidar.watch(this.config.daemon.watchPaths, {
      ignored: [/node_modules/, /dist/, /\.git/, /\.openclaw/],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath) => this.onFileChange(filePath))
      .on('change', (filePath) => this.onFileChange(filePath))
      .on('unlink', (filePath) => this.onFileChange(filePath))
      .on('error', (error) => {
        this.logger.error('daemon.watcher.error', { error: error.message });
        this._recordWatchFailure(error);
      })
      .on('ready', () => {
        this.logger.info('daemon.ready', { watchedPaths: this.config.daemon.watchPaths });
      });
  }

  private _recordWatchFailure(_err: unknown): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.circuitState === 'half-open') {
      // Failure in half-open → stay open
      this.logger.warn('circuit breaker OPEN — half-open attempt failed', {
        circuitState: 'open',
        failureCount: this.failureCount,
        retryInMs: CIRCUIT_OPEN_DURATION_MS,
      });
      this.circuitState = 'open';
      setTimeout(() => this._attemptReclose(), CIRCUIT_OPEN_DURATION_MS);
      return;
    }

    if (this.failureCount >= FAILURE_THRESHOLD) {
      this.circuitState = 'open';
      this.logger.warn('circuit breaker OPEN — skipping watch', {
        circuitState: 'open',
        retryInMs: CIRCUIT_OPEN_DURATION_MS,
      });
      // Stop the watcher
      if (this.watcher) {
        this.watcher.close().catch(() => {
          // ignore
        });
        this.watcher = null;
      }
      setTimeout(() => this._attemptReclose(), CIRCUIT_OPEN_DURATION_MS);
    }
  }

  private async _attemptReclose(): Promise<void> {
    if (this.circuitState !== 'open') return;
    this.circuitState = 'half-open';
    this.logger.info('circuit breaker HALF-OPEN — attempting watch', { circuitState: 'half-open' });
    try {
      await this._startWatcher();
      // Success → close circuit
      this.circuitState = 'closed';
      this.failureCount = 0;
      this.lastFailureAt = null;
      this.logger.info('circuit breaker CLOSED — watch re-established', { circuitState: 'closed' });
    } catch (_err) {
      this._recordWatchFailure(_err);
    }
  }

  get circuitBreakerState(): CircuitState {
    return this.circuitState;
  }

  // ---------------------------------------------------------------------------
  // File Change Flow: fs → debounce → gitnexus → canonical → pipeline
  // ---------------------------------------------------------------------------

  private onFileChange(filePath: string): void {
    if (!this.running) return;

    // Collect raw filesystem changes
    this.pendingFiles.add(filePath);

    // Debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChanges();
    }, this.config.daemon.debounceMs);
  }

  private async processChanges(): Promise<void> {
    if (this.pendingFiles.size === 0) return;

    // Run coalescing: skip if pipeline is already running
    if (this.pipelineRunPromise) {
      this.logger.debug('daemon.pipeline.coalesced', {
        pendingFiles: this.pendingFiles.size,
      });
      return;
    }

    // Collect all pending changes
    const rawFiles = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    this.logger.info('daemon.processing.changes', { fileCount: rawFiles.length });

    // Create cancellation token for this run
    this.cancelToken = new CancelToken();

    // Execute pipeline with coalescing
    this.pipelineRunPromise = this.runPipeline(rawFiles, this.cancelToken)
      .finally(() => {
        this.pipelineRunPromise = null;
        this.cancelToken = null;
      });

    return this.pipelineRunPromise;
  }

  /**
   * Full change processing pipeline:
   * fs changes → GitNexus resolution → canonical change event → quality gate → secdev → audit
   */
  private async runPipeline(rawFiles: string[], cancelToken: CancelToken): Promise<void> {
    if (cancelToken.isCancelled) return;

    // Step 1: Route through GitNexus for authoritative change intelligence
    let gitNexusResult: GitNexusResult | null = null;
    if (this.config.tools.gitnexus.enabled) {
      try {
        gitNexusResult = await this.resolveChangesViaGitNexus(rawFiles);
        // Emit canonical GitNexus change event
        await this.gitNexus.emitEvents(gitNexusResult);
        this.logger.info('daemon.gitnexus.resolved', {
          fileCount: gitNexusResult.changedFiles.length,
          packageCount: gitNexusResult.packageNames.length,
        });
      } catch (err) {
        this.logger.error('daemon.gitnexus.error', {
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue without GitNexus metadata
      }
    }

    if (cancelToken.isCancelled) return;

    // Step 2: Run quality gate (prettier + eslint + secdev) through tool queue
    await this.qualityService.runQualityGate(rawFiles);

    if (cancelToken.isCancelled) return;

    this.logger.info('daemon.pipeline.complete', {
      fileCount: rawFiles.length,
      packages: gitNexusResult?.packageNames ?? [],
    });
  }

  /**
   * Resolve changed files through GitNexus for authoritative change intelligence.
   * Maps files to package ownership and classifies them.
   */
  private async resolveChangesViaGitNexus(files: string[]): Promise<GitNexusResult> {
    const changedFiles = files.map((f) => ({
      path: f,
      status: 'modified' as const,
    }));

    const fileToPackage = new Map<string, string>();
    const packageNames = new Set<string>();

    for (const file of changedFiles) {
      const owner = await this.gitNexus.resolveFileOwnership(file.path);
      if (owner) {
        fileToPackage.set(file.path, owner);
        packageNames.add(owner);
      }
    }

    return {
      changedFiles,
      packageNames: Array.from(packageNames),
      fileToPackage,
      diff: { added: 0, removed: 0, modified: files.length },
    };
  }

  // ---------------------------------------------------------------------------
  // Shutdown with cancellation
  // ---------------------------------------------------------------------------

  async shutdown(reason = 'manual'): Promise<void> {
    this.logger.info('daemon.shutdown', { reason });
    this.running = false;

    // Cancel any running pipeline
    this.cancelToken?.cancel();

    // Cancel all tool executions
    this.toolQueue.cancelAll();

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Wait for pipeline to finish
    if (this.pipelineRunPromise) {
      await this.pipelineRunPromise;
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    // Flush pending audit writes
    await this.auditStore.flush();
  }

  private reload(): void {
    this.logger.info('daemon.reload', {});
    this.gitNexus.invalidatePackageCache();
    // In production, reload config and restart watcher
  }

  get isRunning(): boolean {
    return this.running;
  }

  get status() {
    return this.getHealth();
  }

  getHealth(): {
    healthy: boolean;
    running: boolean;
    uptime: number;
    pendingFiles: number;
    pipelineRunning: boolean;
    eventBus: {
      bufferSize: number;
      overflowCount: number;
      totalProcessed: number;
      totalFailures: number;
    };
    watcher: {
      ready: boolean;
      watchedPaths: number;
    };
  } {
    return {
      healthy: this.running,
      running: this.running,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      pendingFiles: this.pendingFiles.size,
      pipelineRunning: this.pipelineRunPromise !== null,
      eventBus: {
        bufferSize: this.eventBus.getBufferSize(),
        overflowCount: this.eventBus.getOverflowCount(),
        totalProcessed: this.eventBus.getTotalProcessed(),
        totalFailures: this.eventBus.getTotalFailures(),
      },
      watcher: {
        ready: this.watcher !== null,
        watchedPaths: this.config.daemon.watchPaths.length,
      },
    };
  }
}

// Factory
export function createDaemon(_config?: unknown): WatchDaemon {
  const configService = ConfigService.fromFileOrDefaults(
    process.env.OPENCLAW_CONFIG,
  );
  const cfg = configService.getConfig();
  ConfigService.validateStartup(cfg);
  return new WatchDaemon(cfg);
}

// CLI entry point
async function main(): Promise<void> {
  const daemon = createDaemon();
  await daemon.start();
  await new Promise(() => {});
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Daemon failed:', err);
    process.exit(1);
  });
}
