// Main agent relay service — handoff delivery to main agent channel
// Splits creation (relay.condensed) and delivery (relay.delivered) semantics
// Supports confidence threshold routing and review queues

import type {
  CondensedRelay200,
  CondensedRelay300,
  RelayRoutingDecision,
} from '@openclaw/core-types';
import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';

export interface RelayDelivery {
  taskId: string;
  delivered: boolean;
  timestamp: string;
  routingDecision: RelayRoutingDecision;
}

export interface ReviewQueueItem {
  relay200: CondensedRelay200;
  relay300: CondensedRelay300;
  addedAt: string;
  reason: string;
}

export class MainAgentRelayService {
  private eventBus: EventBus;
  private logger: Logger;
  private inbox: Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> = [];
  private reviewQueue: ReviewQueueItem[] = [];
  private maxInboxSize: number;
  private maxReviewQueueSize: number;
  private confidenceThreshold: number;

  constructor(
    eventBus: EventBus,
    logger: Logger,
    options?: { maxInboxSize?: number; maxReviewQueueSize?: number; confidenceThreshold?: number },
  ) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'MainAgentRelayService' });
    this.maxInboxSize = options?.maxInboxSize ?? 100;
    this.maxReviewQueueSize = options?.maxReviewQueueSize ?? 500;
    this.confidenceThreshold = options?.confidenceThreshold ?? 0.5;
  }

  decideRouting(relay200: CondensedRelay200): RelayRoutingDecision {
    if (relay200.severity === 'critical') {
      return { decision: 'block', confidence: relay200.confidence, reason: 'critical_severity' };
    }

    if (relay200.confidence < this.confidenceThreshold) {
      return {
        decision: 'review_queue',
        confidence: relay200.confidence,
        reason: `below_confidence_threshold_${this.confidenceThreshold}`,
      };
    }

    return { decision: 'relay', confidence: relay200.confidence };
  }

  async deliver(relay200: CondensedRelay200, relay300: CondensedRelay300): Promise<RelayDelivery> {
    const routing = this.decideRouting(relay200);

    try {
      if (routing.decision === 'block') {
        this.logger.warn('relay.blocked.critical_severity', {
          taskId: relay200.taskId,
          confidence: relay200.confidence,
        });

        await this.eventBus.emit({
          kind: 'relay.delivery_failed',
          schemaVersion: 'v1',
          sequence: 0,
          streamId: relay200.taskId,
          taskId: relay200.taskId,
          reason: 'critical_severity_blocked',
          timestamp: new Date().toISOString(),
        });

        return {
          taskId: relay200.taskId,
          delivered: false,
          timestamp: new Date().toISOString(),
          routingDecision: routing,
        };
      }

      if (routing.decision === 'review_queue') {
        while (this.reviewQueue.length >= this.maxReviewQueueSize) {
          this.reviewQueue.shift();
          this.logger.warn('relay.review_queue.full.dropped_oldest', {
            taskId: relay200.taskId,
            reviewQueueSize: this.reviewQueue.length,
          });
        }
        this.reviewQueue.push({
          relay200,
          relay300,
          addedAt: new Date().toISOString(),
          reason: routing.reason,
        });
        this.logger.info('relay.routed_to_review_queue', {
          taskId: relay200.taskId,
          confidence: relay200.confidence,
          threshold: this.confidenceThreshold,
        });

        return {
          taskId: relay200.taskId,
          delivered: false,
          timestamp: new Date().toISOString(),
          routingDecision: routing,
        };
      }

      while (this.inbox.length >= this.maxInboxSize) {
        this.inbox.shift();
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
        routingDecision: routing,
      };

      this.logger.info('relay.delivered', {
        taskId: delivery.taskId,
        severity: relay200.severity,
        inboxSize: this.inbox.length,
      });

      await this.eventBus.emit({
        kind: 'relay.delivered',
        schemaVersion: 'v1',
        sequence: 0,
        streamId: relay200.taskId,
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
        schemaVersion: 'v1',
        sequence: 0,
        streamId: relay200.taskId,
        taskId: relay200.taskId,
        reason: errMsg,
        timestamp: new Date().toISOString(),
      });

      return {
        taskId: relay200.taskId,
        delivered: false,
        timestamp: new Date().toISOString(),
        routingDecision: routing,
      };
    }
  }

  async deliverAndEmit(
    relay200: CondensedRelay200,
    relay300: CondensedRelay300,
  ): Promise<RelayDelivery> {
    return this.deliver(relay200, relay300);
  }

  pickUp(): Array<{ relay200: CondensedRelay200; relay300: CondensedRelay300 }> {
    const items = [...this.inbox];
    this.inbox = [];
    this.logger.debug('relay.picked_up', { count: items.length });
    return items;
  }

  pickUpReviewQueue(maxItems?: number): ReviewQueueItem[] {
    const items = this.reviewQueue.slice(0, maxItems);
    this.reviewQueue = this.reviewQueue.slice(maxItems ?? this.reviewQueue.length);
    return items;
  }

  get inboxSize(): number {
    return this.inbox.length;
  }

  get reviewQueueSize(): number {
    return this.reviewQueue.length;
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }
}
