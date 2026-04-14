# Runbooks

## Start the Orchestrator

```bash
pnpm openclaw start
# or
OPENCLAW_LOG_LEVEL=debug OPENCLAW_LOG_FORMAT=human pnpm openclaw start
```

## Start the Watch Daemon

```bash
pnpm openclaw daemon
```

## Check Status

```bash
pnpm openclaw status
```

## Configuration

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OPENCLAW_CONFIG` | Path to JSON config file | (use defaults) |
| `OPENCLAW_WORKSPACE` | Workspace root path | `.` |
| `OPENCLAW_LOG_LEVEL` | Log level | `info` |
| `OPENCLAW_LOG_FORMAT` | Log format | `json` |
| `OPENCLAW_AUDIT_PATH` | Audit store path | `.openclaw/audit` |
| `OPENCLAW_MAX_WORKERS` | Max concurrent workers | `4` |

### Config File

```json
{
  "workspace": "/path/to/repo",
  "orchestrator": {
    "maxConcurrentWorkers": 8,
    "relayBudget200": 200,
    "relayBudget300": 300,
    "retryAttempts": 3,
    "retryDelayMs": 1000
  },
  "daemon": {
    "watchPaths": ["."],
    "debounceMs": 500
  },
  "tools": {
    "gitnexus": { "enabled": true },
    "secdev": { "enabled": false },
    "eslint": { "enabled": true },
    "prettier": { "enabled": true }
  },
  "audit": {
    "storePath": ".openclaw/audit",
    "retentionDays": 30,
    "deadLetterPath": ".openclaw/dead-letter"
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## Troubleshooting

### Orchestrator won't start
- Check that `pnpm build` completed successfully
- Check audit store directory is writable

### Quality gate not triggering
- Verify daemon is running: `pnpm openclaw status`
- Check `daemon.debounceMs` isn't too high
- Verify `node_modules` is in ignored paths

### Tests failing
- Run `pnpm build` first (tsconfig references need built deps)
- Run individual package test: `pnpm --filter @openclaw/core-schemas test`

## systemd Service (VPS/Production)

Create `/etc/systemd/system/openclaw-orchestrator.service`:

```ini
[Unit]
Description=OpenClaw Orchestrator
After=network.target

[Service]
Type=simple
User=openclaw
WorkingDirectory=/opt/openclaw
Environment=OPENCLAW_LOG_LEVEL=info
Environment=OPENCLAW_LOG_FORMAT=json
ExecStart=/usr/bin/node /opt/openclaw/apps/orchestrator/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable openclaw-orchestrator
sudo systemctl start openclaw-orchestrator
```

## Adding a New Agent Type

1. Add new `AgentStatus` variant to `@openclaw/core-types`
2. Add matching Zod value to `@openclaw/core-schemas`
3. Update any switch statements that match on AgentStatus
4. Add test for new status in condense-engine

## Adding a New Tool Adapter

1. Create package: `packages/tool-<name>/`
2. Define contract interface (e.g., `MyToolAdapter`)
3. Implement local adapter (e.g., `LocalMyToolAdapter`)
4. Add to `ChangedFileQualityService` constructor
5. Add to daemon dependencies
