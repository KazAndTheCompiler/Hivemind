// Audit persistence — JSONL append-only logs for production debugging
// Plus legacy file-per-event mode for backward compatibility

import * as fs from 'fs';
import * as path from 'path';
import type { OpenClawEvent } from '@openclaw/core-types';
import { Logger } from '@openclaw/core-logging';
import { AuditStoreError } from '@openclaw/core-errors';

export interface AuditRecord {
  id: string;
  event: OpenClawEvent;
  persistedAt: string;
}

export interface DeadLetterRecord {
  id: string;
  event: unknown;
  reason: string;
  capturedAt: string;
}

// ---------------------------------------------------------------------------
// JSONL Append-Only Audit Store — production pattern
// ---------------------------------------------------------------------------

export interface JsonlWriteResult {
  bytesWritten: number;
  line: number;
}

/**
 * JSONL (JSON Lines) append-only log for a specific event category.
 * Each line is a complete JSON object. This pattern is standard for
 * production debugging because:
 * - Files can be tailed in real-time
 * - Lines are independent (corruption of one doesn't break others)
 * - Standard tools like jq can process them
 * - Easy to rotate and archive
 */
export class JsonlAppendOnlyLog {
  private filePath: string;
  private logger: Logger;
  private writeQueue: Array<{ data: unknown; resolve: (r: JsonlWriteResult) => void; reject: (e: Error) => void }> = [];
  private flushing = false;

  constructor(filePath: string, logger: Logger) {
    this.filePath = filePath;
    this.logger = logger.child({ service: 'JsonlAppendOnlyLog', logFile: filePath });

    // Ensure directory exists
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
  }

  /** Append a JSON line to the log. Async with batching. */
  append(data: unknown): Promise<JsonlWriteResult> {
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ data, resolve, reject });
      this.scheduleFlush();
    });
  }

  /** Read all lines from the log file */
  async readAll(): Promise<unknown[]> {
    if (!fs.existsSync(this.filePath)) return [];
    const content = await fs.promises.readFile(this.filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null; // Skip corrupted lines
      }
    }).filter(Boolean);
  }

  /** Read last N lines from the log file */
  async readLast(n: number): Promise<unknown[]> {
    if (!fs.existsSync(this.filePath)) return [];
    const content = await fs.promises.readFile(this.filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const last = lines.slice(-n);
    return last.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }

  /** Get the file size in bytes */
  get fileSize(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    return fs.statSync(this.filePath).size;
  }

  /** Get the number of lines in the log */
  get lineCount(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    const content = fs.readFileSync(this.filePath, 'utf-8');
    return content.trim().split('\n').filter(Boolean).length;
  }

  /** Flush all pending writes */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;
    if (this.flushing) return;

    this.flushing = true;
    const batch = [...this.writeQueue];
    this.writeQueue = [];

    try {
      const lines = batch.map(({ data }) => JSON.stringify(data)).join('\n') + '\n';
      await fs.promises.appendFile(this.filePath, lines, 'utf-8');

      for (let i = 0; i < batch.length; i++) {
        batch[i].resolve({
          bytesWritten: lines.length,
          line: this.lineCount - batch.length + i + 1,
        });
      }
    } catch (err) {
      this.logger.error('jsonl.flush_error', {
        filePath: this.filePath,
        error: err instanceof Error ? err.message : String(err),
      });
      for (const { reject } of batch) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      this.flushing = false;
    }
  }

  private scheduleFlush(): void {
    if (this.flushing) return;
    if (this.writeQueue.length >= 50) {
      this.flush().catch(() => {});
    } else {
      setTimeout(() => { this.flush().catch(() => {}); }, 100);
    }
  }
}

// ---------------------------------------------------------------------------
// DurableFileAuditStore — production-safe with JSONL logs + file-per-event fallback
// ---------------------------------------------------------------------------

interface PendingAuditWrite {
  filePath: string;
  content: string;
  resolve: (value: AuditRecord) => void;
  reject: (error: Error) => void;
  type: 'audit';
}

interface PendingDeadLetterWrite {
  filePath: string;
  content: string;
  resolve: (value: DeadLetterRecord) => void;
  reject: (error: Error) => void;
  type: 'dead_letter';
}

