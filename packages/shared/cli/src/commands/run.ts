import fs from 'fs';
import path from 'path';
import { findPackages, loadMetadata, getSafetyLabel } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';
import { ExecutionMode } from '@secdev/shared-types';

export async function runCommand(rootPath: string, packageId: string, mode: string = 'dry-run', format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'run', format === 'json' ? 'json' : 'human', mode as ExecutionMode);
  const packagesPath = path.join(rootPath, 'packages');
  const packages = findPackages(packagesPath);

  let found = false;
  for (const pkgPath of packages) {
    try {
      const meta = loadMetadata(pkgPath);
      if (meta.id === packageId) {
        found = true;
        const relPath = path.relative(rootPath, pkgPath);
        const mainScript = findMainScript(pkgPath);

        if (format === 'json') {
          console.log(JSON.stringify({
            id: meta.id,
            title: meta.title,
            mode,
            safetyBoundary: meta.safetyBoundary,
            script: mainScript,
            path: relPath,
          }, null, 2));
        } else {
          console.log(`\n🚀 Running: ${meta.title}`);
          console.log(`   ID:     ${meta.id}`);
          console.log(`   Mode:   ${mode}`);
          console.log(`   Safety: ${getSafetyLabel(meta.safetyBoundary)}`);
          console.log(`   Path:   ${relPath}`);

          // Safety checks
          if (meta.safetyBoundary === 'restricted-research' || meta.safetyBoundary === 'do-not-deploy') {
            console.log(`\n⚠️  WARNING: This package has restricted safety boundaries.`);
            console.log(`   It should only be run in isolated lab environments.`);
          }

          if (mainScript) {
            console.log(`\n📜 Main Script: ${mainScript}`);
            if (mode === 'dry-run') {
              console.log(`\n[DRY RUN] Would execute: python ${mainScript}`);
            } else if (mode === 'simulation') {
              console.log(`\n[SIMULATION] Would execute: python ${mainScript} --simulate`);
            } else {
              console.log(`\n[FULL EXECUTION] Would execute: python ${mainScript}`);
              console.log(`   ⚠️  Full execution of restricted labs requires --allow-restricted flag.`);
            }
          } else {
            console.log(`\n⚠️  No executable script found.`);
          }
          console.log('');
        }
        break;
      }
    } catch {
      // skip
    }
  }

  if (!found) {
    logger.error(`Package not found: ${packageId}`);
    process.exit(1);
  }
}

function findMainScript(pkgPath: string): string | null {
  // Look for the primary script file
  const extensions = ['.py', '.sh', '.js', '.ts'];
  try {
    const files = fs.readdirSync(pkgPath);
    for (const ext of extensions) {
      const match = files.find((f) => f.endsWith(ext) && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts') && f !== 'tsconfig.json');
      if (match) return match;
    }
  } catch {
    // ignore
  }
  return null;
}
