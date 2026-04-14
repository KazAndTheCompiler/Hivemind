// Typed EventBus with discriminated union event handling
// Backpressure-safe, with structured failure capture and correlation IDs
// Supports idempotency, sequencing, and observability metrics

import type {
  OpenClawEvent,
  OpenClawEventKind,
  EventMeta,
  SystemMetrics,
  IdempotencyRecord,
  PipelineLock,
} from '@openclaw/core-types';
import { createLogger, Logger } from '@openclaw/core-logging';
import * as crypto from 'crypto';

export type EventHandler<T extends OpenClawEvent = OpenClawEvent> = (
  event: T,
) => void | Promise<void>;

export interface Subscription {
  unsubscribe(): void;
}

export interface EventProcessingResult {
  event: OpenClawEvent;
  handlerCount: number;
  succeeded: number;
  failed: number;
  errors: Array<{ handler: string; error: string }>;
  idempotencySkipped?: boolean;
}

const MAX_BUFFER_SIZE = 1000;
const OVERFLOW_POLICY: 'drop_oldest' | 'reject_new' | 'dead_letter' = 'dead_letter';
const MAX_IDEMPOTENCY_CACHE = 10000;

function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `evt_${ts}_${rand}`;
}

function generateEventIdempotencyKey(event: OpenClawEvent): string {
  const payload = JSON.stringify(event);
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
}

