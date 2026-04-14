// Automation enforcement layer core types and schemas
// Domain models for the enforcement subsystem

import { z } from 'zod';

// ============================================
// Core Enums
// ============================================

export const AutomationModeSchema = z.enum(['changed_file', 'checkpoint', 'full_repo']);
export type AutomationMode = z.infer<typeof AutomationModeSchema>;

export const ToolNameSchema = z.enum(['prettier', 'eslint', 'tsc', 'knip', 'gitnexus']);
export type ToolName = z.infer<typeof ToolNameSchema>;

export const EnforcementSeveritySchema = z.enum(['info', 'warning', 'blocker']);
export type EnforcementSeverity = z.infer<typeof EnforcementSeveritySchema>;

export const EnforcementStatusSchema = z.enum(['passed', 'failed', 'partial', 'skipped', 'timed_out']);
export type EnforcementStatus = z.infer<typeof EnforcementStatusSchema>;

export const RepoStateSchema = z.enum(['stable', 'repairing', 'drifting']);
export type RepoState = z.infer<typeof RepoStateSchema>;

// ============================================
// Tool Execution Target
// ============================================

export const ToolExecutionTargetSchema = z.object({
  files: z.array(z.string()),
  packages: z.array(z.string()),
  patterns: z.array(z.string()),
});
export type ToolExecutionTarget = z.infer<typeof ToolExecutionTargetSchema>;

// ============================================
// Tool Issue
// ============================================

export const ToolIssueSchema = z.object({
  tool: ToolNameSchema,
  severity: EnforcementSeveritySchema,
  ruleId: z.string().optional(),
  file: z.string().optional(),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  symbol: z.string().optional(),
  suggestion: z.string().optional(),
});
export type ToolIssue = z.infer<typeof ToolIssueSchema>;

// ============================================
// Tool Execution Result
// ============================================

export const ToolExecutionResultSchema = z.object({
  tool: ToolNameSchema,
  mode: AutomationModeSchema,
  status: EnforcementStatusSchema,
  durationMs: z.number(),
  exitCode: z.number().nullable(),
  target: ToolExecutionTargetSchema,
  blockerCount: z.number(),
  warningCount: z.number(),
  issues: z.array(ToolIssueSchema),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  retryCount: z.number(),
  timestamp: z.string(),
});
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;

// ============================================
// Enforcement Decision
// ============================================

export const EnforcementDecisionSchema = z.object({
  canProceed: z.boolean(),
  blockingTools: z.array(ToolNameSchema),
  warningTools: z.array(ToolNameSchema),
  rationale: z.string(),
});
export type EnforcementDecision = z.infer<typeof EnforcementDecisionSchema>;

// ============================================
// Condensed Agent Summary
// ============================================

export const CondensedAgentSummarySchema = z.object({
  mode: AutomationModeSchema,
  repoState: RepoStateSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  nextActions: z.array(z.string()),
  touchedAreas: z.array(z.string()),
  tokenBudget: z.union([z.literal(200), z.literal(300)]),
});
export type CondensedAgentSummary = z.infer<typeof CondensedAgentSummarySchema>;

// ============================================
// GitNexus Context Summary
// ============================================

export const GitNexusContextSummarySchema = z.object({
  touchedAreas: z.array(z.string()),
  hotspots: z.array(z.string()),
  architecturalNotes: z.array(z.string()),
  suspectedRisks: z.array(z.string()),
  summary: z.string(),
});
export type GitNexusContextSummary = z.infer<typeof GitNexusContextSummarySchema>;

// ============================================
// Audit Event Types
// ============================================

