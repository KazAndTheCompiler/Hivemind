// OrchestratorService — supervisor pattern for worker agents
// Coordinates the full pipeline: ingest → sanitize → validate → normalize → condense → relay
// Supports pipeline ownership lock, partial failure strategy, and deterministic replay

import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
  OpenClawConfig,
  RawAgentSummary,
  PipelineOutcome,
  PipelineResult,
  PipelineStepResult,
  SystemState,
  TaskState,
  PipelineLock,
  ToolFinding,
} from '@openclaw/core-types';
import { EventBus, Subscription } from '@openclaw/core-events';
import { Logger, createLoggerFromConfig } from '@openclaw/core-logging';
import { ConfigService } from '@openclaw/core-config';
import { AgentSummaryIngestService, SummaryNormalizationService } from '@openclaw/summarizer';
import { SummaryCondenseService } from '@openclaw/watson';
import { MainAgentRelayService } from '@openclaw/agent-relay';
import { AgentRouter } from '@openclaw/agent-router';
import { AgentMemory, DurableFileSink } from '@openclaw/agent-memory';
import { DurableFileAuditStore } from '@openclaw/audit-store';
import { LocalSecDevAdapter } from '@openclaw/tool-secdev';
import { ChangedFileQualityService } from '@openclaw/change-detector';
import { LocalEslintRunner } from '@openclaw/tool-eslint';
import { LocalPrettierRunner } from '@openclaw/tool-prettier';
import { CheckpointOrchestrator } from '@openclaw/automation-checkpoints';
import { SummaryEmitter } from '@openclaw/automation-summary';
import { GuardStack, createGuardStack } from '@openclaw/guard-stack';
import * as fs from 'fs';

export interface ColdStartCheckResult {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

export interface SemanticGuardResult {
  passed: boolean;
  issues: string[];
  findings: ToolFinding[];
}

export interface ReplayResult {
  eventCount: number;
  pipelineRuns: number;
  errors: string[];
}

export interface QualityScore {
  lint: number;
  format: number;
  security: number;
  overall: number;
}

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailure: string | null;
  lastFailureAt: number | null;
}

export interface HealthStatus {
  healthy: boolean;
  running: boolean;
  halted: boolean;
  uptime: number;
  driftCounter: number;
  circuitBreakers: Record<string, { state: string; failures: number; lastFailure: string | null }>;
  eventBus: {
    bufferSize: number;
    overflowCount: number;
    totalProcessed: number;
    totalFailures: number;
  };
  pendingOperations: number;
  memory: {
    inboxSize: number;
    unreadCount: number;
  };
  relay: {
    inboxSize: number;
    reviewQueueSize: number;
  };
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
  private secdevAdapter: LocalSecDevAdapter;
  private qualityService: ChangedFileQualityService;
  private checkpointOrchestrator: CheckpointOrchestrator;
  private summaryEmitter: SummaryEmitter;
  private guardStack: GuardStack;
  private routerSubscription: Subscription | null = null;
  private driftCounter = 0;
  private readonly DRIFT_THRESHOLD = 3;
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT_MS = 30_000;
  private running = false;
  private startTime = Date.now();

  private circuitBreakers: Map<string, CircuitBreaker> = new Map([
    ['secdev', { state: CircuitState.CLOSED, failureCount: 0, lastFailure: null, lastFailureAt: null }],
    ['quality_gate', { state: CircuitState.CLOSED, failureCount: 0, lastFailure: null, lastFailureAt: null }],
  ]);
  private pendingOperations = new Set<Promise<unknown>>();
  private pipelineHalted = false;
  private pipelineRunPromise: Promise<void> | null = null;
  private systemState: SystemState = {
    schemaVersion: 'v1',
    tasks: {},
    streams: {},
    lastUpdated: new Date().toISOString(),
    globalSequence: 0,
  };

