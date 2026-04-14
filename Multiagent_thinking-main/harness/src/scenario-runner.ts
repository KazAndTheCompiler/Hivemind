import * as fs from 'fs';
import * as path from 'path';
import { ScenarioResult, RunMetrics } from './schemas/index.js';
import { BaselineRunner, EmissionRunner, RunnerConfig } from './runner.js';
import { createMockAdapter, createOpenRouterAdapter, ProviderManager } from './providers.js';
import { ComparisonEngine, compareMetrics } from './guards/comparison-engine.js';

export interface ScenarioConfig {
  scenarioId: string;
  useMock: boolean;
  outputDir: string;
  verbose: boolean;
}

const DEFAULT_SCENARIO_CONFIG: ScenarioConfig = {
  scenarioId: 'default',
  useMock: true,
  outputDir: './harness/results',
  verbose: false,
};

function loadFixture(fixturePath: string): unknown {
  const content = fs.readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content);
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function saveArtifact(dir: string, filename: string, content: string): void {
  ensureDir(dir);
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
}

function saveJsonArtifact(dir: string, filename: string, data: unknown): void {
  saveArtifact(dir, filename, JSON.stringify(data, null, 2));
}

function saveEventsJsonl(filePath: string, events: Array<{ timestamp: string; type: string; data: Record<string, unknown> }>): void {
  ensureDir(path.dirname(filePath));
  const content = events.map(e => JSON.stringify(e)).join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
}

export async function runScenario(
  scenario: unknown,
  config: ScenarioConfig
): Promise<ScenarioResult> {
  const scenarioObj = scenario as Record<string, unknown>;
  const flow = scenarioObj.flow as string;
  
  const providerManager = new ProviderManager();
  providerManager.register('mock', createMockAdapter());
  
  if (!config.useMock && process.env.OPENROUTER_API_KEY) {
    providerManager.register('openrouter', createOpenRouterAdapter(process.env.OPENROUTER_API_KEY));
    providerManager.setDefault('openrouter');
  } else {
    providerManager.setDefault('mock');
  }
  
  const runnerConfig: RunnerConfig = {
    provider: providerManager.getDefault(),
    maxIterations: 5,
    enableRetry: true,
    enableEscalation: true,
    outputDir: config.outputDir,
  };
  
  let result: ScenarioResult;
  
  if (flow === 'baseline') {
    const runner = new BaselineRunner(runnerConfig);
    result = await runner.run(
      scenarioObj.task as string,
      scenarioObj.files as string[] || []
    );
  } else {
    const runner = new EmissionRunner(runnerConfig);
    result = await runner.run(
      scenarioObj.task as string,
      scenarioObj.files as string[] || []
    );
  }
  
  result.scenarioId = scenarioObj.id as string || config.scenarioId;
  result.scenarioName = scenarioObj.name as string || flow;
  
  return result;
}

export async function runComparison(
  baselineScenario: unknown,
  emissionScenario: unknown,
  config: ScenarioConfig
): Promise<{ baseline: ScenarioResult; emission: ScenarioResult; comparison: ReturnType<typeof compareMetrics> }> {
  const baselineResult = await runScenario(baselineScenario, { ...config, scenarioId: 'baseline' });
  const emissionResult = await runScenario(emissionScenario, { ...config, scenarioId: 'emission' });
  
  const comparison = compareMetrics(baselineResult.metrics, emissionResult.metrics);
  
  return { baseline: baselineResult, emission: emissionResult, comparison };
}

export function saveScenarioResult(result: ScenarioResult, outputDir: string): void {
  const runId = result.scenarioId;
  const rawDir = path.join(outputDir, runId, 'raw');
  const normalizedDir = path.join(outputDir, runId, 'normalized');
  
  ensureDir(rawDir);
  ensureDir(normalizedDir);
  
  saveJsonArtifact(rawDir, 'scenario-result.json', result);
  saveJsonArtifact(normalizedDir, 'metrics.json', result.metrics);
  
  const summaryMd = generateSummaryMarkdown(result);
  saveArtifact(outputDir, `${runId}/summary.md`, summaryMd);
  saveArtifact(outputDir, `${runId}/metrics.json`, JSON.stringify(result.metrics, null, 2));
  saveArtifact(outputDir, `${runId}/errors.jsonl`, result.errors.map(e => JSON.stringify({ error: e })).join('\n'));
}

