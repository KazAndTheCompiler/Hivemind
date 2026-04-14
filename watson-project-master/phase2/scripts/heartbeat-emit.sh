#!/bin/bash
set -eo pipefail

WATSON_DIR="/home/openclaw/.openclaw/workspace/watson"
PALACE_DIR="$HOME/watson-palace"
PHASE2_DIR="$WATSON_DIR/phase2"
TIMESTAMP=$(date -Iseconds)
TASK_ID="zoe-heartbeat-$(date +%Y%m%d-%H%M)"
LOG_FILE="$PHASE2_DIR/logs/emitter.log"

echo "[DBG] Starting heartbeat at $(date)"

mkdir -p "$PHASE2_DIR/logs" "$PHASE2_DIR/emissions"
echo "[DBG] Dirs created"

REPO_STATUS='{}'
for repo in "$HOME/secdev_project" "$HOME/watson-project" "$WATSON_DIR"; do
  if [ -d "$repo/.git" ]; then
    name=$(basename "$repo")
    cd "$repo"
    branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")
    behind=$(git rev-list HEAD..@{u} --count 2>/dev/null || echo "0")
    changes=$(git status --porcelain 2>/dev/null | wc -l || echo "0")
    REPO_STATUS=$(echo "$REPO_STATUS" | jq -c ". + {\"$name\": {\"branch\": \"$branch\", \"ahead\": $ahead, \"behind\": $behind, \"changes\": $changes}}")
  fi
done
cd "$WATSON_DIR"
echo "[DBG] REPO_STATUS=$REPO_STATUS"

MEMORY_FILES=$(find "$HOME/.openclaw/workspace/memory" -name "*.md" 2>/dev/null | wc -l)
SESSION_COUNT=$(find "$HOME/.openclaw/sessions" -name "*.jsonl" 2>/dev/null | wc -l)
echo "[DBG] MEM=$MEMORY_FILES SESS=$SESSION_COUNT"

LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
DISK_FREE=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
MEMORY_FREE=$(free -m | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
echo "[DBG] SYS load=$LOAD disk=$DISK_FREE mem=$MEMORY_FREE"

FINDINGS='[]'
if [ "$MEMORY_FILES" -lt 1 ]; then
  echo "[DBG] Adding Z01 finding"
  FINDINGS=$(echo "$FINDINGS" | jq ". += [{\"id\":\"Z01\",\"severity\":\"medium\",\"area\":\"memory\",\"title\":\"No memory files found\"}]")
fi
if [ "$SESSION_COUNT" -gt 50 ]; then
  echo "[DBG] Adding Z02 finding"
  FINDINGS=$(echo "$FINDINGS" | jq ". += [{\"id\":\"Z02\",\"severity\":\"low\",\"area\":\"sessions\",\"title\":\"Many sessions\"}]")
fi
echo "[DBG] FINDINGS=$FINDINGS"

REPO_NAMES=$(echo "$REPO_STATUS" | jq -r 'keys | join(", ")')
echo "[DBG] REPO_NAMES=$REPO_NAMES"

EMISSION_FILE="$PHASE2_DIR/emissions/$TASK_ID.json"
echo "[DBG] EMISSION_FILE=$EMISSION_FILE"

python3 - "$TIMESTAMP" "$TASK_ID" "$REPO_NAMES" "$MEMORY_FILES" "$SESSION_COUNT" "$LOAD" "$DISK_FREE" "$MEMORY_FREE" "$FINDINGS" "$REPO_STATUS" "$EMISSION_FILE" << 'PYEOF'
import json, sys
em = {
    "version": "1.0", "emitter": "zoe", "timestamp": sys.argv[1], "task_id": sys.argv[2],
    "status": "done",
    "summary": f"Repos: {sys.argv[3]}, Mem: {sys.argv[4]}, Sess: {sys.argv[5]}",
    "findings": json.loads(sys.argv[9]), "next_actions": [], "confidence": 0.95,
    "system": {"load_avg": sys.argv[6], "disk_usage_pct": sys.argv[7], "memory_pct": sys.argv[8],
               "repo_status": json.loads(sys.argv[10])}}
with open(sys.argv[11], 'w') as f: json.dump(em, f, indent=2)
print(f"OK: {sys.argv[11]}")
PYEOF

echo "[DBG] Python done, exit=$?"
ls -la "$EMISSION_FILE"
cat "$EMISSION_FILE" | head -5

echo "[DBG] Copying to palace..."
mkdir -p "$PALACE_DIR/wings/zoe/hall_events"
cp "$EMISSION_FILE" "$PALACE_DIR/wings/zoe/hall_events/"
echo "[DBG] Done. Palace has: $(ls ~/watson-palace/wings/zoe/hall_events/*.json 2>/dev/null | wc -l) files"
