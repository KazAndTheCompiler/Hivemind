import { ProviderAdapter, createMockAdapter } from './providers.js';
import { TypeScriptGuard, SemanticGuard } from './guards/index.js';
import { OllamaFilter } from './guards/ollama-filter.js';
import { RetryRunner, EscalationEngine } from './guards/index.js';
import { 
  RunMetrics, 
  ScenarioResult, 
  ArtifactPaths,
  Phase 
} from './schemas/index.js';

export interface RunnerConfig {
  provider: ProviderAdapter;
  maxIterations: number;
  enableRetry: boolean;
  enableEscalation: boolean;
  outputDir: string;
}

export interface RunEvent {
  timestamp: string;
  type: 'call' | 'validation' | 'retry' | 'escalation' | 'guard';
  data: Record<string, unknown>;
}

const DEFAULT_CONFIG: RunnerConfig = {
  provider: createMockAdapter(),
  maxIterations: 5,
  enableRetry: true,
  enableEscalation: true,
  outputDir: './results',
};

export abstract class BaseRunner {
  protected config: RunnerConfig;
  protected tsGuard: TypeScriptGuard;
  protected semGuard: SemanticGuard;
  protected ollamaFilter: OllamaFilter;
  protected retryRunner: RetryRunner;
  protected escalationEngine: EscalationEngine;
  protected events: RunEvent[];
  
  constructor(config: Partial<RunnerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tsGuard = new TypeScriptGuard('Progress', ['phase', 'done', 'blockers']);
    this.semGuard = new SemanticGuard();
    this.ollamaFilter = new OllamaFilter();
    this.retryRunner = new RetryRunner();
    this.escalationEngine = new EscalationEngine();
    this.events = [];
  }
  
  protected async callModel(prompt: string, system: string, interfaceName: string, maxTokens = 150): Promise<string> {
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ];
    
    const response = await this.config.provider.call('default', messages, maxTokens);
    return response.content;
  }
  
  protected validateOutput(raw: string, interfaceName: string): { passed: boolean; issues: string[] } {
    const result = this.tsGuard.validate(raw);
    
    if (!result.passed) {
      return { passed: false, issues: result.issues };
    }
    
    const semResult = this.semGuard.validateFromRaw(raw);
    if (!semResult.passed) {
      return { passed: false, issues: semResult.issues };
    }
    
    return { passed: true, issues: [] };
  }
  
  protected recordEvent(type: RunEvent['type'], data: Record<string, unknown>): void {
    this.events.push({
      timestamp: new Date().toISOString(),
      type,
      data,
    });
  }
  
  protected createMetrics(): RunMetrics {
    return {
      totalTokens: 0,
      frontierCalls: 0,
      workerCalls: 0,
      monitoringOverhead: 0,
      retryCount: 0,
      escalationCount: 0,
      complianceRate: 0,
      averageOutputSize: 0,
    };
  }
  
  protected async runWithRetry<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<{ success: boolean; result?: T; retries: number }> {
    const result = await this.retryRunner.run(fn);
    return {
      success: result.success,
      result: result.result as T | undefined,
      retries: result.retryCount,
    };
  }
  
  abstract run(task: string, files?: string[]): Promise<ScenarioResult>;
  
  protected createArtifactPaths(runId: string): ArtifactPaths {
    return {
      rawDir: `${this.config.outputDir}/${runId}/raw`,
      normalizedDir: `${this.config.outputDir}/${runId}/normalized`,
      summaryPath: `${this.config.outputDir}/${runId}/summary.md`,
      metricsPath: `${this.config.outputDir}/${runId}/metrics.json`,
      eventsPath: `${this.config.outputDir}/${runId}/events.jsonl`,
    };
  }
}

