// Watch daemon — monitors file changes, triggers quality gates, systemd-friendly

import chokidar, { FSWatcher } from 'chokidar';
import { ConfigService } from '@openclaw/core-config';
import { createLogger, Logger } from '@openclaw/core-logging';
import { EventBus } from '@openclaw/core-events';
import type { OpenClawConfig } from '@openclaw/core-types';
import { LocalEslintRunner } from '@openclaw/tool-eslint';
import { LocalPrettierRunner } from '@openclaw/tool-prettier';
import { LocalSecDevAdapter } from '@openclaw/tool-secdev';
import { ChangedFileQualityService } from '@openclaw/change-detector';
import { AuditStore } from '@openclaw/audit-store';

export class WatchDaemon {
  private config: OpenClawConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingFiles = new Set<string>();
  private qualityService: ChangedFileQualityService;
  private auditStore: AuditStore;
  private running = false;

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLogger(config.logging);
    this.eventBus = new EventBus(this.logger);

    // Wire up tool adapters
    const eslintRunner = new LocalEslintRunner(this.logger, this.config.tools.eslint.configFile);
    const prettierRunner = new LocalPrettierRunner(this.logger);
    const secdevAdapter = new LocalSecDevAdapter(this.logger);

    this.qualityService = new ChangedFileQualityService(
      this.eventBus,
      this.logger,
      eslintRunner,
      prettierRunner,
      secdevAdapter,
    );

    const auditStorePath = config.audit.storePath;
    const deadLetterPath = config.audit.deadLetterPath;
    this.auditStore = new AuditStore(auditStorePath, deadLetterPath, this.logger);

    // Audit all events
    this.eventBus.onAny(async (event) => {
      try {
        await this.auditStore.persist(event);
      } catch {
        // Silent fail for audit persistence errors
      }
    });

    // Set up dead-letter handler
    this.eventBus.setDeadLetterHandler(async (event, reason) => {
      await this.auditStore.persistDeadLetter(event, reason);
    });

    this.logger.info('daemon.initialized', {
      watchPaths: this.config.daemon.watchPaths,
      debounceMs: this.config.daemon.debounceMs,
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

    const files = Array.from(this.pendingFiles);
    this.pendingFiles.clear();

    this.logger.info('daemon.processing.changes', { fileCount: files.length });

    try {
      // Run quality gate on changed files
      await this.qualityService.runQualityGate(files);
    } catch (err) {
      this.logger.error('daemon.quality.gate.error', {
        error: err instanceof Error ? err.message : String(err),
      });
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
  }

  private reload(): void {
    this.logger.info('daemon.reload');
    // In production, reload config and restart watcher
  }

  get isRunning(): boolean {
    return this.running;
  }
}

// Factory
export function createDaemon(config?: unknown): WatchDaemon {
  const configService = new ConfigService(config);
  return new WatchDaemon(configService.getConfig());
}

// CLI entry point
async function main(): Promise<void> {
  const configPath = process.env.OPENCLAW_CONFIG;

  let daemon: WatchDaemon;
  if (configPath) {
    daemon = createDaemon(require(configPath));
  } else {
    daemon = createDaemon();
  }

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
