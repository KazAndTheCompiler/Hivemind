// Main agent relay service — handoff delivery to main agent channel
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

  async deliver(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<RelayDelivery> {
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

    return delivery;
  }

  async deliverAndEmit(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<RelayDelivery> {
    const delivery = await this.deliver(relay200, relay300);

    // Emit to event bus for audit trail
    await this.eventBus.emit({
      kind: 'relay.condensed',
      relay200,
      relay300,
      timestamp: delivery.timestamp,
    });

    return delivery;
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
