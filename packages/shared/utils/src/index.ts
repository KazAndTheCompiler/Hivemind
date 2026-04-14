import fs from 'fs';
import path from 'path';
import { AnyMetadataSchema } from '@secdev/shared-schemas';

const METADATA_FILE = 'metadata.json';

export function loadMetadata(packagePath: string): unknown {
  const metadataPath = path.join(packagePath, METADATA_FILE);
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Metadata file not found: ${metadataPath}`);
  }
  const raw = fs.readFileSync(metadataPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return AnyMetadataSchema.parse(parsed);
}

export function findPackages(rootPath: string, _includePattern = '**/*'): string[] {
  const packages: string[] = [];

  function scan(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const metadataPath = path.join(fullPath, METADATA_FILE);
        if (fs.existsSync(metadataPath)) {
          packages.push(fullPath);
        }
        scan(fullPath);
      }
    }
  }

  scan(rootPath);
  return packages;
}

export function validateMetadata(packagePath: string): { valid: boolean; errors: string[]; data?: any } {
  try {
    const data = loadMetadata(packagePath);
    return { valid: true, errors: [], data };
  } catch (err) {
    const errors = err instanceof Error ? [err.message] : ['Unknown validation error'];
    return { valid: false, errors };
  }
}

export function getSafetyLabel(safetyBoundary: string): string {
  const labels: Record<string, string> = {
    'defensive': '✅ Defensive',
    'analysis': '🔍 Analysis Only',
    'simulation': '🎮 Simulation',
    'dual-use': '⚠️ Dual-Use',
    'restricted-research': '🔒 Restricted Research',
    'lab-only': '🧪 Lab Only',
    'do-not-deploy': '🚫 Do Not Deploy',
  };
  return labels[safetyBoundary] ?? '❓ Unknown';
}

export function getRiskBadge(riskLevel: string): string {
  const badges: Record<string, string> = {
    'low': '🟢 Low',
    'medium': '🟡 Medium',
    'high': '🟠 High',
    'critical': '🔴 Critical',
  };
  return badges[riskLevel] ?? '❓ Unknown';
}

export function formatTable(rows: Record<string, string>[], headers: string[]): string {
  if (rows.length === 0) return 'No data.';

  const widths: Record<string, number> = {};
  for (const h of headers) {
    widths[h] = Math.max(h.length, ...rows.map((r) => (r[h] ?? '').length));
  }

  const headerRow = headers.map((h) => h.padEnd(widths[h])).join(' │ ');
  const separator = headers.map((h) => '─'.repeat(widths[h])).join('─┼─');

  const dataRows = rows.map((row) =>
    headers.map((h) => (row[h] ?? '').padEnd(widths[h])).join(' │ ')
  );

  return [headerRow, separator, ...dataRows].join('\n');
}
