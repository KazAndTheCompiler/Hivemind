// Environment-based configuration with Zod validation
import { OpenClawConfigSchema } from '@openclaw/core-schemas';
import { ConfigError } from '@openclaw/core-errors';
import type { OpenClawConfig } from '@openclaw/core-types';

export class ConfigService {
  private config: OpenClawConfig;

  constructor(raw?: unknown) {
    const merged = this.mergeWithEnv(raw);
    const result = OpenClawConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new ConfigError('Invalid configuration', {
        errors: result.error.flatten(),
      });
    }
    this.config = result.data;
  }

  getConfig(): OpenClawConfig {
    return this.config;
  }

  getAtPath<T>(configPath: string): T {
    const parts = configPath.split('.');
    let current: unknown = this.config;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        throw new ConfigError(`Config path not found: ${configPath}`);
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current as T;
  }

  private mergeWithEnv(raw?: unknown): Record<string, unknown> {
    const base = typeof raw === 'object' && raw !== null ? raw as Record<string, unknown> : {};

    // Environment variable overrides
    const envOverrides: Record<string, unknown> = {};

    if (process.env.OPENCLAW_WORKSPACE) {
      envOverrides.workspace = process.env.OPENCLAW_WORKSPACE;
    }
    if (process.env.OPENCLAW_LOG_LEVEL) {
      envOverrides.logging = { ...(base.logging as object || {}), level: process.env.OPENCLAW_LOG_LEVEL };
    }
    if (process.env.OPENCLAW_LOG_FORMAT) {
      envOverrides.logging = { ...(base.logging as object || {}), format: process.env.OPENCLAW_LOG_FORMAT };
    }
    if (process.env.OPENCLAW_AUDIT_PATH) {
      envOverrides.audit = { ...(base.audit as object || {}), storePath: process.env.OPENCLAW_AUDIT_PATH };
    }
    if (process.env.OPENCLAW_MAX_WORKERS) {
      envOverrides.orchestrator = { ...(base.orchestrator as object || {}), maxConcurrentWorkers: parseInt(process.env.OPENCLAW_MAX_WORKERS, 10) };
    }

    return { ...base, ...envOverrides };
  }

  static fromFile(path: string): ConfigService {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const loaded = require(path) as unknown;
      return new ConfigService(loaded);
    } catch (err) {
      // Fall back to env + defaults
      return new ConfigService(undefined);
    }
  }

  static defaults(): ConfigService {
    return new ConfigService(undefined);
  }
}
