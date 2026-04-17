// Canonical TypeScript types for OpenClaw agent coordination
// This package defines ALL interfaces, enums, and type aliases used across the system.

// ---------------------------------------------------------------------------
// Schema Versioning
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 'v1' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export type AgentStatus = 'working' | 'blocked' | 'done' | 'failed' | 'needs_review';

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type Severity = 'none' | 'low' | 'medium' | 'high' | 'critical';
export type ToolSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

// ---------------------------------------------------------------------------
// Tool Finding
// ---------------------------------------------------------------------------

export type ToolSource = 'secdev' | 'gitnexus' | 'eslint' | 'prettier' | 'system';

export interface ToolFinding {
  source: ToolSource;
  severity: ToolSeverity;
  code: string;
  message: string;
  fileRefs: string[];
  suggestedAction?: string;
}

// ---------------------------------------------------------------------------
// Agent Summary Types
// ---------------------------------------------------------------------------

export interface RawAgentSummary {
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  confidence: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NormalizedAgentSummary {
  taskId: string;
  agentId: string;
  status: AgentStatus;
  conciseSummary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  confidence: number;
  tags: string[];
  toolFindings: ToolFinding[];
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Condensed Relay Types
// ---------------------------------------------------------------------------

export interface CondensedRelay200 {
  version: 'relay.v1';
  budget: 200;
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextAction: string | null;
  severity: Severity;
  confidence: number;
}

export interface CondensedRelay300 {
  version: 'relay.v1';
  budget: 300;
  taskId: string;
  agentId: string;
  status: AgentStatus;
  summary: string;
  touchedFiles: string[];
  blockers: string[];
  nextActions: string[];
  topFindings: ToolFinding[];
  severity: Severity;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Event Types (discriminated unions)
// ---------------------------------------------------------------------------

export interface FileChangeEvent {
  kind: 'file.change.detected';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  files: string[];
  packageNames: string[];
  timestamp: string;
}

export interface AgentSummaryEvent {
  kind: 'agent.summary.emitted';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  raw: RawAgentSummary;
  timestamp: string;
}

export interface AgentNormalizedEvent {
  kind: 'agent.summary.normalized';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  normalized: NormalizedAgentSummary;
  timestamp: string;
}

export interface CondensedRelayEvent {
  kind: 'relay.condensed';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  relay200: CondensedRelay200;
  relay300: CondensedRelay300;
  timestamp: string;
}

export interface QualityGateResult {
  kind: 'quality.gate.completed';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  changedFiles: string[];
  prettier: {
    ran: boolean;
    formattedFiles: string[];
    failedFiles: string[];
  };
  eslint: {
    ran: boolean;
    fixedFiles: string[];
    failedFiles: string[];
    warnings: number;
    errors: number;
  };
  findings: ToolFinding[];
  timestamp: string;
}

export interface SecDevFindingEvent {
  kind: 'secdev.finding';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  finding: ToolFinding;
  timestamp: string;
}

export interface GitNexusChangeEvent {
  kind: 'gitnexus.change';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  files: string[];
  packageNames: string[];
  diff: { added: number; removed: number; modified: number };
  timestamp: string;
}

export interface AuditPersistEvent {
  kind: 'audit.persisted';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  eventType: string;
  recordId: string;
  timestamp: string;
}

export interface DeadLetterEvent {
  kind: 'audit.dead_letter';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  originalEvent: OpenClawEvent;
  reason: string;
  timestamp: string;
}

export interface OrchestratorStartEvent {
  kind: 'orchestrator.started';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  timestamp: string;
}

export interface OrchestratorShutdownEvent {
  kind: 'orchestrator.shutdown';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  reason: string;
  timestamp: string;
}

export interface OrchestratorHaltedEvent {
  kind: 'orchestrator.halted';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  reason: string;
  timestamp: string;
}

export interface WorkerEmitEvent {
  kind: 'worker.emit';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  workerId: string;
  summary: RawAgentSummary;
  timestamp: string;
}

export interface RelayDeliveredEvent {
  kind: 'relay.delivered';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  taskId: string;
  severity: Severity;
  inboxSize: number;
  timestamp: string;
}

export interface RelayDeliveryFailedEvent {
  kind: 'relay.delivery_failed';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  taskId: string;
  reason: string;
  timestamp: string;
}

export interface GitNexusChangeDetectedEvent {
  kind: 'gitnexus.change.detected';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  files: string[];
  packageNames: string[];
  diff: { added: number; removed: number; modified: number };
  timestamp: string;
}

// Discriminated union of all event kinds
export type OpenClawEvent =
  | FileChangeEvent
  | AgentSummaryEvent
  | AgentNormalizedEvent
  | CondensedRelayEvent
  | QualityGateResult
  | SecDevFindingEvent
  | GitNexusChangeEvent
  | AuditPersistEvent
  | DeadLetterEvent
  | OrchestratorStartEvent
  | OrchestratorShutdownEvent
  | OrchestratorHaltedEvent
  | WorkerEmitEvent
  | RelayDeliveredEvent
  | RelayDeliveryFailedEvent
  | GitNexusChangeDetectedEvent;

export type OpenClawEventKind = OpenClawEvent['kind'];

// ---------------------------------------------------------------------------
// Event Metadata — observability for every event
// ---------------------------------------------------------------------------

export interface EventMeta {
  eventId: string;
  correlationId?: string;
  causationId?: string;
  createdAt: string;
  processedAt?: string;
  failedHandlers?: number;
  sequence?: number;
  streamId?: string;
  schemaVersion?: SchemaVersion;
}

// ---------------------------------------------------------------------------
// Token Budget
// ---------------------------------------------------------------------------

export interface TokenBudget {
  maxTokens: number;
  usedTokens: number;
  remainingTokens: number;
  exceeded: boolean;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OpenClawConfig {
  workspace: string;
  orchestrator: {
    maxConcurrentWorkers: number;
    relayBudget200: number;
    relayBudget300: number;
    retryAttempts: number;
    retryDelayMs: number;
  };
  daemon: {
    watchPaths: string[];
    debounceMs: number;
  };
  tools: {
    gitnexus: {
      enabled: boolean;
      command?: string;
    };
    secdev: {
      enabled: boolean;
      command?: string;
    };
    eslint: {
      enabled: boolean;
      configFile?: string;
    };
    prettier: {
      enabled: boolean;
      configFile?: string;
    };
  };
  audit: {
    storePath: string;
    retentionDays: number;
    deadLetterPath: string;
  };
  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'human';
    output?: string;
  };
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export interface OpenClawErrorInfo {
  code: string;
  message: string;
  cause?: Error;
  context?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Queue / Buffering
// ---------------------------------------------------------------------------

export interface BoundedQueueItem<T> {
  data: T;
  enqueuedAt: string;
  attempts: number;
}

export interface BoundedQueue<T> {
  capacity: number;
  size: number;
  items: BoundedQueueItem<T>[];
}

// ---------------------------------------------------------------------------
// Orchestrator State
// ---------------------------------------------------------------------------

export interface OrchestratorState {
  running: boolean;
  workers: Map<string, WorkerState>;
  queueSize: number;
  lastEventAt: string;
}

export interface WorkerState {
  id: string;
  status: 'idle' | 'working' | 'blocked' | 'error';
  currentTask?: string;
  lastEmissionAt?: string;
}

// ---------------------------------------------------------------------------
// System State (deterministic snapshot for replay)
// ---------------------------------------------------------------------------

export interface TaskState {
  taskId: string;
  status: AgentStatus;
  confidence: number;
  severity: Severity;
  processedAt: string;
  relayDelivered: boolean;
  relayBlocked: boolean;
  blockerReason?: string;
}

export interface SystemState {
  schemaVersion: SchemaVersion;
  tasks: Record<string, TaskState>;
  streams: Record<string, StreamState>;
  lastUpdated: string;
  globalSequence: number;
}

export interface StreamState {
  streamId: string;
  lastSequence: number;
  taskIds: string[];
}

// ---------------------------------------------------------------------------
// Event Sequencing (for ordering guarantees)
// ---------------------------------------------------------------------------

export interface SequencedEvent {
  sequence: number;
  streamId: string;
}

export type DomainEvent =
  | { type: 'task.started'; taskId: string; timestamp: string }
  | { type: 'task.completed'; taskId: string; timestamp: string }
  | { type: 'task.failed'; taskId: string; reason: string; timestamp: string }
  | { type: 'relay.blocked'; taskId: string; reason: string; timestamp: string }
  | { type: 'relay.released'; taskId: string; timestamp: string };

// ---------------------------------------------------------------------------
// Idempotency (deduplication via eventId hash)
// ---------------------------------------------------------------------------

export interface IdempotencyRecord {
  eventId: string;
  processedAt: string;
  result: 'processed' | 'skipped' | 'error';
}

// ---------------------------------------------------------------------------
// Pipeline Outcome (partial failure strategy)
// ---------------------------------------------------------------------------

export type PipelineOutcome = 'success' | 'partial' | 'failed';

export interface PipelineResult {
  outcome: PipelineOutcome;
  taskId: string;
  steps: PipelineStepResult[];
  timestamp: string;
}

export interface PipelineStepResult {
  step: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Confidence Threshold Routing
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.5;

export type RelayRoutingDecision =
  | { decision: 'relay'; confidence: number }
  | { decision: 'review_queue'; confidence: number; reason: string }
  | { decision: 'block'; confidence: number; reason: string };

// ---------------------------------------------------------------------------
// Observability Metrics
// ---------------------------------------------------------------------------

export interface SystemMetrics {
  eventsProcessedTotal: number;
  eventsFailedTotal: number;
  toolRunsTotal: number;
  toolRunsFailed: number;
  relayEmittedTotal: number;
  relayBlockedTotal: number;
  pipelineLockConflicts: number;
  idempotencySkippedTotal: number;
  lastMetricsUpdated: string;
}

// ---------------------------------------------------------------------------
// Pipeline Ownership Lock
// ---------------------------------------------------------------------------

export interface PipelineLock {
  owner: 'daemon' | 'orchestrator' | 'replay' | null;
  lockedAt: string | null;
  taskId?: string;
}

export const NO_LOCK: PipelineLock = {
  owner: null,
  lockedAt: null,
};

// ---------------------------------------------------------------------------
// Agent Reputation
// ---------------------------------------------------------------------------

export interface AgentReputation {
  agentId: string;
  successRate: number;
  totalRuns: number;
  lastRunAt: string;
  trustScore: number;
}
