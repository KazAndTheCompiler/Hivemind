// Audit persistence — durable file-backed event storage with buffered writes and dead-letter queue

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
// Legacy AuditStore — kept for backward compatibility
// ---------------------------------------------------------------------------

export class AuditStore {
  private storePath: string;
  private deadLetterPath: string;
  private logger: Logger;

  constructor(storePath: string, deadLetterPath: string, logger: Logger) {
    this.storePath = storePath;
    this.deadLetterPath = deadLetterPath;
    this.logger = logger.child({ service: 'AuditStore' });

    // Ensure directories exist
    fs.mkdirSync(this.storePath, { recursive: true });
    fs.mkdirSync(this.deadLetterPath, { recursive: true });
  }

  async persist(event: OpenClawEvent): Promise<AuditRecord> {
    const id = this.generateId(event);
    const record: AuditRecord = {
      id,
      event,
      persistedAt: new Date().toISOString(),
    };

    try {
      const filePath = path.join(this.storePath, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

      this.logger.debug('audit.persisted', { id, kind: event.kind });

      return record;
    } catch (err) {
      throw new AuditStoreError('Failed to persist audit record', {
        id,
        kind: event.kind,
      }, err instanceof Error ? err : undefined);
    }
  }

  async persistDeadLetter(event: unknown, reason: string): Promise<DeadLetterRecord> {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record: DeadLetterRecord = {
      id,
      event,
      reason,
      capturedAt: new Date().toISOString(),
    };

    try {
      const filePath = path.join(this.deadLetterPath, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));

      this.logger.warn('audit.dead_letter.persisted', { id, reason });

      return record;
    } catch (err) {
      throw new AuditStoreError('Failed to persist dead letter record', {
        id,
        reason,
      }, err instanceof Error ? err : undefined);
    }
  }

  async getRecord(id: string): Promise<AuditRecord | null> {
    try {
      const filePath = path.join(this.storePath, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;

      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as AuditRecord;
    } catch (err) {
      this.logger.error('audit.get.error', { id, error: String(err) });
      return null;
    }
  }

  async listRecords(kind?: string): Promise<AuditRecord[]> {
    try {
      const files = fs.readdirSync(this.storePath).filter((f) => f.endsWith('.json'));
      const records: AuditRecord[] = [];

      for (const file of files) {
        const content = fs.readFileSync(path.join(this.storePath, file), 'utf-8');
        const record = JSON.parse(content) as AuditRecord;

        if (kind && record.event.kind !== kind) continue;
        records.push(record);
      }

      return records.sort((a, b) => a.persistedAt.localeCompare(b.persistedAt));
    } catch (err) {
      this.logger.error('audit.list.error', { error: String(err) });
      return [];
    }
  }

  async flush(): Promise<void> {
    // No-op for sync AuditStore
  }

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

// ---------------------------------------------------------------------------
// DurableFileAuditStore — production-safe file-backed store with async buffered writes
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
  }

  /**
   * Queue an event for durable persistence.
   * Writes are batched and flushed asynchronously.
   */
  async persist(event: OpenClawEvent): Promise<AuditRecord> {
    const id = this.generateId(event);
    const record: AuditRecord = {
      id,
      event,
      persistedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.storePath, `${id}.json`);
    const content = JSON.stringify(record, null, 2);

    return new Promise<AuditRecord>((resolve, reject) => {
      this.writeQueue.push({ filePath, content, type: 'audit', resolve, reject });
      this.scheduleFlush();
    });
  }

  /**
   * Queue a dead-letter record for durable persistence.
   */
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

  /**
   * Immediately flush all pending writes.
   */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;
    if (this.flushing) return;

    this.flushing = true;
    const batch = [...this.writeQueue];
    this.writeQueue = [];

    this.logger.debug('audit.flush.start', { batchSize: batch.length });

    let successCount = 0;
    let failCount = 0;

    for (const write of batch) {
      try {
        await fs.promises.writeFile(write.filePath, write.content, 'utf-8');
        write.resolve(JSON.parse(write.content));
        successCount++;
      } catch (err) {
        this.logger.error('audit.flush.write_error', {
          filePath: write.filePath,
          error: err instanceof Error ? err.message : String(err),
        });
        write.reject(err instanceof Error ? err : new Error(String(err)));
        failCount++;
      }
    }

    this.flushing = false;

    if (failCount > 0) {
      this.logger.warn('audit.flush.complete', { successCount, failCount });
    }

    this.logger.debug('audit.flush.complete', { successCount });
  }

  async getRecord(id: string): Promise<AuditRecord | null> {
    try {
      const filePath = path.join(this.storePath, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;

      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content) as AuditRecord;
    } catch (err) {
      this.logger.error('audit.get.error', { id, error: String(err) });
      return null;
    }
  }

  async listRecords(kind?: string): Promise<AuditRecord[]> {
    try {
      const files = await fs.promises.readdir(this.storePath);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));
      const records: AuditRecord[] = [];

      for (const file of jsonFiles) {
        const content = await fs.promises.readFile(path.join(this.storePath, file), 'utf-8');
        const record = JSON.parse(content) as AuditRecord;

        if (kind && record.event.kind !== kind) continue;
        records.push(record);
      }

      return records.sort((a, b) => a.persistedAt.localeCompare(b.persistedAt));
    } catch (err) {
      this.logger.error('audit.list.error', { error: String(err) });
      return [];
    }
  }

  /**
   * Get the number of pending writes in the queue.
   */
  get pendingCount(): number {
    return this.writeQueue.length;
  }

  private scheduleFlush(): void {
    if (this.flushing) return;
    if (this.writeQueue.length === 0) return;

    // Flush immediately if queue is growing, otherwise debounce
    if (this.writeQueue.length >= 50) {
      this.flush().catch((err) => {
        this.logger.error('audit.flush.scheduled_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    } else {
      setTimeout(() => {
        this.flush().catch((err) => {
          this.logger.error('audit.flush.scheduled_error', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }, 100);
    }
  }

  private generateId(event: OpenClawEvent): string {
    this.writeCounter++;
    const ts = Date.now().toString(36);
    const kind = event.kind.replace(/\./g, '_');
    // Safely extract taskId if present using type narrowing
    let taskRef = 'system';
    if ('taskId' in event && typeof event.taskId === 'string') {
      taskRef = event.taskId;
    }
    return `${kind}_${ts}_${taskRef}_${this.writeCounter}`;
  }
}
