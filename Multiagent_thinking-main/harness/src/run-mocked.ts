#!/usr/bin/env node
/**
 * run-mocked.ts — Run tests with mocked outputs
 */

import { ScenarioRunner } from './scenario-runner.js';

async function main() {
  console.log('='.repeat(60));
  console.log('RUNNING MOCKED TESTS');
  console.log('='.repeat(60));
  console.log('');
  
  const runner = new ScenarioRunner({
    useMock: true,
    outputDir: './results',
    verbose: true,
  });
  
  const results = await runner.runAll([
    './harness/fixtures/3-agent-flow.json',
    './harness/fixtures/baseline-snake-game.json',
    './harness/fixtures/emission-snake-game.json',
  ]);
  
  const stats = runner.getAggregateStats();
  
  console.log('');
  console.log(`Mocked Tests: ${stats.passed}/${stats.total} passed`);
  
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(console.error);