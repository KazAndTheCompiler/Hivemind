import fs from 'fs';
import path from 'path';
import { findPackages, loadMetadata, formatTable } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';

export async function inventoryCommand(rootPath: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'inventory');
  const packagesPath = path.join(rootPath, 'packages');

  if (!fs.existsSync(packagesPath)) {
    logger.error(`Packages directory not found: ${packagesPath}`);
    process.exit(1);
  }

  const packages = findPackages(packagesPath);
  const byDomain: Record<string, any[]> = {
    labs: [],
    tools: [],
    detections: [],
    defense: [],
    forensics: [],
    content: [],
    unknown: [],
  };

  for (const pkgPath of packages) {
    try {
      const meta = loadMetadata(pkgPath);
      const domain = meta.type ?? 'unknown';
      const domainKey = domain === 'lab' ? 'labs' : domain === 'tool' ? 'tools' : domain === 'detection' ? 'detections' : domain === 'defense' ? 'defense' : domain === 'forensics' ? 'forensics' : 'unknown';
      byDomain[domainKey].push({
        id: meta.id,
        title: meta.title,
        category: meta.category,
        riskLevel: meta.riskLevel,
        safetyBoundary: meta.safetyBoundary,
      });
    } catch {
      byDomain.unknown.push({
        id: path.basename(pkgPath),
        title: '(no metadata)',
        category: '?',
        riskLevel: '?',
        safetyBoundary: '?',
      });
    }
  }

  if (format === 'json') {
    console.log(JSON.stringify(byDomain, null, 2));
  } else {
    console.log('\n📚 SecDev Labs — Package Inventory\n');
    for (const [domain, pkgs] of Object.entries(byDomain)) {
      if (pkgs.length === 0) continue;
      console.log(`\n── ${domain.toUpperCase()} (${pkgs.length}) ──`);
      const rows = pkgs.map((p) => ({
        ID: p.id,
        Title: p.title,
        Category: p.category,
        Risk: p.riskLevel,
        Safety: p.safetyBoundary,
      }));
      console.log(formatTable(rows, ['ID', 'Title', 'Category', 'Risk', 'Safety']));
    }

    const total = Object.values(byDomain).reduce((sum, pkgs) => sum + pkgs.length, 0);
    console.log(`\n📊 Total: ${total} packages\n`);
  }
}
