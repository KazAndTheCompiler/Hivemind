// OpenClaw CLI entry point

import { createOrchestrator } from '@openclaw/orchestrator';
import { createDaemon } from '@openclaw/daemon';
import { ConfigService } from '@openclaw/core-config';
import { createLogger } from '@openclaw/core-logging';

function printUsage(): void {
  console.log(`
OpenClaw CLI — Agent Coordination Scaffold

Usage:
  openclaw <command>

Commands:
  start             Start the orchestrator (foreground)
  daemon            Start the watch daemon
  status            Show orchestrator status
  help              Show this help message

Environment:
  OPENCLAW_CONFIG        Path to config file (JSON)
  OPENCLAW_LOG_LEVEL     Log level (trace|debug|info|warn|error)
  OPENCLAW_LOG_FORMAT    Log format (json|human)
  OPENCLAW_AUDIT_PATH    Path to audit store directory
`);
}

async function cmdStart(): Promise<void> {
  const logger = createLogger();
  logger.info('cli.start', { command: 'start' });

  const orchestrator = createOrchestrator();
  await orchestrator.start();

  logger.info('cli.orchestrator.running');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('cli.shutdown.signal', { signal: 'SIGTERM' });
    await orchestrator.shutdown('SIGTERM');
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('cli.shutdown.signal', { signal: 'SIGINT' });
    await orchestrator.shutdown('SIGINT');
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

async function cmdDaemon(): Promise<void> {
  const logger = createLogger();
  logger.info('cli.start', { command: 'daemon' });

  const daemon = createDaemon();
  await daemon.start();

  // Keep alive (daemon handles its own signals)
  await new Promise(() => {});
}

async function cmdStatus(): Promise<void> {
  try {
    const orchestrator = createOrchestrator();
    const status = orchestrator.status;
    console.log('OpenClaw Status:', JSON.stringify(status, null, 2));
  } catch (err) {
    console.error('Failed to get status:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function cmdConfig(): Promise<void> {
  try {
    const configService = ConfigService.fromFileOrDefaults(process.env.OPENCLAW_CONFIG);
    const config = configService.getConfig();
    const sources = configService.getSources();
    console.log('OpenClaw Config Sources:', JSON.stringify(sources, null, 2));
    console.log('OpenClaw Config:', JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to load config:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';

  switch (command) {
    case 'start':
      await cmdStart();
      break;
    case 'daemon':
      await cmdDaemon();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'config':
      await cmdConfig();
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
  console.error('CLI error:', err);
  process.exit(1);
});
