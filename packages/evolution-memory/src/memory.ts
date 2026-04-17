// Evolution Memory Service
// Durable persistence for lessons with trust weighting and decay

import * as fs from 'fs';
import * as path from 'path';
import type {
  ExtractedLesson,
  LessonQuery,
  EvolutionScope,
  LessonPriority,
} from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export interface MemoryStore {
  lessons: Map<string, ExtractedLesson>;
  lessonIndex: Map<string, string[]>;
  lastUpdated: string;
}

export class EvolutionMemoryService {
  private logger: Logger;
  private storePath: string;
  private memory: MemoryStore;
  private writePending = false;

  constructor(storePath: string, logger?: Logger) {
    this.logger = logger ?? createLogger();
    this.storePath = storePath;
    this.memory = this.loadOrCreate();
  }

  saveLesson(lesson: ExtractedLesson): void {
    const existing = this.memory.lessons.get(lesson.id);
    if (existing) {
      this.mergeLesson(existing, lesson);
    } else {
      this.memory.lessons.set(lesson.id, { ...lesson });
      this.indexLesson(lesson);
    }
    this.memory.lastUpdated = new Date().toISOString();
    this.scheduleWrite();
  }

  saveBatch(lessons: ExtractedLesson[]): void {
    for (const lesson of lessons) {
      this.saveLesson(lesson);
    }
  }

  getLesson(id: string): ExtractedLesson | null {
    return this.memory.lessons.get(id) ?? null;
  }

  query(q: LessonQuery): ExtractedLesson[] {
    let results = Array.from(this.memory.lessons.values());

    if (q.scope) {
      results = results.filter((l) => l.scope === q.scope);
    }

    if (q.priority) {
      results = results.filter((l) => l.priority === q.priority);
    }

    if (q.tags && q.tags.length > 0) {
      results = results.filter((l) => q.tags!.some((t) => l.tags.includes(t)));
    }

    if (q.minConfidence !== undefined) {
      results = results.filter((l) => l.confidence >= q.minConfidence!);
    }

    results.sort((a, b) => {
      const priorityOrder: Record<LessonPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });

    if (q.limit) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  getByScope(scope: EvolutionScope): ExtractedLesson[] {
    return this.query({ scope, limit: 100 });
  }

  suppressLesson(id: string, suppressedBy: string): void {
    const lesson = this.memory.lessons.get(id);
    if (lesson) {
      lesson.tags.push(`suppressed:${suppressedBy}`);
      this.memory.lastUpdated = new Date().toISOString();
      this.scheduleWrite();
    }
  }

  archiveLesson(id: string): void {
    const lesson = this.memory.lessons.get(id);
    if (lesson) {
      lesson.tags.push('archived');
      lesson.expiresAt = new Date().toISOString();
      this.memory.lastUpdated = new Date().toISOString();
      this.scheduleWrite();
    }
  }

  decayStaleLessons(maxAgeDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    let decayed = 0;

    for (const lesson of this.memory.lessons.values()) {
      if (lesson.tags.includes('archived') || lesson.tags.includes('suppressed')) {
        continue;
      }

      const created = new Date(lesson.createdAt);
      if (created < cutoff) {
        const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        const decayFactor = Math.max(0.1, 1 - ageDays * 0.05);
        lesson.confidence = lesson.confidence * decayFactor;
        lesson.tags.push(`decayed:${new Date().toISOString()}`);
        decayed++;
      }
    }

    if (decayed > 0) {
      this.memory.lastUpdated = new Date().toISOString();
      this.scheduleWrite();
    }

    return decayed;
  }

  getStats(): {
    total: number;
    byScope: Record<string, number>;
    byPriority: Record<string, number>;
    staleCount: number;
    archivedCount: number;
  } {
    const lessons = Array.from(this.memory.lessons.values());
    const byScope: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let staleCount = 0;
    let archivedCount = 0;

    for (const lesson of lessons) {
      byScope[lesson.scope] = (byScope[lesson.scope] ?? 0) + 1;
      byPriority[lesson.priority] = (byPriority[lesson.priority] ?? 0) + 1;

      if (lesson.tags.includes('archived')) {
        archivedCount++;
      } else if (lesson.confidence < 0.3) {
        staleCount++;
      }
    }

    return {
      total: lessons.length,
      byScope,
      byPriority,
      staleCount,
      archivedCount,
    };
  }

  private indexLesson(lesson: ExtractedLesson): void {
    for (const tag of lesson.tags) {
      if (!this.memory.lessonIndex.has(tag)) {
        this.memory.lessonIndex.set(tag, []);
      }
      this.memory.lessonIndex.get(tag)!.push(lesson.id);
    }
  }

  private mergeLesson(existing: ExtractedLesson, incoming: ExtractedLesson): void {
    const evidenceMap = new Map(existing.evidence.map((e) => [e.id, e]));
    for (const e of incoming.evidence) {
      if (!evidenceMap.has(e.id)) {
        existing.evidence.push(e);
      }
    }

    existing.evidence.push(...incoming.evidence);
    existing.confidence = Math.min(0.95, (existing.confidence + incoming.confidence) / 2);

    if (incoming.priority === 'critical' || incoming.priority === 'high') {
      existing.priority = incoming.priority;
    }

    existing.tags = [...new Set([...existing.tags, ...incoming.tags])];
    existing.expiresAt = incoming.expiresAt;
  }

  private scheduleWrite(): void {
    if (this.writePending) return;
    this.writePending = true;

    setTimeout(() => {
      this.persistToDisk();
      this.writePending = false;
    }, 500);
  }

  private persistToDisk(): void {
    try {
      fs.mkdirSync(this.storePath, { recursive: true });
      const filePath = path.join(this.storePath, 'evolution-memory.json');
      const data = JSON.stringify(this.memory, null, 2);
      fs.writeFileSync(filePath, data, 'utf-8');
      this.logger.debug('evolution.memory.persisted', { lessonCount: this.memory.lessons.size });
    } catch (err) {
      this.logger.error('evolution.memory.persist_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private loadOrCreate(): MemoryStore {
    const filePath = path.join(this.storePath, 'evolution-memory.json');

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as MemoryStore;
        return {
          lessons: new Map(data.lessons),
          lessonIndex: new Map(data.lessonIndex),
          lastUpdated: data.lastUpdated,
        };
      } catch (err) {
        this.logger.warn('evolution.memory.load_error', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      lessons: new Map(),
      lessonIndex: new Map(),
      lastUpdated: new Date().toISOString(),
    };
  }
}
