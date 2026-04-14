#!/bin/bash
# pixie-cron.sh — Pixie periodic heartbeat
# Runs every 15 min via cron: */15 * * * * ~/toolshed/scripts/pixie-cron.sh

PALACE_DIR="$HOME/watson-palace"
WING_DIR="$PALACE_DIR/wings/pixie"
EVENT_DIR="$WING_DIR/hall_events"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EMISSION="$EVENT_DIR/heartbeat-$TIMESTAMP.json"

mkdir -p "$EVENT_DIR"

# Quick system check
SYSINFO=$(~/toolshed/scripts/sysinfo.sh 2>/dev/null)
HOST=$(echo "$SYSINFO" | grep hostname | sed 's/.*"\([^"]*\)".*/\1/')
MEM=$(echo "$SYSINFO" | grep memory_free | sed 's/.*"\([^"]*\)".*/\1/')
DISK=$(echo "$SYSINFO" | grep disk_free | sed 's/.*"\([^"]*\)".*/\1/')
LOAD=$(echo "$SYSINFO" | grep load_avg | sed 's/.*"\([^"]*\)".*/\1/')

# Create heartbeat emission (no embedded JSON)
cat > "$EMISSION" <<JSON
{
  "type": "ProgressSchema",
  "version": "1.0",
  "taskId": "pixie-heartbeat",
  "agent": "pixie",
  "phase": "heartbeat",
  "done": ["system check complete"],
  "blockers": [],
  "next": "waiting for task",
  "touchedFiles": [],
  "metadata": {
    "host": "$HOST",
    "memory_free": "$MEM",
    "disk_free": "$DISK", 
    "load_avg": "$LOAD",
    "timestamp": "$(date -Iseconds)"
  }
}
JSON

# Index to MemPalace
cd "$PALACE_DIR" && yes "" | ~/.watson-venv/bin/mempalace init "$PALACE_DIR" > /dev/null 2>&1 && ~/.watson-venv/bin/mempalace mine "$PALACE_DIR" > /dev/null 2>&1

echo "[pixie-cron] Heartbeat indexed: $EMISSION"