export class BaselineRunner extends BaseRunner {
  async run(task: string, files: string[] = []): Promise<ScenarioResult> {
    const metrics = this.createMetrics();
    const errors: string[] = [];
    
    this.recordEvent('call', { phase: 'baseline_start', task });
    
    for (let i = 0; i < this.config.maxIterations; i++) {
      this.recordEvent('call', { phase: 'frontier_planning', iteration: i });
      metrics.frontierCalls++;
      
      const planning = await this.callModel(
        `Task: ${task}\nFiles: ${files.join(', ')}\n\nPlan this task thoroughly. Explain your approach and potential challenges.`,
        'You are a senior developer planning a task. Be detailed and thorough.',
        'Progress',
        300
      );
      
      metrics.totalTokens += 150;
      
      const validation = this.validateOutput(planning, 'Progress');
      if (!validation.passed) {
        errors.push(`Iteration ${i}: ${validation.issues.join(', ')}`);
      }
      
      this.recordEvent('call', { phase: 'small_work', iteration: i });
      metrics.workerCalls++;
      
      const work = await this.callModel(
        `Task: ${task}\n\nExecute and report your progress in detail.`,
        'You are a sub-agent executing a task. Be thorough.',
        'Progress',
        200
      );
      
      metrics.totalTokens += 120;
      metrics.averageOutputSize += work.length;
      
      this.recordEvent('call', { phase: 'frontier_monitoring', iteration: i });
      metrics.frontierCalls++;
      metrics.monitoringOverhead += 100;
      
      await this.callModel(
        `Result: ${work}\n\nReview and provide guidance.`,
        'You are a monitoring agent. Be thorough in your review.',
        'Progress',
        200
      );
      
      metrics.totalTokens += 120;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    metrics.averageOutputSize = metrics.averageOutputSize / Math.max(metrics.frontierCalls, 1);
    metrics.complianceRate = (metrics.frontierCalls - errors.length) / Math.max(metrics.frontierCalls, 1);
    
    const runId = `baseline-${Date.now()}`;
    
    return {
      scenarioId: runId,
      scenarioName: 'baseline',
      passed: errors.length === 0,
      metrics,
      errors,
      artifacts: this.createArtifactPaths(runId),
    };
  }
}

export class EmissionRunner extends BaseRunner {
  async run(task: string, files: string[] = []): Promise<ScenarioResult> {
    const metrics = this.createMetrics();
    const errors: string[] = [];
    
    this.recordEvent('call', { phase: 'emission_start', task });
    
    this.recordEvent('call', { phase: 'frontier_adr', iteration: 0 });
    metrics.frontierCalls++;
    
    const adrSystem = `OUTPUT ONLY a TypeScript interface. Nothing else.

interface ADRSchema {
    taskId: string;
    agent: string;
    objective: string;
    ownedFiles: string[];
    constraints?: string[];
}

Fill in the ADR for this task. TypeScript only - no prose, no markdown.`;
    
    const adr = await this.callModel(
      `Task: ${task}\nFiles: ${files.join(', ')}\n\nCreate an ADR.`,
      adrSystem,
      'ADRSchema',
      200
    );
    
    metrics.totalTokens += 100;
    metrics.averageOutputSize += adr.length;
    
    this.recordEvent('guard', { phase: 'adr_validation', raw: adr.slice(0, 100) });
    
    for (let i = 0; i < this.config.maxIterations; i++) {
      this.recordEvent('call', { phase: 'worker_progress', iteration: i });
      metrics.workerCalls++;
      
      const progressSystem = `OUTPUT ONLY a TypeScript interface. Nothing else.

interface Progress {
    taskId: string;
    agent: string;
    phase: "init" | "analysis" | "implementation" | "testing" | "verification" | "complete";
    done: string[];
    blockers: string[];
    touchedFiles?: string[];
}

Fill in your progress. TypeScript only - no prose, no markdown.`;
      
      const progress = await this.callModel(
        `ADR: ${adr.slice(0, 200)}\n\nExecute the plan. Report progress.`,
        progressSystem,
        'Progress',
        150
      );
      
      metrics.totalTokens += 80;
      metrics.averageOutputSize += progress.length;
      
      const validation = this.validateOutput(progress, 'Progress');
      if (!validation.passed) {
        errors.push(`Iteration ${i}: ${validation.issues.join(', ')}`);
        this.recordEvent('validation', { iteration: i, issues: validation.issues });
      }
      
      this.recordEvent('guard', { phase: 'ollama_filter', iteration: i });
      const condensed = this.ollamaFilter.condenseRaw('worker-1', 'implementation', ['work done'], []);
      
      if (condensed.blockers.length > 0) {
        const escalation = this.escalationEngine.check(['work done'], condensed.blockers, 'implementation');
        if (escalation) {
          this.recordEvent('escalation', { escalation });
          metrics.escalationCount++;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    metrics.complianceRate = (metrics.workerCalls - errors.length) / Math.max(metrics.workerCalls, 1);
    
    const runId = `emission-${Date.now()}`;
    
    return {
      scenarioId: runId,
      scenarioName: 'emission',
      passed: errors.length === 0,
      metrics,
      errors,
      artifacts: this.createArtifactPaths(runId),
    };
  }
}