type PendingWrite = PendingAuditWrite | PendingDeadLetterWrite;

export class DurableFileAuditStore {
  private storePath: string;
  private deadLetterPath: string;
  private logger: Logger;
  private writeQueue: PendingWrite[] = [];
  private flushing = false;
  private writeCounter = 0;

  // JSONL logs
  private auditLog: JsonlAppendOnlyLog;
  private relayLog: JsonlAppendOnlyLog;
  private qualityLog: JsonlAppendOnlyLog;

  constructor(storePath: string, deadLetterPath: string, logger: Logger) {
    this.storePath = storePath;
    this.deadLetterPath = deadLetterPath;
    this.logger = logger.child({ service: 'DurableFileAuditStore' });

    // Ensure directories exist
    try {
      fs.mkdirSync(this.storePath, { recursive: true });
      fs.mkdirSync(this.deadLetterPath, { recursive: true });
    } catch (err) {
      this.logger.error('audit.store.mkdir_error', {
        storePath: this.storePath,
        deadLetterPath: this.deadLetterPath,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AuditStoreError('Failed to create audit store directories', {}, err instanceof Error ? err : undefined);
    }

    // Initialize JSONL append-only logs
    this.auditLog = new JsonlAppendOnlyLog(path.join(storePath, 'audit.jsonl'), logger);
    this.relayLog = new JsonlAppendOnlyLog(path.join(storePath, 'relay.jsonl'), logger);
    this.qualityLog = new JsonlAppendOnlyLog(path.join(storePath, 'quality.jsonl'), logger);
  }

  /**
   * Queue an event for durable persistence.
   * Writes to both JSONL log and file-per-event for backward compatibility.
   */
  async persist(event: OpenClawEvent): Promise<AuditRecord> {
    const id = this.generateId(event);
    const record: AuditRecord = {
      id,
      event,
      persistedAt: new Date().toISOString(),
    };

    // Write to JSONL log
    await this.auditLog.append(record);

    // Route to specific JSONL log
    if (event.kind === 'relay.condensed' || event.kind === 'relay.delivered' || event.kind === 'relay.delivery_failed') {
      await this.relayLog.append(record);
    }
    if (event.kind === 'quality.gate.completed') {
      await this.qualityLog.append(record);
    }

    // Also write file-per-event for backward compatibility (queued)
    const filePath = path.join(this.storePath, `${id}.json`);
    const content = JSON.stringify(record, null, 2);

    return new Promise<AuditRecord>((resolve, reject) => {
      this.writeQueue.push({ filePath, content, type: 'audit', resolve, reject });
      this.scheduleFlush();
    });
  }

  async persistDeadLetter(event: unknown, reason: string): Promise<DeadLetterRecord> {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: DeadLetterRecord = {
      id,
      event,
      reason,
      capturedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.deadLetterPath, `${id}.json`);
    const content = JSON.stringify(record, null, 2);

    return new Promise<DeadLetterRecord>((resolve, reject) => {
      this.writeQueue.push({ filePath, content, type: 'dead_letter', resolve, reject });
      this.scheduleFlush();
    });
  }

  async flush(): Promise<void> {
    // Flush JSONL logs
    await this.auditLog.flush();
    await this.relayLog.flush();
    await this.qualityLog.flush();

    // Flush file-per-event queue
    if (this.writeQueue.length === 0) return;
    if (this.flushing) return;

    this.flushing = true;
    const batch = [...this.writeQueue];
    this.writeQueue = [];

    this.logger.debug('audit.flush.start', { batchSize: batch.length });

    for (const write of batch) {
      try {
        await fs.promises.writeFile(write.filePath, write.content, 'utf-8');
        if (write.type === 'audit') {
          write.resolve(JSON.parse(write.content));
        } else {
          write.resolve(JSON.parse(write.content));
        }
      } catch (err) {
        this.logger.error('audit.flush.write_error', {
          filePath: write.filePath,
          error: err instanceof Error ? err.message : String(err),
        });
        write.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this.flushing = false;
    this.logger.debug('audit.flush.complete', { flushedCount: batch.length });
  }

  async getRecord(id: string): Promise<AuditRecord | null> {
    try {
      const filePath = path.join(this.storePath, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as AuditRecord;
    } catch {
      return null;
    }
  }

  async listRecords(kind?: string): Promise<AuditRecord[]> {
    return this.auditLog.readAll().then((lines) => {
      const records = lines as AuditRecord[];
      if (kind) {
        return records.filter((r) => r.event.kind === kind);
      }
      return records;
    });
  }

  /** Replay events from the audit log */
  async replay(kind?: string): Promise<OpenClawEvent[]> {
    const records = await this.listRecords(kind);
    return records.map((r) => r.event);
  }

  /** Get JSONL log references for debugging */
  get logPaths(): { audit: string; relay: string; quality: string } {
    return {
      audit: this.auditLog['filePath'],
      relay: this.relayLog['filePath'],
      quality: this.qualityLog['filePath'],
    };
  }

  get pendingCount(): number {
    return this.writeQueue.length;
  }

  private scheduleFlush(): void {
    if (this.flushing) return;
    if (this.writeQueue.length >= 50) {
      this.flush().catch(() => {});
    } else {
      setTimeout(() => { this.flush().catch(() => {}); }, 100);
    }
  }

  private generateId(event: OpenClawEvent): string {
    this.writeCounter++;
    const ts = Date.now().toString(36);
    const kind = event.kind.replace(/\./g, '_');
    let taskRef = 'system';
    if ('taskId' in event && typeof event.taskId === 'string') {
      taskRef = event.taskId;
    }
    return `${kind}_${ts}_${taskRef}_${this.writeCounter}`;
  }
}

// ---------------------------------------------------------------------------
// Legacy AuditStore — kept for backward compatibility
// ---------------------------------------------------------------------------

export class AuditStore {
  private storePath: string;
  private deadLetterPath: string;

  constructor(storePath: string, deadLetterPath: string, _logger: Logger) {
    this.storePath = storePath;
    this.deadLetterPath = deadLetterPath;

    fs.mkdirSync(this.storePath, { recursive: true });
    fs.mkdirSync(this.deadLetterPath, { recursive: true });
  }

  async persist(event: OpenClawEvent): Promise<AuditRecord> {
    const id = this.generateId(event);
    const record: AuditRecord = { id, event, persistedAt: new Date().toISOString() };
    try {
      fs.writeFileSync(path.join(this.storePath, `${id}.json`), JSON.stringify(record, null, 2));
      return record;
    } catch (err) {
      throw new AuditStoreError('Failed to persist audit record', { id, kind: event.kind }, err instanceof Error ? err : undefined);
    }
  }

  async persistDeadLetter(event: unknown, reason: string): Promise<DeadLetterRecord> {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: DeadLetterRecord = { id, event, reason, capturedAt: new Date().toISOString() };
    try {
      fs.writeFileSync(path.join(this.deadLetterPath, `${id}.json`), JSON.stringify(record, null, 2));
      return record;
    } catch (err) {
      throw new AuditStoreError('Failed to persist dead letter record', { id, reason }, err instanceof Error ? err : undefined);
    }
  }

  async getRecord(id: string): Promise<AuditRecord | null> {
    try {
      const filePath = path.join(this.storePath, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as AuditRecord;
    } catch {
      return null;
    }
  }

  async listRecords(kind?: string): Promise<AuditRecord[]> {
    try {
      const files = fs.readdirSync(this.storePath).filter((f) => f.endsWith('.json'));
      const records: AuditRecord[] = [];
      for (const file of files) {
        const record = JSON.parse(fs.readFileSync(path.join(this.storePath, file), 'utf-8')) as AuditRecord;
        if (kind && record.event.kind !== kind) continue;
        records.push(record);
      }
      return records.sort((a, b) => a.persistedAt.localeCompare(b.persistedAt));
    } catch {
      return [];
    }
  }

  async flush(): Promise<void> {}

  private generateId(event: OpenClawEvent): string {
    const ts = Date.now().toString(36);
    const kind = event.kind.replace(/\./g, '_');
    let taskRef = 'system';
    if ('taskId' in event && typeof event.taskId === 'string') {
      taskRef = event.taskId;
    }
    return `${kind}_${ts}_${taskRef}`;
  }
}
