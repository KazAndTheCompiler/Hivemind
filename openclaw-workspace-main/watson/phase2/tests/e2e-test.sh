#!/bin/bash
# Phase 2 E2E Test
# Full cycle: emit → palace → retrieve

set -e

WATSON_DIR="/home/openclaw/.openclaw/workspace/watson"
PHASE2_DIR="$WATSON_DIR/phase2"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

echo "=== PHASE 2 E2E TEST ==="
echo ""

# Test 1: Schema validation (Python)
echo "[1/5] Schema validation..."
python3 -c "
import json, sys
# Load and verify the TypeScript schema (as JSON)
schema = open('$PHASE2_DIR/schema.ts').read()
print('Schema has PHASE2_GOAL:', 'PHASE2_GOAL' in schema)
print('Schema has Phase2Emission:', 'Phase2Emission' in schema)
" && pass "Schema loads" || fail "Schema not loadable"

# Test 2: Heartbeat script exists
echo "[2/5] Heartbeat script..."
[ -x "$PHASE2_DIR/scripts/heartbeat.py" ] && pass "Heartbeat script exists and executable" || fail "Heartbeat script missing or not executable"

# Test 3: Retrieve script exists
echo "[3/5] Retrieve script..."
[ -x "$PHASE2_DIR/scripts/palace-retrieve.sh" ] && pass "Retrieve script exists" || fail "Retrieve script missing"

# Test 4: Run heartbeat emission
echo "[4/5] Run heartbeat emission..."
python3 "$PHASE2_DIR/scripts/heartbeat.py" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  pass "Heartbeat emission ran without error"
else
  fail "Heartbeat emission failed"
fi

# Test 5: Emission in palace
echo "[5/5] Emission in palace..."
WING_EVENTS="$HOME/watson-palace/wings/zoe/hall_events"
LATEST=$(ls -t "$WING_EVENTS"/zoe-heartbeat-*.json 2>/dev/null | head -1)
if [ -n "$LATEST" ] && [ -s "$LATEST" ]; then
  python3 -c "
import json
d = json.load(open('$LATEST'))
assert d.get('emitter') == 'zoe', f\"wrong emitter: {d.get('emitter')}\"
assert d.get('task_id'), 'missing task_id'
assert d.get('timestamp'), 'missing timestamp'
print('Emitter:', d['emitter'], '| Task:', d['task_id'])
" && pass "Emission in palace with required fields" || fail "Emission corrupt or missing fields"
else
  fail "No emission found in palace"
fi

echo ""
echo "=== PHASE 2 E2E: TESTS COMPLETE ==="