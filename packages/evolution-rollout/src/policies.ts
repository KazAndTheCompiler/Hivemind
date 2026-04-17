// Policy Registry Service
// Versioned policy storage with lineage tracking

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { PolicyVersion } from '@openclaw/evolution-core';
import { createLogger, type Logger } from '@openclaw/core-logging';

export class PolicyRegistryService {
  private logger: Logger;
  private storePath: string;
  private policies: Map<string, PolicyVersion[]> = new Map();

  constructor(storePath: string, logger?: Logger) {
    this.logger = logger ?? createLogger();
    this.storePath = storePath;
    this.load();
  }

  registerPolicy(
    policyId: string,
    config: Record<string, unknown>,
    createdFromVersion?: string,
  ): PolicyVersion {
    const existing = this.policies.get(policyId) ?? [];
    const latestVersion = existing.find((p) => p.status === 'active');

    const version = this.computeNextVersion(latestVersion?.version ?? 'v0');

    const checksum = this.computeChecksum(JSON.stringify(config));

    const policyVersion: PolicyVersion = {
      policyId,
      version,
      config,
      checksum,
      createdAt: new Date().toISOString(),
      createdFromVersion: createdFromVersion ?? latestVersion?.version,
      status: 'draft',
    };

    existing.push(policyVersion);
    this.policies.set(policyId, existing);
    this.persist();

    this.logger.info('policy.registered', {
      policyId,
      version,
      checksum,
    });

    return policyVersion;
  }

  activatePolicy(policyId: string, version: string): boolean {
    const versions = this.policies.get(policyId);
    if (!versions) return false;

    const policyVersion = versions.find((p) => p.version === version);
    if (!policyVersion) return false;

    for (const pv of versions) {
      if (pv.status === 'active') {
        pv.status = 'archived';
      }
    }

    policyVersion.status = 'active';
    this.persist();

    this.logger.info('policy.activated', { policyId, version });
    return true;
  }

  archivePolicy(policyId: string, version: string): boolean {
    const versions = this.policies.get(policyId);
    if (!versions) return false;

    const policyVersion = versions.find((p) => p.version === version);
    if (!policyVersion) return false;

    policyVersion.status = 'archived';
    this.persist();

    this.logger.info('policy.archived', { policyId, version });
    return true;
  }

  getActivePolicy(policyId: string): PolicyVersion | null {
    const versions = this.policies.get(policyId);
    if (!versions) return null;
    return versions.find((p) => p.status === 'active') ?? null;
  }

  getPolicyVersion(policyId: string, version: string): PolicyVersion | null {
    const versions = this.policies.get(policyId);
    if (!versions) return null;
    return versions.find((p) => p.version === version) ?? null;
  }

  getPolicyHistory(policyId: string): PolicyVersion[] {
    const versions = this.policies.get(policyId);
    return versions ? [...versions].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : [];
  }

  getAllPolicies(): Map<string, PolicyVersion[]> {
    return new Map(this.policies);
  }

  validateChecksum(policyId: string, version: string, config: Record<string, unknown>): boolean {
    const pv = this.getPolicyVersion(policyId, version);
    if (!pv) return false;
    return pv.checksum === this.computeChecksum(JSON.stringify(config));
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
      const filePath = path.join(this.storePath, 'policy-registry.json');
      const data = JSON.stringify(Array.from(this.policies.entries()), null, 2);
      fs.writeFileSync(filePath, data, 'utf-8');
    } catch (err) {
      this.logger.error('policy.registry.persist_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private load(): void {
    const filePath = path.join(this.storePath, 'policy-registry.json');
    if (!fs.existsSync(filePath)) return;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content) as Array<[string, PolicyVersion[]]>;
      this.policies = new Map(data);
    } catch (err) {
      this.logger.warn('policy.registry.load_error', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
