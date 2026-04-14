// Watch daemon — monitors file changes, routes through GitNexus, triggers quality gates, systemd-friendly

import chokidar, { FSWatcher } from 'chokidar';
import { ConfigService } from '@openclaw/core-config';
import { createLogger, Logger } from '@openclaw/core-logging';
import { EventBus } from '@openclaw/core-events';
import type { OpenClawConfig } from '@openclaw/core-types';
import { LocalEslintRunner } from '@openclaw/tool-eslint';
import { LocalPrettierRunner } from '@openclaw/tool-prettier';
import { LocalSecDevAdapter } from '@openclaw/tool-secdev';
import { LocalGitNexusAdapter, type GitNexusResult } from '@openclaw/tool-gitnexus';
import { ChangedFileQualityService } from '@openclaw/change-detector';
import { DurableFileAuditStore } from '@openclaw/audit-store';

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
  private running = false;
  private qualityGateLock = false; // coalescing lock for Phase 8

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLogger(config.logging);
    this.eventBus = new EventBus(this.logger);

    // Initialize GitNexus adapter as authoritative change intelligence layer
    this.gitNexus = new LocalGitNexusAdapter(this.eventBus, this.logger);

    // Wire up tool adapters
    const eslintRunner = new LocalEslintRunner(this.logger, {
      configFile: this.config.tools.eslint.configFile,
    });
    const prettierRunner = new LocalPrettierRunner(this.logger);
    const secdevAdapter = new LocalSecDevAdapter(this.logger);

    this.qualityService = new ChangedFileQualityService(
      this.eventBus,
      this.logger,
      eslintRunner,
      prettierRunner,
      secdevAdapter,
    );

    // Use durable file-backed audit store
    this.auditStore = new DurableFileAuditStore(
      config.audit.storePath,
      config.audit.deadLetterPath,
      this.logger,
    );

    // Audit all events
    this.eventBus.onAny(async (event) => {
      try {
        await this.auditStore.persist(event);
      } catch (err) {
        this.logger.error('daemon.audit.persist_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Set up dead-letter handler
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
      ignored: [
        /node_modules/,
        /dist/,
        /\.git/,
        /\.openclaw/,
      ],
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher
      .on('add', (filePath) => this.onFileChange(filePath))
      .on('change', (filePath) => this.onFileChange(filePath))
      .on('unlink', (filePath) => this.onFileChange(filePath))
      .on('error', (error) => {
        this.logger.error('daemon.watcher.error', {
          error: error.message,
        });
      })
      .on('ready', () => {
        this.logger.info('daemon.ready', {
          watchedPaths: this.config.daemon.watchPaths,
        });
      });

    // Graceful shutdown
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGHUP', () => this.reload());
  }

  private onFileChange(filePath: string): void {
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

    // Run coalescing: skip if a quality gate is already running (Phase 8)
    if (this.qualityGateLock) {
      this.logger.debug('daemon.quality.gate.coalesced', {
        pendingFiles: this.pendingFiles.size,
      });
      return;
    }

    const files = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    this.logger.info('daemon.processing.changes', { fileCount: files.length });

    // Route change intelligence through GitNexus adapter
    if (this.config.tools.gitnexus.enabled) {
      try {
        // Use raw file paths from chokidar, let GitNexus resolve ownership
        const gitNexusResult = await this.resolveChangesViaGitNexus(files);

        // Emit GitNexus events
        await this.gitNexus.emitEvents(gitNexusResult);

        // Run quality gate on changed files with SecDev pass
        await this.runQualityGateWithLock(files);

        this.logger.info('daemon.processing.complete', {
          fileCount: files.length,
          packageCount: gitNexusResult.packageNames.length,
        });
      } catch (err) {
        this.logger.error('daemon.gitnexus.error', {
          error: err instanceof Error ? err.message : String(err),
        });
        // Fallback: run quality gate directly without GitNexus metadata
        await this.runQualityGateWithLock(files);
      }
    } else {
      // GitNexus disabled — run quality gate directly
      await this.runQualityGateWithLock(files);
    }
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

  private async runQualityGateWithLock(files: string[]): Promise<void> {
    this.qualityGateLock = true;
    try {
      await this.qualityService.runQualityGate(files);
    } catch (err) {
      this.logger.error('daemon.quality.gate.error', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.qualityGateLock = false;
    }
  }

  async shutdown(reason = 'manual'): Promise<void> {
    this.logger.info('daemon.shutdown', { reason });
    this.running = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
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
    // In production, reload config and restart watcher
    this.gitNexus.invalidatePackageCache();
  }

  get isRunning(): boolean {
    return this.running;
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

  // Keep process alive
  await new Promise(() => {});
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('Daemon failed:', err);
    process.exit(1);
  });
}
