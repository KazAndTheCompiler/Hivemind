#!/usr/bin/env node

import path from 'path';
import { listCommand } from './commands/list';
import { infoCommand } from './commands/info';
import { runCommand } from './commands/run';
import { validateCommand } from './commands/validate';
import { doctorCommand } from './commands/doctor';
import { inventoryCommand } from './commands/inventory';
import { graphCommand } from './commands/graph';
import { migrateCommand } from './commands/migrate';

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(`
secdev — SecDev Labs CLI v${VERSION}

Usage:
  secdev <command> [options]

Commands:
  list                List all packages in the monorepo
  info <id>           Show detailed information about a package
  run <id> [mode]     Run a lab or tool (mode: dry-run|simulation|analysis-only|full-execution)
  validate            Validate metadata for all packages
  doctor              Run health checks on the monorepo
  inventory           Show package inventory grouped by domain
  graph               Show package dependency graph
  migrate [args]      Manage legacy project migrations
  help                Show this help message
  version             Show version

Options:
  --format <json|human>  Output format (default: human)
  --root <path>          Root directory (default: current directory)

Examples:
  secdev list
  secdev list --format json
  secdev info lab-honeypot-basic
  secdev run lab-honeypot-basic dry-run
  secdev validate
  secdev doctor
  secdev inventory
  secdev graph
  secdev migrate
  secdev migrate --register projects/01-honeypot-basic labs @secdev/lab-honeypot-basic completed
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse global options
  const format = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'human';
  const rootPath = args.includes('--root') ? args[args.indexOf('--root') + 1] : process.cwd();

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'version') {
    console.log(`secdev v${VERSION}`);
    return;
  }

  try {
    switch (command) {
      case 'list':
        await listCommand(rootPath, format as 'human' | 'json');
        break;
      case 'info':
        if (!args[1]) {
          console.error('Error: info requires a package ID');
          console.error('Usage: secdev info <id>');
          process.exit(1);
        }
        await infoCommand(rootPath, args[1], format as 'human' | 'json');
        break;
      case 'run':
        if (!args[1]) {
          console.error('Error: run requires a package ID');
          console.error('Usage: secdev run <id> [mode]');
          process.exit(1);
        }
        await runCommand(rootPath, args[1], args[2] ?? 'dry-run', format as 'human' | 'json');
        break;
      case 'validate':
        await validateCommand(rootPath, format as 'human' | 'json');
        break;
      case 'doctor':
        await doctorCommand(rootPath, format as 'human' | 'json');
        break;
      case 'inventory':
        await inventoryCommand(rootPath, format as 'human' | 'json');
        break;
      case 'graph':
        await graphCommand(rootPath, format as 'human' | 'json');
        break;
      case 'migrate':
        await migrateCommand(rootPath, args.slice(1), format as 'human' | 'json');
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "secdev help" for usage information');
        process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
