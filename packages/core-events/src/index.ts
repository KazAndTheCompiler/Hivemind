// Typed EventBus with discriminated union event handling
// Backpressure-safe, with structured failure capture and correlation IDs

import type { OpenClawEvent, OpenClawEventKind, EventMeta } from '@openclaw/core-types';
import { createLogger, Logger } from '@openclaw/core-logging';

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
}

const MAX_BUFFER_SIZE = 1000;
const OVERFLOW_POLICY: 'drop_oldest' | 'reject_new' | 'dead_letter' = 'dead_letter';

/** Generate a unique event ID */
function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `evt_${ts}_${rand}`;
}

export class EventBus {
  private handlers = new Map<OpenClawEventKind, Set<EventHandler>>();
  private catchAll = new Set<EventHandler<OpenClawEvent>>();
  private buffer: OpenClawEvent[] = [];
  private processing = false;
  private logger: Logger;
  private deadLetterHandler?: (event: OpenClawEvent, reason: string) => void | Promise<void>;
  private eventDeliveryFailedHandler?: (event: OpenClawEvent, meta: EventMeta) => void | Promise<void>;
  private _overflowCount = 0;
  private _totalProcessed = 0;
  private _totalFailures = 0;

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
    // Backpressure: check buffer capacity
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
        this.buffer.shift(); // drop oldest
        this.buffer.push(event);
      } else if (OVERFLOW_POLICY === 'reject_new') {
        // Event is dropped — logged above
        return;
      }

      return;
    }

    this.buffer.push(event);

    if (!this.processing) {
      await this.processBuffer();
    }
  }

  private async processBuffer(): Promise<void> {
    this.processing = true;

    while (this.buffer.length > 0) {
      const event = this.buffer.shift()!;
      const kind = event.kind;
      const meta: EventMeta = {
        eventId: generateEventId(),
        createdAt: new Date().toISOString(),
      };

      const result: EventProcessingResult = {
        event,
        handlerCount: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      };

      try {
        // Fire kind-specific handlers
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

        // Fire catch-all handlers
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
        // This catch is for unexpected errors in the processing loop itself
        this.logger.error('event.processing.error', {
          kind,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      meta.processedAt = new Date().toISOString();
      meta.failedHandlers = result.failed > 0 ? result.failed : undefined;

      this._totalProcessed++;
      if (result.failed > 0) {
        this._totalFailures++;
        this.logger.warn('event.handler.failures', {
          kind,
          handlerCount: result.handlerCount,
          failed: result.failed,
          errors: result.errors.slice(0, 5), // cap logged errors
        });

        // Emit delivery failure notification
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
  }

  handlerCount(kind: OpenClawEventKind): number {
    return this.handlers.get(kind)?.size ?? 0;
  }

  get bufferSize(): number {
    return this.buffer.length;
  }

  /** Number of events dropped due to buffer overflow */
  get overflowCount(): number {
    return this._overflowCount;
  }

  /** Total events successfully processed */
  get totalProcessed(): number {
    return this._totalProcessed;
  }

  /** Total handler failures across all processed events */
  get totalFailures(): number {
    return this._totalFailures;
  }

  /** Current capacity utilization as a fraction */
  get capacityUtilization(): number {
    return this.buffer.length / MAX_BUFFER_SIZE;
  }
}
