// GitNexus adapter — change detection, file classification, package mapping
// Contract interface + local fallback implementation using child_process.execFile

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import * as path from 'path';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Contract interfaces
// ---------------------------------------------------------------------------

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: { added: number; removed: number };
}

export interface GitNexusResult {
  changedFiles: ChangedFile[];
  packageNames: string[];
  fileToPackage: Map<string, string>; // file path -> package name
  diff: { added: number; removed: number; modified: number };
}

export interface GitNexusAdapter {
  detectChanges(baseRef?: string): Promise<GitNexusResult>;
  resolveFileOwnership(filePath: string): Promise<string | null>;
  classifyFile(filePath: string): Promise<{ type: string; language: string }>;
  emitEvents(result: GitNexusResult): Promise<void>;
}

// ---------------------------------------------------------------------------
// LocalGitNexusAdapter — git-based implementation with real package discovery
// ---------------------------------------------------------------------------

export class LocalGitNexusAdapter implements GitNexusAdapter {
  private eventBus: EventBus;
  private logger: Logger;
  private workDir: string;
  private packageCache: Map<string, string> | null = null;

  constructor(eventBus: EventBus, logger: Logger, workDir = process.cwd()) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'LocalGitNexusAdapter' });
    this.workDir = workDir;
  }

  async detectChanges(baseRef = 'HEAD'): Promise<GitNexusResult> {
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--name-status', baseRef], {
        cwd: this.workDir,
        timeout: 30_000,
      });

      const changedFiles: ChangedFile[] = [];
      let addedCount = 0;
      let removedCount = 0;
      let modifiedCount = 0;

      for (const line of stdout.split('\n').filter(Boolean)) {
        const parts = line.split('\t');
        const statusCode = parts[0];
        const filePath = parts[1] ?? parts[0];

        let status: ChangedFile['status'] = 'modified';
        if (statusCode === 'A') {
          status = 'added';
          addedCount++;
        } else if (statusCode === 'D') {
          status = 'deleted';
          removedCount++;
        } else if (statusCode === 'M') {
          status = 'modified';
          modifiedCount++;
        } else if (statusCode.startsWith('R')) {
          status = 'renamed';
          modifiedCount++;
        }

        changedFiles.push({ path: filePath, status });
      }

      // Resolve package ownership for all changed files
      const fileToPackage = new Map<string, string>();
      const packageNames = new Set<string>();

      for (const file of changedFiles) {
        const owner = await this.resolveFileOwnership(file.path);
        if (owner) {
          fileToPackage.set(file.path, owner);
          packageNames.add(owner);
        }
      }

      const result: GitNexusResult = {
        changedFiles,
        packageNames: Array.from(packageNames),
        fileToPackage,
        diff: { added: addedCount, removed: removedCount, modified: modifiedCount },
      };

      this.logger.info('gitnexus.changes.detected', {
        fileCount: changedFiles.length,
        packageCount: packageNames.size,
        ...result.diff,
      });

      return result;
    } catch (err) {
      throw new Error(
        `Failed to detect git changes: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Resolve package ownership by walking upward from the file path
   * to find the nearest package.json with a "name" field.
   * Uses a cached workspace package map for performance.
   */
  async resolveFileOwnership(filePath: string): Promise<string | null> {
    // Build cache on first call
    if (this.packageCache === null) {
      this.packageCache = await this.buildPackageCache();
    }

    // Try exact directory match first
    const dir = path.dirname(filePath);
    if (this.packageCache.has(dir)) {
      return this.packageCache.get(dir) ?? null;
    }

    // Walk upward from file's directory to find nearest package.json
    let current = dir;
    const root = path.resolve(this.workDir);

    while (current.startsWith(root) || current === root) {
      const pkgJsonPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkgContent = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          if (pkgContent.name) {
            // Cache this directory
            this.packageCache.set(current, pkgContent.name);
            return pkgContent.name;
          }
        } catch {
          // Invalid package.json, continue walking up
        }
      }

      // Check cache for this directory
      if (this.packageCache.has(current)) {
        return this.packageCache.get(current) ?? null;
      }

      const parent = path.dirname(current);
      if (parent === current) break; // reached root
      current = parent;
    }

    return null; // unknown owner
  }

  async classifyFile(filePath: string): Promise<{ type: string; language: string }> {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      sh: 'shell',
      json: 'json',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
    };

    return {
      type: this.guessFileType(ext),
      language: languageMap[ext] ?? 'unknown',
    };
  }

  async emitEvents(result: GitNexusResult): Promise<void> {
    await this.eventBus.emit({
      kind: 'gitnexus.change.detected',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: result.packageNames.join(',') || 'unknown',
      files: result.changedFiles.map((f) => f.path),
      packageNames: result.packageNames,
      diff: result.diff,
      timestamp: new Date().toISOString(),
    });

    await this.eventBus.emit({
      kind: 'file.change.detected',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: result.packageNames.join(',') || 'unknown',
      files: result.changedFiles.map((f) => f.path),
      packageNames: result.packageNames,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Build a map of directory -> package name by scanning workspace.
   * Walks the workspace to discover all package.json files and their
   * containing directories.
   */
  private async buildPackageCache(): Promise<Map<string, string>> {
    const cache = new Map<string, string>();

    try {
      // Use git ls-files to find all package.json files in the workspace
      const { stdout } = await execFileAsync('git', ['ls-files', '**/package.json'], {
        cwd: this.workDir,
        timeout: 10_000,
      });

      for (const file of stdout.split('\n').filter(Boolean)) {
        const absPath = path.join(this.workDir, file);
        if (!fs.existsSync(absPath)) continue;

        try {
          const pkgContent = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
          if (pkgContent.name) {
            const dir = path.dirname(path.resolve(absPath));
            cache.set(dir, pkgContent.name);
          }
        } catch {
          // Skip invalid package.json
        }
      }
    } catch {
      // Fallback: not a git repo or git ls-files failed
      this.logger.warn('gitnexus.package_cache.fallback', {
        message: 'Could not build package cache via git, using empty cache',
      });
    }

    return cache;
  }

  /** Invalidate the package cache (e.g., after dependencies change) */
  invalidatePackageCache(): void {
    this.packageCache = null;
  }

  private guessFileType(ext: string): string {
    if (['ts', 'tsx'].includes(ext)) return 'source';
    if (['js', 'jsx'].includes(ext)) return 'source';
    if (['py', 'sh'].includes(ext)) return 'script';
    if (['json'].includes(ext)) return 'config';
    if (['md'].includes(ext)) return 'doc';
    if (['yaml', 'yml'].includes(ext)) return 'config';
    return 'other';
  }
}
