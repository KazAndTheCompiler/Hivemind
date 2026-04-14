#!/bin/bash
# Step 2.2: Palace Retrieve
# Reads back recent Zoe emissions from the palace

echo "=== Palace Retrieve ==="
echo "Wing: zoe | Hall: events"
echo ""

WING_EVENTS="$HOME/watson-palace/wings/zoe/hall_events"

if [ -d "$WING_EVENTS" ]; then
  echo "Recent emissions:"
  ls -t "$WING_EVENTS"/zoe-heartbeat-*.json 2>/dev/null | head -5 | while read f; do
    echo ""
    echo "--- $(basename $f) ---"
    python3 -c "
import json, sys
try:
    d = json.load(open('$f'))
    print('Task:', d.get('task_id'))
    print('Time:', d.get('timestamp'))
    print('Summary:', d.get('summary',''))
    print('Findings:', len(d.get('findings',[])))
    print('Confidence:', d.get('confidence'))
except:
    print('(corrupt)')
" 2>/dev/null || echo "(error reading)"
  done
else
  echo "No wing directory found at $WING_EVENTS"
fi

echo ""
echo "=== Palace Status ==="
~/.watson-venv/bin/mempalace status 2>/dev/null || echo "MemPalace not available"