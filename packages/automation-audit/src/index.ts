// Audit event persistence for automation enforcement
// Records all enforcement outcomes in typed audit events

import type {
  AuditEvent,
  AuditEventType,
  ToolExecutionResult,
  AutomationRun,
  EnforcementDecision,
} from '@openclaw/automation-core';

export interface AuditStore {
  append(event: AuditEvent): void;
  getByRunId(runId: string): AuditEvent[];
  getByType(type: AuditEventType): AuditEvent[];
  getRecent(limit?: number): AuditEvent[];
}

export class InMemoryAuditStore implements AuditStore {
  private events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    this.events.push(event);
  }

  getByRunId(runId: string): AuditEvent[] {
    return this.events.filter((e) => e.runId === runId);
  }

  getByType(type: AuditEventType): AuditEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  getRecent(limit = 100): AuditEvent[] {
    return this.events.slice(-limit);
  }
}

export interface AuditLogger {
  logToolStart(tool: string, runId: string, mode: string): void;
  logToolEnd(result: ToolExecutionResult, runId: string): void;
  logToolRetry(tool: string, runId: string, attempt: number): void;
  logToolSkipped(tool: string, runId: string, reason: string): void;
  logDecision(decision: EnforcementDecision, runId: string): void;
  logCheckpointTriggered(label: string, runId: string): void;
  logCheckpointCompleted(runId: string): void;
  logSummaryEmitted(runId: string, tokenBudget: 200 | 300): void;
  logRunStarted(runId: string, mode: string): void;
  logRunCompleted(run: AutomationRun): void;
}

export class AutomationAuditLogger implements AuditLogger {
  private store: AuditStore;
  private emitFn: (event: AuditEvent) => void;

  constructor(store: AuditStore, emitFn?: (event: AuditEvent) => void) {
    this.store = store;
    this.emitFn = emitFn ?? (() => {});
  }

  logToolStart(tool: string, runId: string, mode: string): void {
    this.record({ type: 'tool_execution_started', runId, tool: tool as any, payload: { mode } });
  }

  logToolEnd(result: ToolExecutionResult, runId: string): void {
    this.record({
      type: 'tool_execution_completed',
      runId,
      tool: result.tool,
      payload: {
        status: result.status,
        blockerCount: result.blockerCount,
        warningCount: result.warningCount,
        durationMs: result.durationMs,
      },
    });
  }

  logToolRetry(tool: string, runId: string, attempt: number): void {
    this.record({ type: 'tool_retry', runId, tool: tool as any, payload: { attempt } });
  }

  logToolSkipped(tool: string, runId: string, reason: string): void {
    this.record({ type: 'tool_skipped', runId, tool: tool as any, payload: { reason } });
  }

  logDecision(decision: EnforcementDecision, runId: string): void {
    this.record({
      type: 'enforcement_decision',
      runId,
      payload: {
        canProceed: decision.canProceed,
        blockingTools: decision.blockingTools,
        warningTools: decision.warningTools,
        rationale: decision.rationale,
      },
    });
  }

  logCheckpointTriggered(label: string, runId: string): void {
    this.record({ type: 'checkpoint_triggered', runId, payload: { label } });
  }

  logCheckpointCompleted(runId: string): void {
    this.record({ type: 'checkpoint_completed', runId, payload: {} });
  }

  logSummaryEmitted(runId: string, tokenBudget: 200 | 300): void {
    this.record({ type: 'summary_emitted', runId, payload: { tokenBudget } });
  }

  logRunStarted(runId: string, mode: string): void {
    this.record({ type: 'run_started', runId, payload: { mode } });
  }

  logRunCompleted(run: AutomationRun): void {
    this.record({
      type: 'run_completed',
      runId: run.id,
      payload: {
        mode: run.mode,
        resultCount: run.results.length,
        canProceed: run.decision?.canProceed,
      },
    });
  }

  getStore(): AuditStore {
    return this.store;
  }

  private record(params: {
    type: AuditEventType;
    runId?: string;
    tool?: string;
    payload: Record<string, unknown>;
  }): void {
    const event: AuditEvent = {
      id: this.generateEventId(),
      type: params.type,
      timestamp: new Date().toISOString(),
      runId: params.runId,
      tool: params.tool as any,
      payload: params.payload,
    };
    this.store.append(event);
    this.emitFn(event);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const createInMemoryAuditStore = (): AuditStore => new InMemoryAuditStore();

export const createAutomationAuditLogger = (
  store?: AuditStore,
  emitFn?: (event: AuditEvent) => void,
): AuditLogger => new AutomationAuditLogger(store ?? createInMemoryAuditStore(), emitFn);