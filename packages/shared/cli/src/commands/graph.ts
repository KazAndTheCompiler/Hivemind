import fs from 'fs';
import path from 'path';
import { findPackages, loadMetadata, formatTable } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';
import type { LabMetadata } from '@secdev/shared-types';

export async function graphCommand(rootPath: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'graph');
  const packagesPath = path.join(rootPath, 'packages');

  if (!fs.existsSync(packagesPath)) {
    logger.error(`Packages directory not found: ${packagesPath}`);
    process.exit(1);
  }

  const packages = findPackages(packagesPath);
  const nodes: { id: string; type: string; title: string; domain: string }[] = [];
  const edges: { from: string; to: string; label: string }[] = [];

  for (const pkgPath of packages) {
    try {
      const meta = loadMetadata(pkgPath) as LabMetadata;
      const domain = meta.type === 'lab' ? 'labs' : meta.type === 'tool' ? 'tools' : meta.type === 'detection' ? 'detections' : meta.type === 'defense' ? 'defense' : meta.type === 'forensics' ? 'forensics' : 'unknown';
      nodes.push({
        id: meta.id,
        type: meta.type,
        title: meta.title,
        domain,
      });

      // Add edges for prerequisites (packages that reference other packages)
      if (meta.prerequisites) {
        for (const prereq of meta.prerequisites) {
          edges.push({
            from: meta.id,
            to: prereq,
            label: 'requires',
          });
        }
      }
    } catch {
      // skip packages without metadata
    }
  }

  if (format === 'json') {
    console.log(JSON.stringify({ nodes, edges }, null, 2));
  } else {
    console.log('\n🔗 SecDev Labs — Package Graph\n');
    console.log(`  Nodes: ${nodes.length}`);
    console.log(`  Edges: ${edges.length}`);
    console.log('\n── Nodes by Domain ──');
    const rows = nodes.map((n) => ({
      ID: n.id,
      Type: n.type,
      Title: n.title,
      Domain: n.domain,
    }));
    console.log(formatTable(rows, ['ID', 'Type', 'Title', 'Domain']));

    if (edges.length > 0) {
      console.log('\n── Dependencies ──');
      const edgeRows = edges.map((e) => ({
        From: e.from,
        To: e.to,
        Label: e.label,
      }));
      console.log(formatTable(edgeRows, ['From', 'To', 'Label']));
    }
    console.log('');
  }
}
