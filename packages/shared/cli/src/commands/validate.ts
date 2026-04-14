import path from 'path';
import { findPackages, validateMetadata } from '@secdev/shared-utils';
import { createLogger } from '@secdev/shared-logger';

export async function validateCommand(rootPath: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'validate');
  const packagesPath = path.join(rootPath, 'packages');
  const packages = findPackages(packagesPath);

  const results: { path: string; valid: boolean; errors: string[] }[] = [];

  for (const pkgPath of packages) {
    const result = validateMetadata(pkgPath);
    results.push({
      path: path.relative(rootPath, pkgPath),
      valid: result.valid,
      errors: result.errors,
    });
  }

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.length - validCount;

  if (format === 'json') {
    console.log(JSON.stringify({ total: results.length, valid: validCount, invalid: invalidCount, results }, null, 2));
  } else {
    if (invalidCount > 0) {
      logger.warn(`${invalidCount} package(s) have invalid metadata`);
      for (const r of results) {
        if (!r.valid) {
          console.log(`\n❌ ${r.path}`);
          for (const e of r.errors) console.log(`   • ${e}`);
        }
      }
    }
    logger.info(`${validCount}/${results.length} packages have valid metadata`);
  }

  if (invalidCount > 0) process.exit(1);
}
