// OrchestratorService — supervisor pattern for worker agents
// Coordinates the full pipeline: ingest → normalize → condense → relay

import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  OpenClawConfig,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger, createLoggerFromConfig } from '@openclaw/core-logging';
import { ConfigService } from '@openclaw/core-config';
import { AgentSummaryIngestService, SummaryNormalizationService } from '@openclaw/summarizer';
import { SummaryCondenseService } from '@openclaw/condense-engine';
import { MainAgentRelayService } from '@openclaw/agent-relay';
import { AgentRouter } from '@openclaw/agent-router';
import { AgentMemory, DurableFileSink, type MemorySink } from '@openclaw/agent-memory';
import { DurableFileAuditStore } from '@openclaw/audit-store';

export class OrchestratorService {
  private config: OpenClawConfig;
  private logger: Logger;
  private eventBus: EventBus;
  private ingestService: AgentSummaryIngestService;
  private normalizationService: SummaryNormalizationService;
  private condenseService: SummaryCondenseService;
  private relayService: MainAgentRelayService;
  private router: AgentRouter;
  private memory: AgentMemory;
  private auditStore: DurableFileAuditStore;
  private running = false;
  private pendingOperations = new Set<Promise<unknown>>();

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLoggerFromConfig(config);
    this.eventBus = new EventBus(this.logger);

    // Set up durable audit store
    this.auditStore = new DurableFileAuditStore(
      config.audit.storePath,
      config.audit.deadLetterPath,
      this.logger,
    );

    // Set up dead-letter handler — captures all failed events
    this.eventBus.setDeadLetterHandler(async (event, reason) => {
      this.logger.warn('orchestrator.dead_letter', { reason, kind: event.kind });
      try {
        await this.auditStore.persistDeadLetter(event, reason);
      } catch (err) {
        this.logger.error('orchestrator.dead_letter.persist_error', {
          reason,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    // Wire up services
    this.ingestService = new AgentSummaryIngestService(this.eventBus, this.logger);
    this.normalizationService = new SummaryNormalizationService(this.eventBus, this.logger);
    this.condenseService = new SummaryCondenseService(this.eventBus, this.logger);
    this.relayService = new MainAgentRelayService(this.eventBus, this.logger);
    this.router = new AgentRouter(this.eventBus, this.logger);

    // Set up memory — use durable file-backed sink in production
    const memorySink = this.createMemorySink();
    this.memory = new AgentMemory(memorySink, 'orchestrator');

    // Start router listening
    this.router.startListening();

    // Audit all events
    this.eventBus.onAny(async (event) => {
      const op = this.trackOperation(this.auditStore.persist(event));
      this.pendingOperations.add(op);
      op.finally(() => this.pendingOperations.delete(op)).catch((err) => {
        this.logger.error('orchestrator.audit.persist_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    });

    this.logger.info('orchestrator.initialized', {
      memorySink: memorySink.constructor.name,
      maxWorkers: config.orchestrator.maxConcurrentWorkers,
    });
  }

  private createMemorySink(): MemorySink {
    // Use durable file-backed sink for production
    const memoryPath = `${this.config.audit.storePath}/memory`;
    return new DurableFileSink(memoryPath, this.logger);
  }

  // Main pipeline: raw summary → condensed relay → main agent delivery
  async processSummary(raw: unknown): Promise<{
    normalized: NormalizedAgentSummary;
    relay200: CondensedRelay200;
    relay300: CondensedRelay300;
  }> {
    if (!this.running) {
      throw new Error('Orchestrator is not running');
    }

    // Step 1: Ingest and validate
    const validated = await this.ingestService.ingest(raw);

    // Step 2: Normalize
    const normalized = await this.normalizationService.normalizeAndEmit(validated);

    // Step 3: Condense (guarantees 200/300 token budgets on full payload)
    const { relay200, relay300 } = await this.condenseService.condenseAndEmit(normalized);

    // Step 4: Relay to main agent (emits relay.delivered or relay.delivery_failed)
    const delivery = await this.relayService.deliverAndEmit(relay200, relay300);

    if (!delivery.delivered) {
      this.logger.error('orchestrator.relay.delivery_failed', {
        taskId: relay200.taskId,
      });
    }

    // Step 5: Persist in memory
    await this.memory.saveSummary(normalized);
    await this.memory.saveRelay(relay200, relay300);

    return { normalized, relay200, relay300 };
  }

  async start(): Promise<void> {
    this.running = true;
    this.logger.info('orchestrator.started', {
      maxWorkers: this.config.orchestrator.maxConcurrentWorkers,
    });

    await this.eventBus.emit({
      kind: 'orchestrator.started',
      timestamp: new Date().toISOString(),
    });
  }

  async shutdown(reason = 'manual'): Promise<void> {
    this.running = false;
    this.logger.info('orchestrator.shutdown.start', { reason });

    // Wait for pending operations (bounded wait)
    if (this.pendingOperations.size > 0) {
      this.logger.info('orchestrator.shutdown.waiting', {
        pendingCount: this.pendingOperations.size,
      });
      await Promise.allSettled(this.pendingOperations);
    }

    // Flush memory sink
    await this.memory.flush();

    // Flush audit store
    await this.auditStore.flush();

    this.logger.info('orchestrator.shutdown.complete', { reason });

    await this.eventBus.emit({
      kind: 'orchestrator.shutdown',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  private trackOperation<T>(op: Promise<T>): Promise<T> {
    this.pendingOperations.add(op);
    op.finally(() => this.pendingOperations.delete(op));
    return op;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get status() {
    return {
      running: this.running,
      inboxSize: this.router.inboxSize,
      unreadCount: this.router.unreadCount,
      eventBufferUtilization: this.eventBus.capacityUtilization,
      eventOverflowCount: this.eventBus.overflowCount,
      eventTotalProcessed: this.eventBus.totalProcessed,
      eventTotalFailures: this.eventBus.totalFailures,
      pendingOperations: this.pendingOperations.size,
      auditPendingWrites: this.auditStore.pendingCount,
    };
  }
}

// Factory function
export function createOrchestrator(_config?: unknown): OrchestratorService {
  const configService = ConfigService.fromFileOrDefaults(
    process.env.OPENCLAW_CONFIG,
  );
  const cfg = configService.getConfig();
  ConfigService.validateStartup(cfg);
  return new OrchestratorService(cfg);
}
