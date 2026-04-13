import { z } from 'zod';

// Base metadata schema
export const BaseMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string()).default([]),
  language: z.string().default('python'),
  maturity: z.enum(['draft', 'experimental', 'stable', 'deprecated']).default('draft'),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  safetyBoundary: z.enum([
    'defensive',
    'analysis',
    'simulation',
    'dual-use',
    'restricted-research',
    'lab-only',
    'do-not-deploy',
  ]).default('lab-only'),
  prerequisites: z.array(z.string()).default([]),
  setupSteps: z.array(z.string()).default([]),
  expectedOutputs: z.array(z.string()).default([]),
  testStatus: z.string().default('none'),
  docsPath: z.string().default(''),
  owner: z.string().default('secdev-team'),
  maintainer: z.string().default('secdev-team'),
  sourceLegacyPath: z.string().default(''),
});

// Lab metadata schema
export const LabMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('lab'),
  category: z.string(),
  walkthrough: z.array(z.string()).default([]),
  cleanupSteps: z.array(z.string()).default([]),
  estimatedDuration: z.string().default('30m'),
});

// Tool metadata schema
export const ToolMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('tool'),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  cliUsage: z.string().default(''),
});

// Detection metadata schema
export const DetectionMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('detection'),
  detectionType: z.string().default(''),
  dataSource: z.array(z.string()).default([]),
  falsePositiveRate: z.string().default('unknown'),
  ruleFormat: z.string().default(''),
});

// Defense metadata schema
export const DefenseMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('defense'),
  hardeningTarget: z.string().default(''),
  baselineConfig: z.string().default(''),
  complianceFrameworks: z.array(z.string()).default([]),
});

// Forensics metadata schema
export const ForensicsMetadataSchema = BaseMetadataSchema.extend({
  type: z.literal('forensics'),
  evidenceTypes: z.array(z.string()).default([]),
  analysisMethods: z.array(z.string()).default([]),
  toolsRequired: z.array(z.string()).default([]),
});

// Union schema for all metadata types
export const AnyMetadataSchema = z.discriminatedUnion('type', [
  LabMetadataSchema,
  ToolMetadataSchema,
  DetectionMetadataSchema,
  DefenseMetadataSchema,
  ForensicsMetadataSchema,
]);

// Migration record schema
export const ProjectMigrationRecordSchema = z.object({
  legacyPath: z.string(),
  targetDomain: z.string(),
  targetPackage: z.string(),
  status: z.enum(['pending', 'in-progress', 'completed', 'archived', 'docs-only']),
  migratedAt: z.string().optional(),
  notes: z.string().default(''),
});

// Finding schema
export const FindingSchema = z.object({
  id: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  evidence: z.string(),
  recommendation: z.string(),
  sourcePackage: z.string(),
  timestamp: z.string(),
});

// CLI output schema
export const CliOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.record(z.unknown()).optional(),
  errors: z.array(z.string()).default([]),
});

export type BaseMetadata = z.infer<typeof BaseMetadataSchema>;
export type LabMetadata = z.infer<typeof LabMetadataSchema>;
export type ToolMetadata = z.infer<typeof ToolMetadataSchema>;
export type DetectionMetadata = z.infer<typeof DetectionMetadataSchema>;
export type DefenseMetadata = z.infer<typeof DefenseMetadataSchema>;
export type ForensicsMetadata = z.infer<typeof ForensicsMetadataSchema>;
export type AnyMetadata = z.infer<typeof AnyMetadataSchema>;
export type ProjectMigrationRecord = z.infer<typeof ProjectMigrationRecordSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type CliOutput = z.infer<typeof CliOutputSchema>;
