// Typed EventBus with discriminated union event handling
import type { OpenClawEvent, OpenClawEventKind } from '@openclaw/core-types';
import { createLogger, Logger } from '@openclaw/core-logging';

export type EventHandler<T extends OpenClawEvent = OpenClawEvent> = (
  event: T,
) => void | Promise<void>;

export interface Subscription {
  unsubscribe(): void;
}

const MAX_BUFFER_SIZE = 1000;

export class EventBus {
  private handlers = new Map<OpenClawEventKind, Set<EventHandler>>();
  private catchAll = new Set<EventHandler<OpenClawEvent>>();
  private buffer: OpenClawEvent[] = [];
  private processing = false;
  private logger: Logger;
  private deadLetterHandler?: (event: OpenClawEvent, reason: string) => void;

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
    handler: (event: OpenClawEvent, reason: string) => void,
  ): void {
    this.deadLetterHandler = handler;
  }

  async emit(event: OpenClawEvent): Promise<void> {
    // Backpressure-safe buffering
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.logger.warn('event.buffer.full', { size: this.buffer.length });
      if (this.deadLetterHandler) {
        this.deadLetterHandler(event, 'buffer_full');
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

      try {
        // Fire kind-specific handlers
        const kindHandlers = this.handlers.get(kind);
        if (kindHandlers) {
          const promises = Array.from(kindHandlers).map((h) =>
            Promise.resolve(h(event)),
          );
          await Promise.allSettled(promises);
        }

        // Fire catch-all handlers
        const catchAllPromises = Array.from(this.catchAll).map((h) =>
          Promise.resolve(h(event)),
        );
        await Promise.allSettled(catchAllPromises);
      } catch (err) {
        this.logger.error('event.handler.error', {
          kind,
          error: err instanceof Error ? err.message : String(err),
        });
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
}
