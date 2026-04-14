#!/bin/bash
# packy-query.sh — Query Packy memory from MemPalace
# Usage: packy-query.sh <query> [session_id]

QUERY="${1}"
SESSION="${2:-}"

if [ -z "$QUERY" ]; then
  echo "Usage: packy-query.sh <query> [session_id]"
  exit 1
fi

PALACE_DIR="$HOME/watson-palace"
WING_DIR="$PALACE_DIR/wings/dopaflow"

# Search MemPalace
if [ -n "$SESSION" ]; then
  find "$WING_DIR/hall_events" -name "packy-$SESSION-*.json" 2>/dev/null | \
    xargs grep -l "$QUERY" 2>/dev/null | \
    head -5 | \
    while read f; do echo "--- $(basename $f) ---"; cat "$f"; done
else
  find "$WING_DIR/hall_events" -name "packy-*.json" 2>/dev/null | \
    xargs grep -l "$QUERY" 2>/dev/null | \
    head -5 | \
    while read f; do echo "--- $(basename $f) ---"; cat "$f"; done
fi
