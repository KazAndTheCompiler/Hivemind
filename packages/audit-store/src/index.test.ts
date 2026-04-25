import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DurableFileAuditStore } from './index';
import { createLogger } from '@openclaw/core-logging';

const createTestLogger = (): ReturnType<typeof createLogger> =>
  createLogger({ level: 'error', format: 'json' });

describe('DurableFileAuditStore', () => {
  const tmpDir = path.join('/tmp', `audit-store-test-${Date.now()}`);
  const storePath = path.join(tmpDir, 'store');
  const deadLetterPath = path.join(tmpDir, 'dl');

  beforeEach(() => {
    fs.mkdirSync(storePath, { recursive: true });
    fs.mkdirSync(deadLetterPath, { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('persist (retry + DLQ)', () => {
    it('writes a record successfully on first attempt', async () => {
      const store = new DurableFileAuditStore(storePath, deadLetterPath, createTestLogger());
      const event = { kind: 'test.event', timestamp: new Date().toISOString() };
      const record = await store.persist(event as any);
      expect(record.id).toBeTruthy();
      expect(record.event).toEqual(event);
    });

    it('sends record to DLQ when all persist attempts fail', async () => {
      const store = new DurableFileAuditStore(storePath, deadLetterPath, createTestLogger());
      const dlqPath = path.join(storePath, 'dlq');

      const event = {
        kind: 'test.failing_event',
        taskId: 'task-abc123',
        timestamp: new Date().toISOString(),
      };

      // Track call count via closure so we can assert it after
      let callCount = 0;
      const realWriteFile = fs.promises.writeFile;
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(async (filePath: string, ...args: unknown[]) => {
        // Allow DLQ writes to succeed; only fail on regular store files
        if (typeof filePath === 'string' && filePath.endsWith('.json') && !filePath.includes('/dlq/')) {
          callCount++;
          throw new Error('Simulated write failure');
        }
        return realWriteFile(filePath as string, ...args);
      });

      const record = await store.persist(event as any);

      // Record should still be returned (not thrown)
      expect(record.id).toBeTruthy();

      // All 3 retry attempts should have been made
      expect(callCount).toBe(3);

      // DLQ file should exist
      const dlqFiles = fs.readdirSync(dlqPath);
      expect(dlqFiles.length).toBeGreaterThan(0);

      // Find the DLQ file for this task
      const dlqFile = dlqFiles.find((f) => f.includes('task-abc123'));
      expect(dlqFile).toBeDefined();

      const dlqContent = JSON.parse(fs.readFileSync(path.join(dlqPath, dlqFile!), 'utf-8'));
      expect(dlqContent.payload.event.kind).toBe('test.failing_event');
      expect(dlqContent.failedAt).toBeTruthy();
      expect(dlqContent.errorMessage).toBe('Simulated write failure');
      expect(dlqContent.attempts).toBe(3);
    });

    it('listDlq returns all DLQ records sorted by failedAt', async () => {
      const store = new DurableFileAuditStore(storePath, deadLetterPath, createTestLogger());
      const dlqPath = path.join(storePath, 'dlq');

      // Manually create DLQ files to test listDlq
      const dlqRecord1 = {
        payload: { id: 'a', event: { kind: 'test.a' }, persistedAt: new Date().toISOString() },
        failedAt: '2024-01-01T00:00:00.000Z',
        errorMessage: 'err1',
        attempts: 3,
      };
      const dlqRecord2 = {
        payload: { id: 'b', event: { kind: 'test.b' }, persistedAt: new Date().toISOString() },
        failedAt: '2024-01-02T00:00:00.000Z',
        errorMessage: 'err2',
        attempts: 3,
      };

      await fs.promises.writeFile(path.join(dlqPath, '1-task-a.json'), JSON.stringify(dlqRecord1));
      await fs.promises.writeFile(path.join(dlqPath, '2-task-b.json'), JSON.stringify(dlqRecord2));

      const dlqRecords = await store.listDlq();
      expect(dlqRecords.length).toBe(2);
      expect(dlqRecords[0].payload.id).toBe('a');
      expect(dlqRecords[1].payload.id).toBe('b');
    });

    it('dlqCount returns the correct number of DLQ records', async () => {
      const store = new DurableFileAuditStore(storePath, deadLetterPath, createTestLogger());
      const dlqPath = path.join(storePath, 'dlq');

      const dlqRecord = {
        payload: { id: 'x', event: { kind: 'test.x' }, persistedAt: new Date().toISOString() },
        failedAt: new Date().toISOString(),
        errorMessage: 'err',
        attempts: 3,
      };

      await fs.promises.writeFile(path.join(dlqPath, '1-task-x.json'), JSON.stringify(dlqRecord));
      await fs.promises.writeFile(path.join(dlqPath, '2-task-y.json'), JSON.stringify(dlqRecord));

      const count = await store.dlqCount();
      expect(count).toBe(2);
    });
  });
});
