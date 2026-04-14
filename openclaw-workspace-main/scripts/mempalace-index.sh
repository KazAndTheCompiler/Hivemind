#!/bin/bash
# mempalece-index.sh — Index an emission into MemPalace
# Usage: cat <emission.json> | mempalece-index.sh <wing> <room>

WING="${1:-pixie}"
ROOM="${2:-emissions}"

# Read from stdin
EMISSION=$(cat)

# Extract key fields for MemPalace metadata
TASK_ID=$(echo "$EMISSION" | grep -o '"taskId"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
AGENT=$(echo "$EMISSION" | grep -o '"agent"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
PHASE=$(echo "$EMISSION" | grep -o '"phase"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')
TYPE=$(echo "$EMISSION" | grep -o '"type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

# Build metadata string for mempalace
METADATA="task=$TASK_ID agent=$AGENT phase=$PHASE type=$TYPE"

# Write emission to hall_events
EVENT_DIR="~/watson-palace/wings/$WING/hall_events"
mkdir -p "$EVENT_DIR"

FILENAME="${EVENT_DIR}/${TYPE}-${TASK_ID}-$(date +%Y%m%d-%H%M%S).json"
echo "$EMISSION" > "$FILENAME"
echo "Indexed: $FILENAME"

# Also emit summary to stdout for logging
echo "[$AGENT] $PHASE: $TASK_ID" >&2
