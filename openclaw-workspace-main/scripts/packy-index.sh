#!/bin/bash
# packy-index.sh — Store Packy conversation in MemPalace
# Usage: packy-index.sh <session_id> <role> <text> [intent]

SESSION="${1}"
ROLE="${2}"
TEXT="${3}"
INTENT="${4:-}"

if [ -z "$SESSION" ] || [ -z "$ROLE" ] || [ -z "$TEXT" ]; then
  echo "Usage: packy-index.sh <session_id> <role> <text> [intent]"
  echo "Example: packy-index.sh abc123 user \"I want to work on auth\" task_create"
  exit 1
fi

PALACE_DIR="$HOME/watson-palace"
WING_DIR="$PALACE_DIR/wings/dopaflow"
mkdir -p "$WING_DIR/hall_events"

# Create JSON entry
ENTRY="$WING_DIR/hall_events/packy-$SESSION-$(date +%Y%m%d-%H%M%S).json"
cat > "$ENTRY" <<JSON
{
  "type": "PackyMemory",
  "session_id": "$SESSION",
  "role": "$ROLE",
  "text": "$TEXT",
  "intent": "$INTENT",
  "timestamp": "$(date -Iseconds)"
}
JSON

# Index to MemPalace
cd "$PALACE_DIR" && yes "" | ~/.watson-venv/bin/mempalace init "$PALACE_DIR" > /dev/null 2>&1
~/.watson-venv/bin/mempalace mine "$PALACE_DIR" > /dev/null 2>&1

echo "[packy-memoria] Stored: $ENTRY"
