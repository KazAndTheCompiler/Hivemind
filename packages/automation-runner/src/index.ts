// Automation enforcement orchestration service
// Orchestrates tool execution across fast/slow/full_repo loops

import { Logger } from '@openclaw/core-logging';
import type {
  AutomationMode,
  AutomationRun,
  ToolAdapter,
  ToolExecutionResult,
  ToolExecutionTarget,
  ToolName,
  EnforcementDecision,
  EnforcementPolicy,
} from '@openclaw/automation-core';

export interface ToolAdapterRegistry {
  get(name: ToolName): ToolAdapter | undefined;
  register(adapter: ToolAdapter): void;
  list(): ToolAdapter[];
}

export class LocalToolAdapterRegistry implements ToolAdapterRegistry {
  private adapters = new Map<ToolName, ToolAdapter>();

  get(name: ToolName): ToolAdapter | undefined {
    return this.adapters.get(name);
  }

  register(adapter: ToolAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  list(): ToolAdapter[] {
    return Array.from(this.adapters.values());
  }
}

export interface RunnerOptions {
  cwd?: string;
  parallel?: boolean;
  emitEvents?: boolean;
}

export class AutomationRunner {
  private logger: Logger;
  private registry: ToolAdapterRegistry;
  private cwd: string;
  private parallel: boolean;

  constructor(logger: Logger, registry: ToolAdapterRegistry, options?: RunnerOptions) {
    this.logger = logger.child({ service: 'AutomationRunner' });
    this.registry = registry;
    this.cwd = options?.cwd ?? process.cwd();
    this.parallel = options?.parallel ?? false;
  }

  async runFastLoop(
    target: ToolExecutionTarget,
    policy: EnforcementPolicy,
  ): Promise<AutomationRun> {
    return this.run('changed_file', target, policy);
  }

  async runCheckpoint(
    target: ToolExecutionTarget,
    policy: EnforcementPolicy,
  ): Promise<AutomationRun> {
    return this.run('checkpoint', target, policy);
  }

  async runFullRepo(
    target: ToolExecutionTarget,
    policy: EnforcementPolicy,
  ): Promise<AutomationRun> {
    return this.run('full_repo', target, policy);
  }

