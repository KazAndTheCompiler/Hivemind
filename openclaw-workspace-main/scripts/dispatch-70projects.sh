#!/bin/bash
# dispatch-70projects.sh — Dispatch 70 cybersecurity projects to all 7 agents
# Runs as cron job to keep agents working

AGENTS=("zoe" "aria" "bea" "nora" "luna" "sky" "pixie")
PORTS=(18789 18790 18793 18803 18798 18799 18794)
CHANNELS=(1492662195832619109 1492662312845443162 1492662493393457232 1492662699891491027 1492662830766358711 1492663210183098571 1492663362608300233)

LOG="/tmp/dispatch-70projects.log"

log() {
    echo "[$(date)] $1" >> "$LOG"
}

log "Starting dispatch to all agents"

for i in "${!AGENTS[@]}"; do
    AGENT="${AGENTS[$i]}"
    PORT="${PORTS[$i]}"
    CHANNEL="${CHANNELS[$i]}"
    
    TASK_FILE="/home/openclaw/.openclaw-${AGENT}/workspace/TASK-70PROJECTS.md"
    
    if [ ! -f "$TASK_FILE" ]; then
        log "No task file for $AGENT, skipping"
        continue
    fi
    
    # Check if agent has a current project
    CURRENT_PROJECT=$(grep -c "\- \[ \]" "$TASK_FILE" 2>/dev/null || echo "0")
    if [ "$CURRENT_PROJECT" -eq "0" ]; then
        log "$AGENT has no pending projects, skipping"
        continue
    fi
    
    log "Dispatching $AGENT (port $PORT, channel $CHANNEL)"
    
    # Send task reminder via gateway WebSocket
    # The bot will pick this up when it next polls
    curl -s -X POST "http://127.0.0.1:${PORT}/v1/dispatch" \
        -H "Content-Type: application/json" \
        -d "{\"agent\":\"$AGENT\",\"task\":\"70projects\",\"channel\":$CHANNEL}" \
        >> "$LOG" 2>&1 || true
    
done

log "Dispatch complete"