export const AuditEventTypeSchema = z.enum([
  'tool_execution_started',
  'tool_execution_completed',
  'tool_execution_failed',
  'tool_retry',
  'tool_skipped',
  'enforcement_decision',
  'checkpoint_triggered',
  'checkpoint_completed',
  'summary_emitted',
  'run_started',
  'run_completed',
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const AuditEventSchema = z.object({
  id: z.string(),
  type: AuditEventTypeSchema,
  timestamp: z.string(),
  mode: AutomationModeSchema.optional(),
  tool: ToolNameSchema.optional(),
  runId: z.string().optional(),
  payload: z.record(z.unknown()),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ============================================
// Tool Adapter Interface
// ============================================

export interface ToolAdapter {
  readonly name: ToolName;
  readonly supportedModes: AutomationMode[];

  buildCommand(target: ToolExecutionTarget, mode: AutomationMode): string[];
  normalizeResult(
    stdout: string,
    stderr: string,
    exitCode: number | null,
    durationMs: number,
    target: ToolExecutionTarget,
    mode: AutomationMode,
    retryCount: number,
  ): ToolExecutionResult;
}

// ============================================
// Checkpoint Trigger
// ============================================

export const CheckpointTriggerSchema = z.object({
  type: z.enum(['mutation_count', 'milestone', 'manual', 'pre_promotion']),
  threshold: z.number().optional(),
  label: z.string().optional(),
});
export type CheckpointTrigger = z.infer<typeof CheckpointTriggerSchema>;

// ============================================
// Enforcement Policy
// ============================================

export const ToolPolicySchema = z.object({
  required: z.boolean(),
  allowedModes: z.array(AutomationModeSchema),
  blockerOnFailure: z.boolean(),
  warnOnFailure: z.boolean(),
  maxRetries: z.number(),
  timeoutMs: z.number(),
});
export type ToolPolicy = z.infer<typeof ToolPolicySchema>;

export const EnforcementPolicySchema = z.object({
  prettier: ToolPolicySchema,
  eslint: ToolPolicySchema,
  tsc: ToolPolicySchema,
  knip: ToolPolicySchema,
  gitnexus: ToolPolicySchema,
  failClosed: z.boolean(),
});
export type EnforcementPolicy = z.infer<typeof EnforcementPolicySchema>;

export const DEFAULT_ENFORCEMENT_POLICY: EnforcementPolicy = {
  prettier: {
    required: true,
    allowedModes: ['changed_file', 'checkpoint', 'full_repo'],
    blockerOnFailure: false,
    warnOnFailure: true,
    maxRetries: 1,
    timeoutMs: 30_000,
  },
  eslint: {
    required: true,
    allowedModes: ['changed_file', 'checkpoint', 'full_repo'],
    blockerOnFailure: true,
    warnOnFailure: false,
    maxRetries: 2,
    timeoutMs: 60_000,
  },
  tsc: {
    required: true,
    allowedModes: ['changed_file', 'checkpoint', 'full_repo'],
    blockerOnFailure: true,
    warnOnFailure: false,
    maxRetries: 1,
    timeoutMs: 120_000,
  },
  knip: {
    required: true,
    allowedModes: ['checkpoint', 'full_repo'],
    blockerOnFailure: true,
    warnOnFailure: false,
    maxRetries: 1,
    timeoutMs: 180_000,
  },
  gitnexus: {
    required: false,
    allowedModes: ['checkpoint'],
    blockerOnFailure: false,
    warnOnFailure: true,
    maxRetries: 0,
    timeoutMs: 30_000,
  },
  failClosed: true,
};

// ============================================
// Automation Run
// ============================================

export const AutomationRunSchema = z.object({
  id: z.string(),
  mode: AutomationModeSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  results: z.array(ToolExecutionResultSchema),
  decision: EnforcementDecisionSchema.optional(),
  summary: CondensedAgentSummarySchema.optional(),
  mutationCount: z.number().optional(),
});
export type AutomationRun = z.infer<typeof AutomationRunSchema>;

// ============================================
// Summary Condensation
// ============================================

export interface SummaryCondenser {
  condenseTo200(run: AutomationRun, gitNexusContext?: GitNexusContextSummary): CondensedAgentSummary;
  condenseTo300(run: AutomationRun, gitNexusContext?: GitNexusContextSummary): CondensedAgentSummary;
  buildRepairInstructions(run: AutomationRun): string[];
}

// ============================================
// Scope Resolution
// ============================================

export interface ChangedFileDetector {
  detectChangedFiles(workingDirectory: string): Promise<string[]>;
  detectAffectedPackages(changedFiles: string[]): Promise<string[]>;
}

// ============================================
// Execution Configuration
// ============================================

export const ExecutionConfigSchema = z.object({
  cwd: z.string(),
  dryRun: z.boolean().optional(),
  parallel: z.boolean().optional(),
  continueOnError: z.boolean().optional(),
  emitEvents: z.boolean().optional(),
});
export type ExecutionConfig = z.infer<typeof ExecutionConfigSchema>;