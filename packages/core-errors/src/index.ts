// Typed error hierarchy for OpenClaw agent coordination
// Every error carries a code, message, optional cause, and context.

import { OpenClawErrorInfo } from '@openclaw/core-types';

export class OpenClawError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(info: OpenClawErrorInfo) {
    super(info.message);
    this.name = 'OpenClawError';
    this.code = info.code;
    this.context = info.context;
    if (info.cause) {
      this.cause = info.cause;
    }
  }
}

export class SchemaValidationError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'SCHEMA_VALIDATION_ERROR', message, cause, context });
    this.name = 'SchemaValidationError';
  }
}

export class ConfigError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'CONFIG_ERROR', message, cause, context });
    this.name = 'ConfigError';
  }
}

export class AgentProtocolError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'AGENT_PROTOCOL_ERROR', message, cause, context });
    this.name = 'AgentProtocolError';
  }
}

export class CondenseError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'CONDENSE_ERROR', message, cause, context });
    this.name = 'CondenseError';
  }
}

export class ToolExecutionError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'TOOL_EXECUTION_ERROR', message, cause, context });
    this.name = 'ToolExecutionError';
  }
}

export class QueueOverflowError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'QUEUE_OVERFLOW_ERROR', message, cause, context });
    this.name = 'QueueOverflowError';
  }
}

export class AuditStoreError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'AUDIT_STORE_ERROR', message, cause, context });
    this.name = 'AuditStoreError';
  }
}

export class GracefulShutdownError extends OpenClawError {
  constructor(message: string, context?: Record<string, unknown>, cause?: Error) {
    super({ code: 'GRACEFUL_SHUTDOWN_ERROR', message, cause, context });
    this.name = 'GracefulShutdownError';
  }
}

export function isOpenClawError(err: unknown): err is OpenClawError {
  return err instanceof OpenClawError;
}
