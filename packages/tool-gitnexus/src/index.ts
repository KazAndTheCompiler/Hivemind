// GitNexus adapter — change detection, file classification, package mapping
// Contract interface + local fallback implementation

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';

// ---------------------------------------------------------------------------
// Contract interface
// ---------------------------------------------------------------------------

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: { added: number; removed: number };
}

export interface GitNexusResult {
  changedFiles: ChangedFile[];
  packageNames: string[];
  diff: { added: number; removed: number; modified: number };
}

export interface GitNexusAdapter {
  detectChanges(baseRef?: string): Promise<GitNexusResult>;
  classifyFile(path: string): Promise<{ type: string; language: string }>;
  emitEvents(result: GitNexusResult): Promise<void>;
}

// ---------------------------------------------------------------------------
// LocalGitNexusAdapter — git-based fallback implementation
// ---------------------------------------------------------------------------

export class LocalGitNexusAdapter implements GitNexusAdapter {
  private eventBus: EventBus;
  private logger: Logger;
  private workDir: string;

  constructor(eventBus: EventBus, logger: Logger, workDir = process.cwd()) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'LocalGitNexusAdapter' });
    this.workDir = workDir;
  }

  async detectChanges(baseRef = 'HEAD'): Promise<GitNexusResult> {
    try {
      const { stdout } = await execAsync(`git diff --name-status ${baseRef}`, {
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
        const path = parts[1] ?? parts[0];

        let status: ChangedFile['status'] = 'modified';
        if (statusCode === 'A') { status = 'added'; addedCount++; }
        else if (statusCode === 'D') { status = 'deleted'; removedCount++; }
        else if (statusCode === 'M') { status = 'modified'; modifiedCount++; }
        else if (statusCode.startsWith('R')) { status = 'renamed'; modifiedCount++; }

        changedFiles.push({ path, status });
      }

      const packageNames = this.mapFilesToPackages(changedFiles.map((f) => f.path));

      const result: GitNexusResult = {
        changedFiles,
        packageNames,
        diff: { added: addedCount, removed: removedCount, modified: modifiedCount },
      };

      this.logger.info('gitnexus.changes.detected', {
        fileCount: changedFiles.length,
        packageCount: packageNames.length,
        ...result.diff,
      });

      return result;
    } catch (err) {
      throw new Error(`Failed to detect git changes: ${err instanceof Error ? err.message : String(err)}`);
    }
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
      kind: 'gitnexus.change',
      files: result.changedFiles.map((f) => f.path),
      packageNames: result.packageNames,
      diff: result.diff,
      timestamp: new Date().toISOString(),
    });

    await this.eventBus.emit({
      kind: 'file.change.detected',
      files: result.changedFiles.map((f) => f.path),
      packageNames: result.packageNames,
      timestamp: new Date().toISOString(),
    });
  }

  private mapFilesToPackages(files: string[]): string[] {
    const packages = new Set<string>();
    for (const file of files) {
      const match = file.match(/packages\/([^/]+)/);
      if (match) {
        packages.add(`@openclaw/${match[1]}`);
      }
    }
    return Array.from(packages);
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
