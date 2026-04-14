#!/usr/bin/env node
/**
 * run-baseline.ts — Run baseline comparison
 */

import { ScenarioRunner } from './scenario-runner.js';
import * as path from 'path';

async function main() {
  console.log('='.repeat(60));
  console.log('BASELINE VS EMISSION COMPARISON');
  console.log('='.repeat(60));
  console.log('');
  
  const runner = new ScenarioRunner({
    useMock: !process.env.OPENROUTER_API_KEY,
    outputDir: './results',
    verbose: true,
  });
  
  const { baseline, emission, comparison } = await runner.runComparison(
    path.join('./harness/fixtures', 'baseline-snake-game.json'),
    path.join('./harness/fixtures', 'emission-snake-game.json')
  );
  
  console.log('');
  console.log('='.repeat(60));
  console.log('COMPARISON RESULTS');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Token Savings: ${comparison.tokenSavings} (${comparison.tokenSavingsPercent.toFixed(1)}%)`);
  console.log(`Frontier Call Reduction: ${comparison.frontierCallReduction}`);
  console.log(`Compliance Improvement: ${comparison.complianceImprovement >= 0 ? '+' : ''}${comparison.complianceImprovement.toFixed(1)}%`);
  console.log('');
  
  if (comparison.tokenSavingsPercent > 0) {
    console.log('✅ EMISSION SAVES TOKENS');
  } else {
    console.log('⚠️ BASELINE USED FEWER TOKENS');
  }
}

main().catch(console.error);