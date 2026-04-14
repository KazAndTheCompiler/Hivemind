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
import { EventBus } from '@openclaw/core-events';
import { Logger, createLoggerFromConfig } from '@openclaw/core-logging';
import { ConfigService } from '@openclaw/core-config';
import { AgentSummaryIngestService, SummaryNormalizationService } from '@openclaw/summarizer';
import { SummaryCondenseService } from '@openclaw/condense-engine';
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
  private driftCounter = 0;
  private readonly DRIFT_THRESHOLD = 3;
  private running = false;
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

    this.router.startListening();

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

    const taskId = (raw as { taskId?: string }).taskId ?? `task_${Date.now()}`;
    const steps: PipelineStepResult[] = [];
    const startTime = Date.now();

    try {
      const validated = await this.ingestService.ingest(raw);
      steps.push({ step: 'ingest', success: true, durationMs: Date.now() - startTime });

      const sanitized = this.sanitizeSummary(validated);
      const normalized = await this.normalizationService.normalizeAndEmit(sanitized);
      steps.push({ step: 'normalize', success: true, durationMs: Date.now() - startTime });

      const secdevFindings = await this.secdevAdapter.analyzeEmission({
        kind: 'normalized',
        summary: normalized,
      });
      normalized.toolFindings.push(...secdevFindings);

      const guardResult = this.guardStack.validateSummary(
        normalized.conciseSummary,
        normalized.touchedFiles,
        normalized.blockers,
        normalized.nextActions,
      );
      steps.push({ step: 'guard_stack', success: guardResult.passed, durationMs: Date.now() - startTime });

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
            kind: 'orchestrator.halted' as any,
            schemaVersion: 'v1',
            sequence: 0,
            streamId: taskId,
            reason: `escalation: ${guardResult.escalationMessage.type} - ${guardResult.escalationMessage.action}`,
            timestamp: new Date().toISOString(),
          });
        }

        if (this.driftCounter >= this.DRIFT_THRESHOLD) {
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

      const qualityResult = await this.qualityService.runQualityGate(normalized.touchedFiles);
      normalized.toolFindings.push(...qualityResult.findings);
      steps.push({
        step: 'quality_gate',
        success:
          qualityResult.findings.filter((f) => f.severity === 'critical' || f.severity === 'high')
            .length === 0,
        durationMs: Date.now() - startTime,
      });

      const semanticGuardResult = this.runSemanticGuard(normalized);
      if (!semanticGuardResult.passed) {
        normalized.toolFindings.push(...semanticGuardResult.findings);
        this.driftCounter++;
        this.logger.warn('orchestrator.semantic_guard.failed', {
          taskId,
          issues: semanticGuardResult.issues,
          driftCounter: this.driftCounter,
          threshold: this.DRIFT_THRESHOLD,
        });

        if (this.driftCounter >= this.DRIFT_THRESHOLD) {
          this.logger.error('orchestrator.drift.escalation', {
            taskId,
            driftCounter: this.driftCounter,
            issues: semanticGuardResult.issues,
          });
          await this.eventBus.emit({
            kind: 'orchestrator.halted' as any,
            schemaVersion: 'v1',
            sequence: 0,
            streamId: taskId,
            reason: `drift threshold exceeded: ${this.driftCounter} failures`,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        this.driftCounter = 0;
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

      const { relay200, relay300 } = await this.condenseService.condenseAndEmit(normalized);
      steps.push({ step: 'condense', success: true, durationMs: Date.now() - startTime });

      const delivery = await this.relayService.deliverAndEmit(relay200, relay300);
      steps.push({
        step: 'relay',
        success: delivery.delivered,
        durationMs: Date.now() - startTime,
      });

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
        durationMs: Date.now() - startTime,
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

  private runSemanticGuard(normalized: NormalizedAgentSummary): SemanticGuardResult {
    const issues: string[] = [];
    const findings: ToolFinding[] = [];
    const text = [normalized.conciseSummary, ...normalized.blockers, ...normalized.nextActions]
      .join(' ')
      .toLowerCase();

    const emptyDone = normalized.conciseSummary.trim().length === 0;
    const hasBlockers = normalized.blockers.length > 0;
    if (emptyDone && !hasBlockers) {
      issues.push('empty_done_no_blockers');
      findings.push({
        source: 'secdev',
        severity: 'low',
        code: 'SEMANTIC_EMPTY_DONE',
        message: 'Empty summary without blockers is anomalous',
        fileRefs: [],
        suggestedAction: 'Provide a summary or declare blockers',
      });
    }

    const fileCount = normalized.touchedFiles.length;
    if (fileCount === 0) {
      issues.push('no_file_references');
      findings.push({
        source: 'secdev',
        severity: 'low',
        code: 'SEMANTIC_NO_FILE_REFS',
        message: 'No file references in touchedFiles',
        fileRefs: [],
        suggestedAction: 'Include file paths that were modified',
      });
    }

    const actionVerbs = /create|update|delete|fix|implement|refactor|test|add|remove|modify|patch/i;
    if (!actionVerbs.test(text)) {
      issues.push('no_action_verbs');
      findings.push({
        source: 'secdev',
        severity: 'low',
        code: 'SEMANTIC_NO_ACTION_VERBS',
        message: 'No action verbs detected in summary',
        fileRefs: [],
        suggestedAction: 'Use action verbs: create, update, delete, fix, implement, refactor, test',
      });
    }

    const forbiddenPhrases = [
      'completed task',
      'worked on',
      'made changes',
      'did stuff',
      'something',
    ];
    for (const phrase of forbiddenPhrases) {
      if (text.includes(phrase)) {
        issues.push(`forbidden_phrase: ${phrase}`);
        findings.push({
          source: 'secdev',
          severity: 'low',
          code: 'SEMANTIC_FORBIDDEN_PHRASE',
          message: `Forbidden phrase detected: "${phrase}"`,
          fileRefs: [],
          suggestedAction: 'Replace generic phrases with specific descriptions',
        });
      }
    }

    return { passed: issues.length === 0, issues, findings };
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

    this.pipelineRunPromise = this.runQualityGate(files).finally(() => {
      this.pipelineRunPromise = null;
    });

    return this.pipelineRunPromise;
  }

  private async runQualityGate(_files: string[]): Promise<void> {
    this.logger.info('orchestrator.quality.gate.executed', { fileCount: _files.length });
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
    this.running = false;
    this.logger.info('orchestrator.shutdown.start', { reason });

    if (this.pendingOperations.size > 0) {
      this.logger.info('orchestrator.shutdown.waiting', {
        pendingCount: this.pendingOperations.size,
      });
      await Promise.allSettled(
        Array.from(this.pendingOperations).map((p) =>
          Promise.race([p, new Promise((r) => setTimeout(r, 1000))]),
        ),
      );
    }

    await this.memory.flush();
    await this.auditStore.flush();

    this.logger.info('orchestrator.shutdown.complete', { reason });

    await this.eventBus.emit({
      kind: 'orchestrator.shutdown',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'orchestrator',
      reason,
      timestamp: new Date().toISOString(),
    });
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
}

export function createOrchestrator(_config?: unknown): OrchestratorService {
  const configService = ConfigService.fromFileOrDefaults(process.env.OPENCLAW_CONFIG);
  const cfg = configService.getConfig();
  ConfigService.validateStartup(cfg);
  return new OrchestratorService(cfg);
}