  private async run(
    mode: AutomationMode,
    target: ToolExecutionTarget,
    policy: EnforcementPolicy,
  ): Promise<AutomationRun> {
    const runId = this.generateRunId();
    const startedAt = new Date().toISOString();

    this.logger.info('automation.run.start', { runId, mode, target });

    const results: ToolExecutionResult[] = [];
    const tools = this.selectToolsForMode(mode, policy);

    if (this.parallel) {
      const promises = tools.map((tool) => this.executeTool(tool, target, mode, policy));
      const toolResults = await Promise.allSettled(promises);
      for (const result of toolResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    } else {
      for (const tool of tools) {
        const result = await this.executeTool(tool, target, mode, policy);
        results.push(result);
      }
    }

    const decision = this.makeDecision(results, policy);
    const completedAt = new Date().toISOString();

    const run: AutomationRun = {
      id: runId,
      mode,
      startedAt,
      completedAt,
      results,
      decision,
      mutationCount: target.files.length,
    };

    this.logger.info('automation.run.complete', {
      runId,
      mode,
      canProceed: decision.canProceed,
      blockerCount: decision.blockingTools.length,
    });

    return run;
  }

  private async executeTool(
    tool: ToolAdapter,
    target: ToolExecutionTarget,
    mode: AutomationMode,
    policy: EnforcementPolicy,
  ): Promise<ToolExecutionResult> {
    const toolPolicy = policy[tool.name];
    if (!toolPolicy || !tool.supportedModes.includes(mode)) {
      return this.createSkippedResult(tool.name, target, mode);
    }

    const startTime = Date.now();
    let retryCount = 0;
    let lastResult: ToolExecutionResult | null = null;

    while (retryCount <= toolPolicy.maxRetries) {
      try {
        const cmd = tool.buildCommand(target, mode);
        const { stdout, stderr, exitCode } = await this.executeCommand(cmd, toolPolicy.timeoutMs);

        const durationMs = Date.now() - startTime;
        lastResult = tool.normalizeResult(
          stdout,
          stderr,
          exitCode,
          durationMs,
          target,
          mode,
          retryCount,
        );

        if (lastResult.status === 'passed' || lastResult.status === 'skipped') {
          return lastResult;
        }

        if (retryCount < toolPolicy.maxRetries) {
          retryCount++;
          this.logger.warn('automation.tool.retry', { tool: tool.name, attempt: retryCount });
        } else {
          return lastResult;
        }
      } catch (err) {
        if (retryCount < toolPolicy.maxRetries) {
          retryCount++;
        } else {
          return this.createErrorResult(tool.name, target, mode, String(err));
        }
      }
    }

    return lastResult ?? this.createErrorResult(tool.name, target, mode, 'Unknown error');
  }

  private async executeCommand(
    cmd: string[],
    timeoutMs: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    try {
      const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), {
        cwd: this.cwd,
        timeout: timeoutMs,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err) {
      const nodeErr = err as { code?: string | number; message: string; stderr?: string };
      const code = nodeErr.code;
      const isTimedOut =
        code === 'ETIMEDOUT' || code === 'ETIME' || nodeErr.message.includes('timed out');
      if (isTimedOut) {
        return { stdout: '', stderr: 'Command timed out', exitCode: null };
      }
      return {
        stdout: '',
        stderr: nodeErr.stderr ?? nodeErr.message,
        exitCode: typeof code === 'number' ? code : null,
      };
    }
  }

  private selectToolsForMode(mode: AutomationMode, policy: EnforcementPolicy): ToolAdapter[] {
    const allTools = this.registry.list();
    return allTools.filter((tool) => {
      const toolPolicy = policy[tool.name];
      if (!toolPolicy) return false;
      if (!toolPolicy.allowedModes.includes(mode)) return false;
      if (mode === 'changed_file' && tool.name === 'knip') return false;
      if (mode === 'changed_file' && tool.name === 'gitnexus') return false;
      return true;
    });
  }

  private makeDecision(
    results: ToolExecutionResult[],
    policy: EnforcementPolicy,
  ): EnforcementDecision {
    const blockingTools: ToolName[] = [];
    const warningTools: ToolName[] = [];

    for (const result of results) {
      if (result.status === 'failed' || result.status === 'timed_out') {
        const toolPolicy = policy[result.tool];
        if (toolPolicy?.blockerOnFailure) {
          blockingTools.push(result.tool);
        } else if (toolPolicy?.warnOnFailure) {
          warningTools.push(result.tool);
        }
      }
    }

    const canProceed = blockingTools.length === 0 || !policy.failClosed;

    return {
      canProceed,
      blockingTools,
      warningTools,
      rationale: canProceed ? 'No blocking failures' : `Blocked by: ${blockingTools.join(', ')}`,
    };
  }

  private createSkippedResult(
    tool: ToolName,
    target: ToolExecutionTarget,
    mode: AutomationMode,
  ): ToolExecutionResult {
    return {
      tool,
      mode,
      status: 'skipped',
      durationMs: 0,
      exitCode: null,
      target,
      blockerCount: 0,
      warningCount: 0,
      issues: [],
      retryCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private createErrorResult(
    tool: ToolName,
    target: ToolExecutionTarget,
    mode: AutomationMode,
    error: string,
  ): ToolExecutionResult {
    return {
      tool,
      mode,
      status: 'failed',
      durationMs: 0,
      exitCode: null,
      target,
      blockerCount: 1,
      warningCount: 0,
      issues: [{ tool, severity: 'blocker', message: `Execution error: ${error}` }],
      retryCount: 0,
      timestamp: new Date().toISOString(),
    };
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const createAutomationRunner = (
  logger: Logger,
  registry: ToolAdapterRegistry,
  options?: RunnerOptions,
): AutomationRunner => {
  return new AutomationRunner(logger, registry, options);
};
