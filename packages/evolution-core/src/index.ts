// Evolution layer core types
// Domain models for autonomous evolution subsystem

export const SCHEMA_VERSION = 'v1' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export type EvolutionScope =
  | 'prompt'
  | 'routing_policy'
  | 'retry_policy'
  | 'threshold'
  | 'memory_rule'
  | 'tool_policy'
  | 'task_template';

export type EvolutionStage =
  | 'draft'
  | 'experimental'
  | 'canary'
  | 'active'
  | 'rolled_back'
  | 'rejected';

export type EvidenceKind =
  | 'task_outcome'
  | 'quality_gate'
  | 'secdev_finding'
  | 'relay_delivery'
  | 'manual_review'
  | 'rollback_event'
  | 'memory_feedback';

export type LessonPriority = 'low' | 'medium' | 'high' | 'critical';

export type MutationRisk = 'low' | 'medium' | 'high' | 'critical';

export type PromptStatus = 'draft' | 'active' | 'archived';

export type PolicyStatus = 'draft' | 'active' | 'archived';

export interface EvidenceRef {
  id: string;
  kind: EvidenceKind;
  timestamp: string;
  taskId?: string;
  agentId?: string;
  summary?: string;
  refs?: string[];
}

export interface ExtractedLesson {
  id: string;
  scope: EvolutionScope;
  title: string;
  problem: string;
  hypothesis: string;
  recommendedChange: string;
  confidence: number;
  priority: LessonPriority;
  evidence: EvidenceRef[];
  tags: string[];
  expiresAt?: string;
  createdAt: string;
  sourceVersion: string;
}

export interface MutationCandidate {
  id: string;
  scope: EvolutionScope;
  targetId: string;
  baseVersion: string;
  proposedVersion: string;
  rationale: string;
  patch: unknown;
  expectedOutcome: string;
  risk: MutationRisk;
  evidence: EvidenceRef[];
  createdAt: string;
}

export interface ValidationResult {
  candidateId: string;
  schemaValid: boolean;
  policyValid: boolean;
  testsPassed: boolean;
  qualityGatePassed: boolean;
  secdevPassed: boolean;
  regressionsDetected: boolean;
  notes: string[];
  timestamp: string;
}

export interface EvolutionScore {
  candidateId: string;
  successDelta: number;
  failureReduction: number;
  securityScore: number;
  regressionRisk: number;
  complexityCost: number;
  confidenceScore: number;
  overallScore: number;
  timestamp: string;
}

export interface RolloutDecision {
  candidateId: string;
  stage: EvolutionStage;
  approved: boolean;
  reason: string;
  timestamp: string;
}

export interface PromptVersion {
  promptId: string;
  version: string;
  content: string;
  checksum: string;
  createdAt: string;
  createdFromVersion?: string;
  status: PromptStatus;
}

export interface PolicyVersion {
  policyId: string;
  version: string;
  config: Record<string, unknown>;
  checksum: string;
  createdAt: string;
  createdFromVersion?: string;
  status: PolicyStatus;
}

export interface LessonQuery {
  scope?: EvolutionScope;
  priority?: LessonPriority;
  tags?: string[];
  minConfidence?: number;
  limit?: number;
}

export interface CandidateQuery {
  scope?: EvolutionScope;
  stage?: EvolutionStage;
  risk?: MutationRisk;
  limit?: number;
}

export interface EvolutionMetrics {
  observationsIngestedTotal: number;
  lessonsExtractedTotal: number;
  candidatesCreatedTotal: number;
  candidatesValidatedTotal: number;
  candidatesPromotedTotal: number;
  candidatesRejectedTotal: number;
  rollbacksTotal: number;
  canaryFailuresTotal: number;
  promptVersionsTotal: number;
  policyVersionsTotal: number;
  lastMetricsUpdated: string;
}

export interface EvolutionHealth {
  queueDepth: number;
  lastSuccessfulValidation: string | null;
  lastRolloutTime: string | null;
  pendingCandidates: number;
  staleLessonsCount: number;
  replayConsistencyStatus: 'consistent' | 'divergent' | 'unknown';
}

export interface ScoringWeights {
  weightSuccess: number;
  weightFailureReduction: number;
  weightSecurity: number;
  weightConfidence: number;
  weightRegression: number;
  weightComplexity: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  weightSuccess: 0.25,
  weightFailureReduction: 0.2,
  weightSecurity: 0.2,
  weightConfidence: 0.15,
  weightRegression: 0.15,
  weightComplexity: 0.05,
};

export interface RolloutConfig {
  canaryDurationMs: number;
  negativeSignalThreshold: number;
  autoRollbackEnabled: boolean;
  evaluationWindowMs: number;
  minScoreForPromotion: number;
}

export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  canaryDurationMs: 3600000,
  negativeSignalThreshold: 0.1,
  autoRollbackEnabled: true,
  evaluationWindowMs: 1800000,
  minScoreForPromotion: 0.6,
};
