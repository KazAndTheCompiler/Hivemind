// Memory sink abstraction for agent state persistence

import { Logger } from '@openclaw/core-logging';
import type { NormalizedAgentSummary, CondensedRelay200, CondensedRelay300 } from '@openclaw/core-types';

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
}

// In-memory implementation (production can swap for Redis, etc.)
export class InMemorySink implements MemorySink {
  private store = new Map<string, MemoryEntry>();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'InMemorySink' });
  }

  async get(key: string): Promise<unknown> {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    // Check TTL
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
}

// Agent-specific memory operations
export class AgentMemory {
  private sink: MemorySink;
  private agentId: string;

  constructor(sink: MemorySink, agentId: string) {
    this.sink = sink;
    this.agentId = agentId;
  }

  async saveSummary(summary: NormalizedAgentSummary): Promise<void> {
    await this.sink.set(`agent:${this.agentId}:summary:${summary.taskId}`, summary);
  }

  async getSummary(taskId: string): Promise<NormalizedAgentSummary | undefined> {
    return this.sink.get(`agent:${this.agentId}:summary:${taskId}`) as Promise<NormalizedAgentSummary | undefined>;
  }

  async saveRelay(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<void> {
    await this.sink.set(`agent:${this.agentId}:relay:${relay200.taskId}:200`, relay200);
    await this.sink.set(`agent:${this.agentId}:relay:${relay300.taskId}:300`, relay300);
  }

  async getTaskIds(): Promise<string[]> {
    const keys = await this.sink.list(`agent:${this.agentId}:summary:`);
    return keys.map((k) => k.split(':').pop() ?? '').filter(Boolean);
  }
}
