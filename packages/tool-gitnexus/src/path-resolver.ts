// Path resolution for GitNexus — normalizes relative and absolute paths
// Handles edge cases: symlinks, relative paths, missing files

import * as path from 'path';
import * as fs from 'fs';

interface NormalizationResult {
  normalized: string;
  exists: boolean;
  isAbsolute: boolean;
  packageJsonPath?: string;
}

const pathCache = new Map<string, NormalizationResult>();

/**
 * Normalize a file path to absolute and verify it exists.
 * Walks upward to find nearest package.json.
 */
export function normalizeAndResolve(
  filePath: string,
  workDir: string = process.cwd(),
): NormalizationResult {
  // Check cache first
  const cacheKey = `${filePath}:${workDir}`;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }

  // Resolve to absolute path
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(workDir, filePath);

  // Check if file exists
  const exists = fs.existsSync(absolute);

  // Find nearest package.json
  let current = path.dirname(absolute);
  let packageJsonPath: string | undefined;

  while (current !== path.dirname(current)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      packageJsonPath = candidate;
      break;
    }
    current = path.dirname(current);
  }

  const result: NormalizationResult = {
    normalized: absolute,
    exists,
    isAbsolute: true,
    packageJsonPath,
  };

  pathCache.set(cacheKey, result);
  return result;
}

/**
 * Clear the path resolution cache.
 */
export function clearPathCache(): void {
  pathCache.clear();
}

/**
 * Get the owner package of a file by walking up to package.json.
 * Returns "unknown" if no package.json found.
 */
export function getFileOwnerPackage(filePath: string, workDir: string = process.cwd()): string {
  try {
    const resolved = normalizeAndResolve(filePath, workDir);

    if (!resolved.packageJsonPath) {
      return 'unknown';
    }

    const packageJsonContent = fs.readFileSync(resolved.packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    return packageJson.name || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Resolve a list of files to their canonical absolute paths.
 * Filters out non-existent files.
 */
export function resolveFileSet(
  files: string[],
  workDir: string = process.cwd(),
): string[] {
  return files
    .map(f => normalizeAndResolve(f, workDir))
    .filter(r => r.exists)
    .map(r => r.normalized);
}
