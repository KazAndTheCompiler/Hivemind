// Zod runtime validation schemas for OpenClaw agent protocol
// Every type in @openclaw/core-types has a matching Zod schema here.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const AgentStatusSchema = z.enum([
  'working',
  'blocked',
  'done',
  'failed',
  'needs_review',
]);

export const SeveritySchema = z.enum([
  'none',
  'low',
  'medium',
  'high',
  'critical',
]);

export const ToolSeveritySchema = z.enum([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

export const ToolSourceSchema = z.enum([
  'secdev',
  'gitnexus',
  'eslint',
  'prettier',
  'system',
]);

// ---------------------------------------------------------------------------
// Tool Finding
// ---------------------------------------------------------------------------

export const ToolFindingSchema = z.object({
  source: ToolSourceSchema,
  severity: ToolSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  fileRefs: z.array(z.string()).default([]),
  suggestedAction: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Agent Summary
// ---------------------------------------------------------------------------

export const RawAgentSummarySchema = z.object({
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  status: AgentStatusSchema,
  summary: z.string().min(1),
  touchedFiles: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export const NormalizedAgentSummarySchema = z.object({
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  status: AgentStatusSchema,
  conciseSummary: z.string().min(1),
  touchedFiles: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()).default([]),
  toolFindings: z.array(ToolFindingSchema).default([]),
  timestamp: z.string(),
});

// ---------------------------------------------------------------------------
// Condensed Relay
// ---------------------------------------------------------------------------

export const CondensedRelay200Schema = z.object({
  version: z.literal('relay.v1'),
  budget: z.literal(200),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  status: AgentStatusSchema,
  summary: z.string().min(1),
  touchedFiles: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  nextAction: z.string().nullable(),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
});

export const CondensedRelay300Schema = z.object({
  version: z.literal('relay.v1'),
  budget: z.literal(300),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  status: AgentStatusSchema,
  summary: z.string().min(1),
  touchedFiles: z.array(z.string()).default([]),
  blockers: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  topFindings: z.array(ToolFindingSchema).default([]),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Event schemas (discriminated unions)
// ---------------------------------------------------------------------------

export const FileChangeEventSchema = z.object({
  kind: z.literal('file.change.detected'),
  files: z.array(z.string()),
  packageNames: z.array(z.string()),
  timestamp: z.string(),
});

export const AgentSummaryEventSchema = z.object({
  kind: z.literal('agent.summary.emitted'),
  raw: RawAgentSummarySchema,
  timestamp: z.string(),
});

export const AgentNormalizedEventSchema = z.object({
  kind: z.literal('agent.summary.normalized'),
  normalized: NormalizedAgentSummarySchema,
  timestamp: z.string(),
});

export const CondensedRelayEventSchema = z.object({
  kind: z.literal('relay.condensed'),
  relay200: CondensedRelay200Schema,
  relay300: CondensedRelay300Schema,
  timestamp: z.string(),
});

export const QualityGateResultSchema = z.object({
  kind: z.literal('quality.gate.completed'),
  changedFiles: z.array(z.string()),
  prettier: z.object({
    ran: z.boolean(),
    formattedFiles: z.array(z.string()),
    failedFiles: z.array(z.string()),
  }),
  eslint: z.object({
    ran: z.boolean(),
    fixedFiles: z.array(z.string()),
    failedFiles: z.array(z.string()),
    warnings: z.number(),
    errors: z.number(),
  }),
  findings: z.array(ToolFindingSchema),
  timestamp: z.string(),
});

export const SecDevFindingEventSchema = z.object({
  kind: z.literal('secdev.finding'),
  finding: ToolFindingSchema,
  timestamp: z.string(),
});

export const GitNexusChangeEventSchema = z.object({
  kind: z.literal('gitnexus.change'),
  files: z.array(z.string()),
  packageNames: z.array(z.string()),
  diff: z.object({
    added: z.number(),
    removed: z.number(),
    modified: z.number(),
  }),
  timestamp: z.string(),
});

export const AuditPersistEventSchema = z.object({
  kind: z.literal('audit.persisted'),
  eventType: z.string(),
  recordId: z.string(),
  timestamp: z.string(),
});

export const DeadLetterEventSchema = z.object({
  kind: z.literal('audit.dead_letter'),
  originalEvent: z.unknown(),
  reason: z.string(),
  timestamp: z.string(),
});

export const OrchestratorStartEventSchema = z.object({
  kind: z.literal('orchestrator.started'),
  timestamp: z.string(),
});

export const OrchestratorShutdownEventSchema = z.object({
  kind: z.literal('orchestrator.shutdown'),
  reason: z.string(),
  timestamp: z.string(),
});

export const WorkerEmitEventSchema = z.object({
  kind: z.literal('worker.emit'),
  workerId: z.string(),
  summary: RawAgentSummarySchema,
  timestamp: z.string(),
});

// Discriminated union of all OpenClaw events
export const OpenClawEventSchema = z.discriminatedUnion('kind', [
  FileChangeEventSchema,
  AgentSummaryEventSchema,
  AgentNormalizedEventSchema,
  CondensedRelayEventSchema,
  QualityGateResultSchema,
  SecDevFindingEventSchema,
  GitNexusChangeEventSchema,
  AuditPersistEventSchema,
  DeadLetterEventSchema,
  OrchestratorStartEventSchema,
  OrchestratorShutdownEventSchema,
  WorkerEmitEventSchema,
]);

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

export const OpenClawConfigSchema = z.object({
  workspace: z.string().default('.'),
  orchestrator: z.object({
    maxConcurrentWorkers: z.number().int().positive().default(4),
    relayBudget200: z.number().int().positive().default(200),
    relayBudget300: z.number().int().positive().default(300),
    retryAttempts: z.number().int().nonnegative().default(3),
    retryDelayMs: z.number().int().positive().default(1000),
  }).default({}),
  daemon: z.object({
    watchPaths: z.array(z.string()).default(['.']),
    debounceMs: z.number().int().positive().default(500),
  }).default({}),
  tools: z.object({
    gitnexus: z.object({
      enabled: z.boolean().default(true),
      command: z.string().optional(),
    }).default({}),
    secdev: z.object({
      enabled: z.boolean().default(false),
      command: z.string().optional(),
    }).default({}),
    eslint: z.object({
      enabled: z.boolean().default(true),
      configFile: z.string().optional(),
    }).default({}),
    prettier: z.object({
      enabled: z.boolean().default(true),
      configFile: z.string().optional(),
    }).default({}),
  }).default({}),
  audit: z.object({
    storePath: z.string().default('.openclaw/audit'),
    retentionDays: z.number().int().positive().default(30),
    deadLetterPath: z.string().default('.openclaw/dead-letter'),
  }).default({}),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'human']).default('json'),
    output: z.string().optional(),
  }).default({}),
});

// ---------------------------------------------------------------------------
// Re-export types for convenience
// ---------------------------------------------------------------------------

export type RawAgentSummary = z.infer<typeof RawAgentSummarySchema>;
export type NormalizedAgentSummary = z.infer<typeof NormalizedAgentSummarySchema>;
export type CondensedRelay200 = z.infer<typeof CondensedRelay200Schema>;
export type CondensedRelay300 = z.infer<typeof CondensedRelay300Schema>;
export type ToolFinding = z.infer<typeof ToolFindingSchema>;
export type OpenClawConfig = z.infer<typeof OpenClawConfigSchema>;
export type OpenClawEvent = z.infer<typeof OpenClawEventSchema>;
