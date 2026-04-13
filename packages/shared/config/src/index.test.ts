import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../src/index';

describe('ConfigLoader', () => {
  it('should load default config without errors', () => {
    const loader = ConfigLoader.defaults();
    const config = loader.get();
    expect(config.rootPath).toBeDefined();
    expect(config.logLevel).toBe('info');
  });

  it('should validate default config', () => {
    const loader = ConfigLoader.defaults();
    const result = loader.validate();
    expect(result.valid).toBe(true);
  });

  it('should load from a config file', () => {
    // Use the root secdev.config.json if available
    const rootPath = process.cwd();
    const loader = ConfigLoader.fromProjectRoot(rootPath);
    const result = loader.validate();
    expect(result.valid).toBe(true);
  });
});