  constructor(config: OpenClawConfig) {
    this.config = config;
    this.logger = createLoggerFromConfig(config);
    this.eventBus = new EventBus(this.logger);

    this.auditStore = new DurableFileAuditStore(
      config.audit.storePath,
      config.audit.deadLetterPath,
      this.logger,
    );

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

    this.ingestService = new AgentSummaryIngestService(this.eventBus, this.logger);
    this.normalizationService = new SummaryNormalizationService(this.eventBus, this.logger);
    this.condenseService = new SummaryCondenseService(this.eventBus, this.logger);
    this.relayService = new MainAgentRelayService(this.eventBus, this.logger);
    this.router = new AgentRouter(this.eventBus, this.logger);

    this.secdevAdapter = new LocalSecDevAdapter(this.logger);
    this.qualityService = new ChangedFileQualityService(
      this.eventBus,
      this.logger,
      new LocalEslintRunner(this.logger),
      new LocalPrettierRunner(this.logger),
      this.secdevAdapter,
    );
    this.checkpointOrchestrator = new CheckpointOrchestrator();
    this.summaryEmitter = new SummaryEmitter();
    this.guardStack = createGuardStack({ maxRetries: 3, costThreshold: 1000 });

    const memoryPath = `${config.audit.storePath}/memory`;
    const memorySink = new DurableFileSink(memoryPath, this.logger);
    this.memory = new AgentMemory(memorySink, 'orchestrator');

    this.routerSubscription = this.router.startListening();

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

  coldStartCheck(): ColdStartCheckResult {
    const checks: ColdStartCheckResult['checks'] = [];

    try {
      ConfigService.validateStartup(this.config);
      checks.push({ name: 'config_valid', passed: true });
    } catch (err) {
      checks.push({
        name: 'config_valid',
        passed: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    try {
      fs.mkdirSync(this.config.audit.storePath, { recursive: true });
      fs.accessSync(this.config.audit.storePath, fs.constants.W_OK);
      checks.push({ name: 'audit_writeable', passed: true });
    } catch (err) {
      checks.push({
        name: 'audit_writeable',
        passed: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    const workspacePath = this.config.workspace;
    if (workspacePath && workspacePath !== '.' && !fs.existsSync(workspacePath)) {
      checks.push({
        name: 'workspace_exists',
        passed: false,
        detail: `Workspace not found: ${workspacePath}`,
      });
    } else {
      checks.push({ name: 'workspace_exists', passed: true });
    }

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

  async processSummary(raw: unknown): Promise<{
    normalized: NormalizedAgentSummary;
    relay200: CondensedRelay200;
    relay300: CondensedRelay300;
    result: PipelineResult;
  }> {
    if (!this.running) {
      throw new Error('Orchestrator is not running');
    }

    if (this.pipelineHalted) {
      throw new Error('Pipeline is halted due to critical severity. Manual intervention required.');
    }

    if (raw === null || raw === undefined) {
      throw new Error('Cannot process null/undefined summary');
    }

    if (typeof raw !== 'object') {
      throw new Error(`Expected object, got ${typeof raw}`);
    }

    const rawObj = raw as Record<string, unknown>;
    if (Array.isArray(raw)) {
      throw new Error('Cannot process array as summary');
    }

    const taskId = (rawObj.taskId as string | undefined) ?? `task_${Date.now()}`;
    const steps: PipelineStepResult[] = [];

    const record = (name: string, success: boolean, startMs: number) => {
      steps.push({ step: name, success, durationMs: Date.now() - startMs });
    };

    try {
      let t = Date.now();
      const validated = await this.ingestService.ingest(raw);
      record('ingest', true, t);

      t = Date.now();
      const sanitized = this.sanitizeSummary(validated);
      record('sanitize', true, t);

      t = Date.now();
      const normalized = await this.normalizationService.normalizeAndEmit(sanitized);
      record('normalize', true, t);

      t = Date.now();
      let secdevFindings: ToolFinding[] = [];
      if (this.isCircuitOpen('secdev')) {
        this.logger.warn('orchestrator.secdev.circuit_open');
        record('secdev', true, t);
      } else {
        try {
          secdevFindings = await this.secdevAdapter.analyzeEmission({
            kind: 'normalized',
            summary: normalized,
          });
          this.recordCircuitSuccess('secdev');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.recordCircuitFailure('secdev', msg);
          this.logger.error('orchestrator.secdev.error', { error: msg });
        }
      }
      normalized.toolFindings.push(...secdevFindings);
      record('secdev', true, t);

      t = Date.now();
      const guardResult = this.guardStack.validateSummary(
        normalized.conciseSummary,
        normalized.touchedFiles,
        normalized.blockers,
        normalized.nextActions,
      );
      record('guard_stack', guardResult.passed, t);

      if (!guardResult.passed) {
        this.driftCounter++;
        this.logger.warn('orchestrator.guard_stack.failed', {
          taskId,
          stage: guardResult.stage,
          issues: guardResult.issues,
          driftCounter: this.driftCounter,
          threshold: this.DRIFT_THRESHOLD,
          shouldRetry: guardResult.shouldRetry,
          shouldEscalate: guardResult.shouldEscalate,
        });

        if (guardResult.shouldEscalate && guardResult.escalationMessage) {
          this.logger.error('orchestrator.escalation', {
            taskId,
            escalationType: guardResult.escalationMessage.type,
            frontierAction: guardResult.escalationMessage.action,
            reason: guardResult.escalationMessage.reason,
          });
          await this.eventBus.emit({
            kind: 'orchestrator.halted',
            schemaVersion: 'v1',
            sequence: 0,
            streamId: taskId,
            reason: `escalation: ${guardResult.escalationMessage.type} - ${guardResult.escalationMessage.action}`,
            timestamp: new Date().toISOString(),
          });
        }

        if (guardResult.shouldRetry && guardResult.attempt < 3) {
          const backoffMs = this.guardStack.getBackoffMs(guardResult.attempt);
          this.logger.info('orchestrator.guard.retrying', {
            taskId,
            attempt: guardResult.attempt,
            backoffMs,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        } else if (this.driftCounter >= this.DRIFT_THRESHOLD) {
          this.logger.error('orchestrator.drift.halted', {
            taskId,
            driftCounter: this.driftCounter,
          });
          this.pipelineHalted = true;
        }
      } else {
        this.driftCounter = 0;
        this.guardStack.reset();
      }

      t = Date.now();
      let qualityResult: Awaited<ReturnType<ChangedFileQualityService['runQualityGate']>> | null = null;
      if (this.isCircuitOpen('quality_gate')) {
        this.logger.warn('orchestrator.quality_gate.circuit_open');
        record('quality_gate', true, t);
      } else {
        try {
          qualityResult = await this.qualityService.runQualityGate(normalized.touchedFiles);
          this.recordCircuitSuccess('quality_gate');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.recordCircuitFailure('quality_gate', msg);
          this.logger.error('orchestrator.quality_gate.error', { error: msg });
          record('quality_gate', false, t);
          return {
            normalized,
            relay200: {} as CondensedRelay200,
            relay300: {} as CondensedRelay300,
            result: {
              outcome: 'failed' as PipelineOutcome,
              taskId,
              steps,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
      if (qualityResult) {
        normalized.toolFindings.push(...qualityResult.findings);
        record('quality_gate', qualityResult.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length === 0, t);
      }

      if (this.checkpointOrchestrator.shouldCheckpoint()) {
        const checkpointSummary = this.summaryEmitter.emitCheckpointSummary(
          {
            id: `run_${Date.now()}`,
            mode: 'checkpoint',
            status: normalized.toolFindings.some(
              (f) => f.severity === 'critical' || f.severity === 'high',
            )
              ? 'failed'
              : 'passed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            results: [],
          } as any,
          {
            touchedAreas: normalized.touchedFiles,
            hotspots: [],
            architecturalNotes: [],
            suspectedRisks: [],
            summary: normalized.conciseSummary,
          },
        );
        this.logger.info('orchestrator.checkpoint.triggered', {
          taskId,
          summary: checkpointSummary.slice(0, 200),
        });
        await this.checkpointOrchestrator.executeCheckpoint();
      }

      t = Date.now();
      const { relay200, relay300 } = await this.condenseService.condenseAndEmit(normalized);
      record('condense', true, t);

      t = Date.now();
      const delivery = await this.relayService.deliverAndEmit(relay200, relay300);
      record('relay', delivery.delivered, t);

      if (relay200.severity === 'critical' || relay300.severity === 'critical') {
        this.pipelineHalted = true;
      }

      await this.memory.saveSummary(normalized);
      await this.memory.saveRelay(relay200, relay300);
      this.applyConfidenceDecay(normalized);

      this.updateSystemState({
        taskId,
        status: normalized.status,
        confidence: normalized.confidence,
        severity: relay200.severity,
        processedAt: new Date().toISOString(),
        relayDelivered: delivery.delivered,
        relayBlocked: delivery.routingDecision.decision === 'block',
        blockerReason:
          delivery.routingDecision.decision === 'block'
            ? delivery.routingDecision.reason
            : undefined,
      });

      const failedSteps = steps.filter((s) => !s.success).length;
      const outcome: PipelineOutcome =
        failedSteps === 0 ? 'success' : failedSteps === steps.length ? 'failed' : 'partial';

      return {
        normalized,
        relay200,
        relay300,
        result: { outcome, taskId, steps, timestamp: new Date().toISOString() },
      };
    } catch (err) {
      steps.push({
        step: 'unknown',
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      });

      return {
        normalized: {} as NormalizedAgentSummary,
        relay200: {} as CondensedRelay200,
        relay300: {} as CondensedRelay300,
        result: { outcome: 'failed', taskId, steps, timestamp: new Date().toISOString() },
      };
    }
  }

  private updateSystemState(taskState: TaskState): void {
    this.systemState.tasks[taskState.taskId] = taskState;
    this.systemState.lastUpdated = new Date().toISOString();
    this.systemState.globalSequence++;
  }

  reduce(state: SystemState, event: { type: string; [key: string]: unknown }): SystemState {
    switch (event.type) {
      case 'task.started': {
        const taskId = event.taskId as string;
        return {
          ...state,
          tasks: {
            ...state.tasks,
            [taskId]: {
              taskId,
              status: 'working',
              confidence: 1.0,
              severity: 'none',
              processedAt: event.timestamp as string,
              relayDelivered: false,
              relayBlocked: false,
            },
          },
          lastUpdated: event.timestamp as string,
          globalSequence: state.globalSequence + 1,
        };
      }
      case 'task.completed': {
        const taskId = event.taskId as string;
        const existing = state.tasks[taskId];
        if (!existing) return state;
        return {
          ...state,
          tasks: {
            ...state.tasks,
            [taskId]: { ...existing, status: 'done', processedAt: event.timestamp as string },
          },
          lastUpdated: event.timestamp as string,
          globalSequence: state.globalSequence + 1,
        };
      }
      case 'task.failed': {
        const taskId = event.taskId as string;
        const existing = state.tasks[taskId];
        if (!existing) return state;
        return {
          ...state,
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...existing,
              status: 'failed',
              blockerReason: event.reason as string,
              processedAt: event.timestamp as string,
            },
          },
          lastUpdated: event.timestamp as string,
          globalSequence: state.globalSequence + 1,
        };
      }
      case 'relay.blocked': {
        const taskId = event.taskId as string;
        const existing = state.tasks[taskId];
        if (!existing) return state;
        return {
          ...state,
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...existing,
              relayBlocked: true,
              blockerReason: event.reason as string,
              processedAt: event.timestamp as string,
            },
          },
          lastUpdated: event.timestamp as string,
          globalSequence: state.globalSequence + 1,
        };
      }
      case 'relay.released': {
        const taskId = event.taskId as string;
        const existing = state.tasks[taskId];
        if (!existing) return state;
        return {
          ...state,
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...existing,
              relayBlocked: false,
              processedAt: event.timestamp as string,
            },
          },
          lastUpdated: event.timestamp as string,
          globalSequence: state.globalSequence + 1,
        };
      }
      default:
        return state;
    }
  }

  replay(events: Array<{ type: string; [key: string]: unknown }>): SystemState {
    let state = this.systemState;
    for (const event of events) {
      state = this.reduce(state, event);
    }
    return state;
  }

  getSystemState(): SystemState {
    return { ...this.systemState };
  }

  private sanitizeSummary(raw: RawAgentSummary): RawAgentSummary {
    return {
      ...raw,
      summary: raw.summary.slice(0, 5000),
      touchedFiles: raw.touchedFiles.slice(0, 100),
      blockers: raw.blockers.slice(0, 20),
      nextActions: raw.nextActions.slice(0, 20),
      confidence: Math.max(0, Math.min(1, raw.confidence)),
      metadata: raw.metadata ? this.sanitizeMetadata(raw.metadata) : undefined,
    };
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (/secret|password|token|key|credential/i.test(key)) continue;
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        sanitized[key] = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        sanitized[key] = value.slice(0, 50);
      }
    }
    return sanitized;
  }

  private applyConfidenceDecay(normalized: NormalizedAgentSummary): void {
    const criticalFindings = normalized.toolFindings.filter(
      (f) => f.severity === 'critical',
    ).length;
    const highFindings = normalized.toolFindings.filter((f) => f.severity === 'high').length;
    const hasBlockers = normalized.blockers.length > 0;

    if (criticalFindings > 0 || highFindings > 2) {
      normalized.confidence = Math.max(
        0,
        normalized.confidence - 0.1 * criticalFindings - 0.05 * highFindings,
      );
    }

    if (hasBlockers) {
      normalized.confidence = Math.max(0, normalized.confidence - 0.15);
    }
  }

  static computeQualityScore(gate: {
    prettier: { ran: boolean; formattedFiles: string[]; failedFiles: string[] };
    eslint: {
      ran: boolean;
      fixedFiles: string[];
      failedFiles: string[];
      warnings: number;
      errors: number;
    };
    findings: Array<{ severity: string }>;
  }): QualityScore {
    const totalFiles =
      new Set([
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
    const securityIssues = gate.findings.filter(
      (f) => f.severity === 'high' || f.severity === 'critical',
    ).length;
    const security = Math.max(0, 100 - securityIssues * 20);

    return { lint, format, security, overall: Math.round((lint + format + security) / 3) };
  }

  async scheduleQualityGate(files: string[]): Promise<void> {
    if (this.pipelineRunPromise) {
      this.logger.debug('orchestrator.quality.gate.coalesced', { pendingFiles: files.length });
      return;
    }

    this.pipelineRunPromise = this.qualityService.runQualityGate(files).finally(() => {
      this.pipelineRunPromise = null;
    }) as unknown as Promise<void>;

    await this.pipelineRunPromise;
  }

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

  async start(): Promise<void> {
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
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'orchestrator',
      timestamp: new Date().toISOString(),
    });
  }

  async shutdown(reason = 'manual'): Promise<void> {
    if (!this.running) {
      this.logger.warn('orchestrator.shutdown.already_stopped');
      return;
    }

    this.running = false;
    this.logger.info('orchestrator.shutdown.start', {
      reason,
      pendingOperations: this.pendingOperations.size,
      driftCounter: this.driftCounter,
    });

    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
      this.routerSubscription = null;
    }

    const shutdownTimeout = new Promise((resolve) => setTimeout(resolve, 5000));
    const pendingPromise = this.pendingOperations.size > 0
      ? Promise.allSettled(
          Array.from(this.pendingOperations).map((p) =>
            Promise.race([p, new Promise((r) => setTimeout(r, 2000))]),
          ),
        )
      : Promise.resolve();

    await Promise.race([pendingPromise, shutdownTimeout]);

    if (this.pendingOperations.size > 0) {
      this.logger.warn('orchestrator.shutdown.timeout', {
        remainingOperations: this.pendingOperations.size,
      });
    }

    try {
      await Promise.all([
        this.memory.flush(),
        this.auditStore.flush(),
      ]);
      this.logger.info('orchestrator.shutdown.flush_complete');
    } catch (err) {
      this.logger.error('orchestrator.shutdown.flush_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    this.logger.info('orchestrator.shutdown.complete', { reason, uptime: Date.now() - this.startTime });

    try {
      await this.eventBus.emit({
        kind: 'orchestrator.shutdown',
        schemaVersion: 'v1',
        sequence: 0,
        streamId: 'orchestrator',
        reason,
        timestamp: new Date().toISOString(),
      });
    } catch {
      this.logger.error('orchestrator.shutdown.emit_failed');
    }
  }

  private trackOperation<T>(op: Promise<T>): Promise<T> {
    this.pendingOperations.add(op);
    op.finally(() => this.pendingOperations.delete(op));
    return op;
  }

  unhaltPipeline(): void {
    this.pipelineHalted = false;
    this.logger.info('orchestrator.pipeline.unhalted');
  }

  acquirePipelineLock(owner: 'daemon' | 'orchestrator' | 'replay', _taskId: string): boolean {
    const currentLock = this.eventBus.getLock();
    if (currentLock.owner !== null && currentLock.owner !== owner) {
      return false;
    }
    return true;
  }

  releasePipelineLock(owner: 'daemon' | 'orchestrator' | 'replay'): void {
    this.eventBus.releaseLock(owner);
  }

  get isRunning(): boolean {
    return this.running;
  }
  get isHalted(): boolean {
    return this.pipelineHalted;
  }
  get pipelineLock(): PipelineLock {
    return this.eventBus.getLock();
  }

  get status() {
    return {
      running: this.running,
      halted: this.pipelineHalted,
      inboxSize: this.router.inboxSize,
      unreadCount: this.router.unreadCount,
      eventBufferUtilization: this.eventBus.getCapacityUtilization(),
      eventOverflowCount: this.eventBus.getOverflowCount(),
      eventTotalProcessed: this.eventBus.getTotalProcessed(),
      eventTotalFailures: this.eventBus.getTotalFailures(),
      pendingOperations: this.pendingOperations.size,
      auditPendingWrites: this.auditStore.pendingCount,
      auditLogPaths: this.auditStore.logPaths,
      metrics: this.eventBus.getMetrics(),
      systemState: this.getSystemState(),
    };
  }

  getHealth(): HealthStatus {
    const circuitBreakerStatus: Record<string, { state: string; failures: number; lastFailure: string | null }> = {};
    for (const [name, cb] of this.circuitBreakers) {
      circuitBreakerStatus[name] = {
        state: cb.state,
        failures: cb.failureCount,
        lastFailure: cb.lastFailure,
      };
    }

    return {
      healthy: this.running && !this.pipelineHalted,
      running: this.running,
      halted: this.pipelineHalted,
      uptime: Date.now() - this.startTime,
      driftCounter: this.driftCounter,
      circuitBreakers: circuitBreakerStatus,
      eventBus: {
        bufferSize: this.eventBus.getBufferSize(),
        overflowCount: this.eventBus.getOverflowCount(),
        totalProcessed: this.eventBus.getTotalProcessed(),
        totalFailures: this.eventBus.getTotalFailures(),
      },
      pendingOperations: this.pendingOperations.size,
      memory: {
        inboxSize: this.router.inboxSize,
        unreadCount: this.router.unreadCount,
      },
      relay: {
        inboxSize: this.relayService.inboxSize,
        reviewQueueSize: this.relayService.reviewQueueSize,
      },
    };
  }

  private isCircuitOpen(name: string): boolean {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return false;

    if (cb.state === CircuitState.OPEN) {
      const timeSinceLastFailure = cb.lastFailureAt ? Date.now() - cb.lastFailureAt : 0;
      if (timeSinceLastFailure > this.CIRCUIT_RESET_TIMEOUT_MS) {
        cb.state = CircuitState.HALF_OPEN;
        this.logger.info('orchestrator.circuit.half_open', { circuit: name });
        return false;
      }
      return true;
    }
    return false;
  }

  private recordCircuitFailure(name: string, error: string): void {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return;

    cb.failureCount++;
    cb.lastFailure = error;
    cb.lastFailureAt = Date.now();

    if (cb.failureCount >= this.CIRCUIT_FAILURE_THRESHOLD) {
      cb.state = CircuitState.OPEN;
      this.logger.error('orchestrator.circuit.open', {
        circuit: name,
        failureCount: cb.failureCount,
        threshold: this.CIRCUIT_FAILURE_THRESHOLD,
      });
    }
  }

  private recordCircuitSuccess(name: string): void {
    const cb = this.circuitBreakers.get(name);
    if (!cb) return;

    cb.failureCount = 0;
    if (cb.state === CircuitState.HALF_OPEN) {
      cb.state = CircuitState.CLOSED;
      this.logger.info('orchestrator.circuit.closed', { circuit: name });
    }
  }

  resetCircuitBreakers(): void {
    for (const [name, cb] of this.circuitBreakers) {
      cb.failureCount = 0;
      cb.state = CircuitState.CLOSED;
      cb.lastFailure = null;
      cb.lastFailureAt = null;
      this.logger.info('orchestrator.circuit.reset', { circuit: name });
    }
  }

  drainInbox(): Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> {
    const items = this.relayService.pickUp();
    this.logger.info('orchestrator.inbox.drained', { count: items.length });
    return items;
  }

  getReviewQueue(): Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300; addedAt: string; reason: string }> {
    return this.relayService.pickUpReviewQueue();
  }
}

export function createOrchestrator(_config?: unknown): OrchestratorService {
  const configService = ConfigService.fromFileOrDefaults(process.env.OPENCLAW_CONFIG);
  const cfg = configService.getConfig();
  ConfigService.validateStartup(cfg);
  return new OrchestratorService(cfg);
}
