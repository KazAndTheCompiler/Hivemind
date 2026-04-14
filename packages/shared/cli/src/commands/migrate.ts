import fs from 'fs';
import path from 'path';
import { formatTable } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';

export async function migrateCommand(rootPath: string, args: string[], format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'migrate');
  const registryPath = path.join(rootPath, 'MIGRATION_REGISTRY.json');

  // Load migration registry if it exists
  let registry: any[] = [];
  if (fs.existsSync(registryPath)) {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  }

  // If no args, show migration status
  if (args.length === 0) {
    if (format === 'json') {
      console.log(JSON.stringify(registry, null, 2));
    } else {
      console.log('\n🔄 SecDev Labs — Migration Registry\n');
      if (registry.length === 0) {
        console.log('  No migrations registered.');
      } else {
        const rows = registry.map((r) => ({
          Legacy: r.legacyPath,
          Target: r.targetPackage,
          Domain: r.targetDomain,
          Status: r.status,
          Notes: r.notes,
        }));
        console.log(formatTable(rows, ['Legacy', 'Target', 'Domain', 'Status', 'Notes']));
      }

      // Also show legacy projects not yet migrated
      const legacyPath = path.join(rootPath, 'projects');
      if (fs.existsSync(legacyPath)) {
        const legacyFolders = fs.readdirSync(legacyPath, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);

        const migratedPaths = new Set(registry.map((r) => r.legacyPath));
        const pending = legacyFolders.filter((f) => !migratedPaths.has(`projects/${f}`));

        if (pending.length > 0) {
          console.log(`\n── Pending Migrations (${pending.length}) ──`);
          const pendingRows = pending.map((p) => ({
            Legacy: `projects/${p}`,
            Status: 'pending',
            Action: 'Run: secdev migrate <folder-name>',
          }));
          console.log(formatTable(pendingRows, ['Legacy', 'Status', 'Action']));
        }
      }
      console.log('');
    }
    return;
  }

  // If --register flag, register a migration
  if (args[0] === '--register' && args.length >= 5) {
    const [, legacyPath, targetDomain, targetPackage, status] = args;
    const notes = args.slice(5).join(' ') || '';

    const migration = {
      legacyPath,
      targetDomain,
      targetPackage,
      status: status ?? 'pending',
      migratedAt: new Date().toISOString(),
      notes,
    };

    registry.push(migration);
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    logger.info(`Registered migration: ${legacyPath} → ${targetPackage}`);
    return;
  }

  // If a legacy folder name is provided, show migration info
  const legacyFolder = args[0];
  const legacyPath = path.join(rootPath, 'projects', legacyFolder);

  if (!fs.existsSync(legacyPath)) {
    logger.error(`Legacy folder not found: projects/${legacyFolder}`);
    process.exit(1);
  }

  // Find matching migration record
  const existing = registry.find((r) => r.legacyPath === `projects/${legacyFolder}`);

  if (format === 'json') {
    console.log(JSON.stringify({
      legacyPath: `projects/${legacyFolder}`,
      exists: true,
      files: fs.readdirSync(legacyPath),
      migration: existing ?? null,
    }, null, 2));
  } else {
    console.log(`\n📁 Legacy Folder: projects/${legacyFolder}`);
    console.log(`   Files: ${fs.readdirSync(legacyPath).join(', ')}`);
    if (existing) {
      console.log(`\n🔄 Migration Status:`);
      console.log(`   Target: ${existing.targetPackage}`);
      console.log(`   Domain: ${existing.targetDomain}`);
      console.log(`   Status: ${existing.status}`);
      console.log(`   Notes: ${existing.notes}`);
    } else {
      console.log('\n🔄 Migration: Not yet registered');
      console.log(`   Run: secdev migrate --register projects/${legacyFolder} <domain> <package-id> <status>`);
    }
    console.log('');
  }
}
