# Package Taxonomy

SecDev Labs is organized into six operating domains:

## Domains

### 1. labs (`packages/labs/`)
Educational exercises, safe simulations, and walkthrough-style modules.
- **Package naming**: `@secdev/lab-*`
- **Metadata type**: `lab`
- **Examples**: honeypot setup, password cracking practice, malware analysis sandbox

### 2. tools (`packages/tools/`)
Reusable scanners, analyzers, parsers, and helper CLIs.
- **Package naming**: `@secdev/tool-*`
- **Metadata type**: `tool`
- **Examples**: network sniffer, vulnerability scanner, header analyzer

### 3. detections (`packages/detections/`)
Detection logic, Sigma/YARA-like patterns, event analysis, alerting experiments.
- **Package naming**: `@secdev/detection-*`
- **Metadata type**: `detection`
- **Examples**: Snort IDS rules, anomaly detection, threat hunting

### 4. defense (`packages/defense/`)
Hardening guides, security controls, secure configuration, validation suites.
- **Package naming**: `@secdev/defense-*`
- **Metadata type**: `defense`
- **Examples**: firewall setup, TLS configuration, cloud hardening

### 5. forensics (`packages/forensics/`)
Memory/disk/process/network analysis, evidence parsers, timelines.
- **Package naming**: `@secdev/forensics-*`
- **Metadata type**: `forensics`
- **Examples**: digital forensics, malware analysis, memory analysis

### 6. content (`content/`)
Writeups, playbooks, documentation-only references.
- **Package naming**: `@secdev/content-*`
- **Examples**: CTF writeups, bug bounty playbook, security architecture guide

## Shared Foundations

All domains depend on:
- `@secdev/shared-types` — Canonical TypeScript types
- `@secdev/shared-config` — Runtime configuration with Zod validation
- `@secdev/shared-logger` — Structured logging (JSON + human modes)
- `@secdev/shared-schemas` — Runtime validation schemas
- `@secdev/shared-utils` — Shared utilities (metadata loading, package discovery)
- `@secdev/shared-testing` — Test fixtures and assertion helpers

## CLI

The `secdev` CLI provides unified access across all domains:
```bash
secdev list          # All packages
secdev info <id>     # Package details
secdev run <id>      # Execute (with safety checks)
secdev validate      # Metadata validation
secdev doctor        # Health checks
secdev inventory     # Grouped by domain
secdev graph         # Dependency graph
secdev migrate       # Legacy migration tracking
```
