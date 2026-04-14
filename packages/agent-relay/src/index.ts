// Main agent relay service — handoff delivery to main agent channel
// Splits creation (relay.condensed) and delivery (relay.delivered) semantics

import type { CondensedRelay200, CondensedRelay300 } from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';

export interface RelayDelivery {
  taskId: string;
  delivered: boolean;
  timestamp: string;
}

export class MainAgentRelayService {
  private eventBus: EventBus;
  private logger: Logger;
  private inbox: Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> = [];
  private maxInboxSize: number;

  constructor(eventBus: EventBus, logger: Logger, maxInboxSize = 100) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'MainAgentRelayService' });
    this.maxInboxSize = maxInboxSize;
  }

  /**
   * Deliver relay payloads to main agent inbox.
   * Emits relay.delivered on success, relay.delivery_failed on failure.
   */
  async deliver(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<RelayDelivery> {
    try {
      // Enforce inbox capacity
      if (this.inbox.length >= this.maxInboxSize) {
        this.inbox.shift(); // drop oldest
        this.logger.warn('relay.inbox.full.dropped_oldest', {
          taskId: relay200.taskId,
          inboxSize: this.inbox.length,
        });
      }

      this.inbox.push({ relay200, relay300 });

      const delivery: RelayDelivery = {
        taskId: relay200.taskId,
        delivered: true,
        timestamp: new Date().toISOString(),
      };

      this.logger.info('relay.delivered', {
        taskId: delivery.taskId,
        severity: relay200.severity,
        inboxSize: this.inbox.length,
      });

      // Emit delivery event (separate from condensed creation event)
      await this.eventBus.emit({
        kind: 'relay.delivered',
        taskId: relay200.taskId,
        severity: relay200.severity,
        inboxSize: this.inbox.length,
        timestamp: delivery.timestamp,
      });

      return delivery;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error('relay.delivery_failed', {
        taskId: relay200.taskId,
        error: errMsg,
      });

      await this.eventBus.emit({
        kind: 'relay.delivery_failed',
        taskId: relay200.taskId,
        reason: errMsg,
        timestamp: new Date().toISOString(),
      });

      return {
        taskId: relay200.taskId,
        delivered: false,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Deliver and also emit the relay.condensed event for backward compatibility.
   * Prefer calling deliver() + emitting condensed separately for clean semantics.
   */
  async deliverAndEmit(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<RelayDelivery> {
    // relay.condensed was already emitted by SummaryCondenseService.condenseAndEmit()
    // Just deliver to inbox (which emits relay.delivered)
    return this.deliver(relay200, relay300);
  }

  pickUp(): Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> {
    const items = [...this.inbox];
    this.inbox = [];
    this.logger.debug('relay.picked_up', { count: items.length });
    return items;
  }

  get inboxSize(): number {
    return this.inbox.length;
  }
}
