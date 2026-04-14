// Event router and main agent inbox abstraction

import type { RawAgentSummary } from '@openclaw/core-types';
import { EventBus, Subscription } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';

export interface InboxMessage {
  id: string;
  fromAgent: string;
  taskId: string;
  summary: RawAgentSummary;
  receivedAt: string;
  read: boolean;
}

export class AgentRouter {
  private eventBus: EventBus;
  private logger: Logger;
  private inbox: InboxMessage[] = [];
  private maxInboxSize = 200;

  constructor(eventBus: EventBus, logger: Logger) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'AgentRouter' });
  }

  // Subscribe to worker emissions and route to main agent inbox
  startListening(): Subscription {
    return this.eventBus.on('agent.summary.emitted', async (event) => {
      const summaryEvent = event as { kind: 'agent.summary.emitted'; raw: RawAgentSummary; timestamp: string };

      const message: InboxMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fromAgent: summaryEvent.raw.agentId,
        taskId: summaryEvent.raw.taskId,
        summary: summaryEvent.raw,
        receivedAt: summaryEvent.timestamp,
        read: false,
      };

      // Enforce inbox capacity
      if (this.inbox.length >= this.maxInboxSize) {
        this.inbox.shift();
        this.logger.warn('router.inbox.full.dropped_oldest', {
          taskId: message.taskId,
        });
      }

      this.inbox.push(message);

      this.logger.info('router.message.received', {
        messageId: message.id,
        fromAgent: message.fromAgent,
        taskId: message.taskId,
        inboxSize: this.inbox.length,
      });
    });
  }

  // Main agent picks up unread messages
  pickUpUnread(): InboxMessage[] {
    const unread = this.inbox.filter((m) => !m.read);
    for (const msg of unread) {
      msg.read = true;
    }
    return unread;
  }

  // Get all messages
  getAll(): InboxMessage[] {
    return [...this.inbox];
  }

  // Get messages by task
  getByTask(taskId: string): InboxMessage[] {
    return this.inbox.filter((m) => m.taskId === taskId);
  }

  // Clear read messages older than threshold
  sweep(maxAge: number): number {
    const cutoff = new Date(Date.now() - maxAge).toISOString();
    const before = this.inbox.length;
    this.inbox = this.inbox.filter((m) => !m.read || m.receivedAt > cutoff);
    const swept = before - this.inbox.length;

    if (swept > 0) {
      this.logger.info('router.sweep', { sweptCount: swept });
    }

    return swept;
  }

  get inboxSize(): number {
    return this.inbox.length;
  }

  get unreadCount(): number {
    return this.inbox.filter((m) => !m.read).length;
  }
}
