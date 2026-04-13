import fs from 'fs';
import path from 'path';
import { loadMetadata, findPackages, getSafetyLabel, getRiskBadge } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';

export async function infoCommand(rootPath: string, packageId: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'info');
  const packagesPath = path.join(rootPath, 'packages');
  const packages = findPackages(packagesPath);

  let found = false;
  for (const pkgPath of packages) {
    try {
      const meta = loadMetadata(pkgPath);
      if (meta.id === packageId) {
        found = true;
        const relPath = path.relative(rootPath, pkgPath);

        if (format === 'json') {
          console.log(JSON.stringify(meta, null, 2));
        } else {
          console.log(`\n📦 ${meta.title}`);
          console.log(`   ID:       ${meta.id}`);
          console.log(`   Type:     ${meta.type}`);
          console.log(`   Category: ${meta.category}`);
          console.log(`   Language: ${meta.language}`);
          console.log(`   Maturity: ${meta.maturity}`);
          console.log(`   Risk:     ${getRiskBadge(meta.riskLevel)}`);
          console.log(`   Safety:   ${getSafetyLabel(meta.safetyBoundary)}`);
          console.log(`   Path:     ${relPath}`);
          console.log(`   Tags:     ${(meta.tags ?? []).join(', ') || '(none)'}`);
          console.log(`\n📝 ${meta.summary}`);
          if (meta.prerequisites && meta.prerequisites.length > 0) {
            console.log(`\n📋 Prerequisites:`);
            for (const p of meta.prerequisites) console.log(`   • ${p}`);
          }
          if (meta.setupSteps && meta.setupSteps.length > 0) {
            console.log(`\n🔧 Setup Steps:`);
            for (const s of meta.setupSteps) console.log(`   ${s}`);
          }
          if (meta.docsPath) {
            console.log(`\n📖 Docs: ${meta.docsPath}`);
          }
          console.log(`\n📜 Legacy: ${meta.sourceLegacyPath || '(none)'}`);
        }
        break;
      }
    } catch {
      // skip packages without metadata
    }
  }

  if (!found) {
    logger.error(`Package not found: ${packageId}`);
    process.exit(1);
  }
}
