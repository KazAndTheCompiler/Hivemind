// Structured logging service with pino
import pino, { Logger as PinoLogger } from 'pino';
import type { OpenClawConfig } from '@openclaw/core-types';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  trace(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

class PinoLoggerAdapter implements Logger {
  private logger: PinoLogger;

  constructor(level: LogLevel = 'info') {
    this.logger = pino({
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  trace(msg: string, meta?: Record<string, unknown>): void {
    this.logger.trace(meta ?? {}, msg);
  }
  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta ?? {}, msg);
  }
  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta ?? {}, msg);
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta ?? {}, msg);
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta ?? {}, msg);
  }
  child(bindings: Record<string, unknown>): Logger {
    const childLogger = this.logger.child(bindings);
    return new PinoLoggerChild(childLogger);
  }
}

class PinoLoggerChild implements Logger {
  private logger: PinoLogger;

  constructor(logger: PinoLogger) {
    this.logger = logger;
  }

  trace(msg: string, meta?: Record<string, unknown>): void {
    this.logger.trace(meta ?? {}, msg);
  }
  debug(msg: string, meta?: Record<string, unknown>): void {
    this.logger.debug(meta ?? {}, msg);
  }
  info(msg: string, meta?: Record<string, unknown>): void {
    this.logger.info(meta ?? {}, msg);
  }
  warn(msg: string, meta?: Record<string, unknown>): void {
    this.logger.warn(meta ?? {}, msg);
  }
  error(msg: string, meta?: Record<string, unknown>): void {
    this.logger.error(meta ?? {}, msg);
  }
  child(bindings: Record<string, unknown>): Logger {
    return new PinoLoggerChild(this.logger.child(bindings));
  }
}

export function createLogger(config?: OpenClawConfig['logging']): Logger {
  return new PinoLoggerAdapter(config?.level ?? 'info');
}

export function createLoggerFromConfig(config: OpenClawConfig): Logger {
  return createLogger(config.logging);
}
