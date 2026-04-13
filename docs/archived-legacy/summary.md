# Archived Legacy Projects

The `projects/` directory contains 75 legacy folders from the original SecDev project collection. These are preserved for reference during migration.

## Duplicate Numbering (Resolved)

Five numbering slots had two folders each. These have been mapped to unique package IDs:

| Slot | Folder A | Folder B | Resolution |
|------|----------|----------|------------|
| 66 | `66-software-supply-chain` | `66-vulnerability-scanner` | Both migrated as unique packages |
| 67 | `67-container-security` | `67-datacenter-security` | `67-container-security` archived (duplicate of `37-container-security`); `67-datacenter-security` migrated |
| 68 | `68-bug-bounty-playbook` | `68-vehicle-security` | Both migrated (playbook → content, vehicle → lab) |
| 69 | `69-ics-scada-security` | `69-steganography` | Both migrated (ICS → defense, steganography → forensics) |
| 70 | `70-biometric-auth` | `70-security-architecture` | Both migrated (biometric → lab, architecture → content) |

## Non-ASCII Folder Name

- `38-漏洞分析` (Chinese: "vulnerability analysis") → Renamed to `@secdev/lab-vulnerability-analysis` in ASCII

## Docs-Only Conversions

- `06-home-lab` → Content only (setup guide, no code)
- `36-ctf-writeups` → Content only (templates only)

## Archived (Duplicates)

- `67-container-security` → Archived as duplicate of `37-container-security`

## Quality Issues in Legacy

- 25 of 75 folders (33%) lacked README.md
- No test files existed in any folder
- No dependency files (requirements.txt, package.json)
- Mixed code quality: folders 1-33 most complete, 34-60 showed quality drop
- No consistent metadata, naming, or safety boundaries

## Migration Status

See `MIGRATION_REGISTRY.json` for current migration status. The full classification mapping is:

| Legacy Domain | Count | Target |
|---------------|-------|--------|
| labs | ~25 | `packages/labs/` |
| tools | ~20 | `packages/tools/` |
| detections | ~8 | `packages/detections/` |
| defense | ~15 | `packages/defense/` |
| forensics | ~5 | `packages/forensics/` |
| content/docs-only | ~3 | `content/` |
| archived (duplicates) | ~1 | `docs/archived-legacy/` |
