#!/usr/bin/env node
/**
 * drift-test.ts - Run 50 iterations to detect compliance drift
 */

import { ScenarioRunner } from './scenario-runner.js';
import * as fs from 'fs';
import * as path from 'path';

const ITERATIONS = 50;
const OUTPUT_DIR = './harness/results/drift-test';

interface DriftResult {
  iteration: number;
  passed: boolean;
  complianceRate: number;
  totalTokens: number;
  errors: string[];
  timestamp: string;
}

async function runDriftTest(): Promise<void> {
  console.log(`Starting drift test: ${ITERATIONS} iterations...`);
  console.log('');
  
  const results: DriftResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    const runner = new ScenarioRunner({
      useMock: true,
      outputDir: OUTPUT_DIR,
      verbose: false,
    });
    
    const result = await runner.runSingle('./harness/fixtures/emission-snake-game.json');
    
    const driftResult: DriftResult = {
      iteration: i + 1,
      passed: result.passed,
      complianceRate: result.metrics.complianceRate,
      totalTokens: result.metrics.totalTokens,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    };
    
    results.push(driftResult);
    
    if (result.passed) {
      passed++;
      process.stdout.write('✅');
    } else {
      failed++;
      process.stdout.write('❌');
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` [${i + 1}/${ITERATIONS}]\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n');
  console.log('='.repeat(60));
  console.log('DRIFT TEST RESULTS');
  console.log('='.repeat(60));
  console.log('');
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const complianceRates = results.map(r => r.complianceRate);
  const tokenCounts = results.map(r => r.totalTokens);
  
  const avgCompliance = complianceRates.reduce((a, b) => a + b, 0) / complianceRates.length;
  const minCompliance = Math.min(...complianceRates);
  const maxCompliance = Math.max(...complianceRates);
  
  const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const minTokens = Math.min(...tokenCounts);
  const maxTokens = Math.max(...tokenCounts);
  
  console.log(`Total Runs: ${ITERATIONS}`);
  console.log(`Passed: ${totalPassed} (${((totalPassed / ITERATIONS) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${totalFailed} (${((totalFailed / ITERATIONS) * 100).toFixed(1)}%)`);
  console.log('');
  console.log('Compliance Rate:');
  console.log(`  Average: ${(avgCompliance * 100).toFixed(1)}%`);
  console.log(`  Min: ${(minCompliance * 100).toFixed(1)}%`);
  console.log(`  Max: ${(maxCompliance * 100).toFixed(1)}%`);
  console.log('');
  console.log('Token Count:');
  console.log(`  Average: ${avgTokens.toFixed(0)}`);
  console.log(`  Min: ${minTokens}`);
  console.log(`  Max: ${maxTokens}`);
  console.log('');
  
  const complianceDrift = maxCompliance - minCompliance;
  const tokenDrift = maxTokens - minTokens;
  
  console.log('Drift Detection:');
  console.log(`  Compliance drift: ${(complianceDrift * 100).toFixed(1)}% ${complianceDrift > 0.1 ? '(⚠️ DRIFT DETECTED)' : '(✅ STABLE)'}`);
  console.log(`  Token drift: ${tokenDrift} ${tokenDrift > 100 ? '(⚠️ DRIFT DETECTED)' : '(✅ STABLE)'}`);
  console.log('');
  
  if (failed > 0) {
    const failureTypes = new Map<string, number>();
    for (const r of results) {
      for (const e of r.errors) {
        const type = e.split(':')[0];
        failureTypes.set(type, (failureTypes.get(type) || 0) + 1);
      }
    }
    console.log('Failure Types:');
    for (const [type, count] of failureTypes) {
      console.log(`  ${type}: ${count}`);
    }
  }
  
  const summary = {
    timestamp: new Date().toISOString(),
    iterations: ITERATIONS,
    passed: totalPassed,
    failed: totalFailed,
    complianceDrift,
    tokenDrift,
    results: results,
  };
  
  const summaryPath = path.join(OUTPUT_DIR, 'drift-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nDetailed results saved to: ${summaryPath}`);
  
  if (complianceDrift <= 0.1 && tokenDrift <= 100) {
    console.log('\n✅ THESIS STABLE - No significant drift detected');
  } else {
    console.log('\n⚠️ DRIFT DETECTED - Compliance or output varied significantly');
  }
}

runDriftTest().catch(console.error);