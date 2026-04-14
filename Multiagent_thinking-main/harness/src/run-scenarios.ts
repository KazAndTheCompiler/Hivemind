#!/usr/bin/env node
/**
 * run-scenarios.ts — Run all test scenarios and save results
 */

import { ScenarioRunner } from './scenario-runner.js';
import * as path from 'path';

const FIXTURES_DIR = './harness/fixtures';
const RESULTS_DIR = './harness/results';

const fixtures = [
  'baseline-snake-game.json',
  'emission-snake-game.json',
  'failure-loop.json',
  'overlap-conflict.json',
  'cross-file-dependency.json',
  '3-agent-flow.json',
  'provider-switching.json',
  '15-step-loop.json',
];

async function main() {
  const useMock = process.env.OPENROUTER_API_KEY ? false : true;
  const verbose = process.argv.includes('--verbose');
  
  console.log('='.repeat(60));
  console.log('EMISSION HARNESS - RUNNING SCENARIOS');
  console.log('='.repeat(60));
  console.log(`Mode: ${useMock ? 'MOCK' : 'REAL API'}`);
  console.log(`Results: ${RESULTS_DIR}`);
  console.log('');
  
  const runner = new ScenarioRunner({
    useMock,
    outputDir: RESULTS_DIR,
    verbose,
  });
  
  const fixturePaths = fixtures.map(f => path.join(FIXTURES_DIR, f));
  
  console.log(`Running ${fixtures.length} scenarios...`);
  console.log('');
  
  const results = await runner.runAll(fixturePaths);
  
  const stats = runner.getAggregateStats();
  
  console.log('');
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${stats.total}`);
  console.log(`Passed: ${stats.passed}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Pass Rate: ${(stats.passRate * 100).toFixed(1)}%`);
  console.log('');
  console.log(`Results saved to: ${RESULTS_DIR}/`);
  
  if (stats.failed > 0) {
    console.log('');
    console.log('FAILED SCENARIOS:');
    for (const r of results) {
      if (!r.passed) {
        console.log(`  - ${r.scenarioName}: ${r.errors.join(', ')}`);
      }
    }
  }
  
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});