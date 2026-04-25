// Watch daemon — monitors file changes, routes through GitNexus, triggers quality gates
// Flow: fs → debounce → gitnexus → graphify → change context → quality gate → audit
// systemd-friendly with graceful shutdown

import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import { ConfigService } from '@openclaw/core-config';
import { createLogger, Logger } from '@openclaw/core-logging';
import { EventBus } from '@openclaw/core-events';
import type { OpenClawConfig, ChangeContext, DiffSchema } from '@openclaw/core-types';
import { LocalEslintRunner, CancelToken } from '@openclaw/tool-eslint';
import { LocalPrettierRunner } from '@openclaw/tool-prettier';
import { LocalSecDevAdapter } from '@openclaw/tool-secdev';
import { LocalGitNexusAdapter, type GitNexusResult } from '@openclaw/tool-gitnexus';
import { LocalGraphifyAdapter, type GraphifyUpdateResult } from '@openclaw/tool-graphify';
import { ChangedFileQualityService } from '@openclaw/change-detector';
import { ToolExecutionQueue } from '@openclaw/tool-runner';
import { DurableFileAuditStore } from '@openclaw/audit-store';

const TOOL_TIMEOUT = 15_000;
const MAX_CONCURRENT_TOOLS = 4;

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
  private graphify: LocalGraphifyAdapter | null = null;
  private toolQueue: ToolExecutionQueue;
  private running = false;
  private startTime = Date.now();
  private pipelineRunPromise: Promise<void> | null = null;
  private cancelToken: CancelToken | null = null;
  private lastDiffSchemas: DiffSchema[] = [];

  constructor(config: OpenClawConfig, eventBus?: EventBus) {
    this.config = config;
    this.logger = createLogger(config.logging);
    this.eventBus = eventBus ?? new EventBus(this.logger);

    this.gitNexus = new LocalGitNexusAdapter(this.eventBus, this.logger, config.workspace);

    // Initialize graphify adapter if enabled
    if (config.tools.graphify?.enabled) {
      this.graphify = new LocalGraphifyAdapter(
        this.eventBus,
        this.logger,
        config.workspace,
        {
          venvPath: config.tools.graphify.venvPath,
          graphPath: config.tools.graphify.graphPath,
        },
      );
    }

    this.toolQueue = new ToolExecutionQueue(this.logger, {
      maxConcurrent: MAX_CONCURRENT_TOOLS,
      defaultTimeoutMs: TOOL_TIMEOUT,
    });

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

    this.auditStore = new DurableFileAuditStore(
      config.audit.storePath,
      config.audit.deadLetterPath,
      this.logger,
    );

    this.eventBus.onAny(async (event) => {
      try {
        await this.auditStore.persist(event);
      } catch (err) {
        this.logger.error('daemon.audit.persist_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.eventBus.setDeadLetterHandler(async (event, reason) => {
      try {
        await this.auditStore.persistDeadLetter(event, reason);
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
      graphifyEnabled: !!this.graphify,
      toolTimeout: TOOL_TIMEOUT,
      maxConcurrentTools: MAX_CONCURRENT_TOOLS,
    });
  }

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('daemon.already.running');
      return;
    }

    this.running = true;
    this.logger.info('daemon.starting');

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
      })
      .on('ready', () => {
        this.logger.info('daemon.ready', { watchedPaths: this.config.daemon.watchPaths });
      });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGHUP', () => this.reload());
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
   * fs changes → GitNexus resolution → Graphify update → change context → quality gate → audit
   */
  private async runPipeline(rawFiles: string[], cancelToken: CancelToken): Promise<void> {
    if (cancelToken.isCancelled) return;

    // Step 1: Route through GitNexus for authoritative change intelligence
    let gitNexusResult: GitNexusResult | null = null;
    if (this.config.tools.gitnexus.enabled) {
      try {
        gitNexusResult = await this.resolveChangesViaGitNexus(rawFiles);
        await this.gitNexus.emitEvents(gitNexusResult);
        this.logger.info('daemon.gitnexus.resolved', {
          fileCount: gitNexusResult.changedFiles.length,
          packageCount: gitNexusResult.packageNames.length,
        });
      } catch (err) {
        this.logger.error('daemon.gitnexus.error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (cancelToken.isCancelled) return;

    // Step 1.5: Graphify incremental update (AST-only, zero LLM cost)
    let graphifyResult: GraphifyUpdateResult | null = null;
    if (this.graphify && this.config.tools.graphify?.enabled) {
      try {
        graphifyResult = await this.graphify.incrementalUpdate(rawFiles);
        await this.graphify.emitUpdateEvent(graphifyResult);
        this.logger.info('daemon.graphify.updated', {
          nodeCount: graphifyResult.nodeCount,
          edgeCount: graphifyResult.edgeCount,
          durationMs: graphifyResult.durationMs,
        });
      } catch (err) {
        this.logger.error('daemon.graphify.error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (cancelToken.isCancelled) return;

    // Step 2: Run quality gate (prettier + eslint + secdev) through tool queue
    await this.qualityService.runQualityGate(rawFiles);

    if (cancelToken.isCancelled) return;

    // Step 3: Build and emit ChangeContext for orchestrator consumption
    await this.emitChangeContext(rawFiles, gitNexusResult, graphifyResult);

    this.logger.info('daemon.pipeline.complete', {
      fileCount: rawFiles.length,
      packages: gitNexusResult?.packageNames ?? [],
    });
  }

  /**
   * Resolve changed files through GitNexus using real git-based detection.
   * Produces actual diff data instead of shallow status mapping.
   */
  private async resolveChangesViaGitNexus(_files: string[]): Promise<GitNexusResult> {
    const result = await this.gitNexus.detectChanges('HEAD');
    this.lastDiffSchemas = await this.gitNexus.diffToSchema('HEAD');
    return result;
  }

  /**
   * Build ChangeContext from diff schemas + graphify subgraph, then emit
   * change.context.ready event for orchestrator consumption.
   */
  private async emitChangeContext(
    rawFiles: string[],
    gitNexusResult: GitNexusResult | null,
    graphifyResult: GraphifyUpdateResult | null,
  ): Promise<void> {
    const changeContext: ChangeContext = {
      changedFiles: this.lastDiffSchemas,
      subgraph: null,
      packageNames: gitNexusResult?.packageNames ?? [],
      timestamp: new Date().toISOString(),
    };

    // If graphify has a graph, query for relevant subgraph around changed files
    if (this.graphify && graphifyResult && graphifyResult.nodeCount > 0) {
      try {
        const fileQuery = rawFiles
          .map(f => path.basename(f, path.extname(f)))
          .join(' ');
        changeContext.subgraph = await this.graphify.query(
          `changes in ${fileQuery}`,
          this.config.tools.graphify?.queryBudget ?? 500,
        );
      } catch {
        // Subgraph is optional — continue without it
      }
    }

    await this.eventBus.emit({
      kind: 'change.context.ready',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: changeContext.packageNames.join(',') || 'unknown',
      context: changeContext,
      timestamp: new Date().toISOString(),
    });
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
    this.logger.info('daemon.reload');
    this.gitNexus.invalidatePackageCache();
    // In production, reload config and restart watcher
  }

  get isRunning(): boolean { return this.running; }

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
