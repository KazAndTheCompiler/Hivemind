import fs from 'fs';
import path from 'path';
import { findPackages, validateMetadata } from '@secdev/shared-utils';
import { ConfigLoader } from '@secdev/shared-config';
import { createLogger } from '@secdev/shared-logger';

export async function doctorCommand(rootPath: string, format: 'human' | 'json' = 'human'): Promise<void> {
  const logger = createLogger('@secdev/cli', 'doctor');
  const checks: { name: string; status: 'pass' | 'fail' | 'warn'; message: string }[] = [];

  // Check 1: Root package.json exists
  const hasRootPackageJson = fs.existsSync(path.join(rootPath, 'package.json'));
  checks.push({
    name: 'root-package-json',
    status: hasRootPackageJson ? 'pass' : 'fail',
    message: hasRootPackageJson ? 'Root package.json exists' : 'Root package.json missing',
  });

  // Check 2: pnpm-workspace.yaml exists
  const hasWorkspace = fs.existsSync(path.join(rootPath, 'pnpm-workspace.yaml'));
  checks.push({
    name: 'pnpm-workspace',
    status: hasWorkspace ? 'pass' : 'fail',
    message: hasWorkspace ? 'pnpm-workspace.yaml exists' : 'pnpm-workspace.yaml missing',
  });

  // Check 3: tsconfig.base.json exists
  const hasTsconfigBase = fs.existsSync(path.join(rootPath, 'tsconfig.base.json'));
  checks.push({
    name: 'tsconfig-base',
    status: hasTsconfigBase ? 'pass' : 'fail',
    message: hasTsconfigBase ? 'tsconfig.base.json exists' : 'tsconfig.base.json missing',
  });

  // Check 4: Config loads
  try {
    const config = ConfigLoader.fromProjectRoot(rootPath);
    const validation = config.validate();
    checks.push({
      name: 'config-validation',
      status: validation.valid ? 'pass' : 'warn',
      message: validation.valid ? 'Config loads and validates successfully' : `Config validation errors: ${validation.errors.join(', ')}`,
    });
  } catch (err) {
    checks.push({
      name: 'config-validation',
      status: 'fail',
      message: `Config failed to load: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check 5: Shared packages exist
  const sharedPath = path.join(rootPath, 'packages', 'shared');
  const expectedShared = ['types', 'config', 'logger', 'schemas', 'utils', 'testing', 'cli'];
  for (const pkg of expectedShared) {
    const exists = fs.existsSync(path.join(sharedPath, pkg, 'package.json'));
    checks.push({
      name: `shared-${pkg}`,
      status: exists ? 'pass' : 'fail',
      message: exists ? `@secdev/shared-${pkg} exists` : `@secdev/shared-${pkg} missing`,
    });
  }

  // Check 6: Domain directories exist
  const domainDirs = ['labs', 'tools', 'detections', 'defense', 'forensics'];
  for (const dir of domainDirs) {
    const exists = fs.existsSync(path.join(rootPath, 'packages', dir));
    checks.push({
      name: `domain-${dir}`,
      status: exists ? 'pass' : 'warn',
      message: exists ? `packages/${dir}/ exists` : `packages/${dir}/ missing (will be created on migration)`,
    });
  }

  // Check 7: Migration registry exists
  const hasMigrationRegistry = fs.existsSync(path.join(rootPath, 'MIGRATION_REGISTRY.json'));
  checks.push({
    name: 'migration-registry',
    status: hasMigrationRegistry ? 'pass' : 'warn',
    message: hasMigrationRegistry ? 'MIGRATION_REGISTRY.json exists' : 'MIGRATION_REGISTRY.json not found',
  });

  // Check 8: Packages with metadata
  const packagesPath = path.join(rootPath, 'packages');
  if (fs.existsSync(packagesPath)) {
    const allPackages = findPackages(packagesPath);
    const withMetadata = allPackages.filter((p) => {
      const result = validateMetadata(p);
      return result.valid;
    });
    const pct = allPackages.length > 0 ? Math.round((withMetadata.length / allPackages.length) * 100) : 0;
    checks.push({
      name: 'metadata-coverage',
      status: pct > 80 ? 'pass' : pct > 50 ? 'warn' : 'fail',
      message: `${withMetadata.length}/${allPackages.length} packages (${pct}%) have valid metadata`,
    });
  }

  if (format === 'json') {
    console.log(JSON.stringify(checks, null, 2));
  } else {
    const passCount = checks.filter((c) => c.status === 'pass').length;
    const failCount = checks.filter((c) => c.status === 'fail').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;

    console.log('\n🏥 SecDev Labs — Doctor Report\n');
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'fail' ? '❌' : '⚠️';
      console.log(`  ${icon} ${check.name}: ${check.message}`);
    }
    console.log(`\n📊 Summary: ${passCount} pass, ${warnCount} warnings, ${failCount} fail`);
    console.log('');
  }

  if (checks.some((c) => c.status === 'fail')) process.exit(1);
}
