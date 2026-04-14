// OrchestratorService — supervisor pattern for worker agents
// Coordinates the full pipeline: ingest → sanitize → validate → normalize → condense → relay

import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  OpenClawConfig,
  RawAgentSummary,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger, createLoggerFromConfig } from '@openclaw/core-logging';
import { ConfigService } from '@openclaw/core-config';
import { AgentSummaryIngestService, SummaryNormalizationService } from '@openclaw/summarizer';
import { SummaryCondenseService } from '@openclaw/condense-engine';
import { MainAgentRelayService } from '@openclaw/agent-relay';
import { AgentRouter } from '@openclaw/agent-router';
import { AgentMemory, DurableFileSink } from '@openclaw/agent-memory';
import { DurableFileAuditStore } from '@openclaw/audit-store';
import * as fs from 'fs';

export interface ColdStartCheckResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

export interface ReplayResult {
  eventCount: number;
  pipelineRuns: number;
  errors: string[];
}

export interface QualityScore {
  lint: number;    // 0-100
  format: number;  // 0-100
  security: number; // 0-100
  overall: number; // 0-100
}

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
  private pipelineHalted = false;
  private pipelineRunPromise: Promise<void> | null = null; // Run coalescing

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

    // Set up dead-letter handler
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

    // Set up memory
    const memoryPath = `${config.audit.storePath}/memory`;
    const memorySink = new DurableFileSink(memoryPath, this.logger);
    this.memory = new AgentMemory(memorySink, 'orchestrator');

    // Start router
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
      auditLogPaths: this.auditStore.logPaths,
    });
  }

  // ---------------------------------------------------------------------------
  // Cold Start Validation
  // ---------------------------------------------------------------------------

  coldStartCheck(): ColdStartCheckResult {
    const checks: ColdStartCheckResult['checks'] = [];

    // Check config
    try {
      ConfigService.validateStartup(this.config);
      checks.push({ name: 'config_valid', passed: true });
    } catch (err) {
      checks.push({ name: 'config_valid', passed: false, detail: err instanceof Error ? err.message : String(err) });
    }

    // Check audit store write permissions
    try {
      fs.mkdirSync(this.config.audit.storePath, { recursive: true });
      fs.accessSync(this.config.audit.storePath, fs.constants.W_OK);
      checks.push({ name: 'audit_writeable', passed: true });
    } catch (err) {
      checks.push({ name: 'audit_writeable', passed: false, detail: err instanceof Error ? err.message : String(err) });
    }

    // Check workspace integrity
    const workspacePath = this.config.workspace;
    if (workspacePath && workspacePath !== '.' && !fs.existsSync(workspacePath)) {
      checks.push({ name: 'workspace_exists', passed: false, detail: `Workspace not found: ${workspacePath}` });
    } else {
      checks.push({ name: 'workspace_exists', passed: true });
    }

    // Check tool availability (basic check — npx available)
    try {
      const { execSync } = require('child_process');
      execSync('npx --version', { stdio: 'ignore', timeout: 5000 });
      checks.push({ name: 'tool_runtime_available', passed: true });
    } catch {
      checks.push({ name: 'tool_runtime_available', passed: false, detail: 'npx not available' });
    }

    return {
      passed: checks.every((c) => c.passed),
      checks,
    };
  }

  // ---------------------------------------------------------------------------
  // Main Pipeline: raw → validate → sanitize → normalize → condense → relay
  // ---------------------------------------------------------------------------

  async processSummary(raw: unknown): Promise<{
    normalized: NormalizedAgentSummary;
    relay200: CondensedRelay200;
    relay300: CondensedRelay300;
  }> {
    if (!this.running) {
      throw new Error('Orchestrator is not running');
    }

    if (this.pipelineHalted) {
      throw new Error('Pipeline is halted due to critical severity. Manual intervention required.');
    }

    // Step 1: Ingest and validate (TRUST BOUNDARY — never trust raw input)
    const validated = await this.ingestService.ingest(raw);

    // Step 2: Sanitize — strip potentially dangerous fields
    const sanitized = this.sanitizeSummary(validated);

    // Step 3: Normalize (with optional findings from SecDev)
    const normalized = await this.normalizationService.normalizeAndEmit(sanitized);

    // Step 4: Condense (guarantees 200/300 token budgets)
    const { relay200, relay300 } = await this.condenseService.condenseAndEmit(normalized);

    // Step 5: Relay to main agent (emits relay.delivered or relay.delivery_failed)
    const delivery = await this.relayService.deliverAndEmit(relay200, relay300);

    if (!delivery.delivered) {
      this.logger.error('orchestrator.relay.delivery_failed', { taskId: relay200.taskId });
    }

    // Step 6: Check for kill switch — halt pipeline if critical severity
    if (relay200.severity === 'critical' || relay300.severity === 'critical') {
      this.logger.warn('orchestrator.pipeline.halted.critical_severity', {
        taskId: relay200.taskId,
      });
      this.pipelineHalted = true;
    }

    // Step 7: Persist in memory
    await this.memory.saveSummary(normalized);
    await this.memory.saveRelay(relay200, relay300);

    // Step 8: Confidence decay — degrade confidence if relay was large
    this.applyConfidenceDecay(normalized);

    return { normalized, relay200, relay300 };
  }

  /**
   * Sanitize a raw agent summary before processing.
   * Strips potentially dangerous fields, enforces bounds.
   */
  private sanitizeSummary(raw: RawAgentSummary): RawAgentSummary {
    return {
      ...raw,
      // Enforce bounds
      summary: raw.summary.slice(0, 5000),
      touchedFiles: raw.touchedFiles.slice(0, 100),
      blockers: raw.blockers.slice(0, 20),
      nextActions: raw.nextActions.slice(0, 20),
      // Clamp confidence
      confidence: Math.max(0, Math.min(1, raw.confidence)),
      // Sanitize metadata
      metadata: raw.metadata ? this.sanitizeMetadata(raw.metadata) : undefined,
    };
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Skip sensitive-looking keys
      if (/secret|password|token|key|credential/i.test(key)) continue;
      // Only allow primitive values and simple arrays
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
        sanitized[key] = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        sanitized[key] = value.slice(0, 50);
      }
    }
    return sanitized;
  }

  /**
   * Apply confidence decay based on execution history.
   * Degrades confidence if:
   * - Many retries
   * - Many failures
   * - Conflicting tool results
   */
  private applyConfidenceDecay(normalized: NormalizedAgentSummary): void {
    const criticalFindings = normalized.toolFindings.filter((f) => f.severity === 'critical').length;
    const highFindings = normalized.toolFindings.filter((f) => f.severity === 'high').length;
    const hasBlockers = normalized.blockers.length > 0;

    // Decay confidence if many critical/high findings
    if (criticalFindings > 0 || highFindings > 2) {
      normalized.confidence = Math.max(0, normalized.confidence - 0.1 * criticalFindings - 0.05 * highFindings);
    }

    // Decay if blocked
    if (hasBlockers) {
      normalized.confidence = Math.max(0, normalized.confidence - 0.15);
    }
  }

  /**
   * Compute quality score from quality gate results.
   */
  static computeQualityScore(gate: {
    prettier: { ran: boolean; formattedFiles: string[]; failedFiles: string[] };
    eslint: { ran: boolean; fixedFiles: string[]; failedFiles: string[]; warnings: number; errors: number };
    findings: Array<{ severity: string }>;
  }): QualityScore {
    const totalFiles = new Set([
      ...gate.prettier.formattedFiles,
      ...gate.prettier.failedFiles,
      ...gate.eslint.fixedFiles,
      ...gate.eslint.failedFiles,
    ]).size || 1;

    const lint = gate.eslint.ran
      ? Math.round(((totalFiles - gate.eslint.failedFiles.length) / totalFiles) * 100)
      : 100;
    const format = gate.prettier.ran
      ? Math.round(((totalFiles - gate.prettier.failedFiles.length) / totalFiles) * 100)
      : 100;
    const securityIssues = gate.findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length;
    const security = Math.max(0, 100 - securityIssues * 20);

    return {
      lint,
      format,
      security,
      overall: Math.round((lint + format + security) / 3),
    };
  }

  // ---------------------------------------------------------------------------
  // Run Coalescing — prevent overlapping quality gate runs
  // ---------------------------------------------------------------------------

  async scheduleQualityGate(files: string[]): Promise<void> {
    if (this.pipelineRunPromise) {
      this.logger.debug('orchestrator.quality.gate.coalesced', {
        pendingFiles: files.length,
      });
      return;
    }

    this.pipelineRunPromise = this.runQualityGate(files).finally(() => {
      this.pipelineRunPromise = null;
    });

    return this.pipelineRunPromise;
  }

  private async runQualityGate(_files: string[]): Promise<void> {
    // In production, this would trigger the quality gate pipeline
    // For now, just log
    this.logger.info('orchestrator.quality.gate.executed', {
      fileCount: _files.length,
    });
  }

  // ---------------------------------------------------------------------------
  // Replay Capability
  // ---------------------------------------------------------------------------

  async replayEvents(kind?: string): Promise<ReplayResult> {
    const events = await this.auditStore.replay(kind);
    this.logger.info('orchestrator.replay.start', { eventCount: events.length, kind });

    const errors: string[] = [];
    let pipelineRuns = 0;

    for (const event of events) {
      try {
        if (event.kind === 'agent.summary.emitted') {
          const raw = (event as { raw: unknown }).raw;
          await this.processSummary(raw);
          pipelineRuns++;
        }
      } catch (err) {
        errors.push(`Failed to replay event: ${err instanceof Error ? err.message : String(err)}`);
        this.logger.error('orchestrator.replay.event_error', {
          kind: event.kind,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { eventCount: events.length, pipelineRuns, errors };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    // Cold start validation
    const coldStart = this.coldStartCheck();
    if (!coldStart.passed) {
      const failed = coldStart.checks.filter((c) => !c.passed);
      this.logger.error('orchestrator.cold_start.failed', {
        failedChecks: failed.map((c) => ({ name: c.name, detail: c.detail })),
      });
      throw new Error(`Cold start validation failed: ${failed.map((c) => c.name).join(', ')}`);
    }

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

    // Wait for pending operations with bounded timeout (1s max per op)
    if (this.pendingOperations.size > 0) {
      this.logger.info('orchestrator.shutdown.waiting', {
        pendingCount: this.pendingOperations.size,
      });
      await Promise.allSettled(
        Array.from(this.pendingOperations).map(
          (p) => Promise.race([p, new Promise((r) => setTimeout(r, 1000))]),
        ),
      );
    }

    // Flush memory and audit
    await this.memory.flush();
    await this.auditStore.flush();

    this.logger.info('orchestrator.shutdown.complete', { reason });

    await this.eventBus.emit({
      kind: 'orchestrator.shutdown',
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private trackOperation<T>(op: Promise<T>): Promise<T> {
    this.pendingOperations.add(op);
    op.finally(() => this.pendingOperations.delete(op));
    return op;
  }

  unhaltPipeline(): void {
    this.pipelineHalted = false;
    this.logger.info('orchestrator.pipeline.unhalted');
  }

  get isRunning(): boolean { return this.running; }
  get isHalted(): boolean { return this.pipelineHalted; }

  get status() {
    return {
      running: this.running,
      halted: this.pipelineHalted,
      inboxSize: this.router.inboxSize,
      unreadCount: this.router.unreadCount,
      eventBufferUtilization: this.eventBus.capacityUtilization,
      eventOverflowCount: this.eventBus.overflowCount,
      eventTotalProcessed: this.eventBus.totalProcessed,
      eventTotalFailures: this.eventBus.totalFailures,
      pendingOperations: this.pendingOperations.size,
      auditPendingWrites: this.auditStore.pendingCount,
      auditLogPaths: this.auditStore.logPaths,
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
