import { ComparisonResult, RunMetrics } from '../schemas/index.js';

export function compareMetrics(baseline: RunMetrics, emission: RunMetrics): ComparisonResult {
  const tokenSavings = baseline.totalTokens - emission.totalTokens;
  const tokenSavingsPercent = baseline.totalTokens > 0 
    ? (tokenSavings / baseline.totalTokens) * 100 
    : 0;
  
  const frontierCallReduction = baseline.frontierCalls - emission.frontierCalls;
  
  const complianceImprovement = baseline.complianceRate > 0
    ? emission.complianceRate - baseline.complianceRate
    : 0;
  
  return {
    baseline,
    emission,
    tokenSavings,
    tokenSavingsPercent,
    frontierCallReduction,
    complianceImprovement,
  };
}

export function generateComparisonMarkdown(result: ComparisonResult): string {
  const lines: string[] = [];
  
  lines.push('# Comparison Report');
  lines.push('');
  lines.push('| Metric | Baseline | Emission | Difference |');
  lines.push('|--------|----------|----------|------------|');
  lines.push(`| Total Tokens | ${result.baseline.totalTokens} | ${result.emission.totalTokens} | ${result.tokenSavings} (${result.tokenSavingsPercent.toFixed(1)}%) |`);
  lines.push(`| Frontier Calls | ${result.baseline.frontierCalls} | ${result.emission.frontierCalls} | ${result.frontierCallReduction} |`);
  lines.push(`| Worker Calls | ${result.baseline.workerCalls} | ${result.emission.workerCalls} | ${result.baseline.workerCalls - result.emission.workerCalls} |`);
  lines.push(`| Monitoring Overhead | ${result.baseline.monitoringOverhead} | ${result.emission.monitoringOverhead} | ${result.baseline.monitoringOverhead - result.emission.monitoringOverhead} |`);
  lines.push(`| Retry Count | ${result.baseline.retryCount} | ${result.emission.retryCount} | ${result.baseline.retryCount - result.emission.retryCount} |`);
  lines.push(`| Escalation Count | ${result.baseline.escalationCount} | ${result.emission.escalationCount} | ${result.baseline.escalationCount - result.emission.escalationCount} |`);
  lines.push(`| Compliance Rate | ${(result.baseline.complianceRate * 100).toFixed(1)}% | ${(result.emission.complianceRate * 100).toFixed(1)}% | ${result.complianceImprovement >= 0 ? '+' : ''}${result.complianceImprovement.toFixed(1)}% |`);
  lines.push(`| Avg Output Size | ${result.baseline.averageOutputSize.toFixed(0)} | ${result.emission.averageOutputSize.toFixed(0)} | ${(result.baseline.averageOutputSize - result.emission.averageOutputSize).toFixed(0)} |`);
  lines.push('');
  
  return lines.join('\n');
}

export class ComparisonEngine {
  compare(baseline: RunMetrics, emission: RunMetrics): ComparisonResult {
    return compareMetrics(baseline, emission);
  }
  
  generateMarkdown(result: ComparisonResult): string {
    return generateComparisonMarkdown(result);
  }
}