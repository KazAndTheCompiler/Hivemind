import { describe, it, expect } from 'vitest';
import { ConfigService } from './index';

describe('ConfigService', () => {
  it('loads with defaults', () => {
    const config = new ConfigService();
    const c = config.getConfig();
    expect(c.orchestrator.maxConcurrentWorkers).toBe(4);
    expect(c.logging.level).toBe('info');
  });

  it('accepts overrides', () => {
    const config = new ConfigService({
      orchestrator: { maxConcurrentWorkers: 8 },
      logging: { level: 'debug', format: 'human' },
    });
    const c = config.getConfig();
    expect(c.orchestrator.maxConcurrentWorkers).toBe(8);
    expect(c.logging.level).toBe('debug');
  });

  it('retrieves values at path', () => {
    const config = new ConfigService();
    const level = config.getAtPath<string>('logging.level');
    expect(level).toBe('info');
  });

  it('creates from defaults static method', () => {
    const config = ConfigService.defaults();
    const c = config.getConfig();
    expect(c.workspace).toBe('.');
  });
});
