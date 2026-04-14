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
import { AgentMemory, InMemorySink } from '@openclaw/agent-memory';
import { AuditStore } from '@openclaw/audit-store';

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
  private auditStore: AuditStore;
  private running = false;

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLoggerFromConfig(config);
    this.eventBus = new EventBus(this.logger);

    // Set up audit dead-letter handler
    this.eventBus.setDeadLetterHandler(async (event, reason) => {
      this.logger.warn('orchestrator.dead_letter', { reason, kind: event.kind });
    });

    const auditStorePath = config.audit.storePath;
    const deadLetterPath = config.audit.deadLetterPath;
    this.auditStore = new AuditStore(auditStorePath, deadLetterPath, this.logger);

    // Wire up services
    this.ingestService = new AgentSummaryIngestService(this.eventBus, this.logger);
    this.normalizationService = new SummaryNormalizationService(this.eventBus, this.logger);
    this.condenseService = new SummaryCondenseService(this.eventBus, this.logger);
    this.relayService = new MainAgentRelayService(this.eventBus, this.logger);
    this.router = new AgentRouter(this.eventBus, this.logger);

    // Set up memory
    const memorySink = new InMemorySink(this.logger);
    this.memory = new AgentMemory(memorySink, 'orchestrator');

    // Start router listening
    this.router.startListening();

    // Audit all events
    this.eventBus.onAny(async (event) => {
      try {
        await this.auditStore.persist(event);
      } catch (err) {
        this.logger.error('orchestrator.audit.persist_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    this.logger.info('orchestrator.initialized');
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

    // Step 3: Condense
    const { relay200, relay300 } = await this.condenseService.condenseAndEmit(normalized);

    // Step 4: Relay to main agent
    await this.relayService.deliverAndEmit(relay200, relay300);

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
    this.logger.info('orchestrator.shutdown', { reason });

    await this.eventBus.emit({
      kind: 'orchestrator.shutdown',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  get status() {
    return {
      running: this.running,
      inboxSize: this.router.inboxSize,
      unreadCount: this.router.unreadCount,
    };
  }
}

// Factory function
export function createOrchestrator(config?: unknown): OrchestratorService {
  const configService = new ConfigService(config);
  return new OrchestratorService(configService.getConfig());
}
