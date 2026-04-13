import { describe, it, expect } from 'vitest';
import { validateMetadataFixture, exampleLabMetadata, exampleToolMetadata } from '../src/index';

describe('metadata fixtures', () => {
  it('should validate example lab metadata', () => {
    expect(validateMetadataFixture(exampleLabMetadata)).toBe(true);
  });

  it('should validate example tool metadata', () => {
    expect(validateMetadataFixture(exampleToolMetadata)).toBe(true);
  });

  it('should reject invalid metadata', () => {
    expect(validateMetadataFixture({ type: 'unknown' })).toBe(false);
  });
});