export class EventBus {
  private handlers = new Map<OpenClawEventKind, Set<EventHandler>>();
  private catchAll = new Set<EventHandler<OpenClawEvent>>();
  private buffer: OpenClawEvent[] = [];
  private processing = false;
  private logger: Logger;
  private deadLetterHandler?: (event: OpenClawEvent, reason: string) => void | Promise<void>;
  private eventDeliveryFailedHandler?: (
    event: OpenClawEvent,
    meta: EventMeta,
  ) => void | Promise<void>;
  private _overflowCount = 0;
  private _totalProcessed = 0;
  private _totalFailures = 0;
  private _idempotencyCache = new Map<string, IdempotencyRecord>();
  private _globalSequence = 0;
  private _streamSequences = new Map<string, number>();
  private pipelineLock: PipelineLock = { owner: null, lockedAt: null };
  private metrics: SystemMetrics = {
    eventsProcessedTotal: 0,
    eventsFailedTotal: 0,
    toolRunsTotal: 0,
    toolRunsFailed: 0,
    relayEmittedTotal: 0,
    relayBlockedTotal: 0,
    pipelineLockConflicts: 0,
    idempotencySkippedTotal: 0,
    lastMetricsUpdated: new Date().toISOString(),
  };

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger();
  }

  on<K extends OpenClawEventKind>(
    kind: K,
    handler: EventHandler<Extract<OpenClawEvent, { kind: K }>>,
  ): Subscription {
    if (!this.handlers.has(kind)) {
      this.handlers.set(kind, new Set());
    }
    this.handlers.get(kind)!.add(handler as EventHandler);
    this.logger.debug('event.handler.registered', { kind });

    return {
      unsubscribe: () => {
        this.handlers.get(kind)?.delete(handler as EventHandler);
      },
    };
  }

  onAny(handler: EventHandler<OpenClawEvent>): Subscription {
    this.catchAll.add(handler);
    return {
      unsubscribe: () => {
        this.catchAll.delete(handler);
      },
    };
  }

  setDeadLetterHandler(
    handler: (event: OpenClawEvent, reason: string) => void | Promise<void>,
  ): void {
    this.deadLetterHandler = handler;
  }

  setEventDeliveryFailedHandler(
    handler: (event: OpenClawEvent, meta: EventMeta) => void | Promise<void>,
  ): void {
    this.eventDeliveryFailedHandler = handler;
  }

  async emit(event: OpenClawEvent): Promise<void> {
    const eventId = generateEventId();
    this._globalSequence++;

    const idempotencyKey = generateEventIdempotencyKey(event);
    if (this._idempotencyCache.has(idempotencyKey)) {
      this.metrics.idempotencySkippedTotal++;
      this.logger.debug('event.idempotency.skipped', { eventId, kind: event.kind });
      return;
    }

    this._idempotencyCache.set(idempotencyKey, {
      eventId,
      processedAt: new Date().toISOString(),
      result: 'processed',
    });

    if (this._idempotencyCache.size > MAX_IDEMPOTENCY_CACHE) {
      const oldestKey = this._idempotencyCache.keys().next().value;
      if (oldestKey) this._idempotencyCache.delete(oldestKey);
    }

    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this._overflowCount++;
      this.logger.warn('event.buffer.full', {
        size: this.buffer.length,
        overflowCount: this._overflowCount,
        policy: OVERFLOW_POLICY,
      });

      if (OVERFLOW_POLICY === 'dead_letter' && this.deadLetterHandler) {
        await this.deadLetterHandler(event, 'buffer_overflow');
      } else if (OVERFLOW_POLICY === 'drop_oldest') {
        this.buffer.shift();
        this.buffer.push(event);
      } else if (OVERFLOW_POLICY === 'reject_new') {
        return;
      }

      return;
    }

    (event as { sequence?: number }).sequence = this._globalSequence;

    this.buffer.push(event);

    if (!this.processing) {
      await this.processBuffer();
    }
  }

  async emitWithLock(
    event: OpenClawEvent,
    owner: 'daemon' | 'orchestrator' | 'replay',
  ): Promise<boolean> {
    if (this.pipelineLock.owner !== null && this.pipelineLock.owner !== owner) {
      this.metrics.pipelineLockConflicts++;
      this.logger.warn('event.pipeline.locked', {
        requestedOwner: owner,
        currentOwner: this.pipelineLock.owner,
        lockedAt: this.pipelineLock.lockedAt,
      });
      return false;
    }

    if (this.pipelineLock.owner === null) {
      this.pipelineLock = {
        owner,
        lockedAt: new Date().toISOString(),
      };
    }

    await this.emit(event);
    return true;
  }

  releaseLock(owner: 'daemon' | 'orchestrator' | 'replay'): void {
    if (this.pipelineLock.owner === owner) {
      this.pipelineLock = { owner: null, lockedAt: null };
      this.logger.debug('event.pipeline.lock.released', { owner });
    }
  }

  getLock(): PipelineLock {
    return { ...this.pipelineLock };
  }

  private async processBuffer(): Promise<void> {
    this.processing = true;

    while (this.buffer.length > 0) {
      const event = this.buffer.shift()!;
      const kind = event.kind;
      const streamId = (event as { streamId?: string }).streamId ?? 'default';
      const eventSequence = (event as { sequence?: number }).sequence ?? 0;

      if (!this._streamSequences.has(streamId)) {
        this._streamSequences.set(streamId, 0);
      }

      const currentSeq = this._streamSequences.get(streamId)!;
      const sequence = eventSequence > 0 ? eventSequence : currentSeq + 1;
      this._streamSequences.set(streamId, sequence);

      const expectedSeq = currentSeq + 1;
      if (sequence > expectedSeq) {
        this.logger.warn('event.sequence.gap', {
          streamId,
          expected: expectedSeq,
          actual: sequence,
        });
      } else if (sequence < expectedSeq) {
        this.logger.warn('event.sequence.out_of_order', {
          streamId,
          expected: expectedSeq,
          actual: sequence,
        });
        this.buffer.unshift(event);
        continue;
      }
      this._streamSequences.set(streamId, sequence);

      const meta: EventMeta = {
        eventId: generateEventId(),
        createdAt: new Date().toISOString(),
        sequence,
        streamId,
      };

      const result: EventProcessingResult = {
        event,
        handlerCount: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      };

      try {
        const kindHandlers = this.handlers.get(kind);
        if (kindHandlers) {
          result.handlerCount += kindHandlers.size;
          const handlerPromises = Array.from(kindHandlers).map(async (h) => {
            try {
              await Promise.resolve(h(event));
              result.succeeded++;
            } catch (err) {
              result.failed++;
              result.errors.push({
                handler: h.name || 'anonymous',
                error: err instanceof Error ? err.message : String(err),
              });
            }
          });
          await Promise.all(handlerPromises);
        }

        const catchAllPromises = Array.from(this.catchAll).map(async (h) => {
          try {
            await Promise.resolve(h(event));
            result.succeeded++;
          } catch (err) {
            result.failed++;
            result.errors.push({
              handler: h.name || 'anonymous_catchall',
              error: err instanceof Error ? err.message : String(err),
            });
          }
        });
        await Promise.all(catchAllPromises);
      } catch (err) {
        this.logger.error('event.processing.error', {
          kind,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      meta.processedAt = new Date().toISOString();
      meta.failedHandlers = result.failed > 0 ? result.failed : undefined;

      this._totalProcessed++;
      this.metrics.eventsProcessedTotal++;
      if (result.failed > 0) {
        this._totalFailures++;
        this.metrics.eventsFailedTotal++;
        this.logger.warn('event.handler.failures', {
          kind,
          handlerCount: result.handlerCount,
          failed: result.failed,
          errors: result.errors.slice(0, 5),
        });

        if (this.eventDeliveryFailedHandler) {
          try {
            await this.eventDeliveryFailedHandler(event, meta);
          } catch (err) {
            this.logger.error('event.delivery_failed_handler.error', {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    this.processing = false;
    this.metrics.lastMetricsUpdated = new Date().toISOString();
  }

  handlerCount(kind: OpenClawEventKind): number {
    return this.handlers.get(kind)?.size ?? 0;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getOverflowCount(): number {
    return this._overflowCount;
  }

  getTotalProcessed(): number {
    return this._totalProcessed;
  }

  getTotalFailures(): number {
    return this._totalFailures;
  }

  getCapacityUtilization(): number {
    return this.buffer.length / MAX_BUFFER_SIZE;
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  getGlobalSequence(): number {
    return this._globalSequence;
  }

  getStreamSequence(streamId: string): number {
    return this._streamSequences.get(streamId) ?? 0;
  }
}
