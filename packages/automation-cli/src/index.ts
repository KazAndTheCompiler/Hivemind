// CLI for automation enforcement
// Commands: fast, checkpoint, full, status, summary

import { createLogger } from '@openclaw/core-logging';
import { DEFAULT_ENFORCEMENT_POLICY } from '@openclaw/automation-core';
import { AutomationRunner, LocalToolAdapterRegistry } from '@openclaw/automation-runner';
import { PrettierAdapter } from '@openclaw/tool-prettier/src/adapter';
import { EslintAdapter } from '@openclaw/tool-eslint/src/adapter';
import { TscAdapter } from '@openclaw/tool-tsc/src/index';
import { KnipAdapter } from '@openclaw/tool-knip/src/index';
import { SummaryEmitter } from '@openclaw/automation-summary';
import { createInMemoryAuditStore, createAutomationAuditLogger } from '@openclaw/automation-audit';
import type { ToolExecutionTarget } from '@openclaw/automation-core';

const logger = createLogger();

function printUsage(): void {
  console.log(`
OpenClaw Automation CLI

Usage:
  openclaw-automation <command> [options]

Commands:
  fast           Run fast-loop enforcement on changed files
  checkpoint     Run checkpoint enforcement with knip and GitNexus
  full           Run full repo enforcement
  status         Show last run status
  summary        Emit condensed summary (200 tokens)
  help           Show this help

Options:
  --files <list>   Comma-separated list of changed files
  --dry-run        Show what would run without executing
`);
}

async function runFastLoop(files: string[]): Promise<void> {
  console.log('Running fast-loop enforcement...');

  const registry = new LocalToolAdapterRegistry();
  registry.register(new PrettierAdapter(logger));
  registry.register(new EslintAdapter(logger));
  registry.register(new TscAdapter(logger));

  const runner = new AutomationRunner(logger, registry, { parallel: true });

  const target: ToolExecutionTarget = {
    files,
    packages: [],
    patterns: [],
  };

  const run = await runner.runFastLoop(target, DEFAULT_ENFORCEMENT_POLICY);

  const emitter = new SummaryEmitter();
  console.log(emitter.emitFastSummary(run));

  const auditLogger = createAutomationAuditLogger();
  auditLogger.logRunCompleted(run);

  if (!run.decision?.canProceed) {
    console.log('\nBlocked: Fix issues before continuing');
    process.exit(1);
  }
}

async function runCheckpoint(files: string[]): Promise<void> {
  console.log('Running checkpoint enforcement...');

  const registry = new LocalToolAdapterRegistry();
  registry.register(new PrettierAdapter(logger));
  registry.register(new EslintAdapter(logger));
  registry.register(new TscAdapter(logger));
  registry.register(new KnipAdapter(logger));

  const runner = new AutomationRunner(logger, registry, { parallel: false });

  const target: ToolExecutionTarget = {
    files,
    packages: [],
    patterns: [],
  };

  const run = await runner.runCheckpoint(target, DEFAULT_ENFORCEMENT_POLICY);

  const emitter = new SummaryEmitter();
  console.log(emitter.emitCheckpointSummary(run));

  if (!run.decision?.canProceed) {
    console.log('\nBlocked: Fix issues before continuing');
    process.exit(1);
  }
}

async function runFullRepo(): Promise<void> {
  console.log('Running full repo enforcement...');

  const registry = new LocalToolAdapterRegistry();
  registry.register(new PrettierAdapter(logger));
  registry.register(new EslintAdapter(logger));
  registry.register(new TscAdapter(logger));
  registry.register(new KnipAdapter(logger));

  const runner = new AutomationRunner(logger, registry, { parallel: false });

  const target: ToolExecutionTarget = {
    files: [],
    packages: [],
    patterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
  };

  const run = await runner.runFullRepo(target, DEFAULT_ENFORCEMENT_POLICY);

  const emitter = new SummaryEmitter();
  console.log(emitter.emitFullRepoSummary(run));

  const auditLogger = createAutomationAuditLogger();
  auditLogger.logRunCompleted(run);

  if (!run.decision?.canProceed) {
    console.log('\nBlocked: Fix issues before continuing');
    process.exit(1);
  }
}

async function showStatus(): Promise<void> {
  const store = createInMemoryAuditStore();
  const recent = store.getRecent(10);

  if (recent.length === 0) {
    console.log('No automation runs recorded');
    return;
  }

  console.log('Recent automation events:');
  for (const event of recent) {
    console.log(`  [${event.timestamp}] ${event.type}${event.runId ? ` (${event.runId})` : ''}`);
  }
}

async function emitSummary(): Promise<void> {
  const store = createInMemoryAuditStore();
  const runs = store.getByType('run_completed');

  if (runs.length === 0) {
    console.log('No completed runs to summarize');
    return;
  }

  const lastRun = runs[runs.length - 1];
  console.log('Last run summary:');
  console.log(JSON.stringify(lastRun.payload, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';

  switch (command) {
    case 'fast': {
      const filesArgIndex = process.argv.findIndex((a) => a === '--files');
      const files = filesArgIndex > 0 ? process.argv[filesArgIndex + 1].split(',') : ['src/**/*.ts'];
      await runFastLoop(files);
      break;
    }
    case 'checkpoint': {
      const filesArgIndex = process.argv.findIndex((a) => a === '--files');
      const files = filesArgIndex > 0 ? process.argv[filesArgIndex + 1].split(',') : ['src/**/*.ts'];
      await runCheckpoint(files);
      break;
    }
    case 'full':
      await runFullRepo();
      break;
    case 'status':
      await showStatus();
      break;
    case 'summary':
      await emitSummary();
      break;
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Automation CLI error:', err);
  process.exit(1);
});