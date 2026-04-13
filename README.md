# SecDev Labs — Cybersecurity Engineering Monorepo

> A TypeScript-first security engineering platform for labs, tools, detections, defense, and forensics.

## Overview

SecDev Labs is a cohesive monorepo organized around six operating domains:

| Domain | Description | Packages |
|--------|-------------|----------|
| **labs** | Educational exercises, safe simulations, walkthrough modules | `@secdev/lab-*` |
| **tools** | Scanners, analyzers, parsers, helper CLIs | `@secdev/tool-*` |
| **detections** | Sigma/YARA patterns, detection logic, alerting | `@secdev/detection-*` |
| **defense** | Hardening, controls, secure configuration, validation | `@secdev/defense-*` |
| **forensics** | Memory/disk/process analysis, evidence parsers, timelines | `@secdev/forensics-*` |
| **content** | Writeups, playbooks, documentation | `@secdev/content-*` |

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# List all packages
pnpm list

# Show package inventory
pnpm inventory

# Run health checks
pnpm doctor

# Validate metadata
pnpm validate
```

## CLI Commands

The `secdev` CLI provides unified access to all packages:

```bash
secdev list                    # List all packages
secdev info <id>               # Detailed package info
secdev run <id> [mode]         # Run a lab or tool
secdev validate                # Validate all metadata
secdev doctor                  # Health check
secdev inventory               # Grouped inventory
secdev graph                   # Dependency graph
secdev migrate                 # Migration management
```

## Architecture

```
packages/
  shared/           ← Shared foundations (TypeScript-first)
    types/          Canonical type definitions
    config/         Runtime config with Zod validation
    logger/         Structured logging (JSON + human)
    schemas/        Runtime validation schemas
    utils/          Shared utilities
    testing/        Test fixtures and helpers
    cli/            Common CLI runner
  labs/             Educational labs
  tools/            Reusable tools
  detections/       Detection logic
  defense/          Hardening modules
  forensics/        Analysis workflows
```

## Safety Boundaries

Every package declares its safety posture:

| Boundary | Meaning |
|----------|---------|
| `defensive` | Purely defensive, safe for general use |
| `analysis` | Analysis-only, no active exploitation |
| `simulation` | Simulated attacks, safe in isolation |
| `dual-use` | Can be used offensively or defensively |
| `restricted-research` | Requires strong context and oversight |
| `lab-only` | Only run in isolated lab environments |
| `do-not-deploy` | Not for production deployment |

## Legacy Migration

This repository evolved from a collection of 70+ standalone projects under `projects/`. They are being migrated into the structured monorepo.

- **Migration Registry**: See `MIGRATION_REGISTRY.json`
- **Legacy Projects**: Preserved under `projects/` (archived)
- **Status**: Run `secdev migrate` to see migration progress

## Package Naming

All packages follow: `@secdev/<domain>-<name>`

Examples:
- `@secdev/lab-honeypot-basic`
- `@secdev/tool-network-sniffer`
- `@secdev/detection-anomaly-lab`
- `@secdev/defense-firewall-setup`
- `@secdev/forensics-memory-analysis`

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm 8.x workspaces
- **Validation**: Zod
- **Testing**: Vitest
- **Logging**: Structured (JSON + human modes)

## Adding a New Lab

1. Create folder: `packages/labs/<name>/`
2. Add `package.json` with `@secdev/lab-<name>`
3. Add `metadata.json` with full lab metadata
4. Add your code (Python, Shell, etc.)
5. Run `secdev validate` to verify

See `docs/adding-a-new-lab.md` for detailed instructions.

## License

Educational and research purposes only.
