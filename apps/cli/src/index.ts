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
  status            Show orchestrator health status
  health            Show orchestrator health (alias for status)
  config            Show current configuration
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

  const shutdown = async (signal: string) => {
    logger.info('cli.shutdown.signal', { signal });
    await orchestrator.shutdown(signal);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await new Promise(() => {});
}

async function cmdDaemon(): Promise<void> {
  const logger = createLogger();
  logger.info('cli.start', { command: 'daemon' });

  const daemon = createDaemon();
  await daemon.start();

  logger.info('cli.daemon.running');

  const shutdown = async (signal: string) => {
    logger.info('cli.shutdown.signal', { signal });
    await daemon.shutdown(signal);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await new Promise(() => {});
}

async function cmdStatus(): Promise<void> {
  try {
    const orchestrator = createOrchestrator();
    const status = orchestrator.getHealth();
    console.log('OpenClaw Health:', JSON.stringify(status, null, 2));
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
    case 'health':
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
