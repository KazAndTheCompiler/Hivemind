// Audit persistence — raw/normalized event storage, dead-letter queue

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

  private generateId(event: OpenClawEvent): string {
    const ts = Date.now().toString(36);
    const kind = event.kind.replace(/\./g, '_');
    const taskRef = 'taskId' in event ? event.taskId : 'system';
    return `${kind}_${ts}_${taskRef}`;
  }
}
