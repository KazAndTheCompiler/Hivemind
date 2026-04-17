import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from './index';
import { createLogger } from '@openclaw/core-logging';
import type { OpenClawEvent } from '@openclaw/core-types';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus(createLogger());
  });

  it('registers and fires kind-specific handlers', async () => {
    let received: OpenClawEvent | null = null;

    bus.on('file.change.detected', (event) => {
      received = event;
    });

    const event: OpenClawEvent = {
      kind: 'file.change.detected',
      schemaVersion: 'v1',
      sequence: 1,
      streamId: 'test',
      files: ['src/a.ts'],
      packageNames: ['@openclaw/core-types'],
      timestamp: new Date().toISOString(),
    };

    await bus.emit(event);

    expect(received).not.toBeNull();
    expect(received!.kind).toBe('file.change.detected');
  });

  it('fires catch-all handlers', async () => {
    let received: OpenClawEvent | null = null;

    bus.onAny((event) => {
      received = event;
    });

    await bus.emit({
      kind: 'orchestrator.started',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'test',
      timestamp: new Date().toISOString(),
    });

    expect(received).not.toBeNull();
    expect(received!.kind).toBe('orchestrator.started');
  });

  it('unsubscribes handlers', async () => {
    let callCount = 0;

    const sub = bus.on('orchestrator.started', () => {
      callCount++;
    });

    await bus.emit({
      kind: 'orchestrator.started',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'test',
      timestamp: new Date().toISOString(),
    });
    expect(callCount).toBe(1);

    sub.unsubscribe();

    await bus.emit({
      kind: 'orchestrator.started',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'test',
      timestamp: new Date().toISOString(),
    });
    expect(callCount).toBe(1); // Should not increment
  });

  it('reports handler count', () => {
    expect(bus.handlerCount('file.change.detected')).toBe(0);

    bus.on('file.change.detected', () => {});
    expect(bus.handlerCount('file.change.detected')).toBe(1);
  });
});
