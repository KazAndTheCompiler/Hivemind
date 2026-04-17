// Zod schemas for evolution layer runtime validation

import { z } from 'zod';

export const EvolutionScopeSchema = z.enum([
  'prompt',
  'routing_policy',
  'retry_policy',
  'threshold',
  'memory_rule',
  'tool_policy',
  'task_template',
]);

export const EvolutionStageSchema = z.enum([
  'draft',
  'experimental',
  'canary',
  'active',
  'rolled_back',
  'rejected',
]);

export const EvidenceKindSchema = z.enum([
  'task_outcome',
  'quality_gate',
  'secdev_finding',
  'relay_delivery',
  'manual_review',
  'rollback_event',
  'memory_feedback',
]);

export const LessonPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const MutationRiskSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const PromptStatusSchema = z.enum(['draft', 'active', 'archived']);

export const PolicyStatusSchema = z.enum(['draft', 'active', 'archived']);

export const EvidenceRefSchema = z.object({
  id: z.string().min(1),
  kind: EvidenceKindSchema,
  timestamp: z.string(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
  summary: z.string().optional(),
  refs: z.array(z.string()).optional(),
});

export const ExtractedLessonSchema = z.object({
  id: z.string().min(1),
  scope: EvolutionScopeSchema,
  title: z.string().min(1),
  problem: z.string().min(1),
  hypothesis: z.string().min(1),
  recommendedChange: z.string().min(1),
  confidence: z.number().min(0).max(1),
  priority: LessonPrioritySchema,
  evidence: z.array(EvidenceRefSchema).min(1),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().optional(),
  createdAt: z.string(),
  sourceVersion: z.string().min(1),
});

export const MutationCandidateSchema = z.object({
  id: z.string().min(1),
  scope: EvolutionScopeSchema,
  targetId: z.string().min(1),
  baseVersion: z.string().min(1),
  proposedVersion: z.string().min(1),
  rationale: z.string().min(1),
  patch: z.unknown(),
  expectedOutcome: z.string().min(1),
  risk: MutationRiskSchema,
  evidence: z.array(EvidenceRefSchema).min(1),
  createdAt: z.string(),
});

export const ValidationResultSchema = z.object({
  candidateId: z.string().min(1),
  schemaValid: z.boolean(),
  policyValid: z.boolean(),
  testsPassed: z.boolean(),
  qualityGatePassed: z.boolean(),
  secdevPassed: z.boolean(),
  regressionsDetected: z.boolean(),
  notes: z.array(z.string()).default([]),
  timestamp: z.string(),
});

export const EvolutionScoreSchema = z.object({
  candidateId: z.string().min(1),
  successDelta: z.number(),
  failureReduction: z.number(),
  securityScore: z.number(),
  regressionRisk: z.number(),
  complexityCost: z.number(),
  confidenceScore: z.number(),
  overallScore: z.number(),
  timestamp: z.string(),
});

export const RolloutDecisionSchema = z.object({
  candidateId: z.string().min(1),
  stage: EvolutionStageSchema,
  approved: z.boolean(),
  reason: z.string().min(1),
  timestamp: z.string(),
});

export const PromptVersionSchema = z.object({
  promptId: z.string().min(1),
  version: z.string().min(1),
  content: z.string().min(1),
  checksum: z.string().min(1),
  createdAt: z.string(),
  createdFromVersion: z.string().optional(),
  status: PromptStatusSchema,
});

export const PolicyVersionSchema = z.object({
  policyId: z.string().min(1),
  version: z.string().min(1),
  config: z.record(z.unknown()),
  checksum: z.string().min(1),
  createdAt: z.string(),
  createdFromVersion: z.string().optional(),
  status: PolicyStatusSchema,
});

export const ScoringWeightsSchema = z.object({
  weightSuccess: z.number().min(0).max(1),
  weightFailureReduction: z.number().min(0).max(1),
  weightSecurity: z.number().min(0).max(1),
  weightConfidence: z.number().min(0).max(1),
  weightRegression: z.number().min(0).max(1),
  weightComplexity: z.number().min(0).max(1),
});

export const RolloutConfigSchema = z.object({
  canaryDurationMs: z.number().int().positive(),
  negativeSignalThreshold: z.number().min(0).max(1),
  autoRollbackEnabled: z.boolean(),
  evaluationWindowMs: z.number().int().positive(),
  minScoreForPromotion: z.number().min(0).max(1),
});

export type EvolutionScope = z.infer<typeof EvolutionScopeSchema>;
export type EvolutionStage = z.infer<typeof EvolutionStageSchema>;
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type LessonPriority = z.infer<typeof LessonPrioritySchema>;
export type MutationRisk = z.infer<typeof MutationRiskSchema>;
export type PromptStatus = z.infer<typeof PromptStatusSchema>;
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ExtractedLesson = z.infer<typeof ExtractedLessonSchema>;
export type MutationCandidate = z.infer<typeof MutationCandidateSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type EvolutionScore = z.infer<typeof EvolutionScoreSchema>;
export type RolloutDecision = z.infer<typeof RolloutDecisionSchema>;
export type PromptVersion = z.infer<typeof PromptVersionSchema>;
export type PolicyVersion = z.infer<typeof PolicyVersionSchema>;
export type ScoringWeights = z.infer<typeof ScoringWeightsSchema>;
export type RolloutConfig = z.infer<typeof RolloutConfigSchema>;
