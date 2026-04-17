// Prompt Registry Service
// Versioned prompt storage with lineage tracking

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { PromptVersion } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export class PromptRegistryService {
  private logger: Logger;
  private storePath: string;
  private prompts: Map<string, PromptVersion[]> = new Map();

  constructor(storePath: string, logger?: Logger) {
    this.logger = logger ?? createLogger();
    this.storePath = storePath;
    this.load();
  }

  registerPrompt(promptId: string, content: string, createdFromVersion?: string): PromptVersion {
    const existing = this.prompts.get(promptId) ?? [];
    const latestVersion = existing.find((p) => p.status === 'active');

    const version = this.computeNextVersion(latestVersion?.version ?? 'v0');

    const checksum = this.computeChecksum(content);

    const promptVersion: PromptVersion = {
      promptId,
      version,
      content,
      checksum,
      createdAt: new Date().toISOString(),
      createdFromVersion: createdFromVersion ?? latestVersion?.version,
      status: 'draft',
    };

    existing.push(promptVersion);
    this.prompts.set(promptId, existing);
    this.persist();

    this.logger.info('prompt.registered', {
      promptId,
      version,
      checksum,
    });

    return promptVersion;
  }

  activatePrompt(promptId: string, version: string): boolean {
    const versions = this.prompts.get(promptId);
    if (!versions) return false;

    const promptVersion = versions.find((p) => p.version === version);
    if (!promptVersion) return false;

    for (const pv of versions) {
      if (pv.status === 'active') {
        pv.status = 'archived';
      }
    }

    promptVersion.status = 'active';
    this.persist();

    this.logger.info('prompt.activated', { promptId, version });
    return true;
  }

  archivePrompt(promptId: string, version: string): boolean {
    const versions = this.prompts.get(promptId);
    if (!versions) return false;

    const promptVersion = versions.find((p) => p.version === version);
    if (!promptVersion) return false;

    promptVersion.status = 'archived';
    this.persist();

    this.logger.info('prompt.archived', { promptId, version });
    return true;
  }

  getActivePrompt(promptId: string): PromptVersion | null {
    const versions = this.prompts.get(promptId);
    if (!versions) return null;
    return versions.find((p) => p.status === 'active') ?? null;
  }

  getPromptVersion(promptId: string, version: string): PromptVersion | null {
    const versions = this.prompts.get(promptId);
    if (!versions) return null;
    return versions.find((p) => p.version === version) ?? null;
  }

  getPromptHistory(promptId: string): PromptVersion[] {
    const versions = this.prompts.get(promptId);
    return versions ? [...versions].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  }

  getAllPrompts(): Map<string, PromptVersion[]> {
    return new Map(this.prompts);
  }

  validateChecksum(promptId: string, version: string, content: string): boolean {
    const pv = this.getPromptVersion(promptId, version);
    if (!pv) return false;
    return pv.checksum === this.computeChecksum(content);
  }

  private computeNextVersion(current: string): string {
    const parts = current.split('.');
    const patch = parseInt(parts[1] ?? '0', 10) + 1;
    return `v${patch}`;
  }

  private computeChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private persist(): void {
    try {
      fs.mkdirSync(this.storePath, { recursive: true });
      const filePath = path.join(this.storePath, 'prompt-registry.json');
      const data = JSON.stringify(Array.from(this.prompts.entries()), null, 2);
      fs.writeFileSync(filePath, data, 'utf-8');
    } catch (err) {
      this.logger.error('prompt.registry.persist_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private load(): void {
    const filePath = path.join(this.storePath, 'prompt-registry.json');
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as Array<[string, PromptVersion[]]>;
      this.prompts = new Map(data);
    } catch (err) {
      this.logger.warn('prompt.registry.load_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
