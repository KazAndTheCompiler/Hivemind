import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestrator, OrchestratorService } from './index';

describe('OrchestratorService', () => {
  let orchestrator: OrchestratorService;

  beforeEach(() => {
    orchestrator = createOrchestrator({
      workspace: '.',
      logging: { level: 'error', format: 'json' },
      audit: { storePath: '/tmp/test-audit', deadLetterPath: '/tmp/test-dl' },
    });
  });

  it('starts and reports running status', async () => {
    await orchestrator.start();
    expect(orchestrator.isRunning).toBe(true);
    expect(orchestrator.status.running).toBe(true);
    await orchestrator.shutdown('test');
  });

  it('processes a summary through the full pipeline', async () => {
    await orchestrator.start();

    const result = await orchestrator.processSummary({
      taskId: 'smoke-1',
      agentId: 'test-worker',
      status: 'done',
      summary: 'Smoke test completed successfully',
      touchedFiles: ['src/test.ts'],
      blockers: [],
      nextActions: [],
      confidence: 0.95,
      timestamp: new Date().toISOString(),
    });

    expect(result.normalized.taskId).toBe('smoke-1');
    expect(result.relay200.budget).toBe(200);
    expect(result.relay300.budget).toBe(300);
    expect(result.relay200.taskId).toBe('smoke-1');
    expect(result.relay300.taskId).toBe('smoke-1');

    await orchestrator.shutdown('test');
  });

  it('rejects processing when not running', async () => {
    await expect(orchestrator.processSummary({
      taskId: 'x', agentId: 'x', status: 'done',
      summary: 'x', touchedFiles: [], blockers: [],
      nextActions: [], confidence: 0.5,
      timestamp: new Date().toISOString(),
    })).rejects.toThrow('Orchestrator is not running');
  });
});
