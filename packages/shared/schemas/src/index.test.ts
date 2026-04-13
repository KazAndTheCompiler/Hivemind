import { describe, it, expect } from 'vitest';
import { LabMetadataSchema, ToolMetadataSchema, AnyMetadataSchema } from '../src/index';

describe('LabMetadataSchema', () => {
  it('should validate a complete lab metadata object', () => {
    const lab = {
      type: 'lab' as const,
      id: 'test-lab',
      title: 'Test Lab',
      summary: 'A test lab',
      category: 'network-security',
      tags: ['test'],
      language: 'python',
      maturity: 'experimental' as const,
      riskLevel: 'low' as const,
      safetyBoundary: 'lab-only' as const,
      prerequisites: [],
      setupSteps: [],
      expectedOutputs: [],
      testStatus: 'none',
      docsPath: '/docs/test-lab',
      owner: 'secdev-team',
      maintainer: 'secdev-team',
      sourceLegacyPath: 'projects/test-lab',
      walkthrough: [],
      cleanupSteps: [],
      estimatedDuration: '30m',
    };
    const result = LabMetadataSchema.parse(lab);
    expect(result.id).toBe('test-lab');
    expect(result.type).toBe('lab');
  });

  it('should reject missing required fields', () => {
    expect(() => LabMetadataSchema.parse({ type: 'lab' })).toThrow();
  });
});

describe('ToolMetadataSchema', () => {
  it('should validate a complete tool metadata object', () => {
    const tool = {
      type: 'tool' as const,
      id: 'test-tool',
      title: 'Test Tool',
      summary: 'A test tool',
      category: 'analysis',
      tags: [],
      language: 'python',
      maturity: 'stable' as const,
      riskLevel: 'low' as const,
      safetyBoundary: 'defensive' as const,
      prerequisites: [],
      setupSteps: [],
      expectedOutputs: [],
      testStatus: 'none',
      docsPath: '/docs/test-tool',
      owner: 'secdev-team',
      maintainer: 'secdev-team',
      sourceLegacyPath: 'projects/test-tool',
      inputs: [],
      outputs: [],
      cliUsage: 'secdev run test-tool',
    };
    const result = ToolMetadataSchema.parse(tool);
    expect(result.id).toBe('test-tool');
    expect(result.type).toBe('tool');
  });
});

describe('AnyMetadataSchema', () => {
  it('should discriminate lab metadata', () => {
    const lab = {
      type: 'lab' as const,
      id: 'lab-x',
      title: 'Lab X',
      summary: 'Summary',
      category: 'research',
      safetyBoundary: 'lab-only' as const,
      riskLevel: 'low' as const,
      maturity: 'draft' as const,
    };
    const result = AnyMetadataSchema.parse(lab);
    expect(result.type).toBe('lab');
  });

  it('should discriminate tool metadata', () => {
    const tool = {
      type: 'tool' as const,
      id: 'tool-y',
      title: 'Tool Y',
      summary: 'Summary',
      category: 'analysis',
      safetyBoundary: 'defensive' as const,
      riskLevel: 'low' as const,
      maturity: 'draft' as const,
    };
    const result = AnyMetadataSchema.parse(tool);
    expect(result.type).toBe('tool');
  });
});
