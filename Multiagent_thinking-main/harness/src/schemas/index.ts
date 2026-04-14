export interface ADRSchema {
  taskId: string;
  agent: string;
  objective: string;
  ownedFiles: string[];
  forbiddenFiles?: string[];
  constraints?: string[];
  definitionOfDone?: string[];
  emitFormat: "progress_v1" | "typescript_v1";
  context?: EmissionContext;
}

export interface EmissionContext {
  mood?: KeywordScore[];
  relations?: RelationScore[];
}

export interface KeywordScore {
  keyword: string;
  score: number;
}

export interface RelationScore {
  entityA: string;
  entityB: string;
  relationType: string;
  score: number;
}

export interface ProgressSchema {
  taskId: string;
  agent: string;
  phase: Phase;
  done: string[];
  blockers: string[];
  next?: string;
  touchedFiles?: string[];
  needsEscalation?: boolean;
}

export type Phase = "init" | "analysis" | "implementation" | "testing" | "verification" | "complete";

export interface CondensedEmission {
  agentId: string;
  updates: string[];
  blockers: string[];
  touchedFiles: string[];
  status: "working" | "blocked" | "complete";
}

export interface VerificationSchema {
  taskId: string;
  verified: boolean;
  confidence: number;
  findings: string[];
  escalations: string[];
  nextAction: "continue" | "retry" | "abort";
}

export interface EscalationSchema {
  taskId: string;
  agent: string;
  reason: string;
  urgency: "low" | "medium" | "high" | "critical";
  blockers: string[];
  suggestedResolution?: string;
  timestamp: string;
}

export interface ValidationResult {
  passed: boolean;
  stage: string;
  issues: string[];
  extractedInterface?: string;
  parsedFields?: Map<string, FieldType>;
}

export interface FieldType {
  name: string;
  type: string;
  optional: boolean;
  rawMatch: string;
}

export interface SemanticResult {
  passed: boolean;
  issues: string[];
  signalDensity: number;
  fileRefs: number;
  actionVerbs: number;
}

export interface GuardConfig {
  requiredInterface: string;
  requiredFields: string[];
  maxOutputTokens: number;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

export interface RetryResult {
  success: boolean;
  retryCount: number;
  reason?: string;
  costEstimate?: number;
  finalOutput?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  metrics: RunMetrics;
  errors: string[];
  artifacts: ArtifactPaths;
}

export interface RunMetrics {
  totalTokens: number;
  frontierCalls: number;
  workerCalls: number;
  monitoringOverhead: number;
  retryCount: number;
  escalationCount: number;
  complianceRate: number;
  averageOutputSize: number;
}

export interface ArtifactPaths {
  rawDir: string;
  normalizedDir: string;
  summaryPath: string;
  metricsPath: string;
  eventsPath: string;
}

export interface ComparisonResult {
  baseline: RunMetrics;
  emission: RunMetrics;
  tokenSavings: number;
  tokenSavingsPercent: number;
  frontierCallReduction: number;
  complianceImprovement: number;
}

export const REQUIRED_INTERFACES: Record<string, string[]> = {
  ADRSchema: ["taskId", "agent", "objective", "ownedFiles"],
  Progress: ["phase", "done", "blockers"],
  CondensedEmission: ["agentId", "updates", "blockers", "status"],
  VerificationSchema: ["taskId", "verified", "confidence", "findings"],
  EscalationSchema: ["taskId", "agent", "reason", "urgency"],
};

export const VALID_ENUMS: Record<string, string[]> = {
  phase: ["init", "analysis", "implementation", "testing", "verification", "complete"],
  status: ["working", "blocked", "complete"],
  urgency: ["low", "medium", "high", "critical"],
  nextAction: ["continue", "retry", "abort"],
};