export function generateSummaryMarkdown(result: ScenarioResult): string {
  const lines: string[] = [];
  
  lines.push(`# ${result.scenarioName}`);
  lines.push('');
  lines.push(`**Scenario ID**: ${result.scenarioId}`);
  lines.push(`**Status**: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
  lines.push('');
  lines.push('## Metrics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Tokens | ${result.metrics.totalTokens} |`);
  lines.push(`| Frontier Calls | ${result.metrics.frontierCalls} |`);
  lines.push(`| Worker Calls | ${result.metrics.workerCalls} |`);
  lines.push(`| Monitoring Overhead | ${result.metrics.monitoringOverhead} |`);
  lines.push(`| Retry Count | ${result.metrics.retryCount} |`);
  lines.push(`| Escalation Count | ${result.metrics.escalationCount} |`);
  lines.push(`| Compliance Rate | ${(result.metrics.complianceRate * 100).toFixed(1)}% |`);
  lines.push(`| Avg Output Size | ${result.metrics.averageOutputSize.toFixed(0)} chars |`);
  lines.push('');
  
  if (result.errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push('');
  }
  
  lines.push('## Artifacts');
  lines.push('');
  lines.push(`- Raw: \`${result.artifacts.rawDir}/\``);
  lines.push(`- Normalized: \`${result.artifacts.normalizedDir}/\``);
  lines.push(`- Summary: \`${result.artifacts.summaryPath}\``);
  lines.push('');
  
  return lines.join('\n');
}

export function saveAggregateResults(results: ScenarioResult[], outputDir: string): void {
  const aggregate = {
    timestamp: new Date().toISOString(),
    totalScenarios: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    overallPassRate: results.filter(r => r.passed).length / results.length,
    scenarios: results.map(r => ({
      id: r.scenarioId,
      name: r.scenarioName,
      passed: r.passed,
      complianceRate: r.metrics.complianceRate,
      totalTokens: r.metrics.totalTokens,
    })),
  };
  
  saveJsonArtifact(outputDir, 'aggregate.json', aggregate);
  
  const summaryLines: string[] = [];
  summaryLines.push('# Test Run Summary');
  summaryLines.push('');
  summaryLines.push(`**Date**: ${aggregate.timestamp}`);
  summaryLines.push(`**Total Scenarios**: ${aggregate.totalScenarios}`);
  summaryLines.push(`**Passed**: ${aggregate.passed}`);
  summaryLines.push(`**Failed**: ${aggregate.failed}`);
  summaryLines.push(`**Pass Rate**: ${(aggregate.overallPassRate * 100).toFixed(1)}%`);
  summaryLines.push('');
  summaryLines.push('## Scenario Results');
  summaryLines.push('');
  summaryLines.push('| Scenario | Status | Compliance | Tokens |');
  summaryLines.push('|----------|--------|------------|--------|');
  
  for (const s of aggregate.scenarios) {
    const status = s.passed ? '✅' : '❌';
    summaryLines.push(`| ${s.name} | ${status} | ${(s.complianceRate * 100).toFixed(1)}% | ${s.totalTokens} |`);
  }
  
  summaryLines.push('');
  
  saveArtifact(outputDir, 'summary.md', summaryLines.join('\n'));
}

export class ScenarioRunner {
  private config: ScenarioConfig;
  private results: ScenarioResult[] = [];
  
  constructor(config: Partial<ScenarioConfig> = {}) {
    this.config = { ...DEFAULT_SCENARIO_CONFIG, ...config };
  }
  
  async runAll(fixturePaths: string[]): Promise<ScenarioResult[]> {
    this.results = [];
    
    for (const fixturePath of fixturePaths) {
      const scenario = loadFixture(fixturePath);
      const result = await runScenario(scenario, this.config);
      this.results.push(result);
      saveScenarioResult(result, this.config.outputDir);
    }
    
    saveAggregateResults(this.results, this.config.outputDir);
    
    return this.results;
  }
  
  async runSingle(fixturePath: string): Promise<ScenarioResult> {
    const scenario = loadFixture(fixturePath);
    const result = await runScenario(scenario, this.config);
    this.results.push(result);
    saveScenarioResult(result, this.config.outputDir);
    return result;
  }
  
  async runComparison(baselinePath: string, emissionPath: string) {
    const baseline = loadFixture(baselinePath);
    const emission = loadFixture(emissionPath);
    return runComparison(baseline, emission, this.config);
  }
  
  getResults(): ScenarioResult[] {
    return [...this.results];
  }
  
  getAggregateStats() {
    const passed = this.results.filter(r => r.passed).length;
    return {
      total: this.results.length,
      passed,
      failed: this.results.length - passed,
      passRate: passed / Math.max(this.results.length, 1),
    };
  }
}