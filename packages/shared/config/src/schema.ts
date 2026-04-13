import { z } from 'zod';

// Execution mode schema
export const ExecutionModeSchema = z.enum([
  'dry-run',
  'simulation',
  'analysis-only',
  'full-execution',
]);

// Package discovery config schema
export const PackageDiscoveryConfigSchema = z.object({
  packagesPath: z.string().default('./packages'),
  includePatterns: z.array(z.string()).default(['**/*']),
  excludePatterns: z.array(z.string()).default(['**/node_modules/**', '**/dist/**']),
  metadataFileName: z.string().default('metadata.json'),
});

// Main runtime config schema
export const RuntimeConfigSchema = z.object({
  rootPath: z.string().default(process.cwd()),
  artifactPath: z.string().default('./artifacts'),
  fixturesPath: z.string().default('./fixtures'),
  docsPath: z.string().default('./docs'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  allowedExecutionModes: z.array(ExecutionModeSchema).default(['dry-run', 'simulation', 'analysis-only']),
  restrictedLabToggle: z.boolean().default(false),
  environmentValidation: z.boolean().default(true),
  packageDiscoveryConfig: PackageDiscoveryConfigSchema.default({}),
});

export type RuntimeConfigInput = z.input<typeof RuntimeConfigSchema>;
export type RuntimeConfig = z.output<typeof RuntimeConfigSchema>;
