import fs from 'fs';
import path from 'path';
import { loadMetadata, findPackages, getSafetyLabel, getRiskBadge, formatTable } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';

export async function listCommand(rootPath: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'list');
  const packagesPath = path.join(rootPath, 'packages');

  if (!fs.existsSync(packagesPath)) {
    logger.error(`Packages directory not found: ${packagesPath}`);
    process.exit(1);
  }

  const packages = findPackages(packagesPath);
  const rows: any[] = [];

  for (const pkgPath of packages) {
    try {
      const meta = loadMetadata(pkgPath);
      const relPath = path.relative(rootPath, pkgPath);
      rows.push({
        ID: meta.id,
        Type: meta.type,
        Title: meta.title,
        Category: meta.category,
        Risk: getRiskBadge(meta.riskLevel),
        Safety: getSafetyLabel(meta.safetyBoundary),
        Path: relPath,
      });
    } catch (err) {
      const relPath = path.relative(rootPath, pkgPath);
      rows.push({
        ID: '(no metadata)',
        Type: '?',
        Title: path.basename(pkgPath),
        Category: '?',
        Risk: '?',
        Safety: '?',
        Path: relPath,
      });
    }
  }

  if (format === 'json') {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    logger.info(`Found ${rows.length} packages`);
    console.log('');
    console.log(formatTable(rows, ['ID', 'Type', 'Title', 'Category', 'Risk', 'Safety', 'Path']));
  }
}
