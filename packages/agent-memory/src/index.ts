// Memory sink abstraction for agent state persistence
// Includes in-memory (dev/test) and file-backed (production) implementations

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@openclaw/core-logging';
import type {
  NormalizedAgentSummary,
  CondensedRelay200,
  CondensedRelay300,
} from '@openclaw/core-types';

export interface MemoryEntry {
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
  ttl?: number; // seconds, undefined = no expiry
}

export interface MemorySink {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  flush?(): Promise<void>;
}

// ---------------------------------------------------------------------------
// InMemorySink — dev/test only
// ---------------------------------------------------------------------------

export class InMemorySink implements MemorySink {
  private store = new Map<string, MemoryEntry>();
  private logger: Logger;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 60_000;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'InMemorySink' });
    this.scheduleCleanup();
  }

  private scheduleCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of this.store) {
      if (entry.ttl) {
        const age = (now - new Date(entry.createdAt).getTime()) / 1000;
        if (age > entry.ttl) {
          this.store.delete(key);
          cleaned++;
        }
      }
    }
    if (cleaned > 0) {
      this.logger.debug('memory.cleanup', { cleaned, remaining: this.store.size });
    }
  }

  async get(key: string): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.ttl) {
      const age = (Date.now() - new Date(entry.createdAt).getTime()) / 1000;
      if (age > entry.ttl) {
        this.store.delete(key);
        this.logger.debug('memory.expired', { key, ttl: entry.ttl });
        return undefined;
      }
    }

    return entry.value;
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const now = new Date().toISOString();
    this.store.set(key, { key, value, createdAt: now, updatedAt: now, ttl });
    this.logger.trace('memory.set', { key, ttl });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.logger.trace('memory.delete', { key });
  }

  async list(prefix = ''): Promise<string[]> {
    return Array.from(this.store.keys()).filter((k) => k.startsWith(prefix));
  }

  get size(): number {
    return this.store.size;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// DurableFileSink — production-safe file-backed memory
// ---------------------------------------------------------------------------

export class DurableFileSink implements MemorySink {
  private storePath: string;
  private logger: Logger;
  private index = new Map<string, { file: string; expiresAt?: number }>();
  private writeQueue = new Map<string, { value: unknown; ttl?: number }>();
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;

  constructor(storePath: string, logger: Logger) {
    this.storePath = storePath;
    this.logger = logger.child({ service: 'DurableFileSink' });

    // Ensure directory exists
    fs.mkdirSync(this.storePath, { recursive: true });

    // Load index from existing files
    this.loadIndex();
  }

  private loadIndex(): void {
    try {
      const indexFile = path.join(this.storePath, '.index.json');
      if (fs.existsSync(indexFile)) {
        const content = fs.readFileSync(indexFile, 'utf-8');
        const data = JSON.parse(content) as Record<string, { file: string; expiresAt?: number }>;
        for (const [key, entry] of Object.entries(data)) {
          // Only load non-expired entries
          if (!entry.expiresAt || entry.expiresAt > Date.now()) {
            this.index.set(key, entry);
          }
        }
      }
    } catch (err) {
      this.logger.warn('memory.index.load_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private saveIndex(): void {
    try {
      const indexFile = path.join(this.storePath, '.index.json');
      const data: Record<string, { file: string; expiresAt?: number }> = {};
      for (const [key, entry] of this.index) {
        data[key] = entry;
      }
      fs.writeFileSync(indexFile, JSON.stringify(data, null, 2));
    } catch (err) {
      this.logger.error('memory.index.save_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async get(key: string): Promise<unknown> {
    const entry = this.index.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.index.delete(key);
      this.saveIndex();
      this.logger.debug('memory.expired', { key });
      return undefined;
    }

    // Check write queue first
    const queued = this.writeQueue.get(key);
    if (queued) return queued.value;

    try {
      const filePath = path.join(this.storePath, entry.file);
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as unknown;
    } catch (err) {
      this.logger.error('memory.get.error', { key, error: String(err) });
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    const entry = this.index.get(key);
    const fileName = entry?.file ?? `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.json`;

    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined;
    this.index.set(key, { file: fileName, expiresAt });

    this.writeQueue.set(key, { value, ttl });
    this.scheduleFlush();

    this.logger.trace('memory.set', { key, ttl, queued: true });
  }

  private scheduleFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.flushing) return;
    if (this.writeQueue.size >= 50) {
      this.flush().catch(() => {});
    } else {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flush().catch(() => {});
      }, 200);
    }
  }

  async delete(key: string): Promise<void> {
    const entry = this.index.get(key);
    if (entry) {
      try {
        const filePath = path.join(this.storePath, entry.file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        this.logger.error('memory.delete.error', { key, error: String(err) });
      }
      this.index.delete(key);
      this.saveIndex();
    }
    this.writeQueue.delete(key);
    this.logger.trace('memory.delete', { key });
  }

  async list(prefix = ''): Promise<string[]> {
    const keys = Array.from(this.index.keys());
    return keys.filter((k) => k.startsWith(prefix));
  }

  async flush(): Promise<void> {
    if (this.writeQueue.size === 0) {
      return;
    }

    this.flushing = true;
    const batch = new Map(this.writeQueue);
    this.writeQueue.clear();

    for (const [key, { value, ttl }] of batch) {
      const entry = this.index.get(key);
      if (!entry) continue;

      try {
        const filePath = path.join(this.storePath, entry.file);
        await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
      } catch (err) {
        this.logger.error('memory.flush.write_error', {
          key,
          error: err instanceof Error ? err.message : String(err),
        });
        this.writeQueue.set(key, { value, ttl });
      }
    }

    this.flushing = false;
    this.saveIndex();
    this.logger.debug('memory.flush.complete', { flushedCount: batch.size });
  }

  get size(): number {
    return this.index.size;
  }
}

// ---------------------------------------------------------------------------
// AgentMemory — agent-specific memory operations
// ---------------------------------------------------------------------------

export class AgentMemory {
  private sink: MemorySink;
  private agentId: string;
  private inbox: unknown[] = [];
  private readonly MAX_INBOX = 10000;

  constructor(sink: MemorySink, agentId: string) {
    this.sink = sink;
    this.agentId = agentId;
  }

  bufferSize(): number {
    return this.inbox.length;
  }

  add(entry: unknown): void {
    if (this.inbox.length >= this.MAX_INBOX) {
      this.inbox.shift();
    }
    this.inbox.push(entry);
  }

  async saveSummary(summary: NormalizedAgentSummary): Promise<void> {
    await this.sink.set(`agent:${this.agentId}:summary:${summary.taskId}`, summary);
  }

  async getSummary(taskId: string): Promise<NormalizedAgentSummary | undefined> {
    return this.sink.get(`agent:${this.agentId}:summary:${taskId}`) as Promise<
      NormalizedAgentSummary | undefined
    >;
  }

  async saveRelay(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<void> {
    await this.sink.set(`agent:${this.agentId}:relay:${relay200.taskId}:200`, relay200);
    await this.sink.set(`agent:${this.agentId}:relay:${relay300.taskId}:300`, relay300);
  }

  async getTaskIds(): Promise<string[]> {
    const keys = await this.sink.list(`agent:${this.agentId}:summary:`);
    return keys.map((k) => k.split(':').pop() ?? '').filter(Boolean);
  }

  async flush(): Promise<void> {
    if (this.sink.flush) {
      await this.sink.flush();
    }
  }
}
