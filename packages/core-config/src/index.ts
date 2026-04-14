// Environment-based configuration with explicit file loading and Zod validation
import * as fs from 'fs';
import * as path from 'path';
import { OpenClawConfigSchema } from '@openclaw/core-schemas';
import { ConfigError } from '@openclaw/core-errors';
import type { OpenClawConfig } from '@openclaw/core-types';

export interface ConfigLoadResult {
  config: OpenClawConfig;
  sources: string[]; // which sources contributed: 'defaults', 'file', 'env'
}

// Layered defaults — safe base that never fails
function buildDefaults(): Record<string, unknown> {
  return {
    workspace: '.',
    orchestrator: {},
    daemon: {
      watchPaths: ['.'],
      debounceMs: 500,
    },
    tools: {},
    audit: {},
    logging: {},
  };
}

export class ConfigService {
  private config: OpenClawConfig;
  private sources: string[];

  private constructor(raw: unknown, sources: string[]) {
    const merged = this.mergeWithEnv(raw);
    const result = OpenClawConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new ConfigError('Invalid configuration', {
        errors: result.error.flatten(),
        sourceInfo: sources,
      });
    }
    this.config = result.data;
    this.sources = sources;
  }

  getConfig(): OpenClawConfig {
    return this.config;
  }

  getSources(): string[] {
    return [...this.sources];
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
    const base = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

    // Environment variable overrides (explicit, validated)
    const envOverrides: Record<string, unknown> = {};

    if (process.env.OPENCLAW_WORKSPACE) {
      envOverrides.workspace = process.env.OPENCLAW_WORKSPACE;
    }
    if (process.env.OPENCLAW_LOG_LEVEL) {
      const level = process.env.OPENCLAW_LOG_LEVEL as string;
      const validLevels = ['trace', 'debug', 'info', 'warn', 'error'] as const;
      if (!validLevels.includes(level as (typeof validLevels)[number])) {
        throw new ConfigError(
          `Invalid OPENCLAW_LOG_LEVEL: ${level}. Must be one of: ${validLevels.join(', ')}`,
        );
      }
      envOverrides.logging = {
        ...(typeof base.logging === 'object' && base.logging !== null ? base.logging : {}),
        level,
      };
    }
    if (process.env.OPENCLAW_LOG_FORMAT) {
      const format = process.env.OPENCLAW_LOG_FORMAT as string;
      if (format !== 'json' && format !== 'human') {
        throw new ConfigError(`Invalid OPENCLAW_LOG_FORMAT: ${format}. Must be 'json' or 'human'`);
      }
      envOverrides.logging = {
        ...(typeof envOverrides.logging === 'object' && envOverrides.logging !== null
          ? envOverrides.logging
          : typeof base.logging === 'object' && base.logging !== null
            ? base.logging
            : {}),
        format,
      };
    }
    if (process.env.OPENCLAW_AUDIT_PATH) {
      envOverrides.audit = {
        ...(typeof base.audit === 'object' && base.audit !== null ? base.audit : {}),
        storePath: process.env.OPENCLAW_AUDIT_PATH,
      };
    }
    if (process.env.OPENCLAW_DEAD_LETTER_PATH) {
      envOverrides.audit = {
        ...(typeof envOverrides.audit === 'object' && envOverrides.audit !== null
          ? envOverrides.audit
          : typeof base.audit === 'object' && base.audit !== null
            ? base.audit
            : {}),
        deadLetterPath: process.env.OPENCLAW_DEAD_LETTER_PATH,
      };
    }
    if (process.env.OPENCLAW_MAX_WORKERS) {
      const maxWorkers = parseInt(process.env.OPENCLAW_MAX_WORKERS, 10);
      if (isNaN(maxWorkers) || maxWorkers < 1) {
        throw new ConfigError(
          `Invalid OPENCLAW_MAX_WORKERS: ${process.env.OPENCLAW_MAX_WORKERS}. Must be a positive integer`,
        );
      }
      envOverrides.orchestrator = {
        ...(typeof base.orchestrator === 'object' && base.orchestrator !== null
          ? base.orchestrator
          : {}),
        maxConcurrentWorkers: maxWorkers,
      };
    }
    if (process.env.OPENCLAW_DEBOUNCE_MS) {
      const debounceMs = parseInt(process.env.OPENCLAW_DEBOUNCE_MS, 10);
      if (isNaN(debounceMs) || debounceMs < 1) {
        throw new ConfigError(
          `Invalid OPENCLAW_DEBOUNCE_MS: ${process.env.OPENCLAW_DEBOUNCE_MS}. Must be a positive integer`,
        );
      }
      envOverrides.daemon = {
        ...(typeof base.daemon === 'object' && base.daemon !== null ? base.daemon : {}),
        debounceMs,
      };
    }

    return { ...base, ...envOverrides };
  }

  /**
   * Load config from an explicit file path.
   * Supports .json files only.
   * Throws ConfigError if file does not exist or is invalid.
   */
  static fromFile(configPath: string): ConfigService {
    const absolutePath = path.resolve(configPath);

    if (!fs.existsSync(absolutePath)) {
      throw new ConfigError(`Config file not found: ${absolutePath}`, {
        requestedPath: configPath,
        absolutePath,
      });
    }

    let raw: unknown;
    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (err) {
      throw new ConfigError(
        `Failed to parse config file: ${absolutePath}`,
        { path: absolutePath },
        err instanceof Error ? err : undefined,
      );
    }

    return new ConfigService(raw, ['defaults', 'file', 'env']);
  }

  /**
   * Try loading from a file path, falling back to defaults+env if file is absent.
   * Throws ConfigError if file exists but is invalid (no silent fallback on bad data).
   */
  static fromFileOrDefaults(configPath?: string): ConfigService {
    if (!configPath) {
      return new ConfigService(buildDefaults(), ['defaults', 'env']);
    }

    const absolutePath = path.resolve(configPath);
    if (!fs.existsSync(absolutePath)) {
      // File not specified or missing — use defaults + env
      return new ConfigService(buildDefaults(), ['defaults', 'env']);
    }

    // File exists — must parse and validate, no silent fallback
    let raw: unknown;
    try {
      const content = fs.readFileSync(absolutePath, 'utf-8');
      raw = JSON.parse(content);
    } catch (err) {
      throw new ConfigError(
        `Failed to parse config file: ${absolutePath}`,
        { path: absolutePath },
        err instanceof Error ? err : undefined,
      );
    }

    return new ConfigService(raw, ['defaults', 'file', 'env']);
  }

  /** Load from defaults + env only */
  static fromDefaults(): ConfigService {
    return new ConfigService(buildDefaults(), ['defaults', 'env']);
  }

  /**
   * Validate critical config at startup.
   * Throws if required runtime values are invalid.
   */
  static validateStartup(config: OpenClawConfig): void {
    if (config.orchestrator.maxConcurrentWorkers < 1) {
      throw new ConfigError('orchestrator.maxConcurrentWorkers must be >= 1');
    }
    if (config.daemon.debounceMs < 100) {
      throw new ConfigError('daemon.debounceMs must be >= 100 to prevent thrashing');
    }
    if (!config.audit.storePath || config.audit.storePath.trim() === '') {
      throw new ConfigError('audit.storePath must be a non-empty string');
    }
    if (!config.audit.deadLetterPath || config.audit.deadLetterPath.trim() === '') {
      throw new ConfigError('audit.deadLetterPath must be a non-empty string');
    }
  }
}
