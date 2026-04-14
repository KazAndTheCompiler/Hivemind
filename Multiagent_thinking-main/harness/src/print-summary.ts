#!/usr/bin/env node
/**
 * print-summary.ts — Print the latest test summary
 */

import * as fs from 'fs';
import * as path from 'path';

function findLatestResultsDir(): string | null {
  const resultsDir = './harness/results';
  
  if (!fs.existsSync(resultsDir)) {
    return null;
  }
  
  const dirs = fs.readdirSync(resultsDir)
    .filter(f => fs.statSync(path.join(resultsDir, f)).isDirectory())
    .map(f => ({ name: f, mtime: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.mtime - a.mtime);
  
  return dirs.length > 0 ? path.join(resultsDir, dirs[0].name) : null;
}

function printSummary(dir: string): void {
  const summaryPath = path.join(dir, 'summary.md');
  const aggregatePath = path.join(dir, 'aggregate.json');
  
  if (fs.existsSync(summaryPath)) {
    console.log(fs.readFileSync(summaryPath, 'utf-8'));
  } else if (fs.existsSync(aggregatePath)) {
    const aggregate = JSON.parse(fs.readFileSync(aggregatePath, 'utf-8'));
    console.log('# Latest Test Run Summary');
    console.log('');
    console.log(`**Date**: ${aggregate.timestamp}`);
    console.log(`**Total Scenarios**: ${aggregate.totalScenarios}`);
    console.log(`**Passed**: ${aggregate.passed}`);
    console.log(`**Failed**: ${aggregate.failed}`);
    console.log(`**Pass Rate**: ${(aggregate.overallPassRate * 100).toFixed(1)}%`);
    console.log('');
    console.log('## Individual Results');
    for (const s of aggregate.scenarios) {
      const status = s.passed ? '✅' : '❌';
      console.log(`- ${s.name}: ${status}`);
    }
  } else {
    console.log('No results found.');
  }
}

function main() {
  const latestDir = findLatestResultsDir();
  
  if (!latestDir) {
    console.log('No results found. Run tests first.');
    process.exit(1);
  }
  
  console.log(`Latest results: ${latestDir}`);
  console.log('');
  printSummary(latestDir);
}

main();