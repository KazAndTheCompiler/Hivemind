import { AnyMetadataSchema } from '@secdev/shared-schemas';
import type { TestFixture } from '@secdev/shared-types';

export function createTestFixture(fixture: Partial<TestFixture>): TestFixture {
  return {
    name: fixture.name ?? 'unnamed',
    description: fixture.description ?? '',
    inputs: fixture.inputs ?? {},
    expectedOutputs: fixture.expectedOutputs ?? {},
    metadata: fixture.metadata ?? {},
  };
}

export function validateMetadataFixture(data: unknown): boolean {
  try {
    AnyMetadataSchema.parse(data);
    return true;
  } catch {
    return false;
  }
}

export const exampleLabMetadata = {
  type: 'lab' as const,
  id: 'example-lab',
  title: 'Example Lab',
  summary: 'A sample lab for testing purposes',
  category: 'research',
  tags: ['example', 'test'],
  language: 'python',
  maturity: 'experimental' as const,
  riskLevel: 'low' as const,
  safetyBoundary: 'lab-only' as const,
  prerequisites: [],
  setupSteps: ['Step 1: Set up environment'],
  expectedOutputs: ['Expected output'],
  testStatus: 'none',
  docsPath: '/docs/labs/example-lab',
  owner: 'secdev-team',
  maintainer: 'secdev-team',
  sourceLegacyPath: '',
  walkthrough: ['Walkthrough step 1'],
  cleanupSteps: ['Cleanup step 1'],
  estimatedDuration: '15m',
};

export const exampleToolMetadata = {
  type: 'tool' as const,
  id: 'example-tool',
  title: 'Example Tool',
  summary: 'A sample tool for testing purposes',
  category: 'analysis',
  tags: ['example', 'test'],
  language: 'python',
  maturity: 'experimental' as const,
  riskLevel: 'low' as const,
  safetyBoundary: 'defensive' as const,
  prerequisites: [],
  setupSteps: [],
  expectedOutputs: ['Analysis results'],
  testStatus: 'none',
  docsPath: '/docs/tools/example-tool',
  owner: 'secdev-team',
  maintainer: 'secdev-team',
  sourceLegacyPath: '',
  inputs: ['input data'],
  outputs: ['output data'],
  cliUsage: 'secdev run example-tool',
};
