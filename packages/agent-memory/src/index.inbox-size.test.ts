import { describe, it, expect } from 'vitest';
import { AgentMemory } from './index';
import { InMemorySink } from './index';
import { createLogger } from '@openclaw/core-logging';

describe('AgentMemory inbox size cap', () => {
  it('should drop oldest entries when inbox exceeds MAX_INBOX', () => {
    const logger = createLogger({ level: 'error', format: 'json' });
    const sink = new InMemorySink(logger);
    const memory = new AgentMemory(sink, 'test-agent');

    // Fill inbox beyond MAX_INBOX (10000)
    const count = 15000;
    for (let i = 0; i < count; i++) {
      memory.add(`entry-${i}`);
    }

    // Oldest 5000 should have been dropped, buffer should be exactly MAX_INBOX
    expect(memory.bufferSize()).toBe(10000);

    // Last entry should still be present
    const lastEntry = memory['inbox'][memory['inbox'].length - 1];
    expect(lastEntry).toBe('entry-14999');
  });

  it('should report correct bufferSize reflecting current inbox length', () => {
    const logger = createLogger({ level: 'error', format: 'json' });
    const sink = new InMemorySink(logger);
    const memory = new AgentMemory(sink, 'test-agent');

    expect(memory.bufferSize()).toBe(0);

    memory.add('first');
    expect(memory.bufferSize()).toBe(1);

    memory.add('second');
    expect(memory.bufferSize()).toBe(2);
  });
});
