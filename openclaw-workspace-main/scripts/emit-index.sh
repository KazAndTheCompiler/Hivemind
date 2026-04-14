#!/bin/bash
# emit-index.sh — Emit a ProgressSchema to MemPalace and index it
# Usage: cat emission.json | emit-index.sh
# Or: emit-index.sh emission.json

set -e

PALACE_DIR="$HOME/watson-palace"
WING_DIR="$PALACE_DIR/wings/pixie"
EVENT_DIR="$WING_DIR/hall_events"

# Ensure directories exist
mkdir -p "$EVENT_DIR"

# Read emission from stdin or file
if [ -n "$1" ] && [ -f "$1" ]; then
  EMISSION=$(cat "$1")
elif [ -p /dev/stdin ]; then
  EMISSION=$(cat)
else
  echo "Error: No emission data provided" >&2
  exit 1
fi

# Extract metadata for filename
TASK_ID=$(echo "$EMISSION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('taskId','unknown'))" 2>/dev/null || echo "unknown")
PHASE=$(echo "$EMISSION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('phase','unknown'))" 2>/dev/null || echo "unknown")
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Write to hall_events
FILENAME="ProgressSchema-${TASK_ID}-${PHASE}-${TIMESTAMP}.json"
FILEPATH="$EVENT_DIR/$FILENAME"
echo "$EMISSION" > "$FILEPATH"

# Re-initialize palace (accepts defaults) and mine the new file
cd "$PALACE_DIR"
yes "" | ~/.watson-venv/bin/mempalace init "$PALACE_DIR" > /dev/null 2>&1 || true
~/.watson-venv/bin/mempalace mine "$PALACE_DIR" 2>/dev/null | tail -3 || true

echo "[pixie] Indexed: $FILENAME -> MemPalace"
