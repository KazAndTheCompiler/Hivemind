// Canonical TypeScript types for OpenClaw agent coordination
// This package defines ALL interfaces, enums, and type aliases used across the system.

// ---------------------------------------------------------------------------
// Agent Status
// ---------------------------------------------------------------------------

export type AgentStatus =
  | 'working'
  | 'blocked'
  | 'done'
  | 'failed'
  | 'needs_review';

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
  files: string[];
  packageNames: string[];
  timestamp: string;
}

export interface AgentSummaryEvent {
  kind: 'agent.summary.emitted';
  raw: RawAgentSummary;
  timestamp: string;
}

export interface AgentNormalizedEvent {
  kind: 'agent.summary.normalized';
  normalized: NormalizedAgentSummary;
  timestamp: string;
}

export interface CondensedRelayEvent {
  kind: 'relay.condensed';
  relay200: CondensedRelay200;
  relay300: CondensedRelay300;
  timestamp: string;
}

export interface QualityGateResult {
  kind: 'quality.gate.completed';
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
  finding: ToolFinding;
  timestamp: string;
}

export interface GitNexusChangeEvent {
  kind: 'gitnexus.change';
  files: string[];
  packageNames: string[];
  diff: { added: number; removed: number; modified: number };
  timestamp: string;
}

export interface AuditPersistEvent {
  kind: 'audit.persisted';
  eventType: string;
  recordId: string;
  timestamp: string;
}

export interface DeadLetterEvent {
  kind: 'audit.dead_letter';
  originalEvent: OpenClawEvent;
  reason: string;
  timestamp: string;
}

export interface OrchestratorStartEvent {
  kind: 'orchestrator.started';
  timestamp: string;
}

export interface OrchestratorShutdownEvent {
  kind: 'orchestrator.shutdown';
  reason: string;
  timestamp: string;
}

export interface WorkerEmitEvent {
  kind: 'worker.emit';
  workerId: string;
  summary: RawAgentSummary;
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
  | WorkerEmitEvent;

export type OpenClawEventKind = OpenClawEvent['kind'];

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
