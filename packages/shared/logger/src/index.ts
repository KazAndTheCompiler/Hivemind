import type { LogEvent, PackageId } from '@secdev/shared-types';
import { ExecutionMode } from '@secdev/shared-types';

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

function createLogEvent(
  packageId: PackageId,
  commandName: string,
  severity: LogEvent['severity'],
  executionMode: ExecutionMode,
  message: string,
  data?: Record<string, unknown>,
): LogEvent {
  return {
    timestamp: new Date().toISOString(),
    packageId,
    commandName,
    severity,
    executionMode,
    correlationId: `${packageId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message,
    data,
  };
}

export class JsonLogger implements Logger {
  private packageId: PackageId;
  private commandName: string;
  private executionMode: ExecutionMode;

  constructor(
    packageId: PackageId,
    commandName: string,
    executionMode: ExecutionMode = ExecutionMode.DRY_RUN,
  ) {
    this.packageId = packageId;
    this.commandName = commandName;
    this.executionMode = executionMode;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.emit('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.emit('error', message, data);
  }

  private emit(
    severity: LogEvent['severity'],
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const event = createLogEvent(
      this.packageId,
      this.commandName,
      severity,
      this.executionMode,
      message,
      data,
    );
    process.stderr.write(JSON.stringify(event) + '\n');
  }
}

export class HumanLogger implements Logger {
  private packageId: PackageId;

  constructor(packageId: PackageId, _commandName: string) {
    this.packageId = packageId;
  }

  debug(message: string, _data?: Record<string, unknown>): void {
    this.write('🔍 DEBUG', message);
  }

  info(message: string, _data?: Record<string, unknown>): void {
    this.write('ℹ️  INFO', message);
  }

  warn(message: string, _data?: Record<string, unknown>): void {
    this.write('⚠️  WARN', message);
  }

  error(message: string, _data?: Record<string, unknown>): void {
    this.write('❌ ERROR', message);
  }

  private write(prefix: string, message: string): void {
    process.stderr.write(`[${prefix}] [${this.packageId}] ${message}\n`);
  }
}

export function createLogger(
  packageId: PackageId,
  commandName: string,
  format: 'json' | 'human' = 'human',
  executionMode?: ExecutionMode,
): Logger {
  if (format === 'json') {
    return new JsonLogger(packageId, commandName, executionMode);
  }
  return new HumanLogger(packageId, commandName);
}
