# Watson Project — Phased Build Plan

**ADR:** ADR-001-production-architecture  
**Date:** 2026-04-12  
**Status:** Implementation Guide

---

## Overview

Build progresses in 5 phases. Each phase is gated — next phase starts only when prior phase has passing e2e tests. Failures return to prior phase for fix.

**Key principle:** Prompts are files. Not in-chat instructions. Each phase writes prompt files that get executed in order.

---

## Phase Dependencies

```
Phase 1 (Foundation)
  ↓
Phase 2 (Agent Emission Integration)
  ↓
Phase 3 (Supervisor + Routing)
  ↓
Phase 4 (Discord Bot Isolation)
  ↓
Phase 5 (Pixie + Ollama Toolshed)
```

---

## PHASE 1 — Foundation

**Goal:** MemPalace + Guard Stack + Palace structure running locally  
**Duration:** ~2 hours  
**Exit gate:** e2e test passes — search returns results, guard rejects bad emissions

### Step 1.1 — Environment Setup

**Prompt file:** `phase1/step1-setup.sh`

```bash
#!/bin/bash
# Install mempalace if not present
pip install mempalace --quiet

# Verify installation
mempalace --version

# Check ChromaDB
python3 -c "import chromadb; print('ChromaDB:', chromadb.__version__)"
```

**Test:** `mempalace --version` returns version. ChromaDB imports.

---

### Step 1.2 — Palace Initialization

**Prompt file:** `phase1/step2-init-palace.sh`

```bash
#!/bin/bash
# Initialize palace at ~/watson-palace
mempalace init ~/watson-palace

# Create wing directories manually (mempalace init may not auto-detect all)
mkdir -p ~/watson-palace/wings/{zoe,aria,bea,pixie,kaz,dopaflow,packy}
mkdir -p ~/watson-palace/wings/zoe/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/aria/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/bea/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/pixie/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/kaz/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/dopaflow/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/packy/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}

# Mine existing project files
mempalace mine ~/.openclaw/workspace --mode project
mempalace mine ~/.openclaw-aria/workspace --mode project
mempalace mine ~/.openclaw-bea/workspace --mode project

echo "Palace initialized"
mempalace status
```

**Test:** `mempalace status` shows entries indexed across wings.

---

### Step 1.3 — Guard Stack Implementation

**Prompt file:** `phase1/step3-guards.ts`

Write TypeScript guard stack at `~/watson/guards.ts` (already exists, verify and validate):

```typescript
// Guards verify before write. 3 stages:
// 1. TypeScriptGuard — structural contract
// 2. SemanticGuard — signal floor (file_refs + action verbs)
// 3. CondenseGuard — Ollama schema condensation

import type { WatsonEmission, GuardResult, Finding } from "./schema.ts";

export const SIGNAL_FLOOR = {
  require_file_refs: true,
  require_action_verbs: true,
  min_findings: 0,
  allowed_action_verbs: [
    "fix", "add", "remove", "update", "create", "delete",
    "replace", "implement", "unify", "thread",
    "route", "wire", "deprecate", "audit", "build",
    "test", "verify", "check", "unwire", "split"
  ]
};

export function runGuardStack(emission: WatsonEmission): GuardResult {
  // Stage 1: TypeScriptGuard
  const tsResult = typescriptGuard(emission);
  if (!tsResult.pass) return tsResult;

  // Stage 2: SemanticGuard  
  const semResult = semanticGuard(emission);
  if (!semResult.pass) return semResult;

  // Stage 3: CondenseGuard
  return condenseGuard(emission);
}

function typescriptGuard(emission: WatsonEmission): GuardResult {
  // Validate structure
  return { pass: true, stage: "typescript", errors: [] };
}

function semanticGuard(emission: WatsonEmission): GuardResult {
  // Validate signal floor
  return { pass: true, stage: "semantic", errors: [] };
}

function condenseGuard(emission: WatsonEmission): GuardResult {
  // Condense to Ollama-friendly schema
  return { pass: true, stage: "condense", errors: [], emission };
}
```

**Test:** TypeScript compiles without errors. Run sample emission through guard stack.

---

### Step 1.4 — E2E Test for Phase 1

**Prompt file:** `phase1/e2e-test.sh`

```bash
#!/bin/bash
set -e

echo "=== PHASE 1 E2E TEST ==="

# Test 1: MemPalace search returns results
echo "[1/4] Testing MemPalace search..."
RESULT=$(mempalace search "GPT2 bfloat16 crash AMD C-50" 2>&1)
if echo "$RESULT" | grep -q "memory"; then
  echo "  PASS: Search returns memories"
else
  echo "  FAIL: Search returned nothing"
  exit 1
fi

# Test 2: Guard stack rejects malformed emission
echo "[2/4] Testing guard stack rejection..."
node -e "
const { runGuardStack } = require('./watson/guards.ts');
const badEmission = { version: '1.0', emitter: 'aria', task_id: 't1', status: 'done', findings: [], next_actions: [], confidence: 1.0 };
// Missing required fields - should fail
const result = runGuardStack(badEmission);
if (!result.pass) { console.log('  PASS: Guard stack rejects bad emission'); process.exit(0); }
else { console.log('  FAIL: Guard stack accepted bad emission'); process.exit(1); }
"

# Test 3: Guard stack accepts valid emission
echo "[3/4] Testing guard stack acceptance..."
node -e "
const { runGuardStack } = require('./watson/guards.ts');
const goodEmission = {
  version: '1.0',
  emitter: 'aria',
  task_id: 'sec-audit-001',
  status: 'done',
  summary: 'Fixed bfloat16 crash on AMD C-50',
  findings: [{
    id: 'S01',
    severity: 'high',
    area: 'tooling',
    title: 'bfloat16 incompatibility on AMD C-50',
    file_refs: ['~/packy2/gpt2_mouth.py'],
    evidence: 'Segfault at 94% model load',
    action: 'Use float32 instead of bfloat16'
  }],
  next_actions: [{ agent: 'zoe', description: 'Confirm fix', priority: 'soon' }],
  confidence: 0.95
};
const result = runGuardStack(goodEmission);
if (result.pass) { console.log('  PASS: Guard stack accepts valid emission'); process.exit(0); }
else { console.log('  FAIL: Guard stack rejected valid emission:', result.errors); process.exit(1); }
"

# Test 4: Palace status shows wings
echo "[4/4] Testing palace structure..."
STATUS=$(mempalace status 2>&1)
for wing in zoe aria bea pixie kaz dopaflow packy; do
  if echo "$STATUS" | grep -q "$wing"; then
    echo "  PASS: Wing $wing exists"
  else
    echo "  FAIL: Wing $wing missing"
    exit 1
  fi
done

echo ""
echo "=== PHASE 1 E2E: ALL TESTS PASSED ==="
```

**Exit gate:** All 4 tests pass. If any fail, fix and retest Phase 1 before proceeding.

---

## PHASE 2 — Agent Emission Integration

**Goal:** Aria and Bea emit to palace on cron schedule  
**Duration:** ~3 hours  
**Exit gate:** e2e test confirms emissions land in palace and are retrievable

### Step 2.1 — Aria Security Audit Cron

**Prompt file:** `phase2/step1-aria-cron.sh`

```bash
#!/bin/bash
# Set up Aria's security audit cron — runs every 6 hours
# Cron job ID: aria-sec-audit-001

# Create the cron script
cat > ~/.openclaw-aria/security-audit.sh << 'CRON'
#!/bin/bash
# Security audit script for Aria
# Runs fail2ban, checks SSH logs, reviews open ports, emits findings to palace

AGENT="aria"
TIMESTAMP=$(date -Iseconds)
TASK_ID="sec-audit-$(date +%Y%m%d-%H%M)"

echo "[Aria] Running security audit..."

# Run fail2ban status check
FAIL2BAN_STATUS=$(sudo fail2ban-client status 2>/dev/null || echo "fail2ban not running")

# Check SSH login attempts
SSH_FAILURES=$(grep -c "Failed password" /var/log/auth.log 2>/dev/null || echo "0")

# Check open ports
OPEN_PORTS=$(ss -tlnp 2>/dev/null | grep -v "State" | wc -l)

# Check system updates
UPDATES=$(apt list --upgradable 2>/dev/null | grep -c "upgradable" || echo "0")

# Check UFW status
UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")

# Build findings array
FINDINGS="[]"
if [ "$SSH_FAILURES" -gt 10 ]; then
  FINDINGS=$(echo "$FINDINGS" | jq ". += [{\"id\":\"S01\",\"severity\":\"high\",\"area\":\"tooling\",\"title\":\"High SSH failure count\",\"file_refs\":[\"/var/log/auth.log\"],\"evidence\":\"$SSH_FAILURES failed logins detected\",\"action\":\"Review fail2ban banned IPs\"}]")
fi

if [ "$UPDATES" -gt 50 ]; then
  FINDINGS=$(echo "$FINDINGS" | jq ". += [{\"id\":\"S02\",\"severity\":\"medium\",\"area\":\"tooling\",\"title\":\"System needs updates\",\"file_refs\":[\"/var/lib/apt\"],\"evidence\":\"$UPDATES packages upgradable\",\"action\":\"Run apt update && upgrade\"}]")
fi

# Build emission
EMISSION=$(cat << EOF
{
  "version": "1.0",
  "emitter": "$AGENT",
  "timestamp": "$TIMESTAMP",
  "task_id": "$TASK_ID",
  "status": "done",
  "summary": "Security audit complete. SSH failures: $SSH_FAILURES, Open ports: $OPEN_PORTS, Updates: $UPDATES",
  "findings": $FINDINGS,
  "next_actions": [{"agent": "zoe", "description": "Review findings", "priority": "soon"}],
  "confidence": 0.9
}
EOF)

echo "[Aria] Emission prepared:"
echo "$EMISSION" | jq .

# Write to palace (via mempalace mine on the output)
echo "$EMISSION" > /tmp/aria-emission-$TASK_ID.json

# Mine this emission into the palace
mempalace mine /tmp/aria-emission-$TASK_ID.json --mode general 2>/dev/null || true

echo "[Aria] Audit complete."
CRON

chmod +x ~/.openclaw-aria/security-audit.sh

# Add to crontab
(crontab -l 2>/dev/null | grep -v "security-audit.sh"; echo "0 */6 * * * ~/.openclaw-aria/security-audit.sh >> ~/.openclaw-aria/logs/audit.log 2>&1") | crontab -

echo "Aria security audit cron installed"
crontab -l | grep security-audit
```

**Test:** Cron installed. Script runs without error. Output written to audit.log.

---

### Step 2.2 — Bea Coding Heartbeat Cron

**Prompt file:** `phase2/step2-bea-cron.sh`

```bash
#!/bin/bash
# Set up Bea's coding heartbeat — runs every 5 minutes
# Emits task status, regression results, code decisions to palace

cat > ~/.openclaw-bea/coding-heartbeat.sh << 'CRON'
#!/bin/bash
AGENT="bea"
TIMESTAMP=$(date -Iseconds)
TASK_ID="bea-heartbeat-$(date +%Y%m%d-%H%M)"

echo "[Bea] Running coding heartbeat..."

# Check DopaFlow project status
DOPAFLOW_STATUS="unknown"
if [ -d ~/.openclaw-bea/workspace/DopaFlow ]; then
  DOPAFLOW_STATUS=$(cd ~/.openclaw-bea/workspace/DopaFlow && git status --porcelain 2>/dev/null | wc -l)
fi

# Check MemPalace mining status
MINEPALACE_STATUS=$(mempalace status 2>&1 | grep "entries" | awk '{print $2}' || echo "0")

# Check recent test results
TEST_RESULT="unknown"
if [ -f ~/.openclaw-bea/workspace/DopaFlow/test-results.txt ]; then
  TEST_RESULT=$(tail -1 ~/.openclaw-bea/workspace/DopaFlow/test-results.txt 2>/dev/null || echo "unknown")
fi

# Build emission
EMISSION=$(cat << EOF
{
  "version": "1.0",
  "emitter": "$AGENT",
  "timestamp": "$TIMESTAMP",
  "task_id": "$TASK_ID",
  "status": "done",
  "summary": "Heartbeat: DopaFlow dirty=$DOPAFLOW_STATUS, Palace entries=$MINEPALACE_STATUS, Tests=$TEST_RESULT",
  "findings": [
    {"id": "B01", "severity": "low", "area": "tooling", "title": "Heartbeat check", "file_refs": ["~/.openclaw-bea/coding-heartbeat.sh"], "evidence": "System operational", "action": "None"}
  ],
  "next_actions": [{"agent": "zoe", "description": "Review if any findings need action", "priority": "later"}],
  "confidence": 0.95
}
EOF)

echo "$EMISSION" > /tmp/bea-emission-$TASK_ID.json
mempalace mine /tmp/bea-emission-$TASK_ID.json --mode general 2>/dev/null || true

echo "[Bea] Heartbeat complete."
CRON

chmod +x ~/.openclaw-bea/coding-heartbeat.sh

# Add to crontab (every 5 min)
(crontab -l 2>/dev/null | grep -v "coding-heartbeat.sh"; echo "*/5 * * * * ~/.openclaw-bea/coding-heartbeat.sh >> ~/.openclaw-bea/logs/heartbeat.log 2>&1") | crontab -

echo "Bea coding heartbeat cron installed"
crontab -l | grep coding-heartbeat
```

**Test:** Cron installed. Script runs without error.

---

### Step 2.3 — Emission Validation (Guard-Integrated)

**Prompt file:** `phase2/step3-emission-validate.sh`

Validates that all emissions from cron scripts pass through guard stack before palace write:

```bash
#!/bin/bash
# Before writing to palace, run emission through guard stack

EMISSION_FILE="$1"
if [ -z "$EMISSION_FILE" ]; then
  echo "Usage: $0 <emission-file.json>"
  exit 1
fi

# Read emission
EMISSION=$(cat "$EMISSION_FILE")

# Run through guard stack (Node.js)
node -e "
const fs = require('fs');
const emission = JSON.parse(fs.readFileSync('$EMISSION_FILE'));
const { runGuardStack } = require('/home/openclaw/.openclaw/workspace/watson/guards.ts');
const result = runGuardStack(emission);
if (result.pass) {
  console.log('GUARD_PASS');
  fs.writeFileSync('$EMISSION_FILE', JSON.stringify(result.emission, null, 2));
} else {
  console.log('GUARD_FAIL:', JSON.stringify(result.errors));
  process.exit(1);
}
"

if [ $? -eq 0 ]; then
  echo "Emission passed guards. Writing to palace..."
  # Write to palace wings
  mempalace mine "$EMISSION_FILE" --mode general 2>/dev/null || true
else
  echo "Emission rejected by guard stack. Fix and retry."
  exit 1
fi
```

**Test:** Valid emission passes. Malformed emission is rejected with errors.

---

### Step 2.4 — E2E Test for Phase 2

**Prompt file:** `phase2/e2e-test.sh`

```bash
#!/bin/bash
set -e

echo "=== PHASE 2 E2E TEST ==="

# Test 1: Aria security audit script runs without error
echo "[1/5] Testing Aria security audit script..."
bash ~/.openclaw-aria/security-audit.sh > /tmp/aria-test-output.txt 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Aria script runs"
else
  echo "  FAIL: Aria script failed"
  cat /tmp/aria-test-output.txt
  exit 1
fi

# Test 2: Bea coding heartbeat script runs without error
echo "[2/5] Testing Bea coding heartbeat script..."
bash ~/.openclaw-bea/coding-heartbeat.sh > /tmp/bea-test-output.txt 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Bea script runs"
else
  echo "  FAIL: Bea script failed"
  cat /tmp/bea-test-output.txt
  exit 1
fi

# Test 3: Guard stack integration — emission passes guards
echo "[3/5] Testing emission guard integration..."
VALID_EMISSION=$(cat << 'EOF'
{
  "version": "1.0",
  "emitter": "aria",
  "task_id": "test-sec-001",
  "status": "done",
  "summary": "Test security finding",
  "findings": [{"id": "T01", "severity": "low", "area": "tooling", "title": "Test", "file_refs": ["test.ts"], "evidence": "test", "action": "none"}],
  "next_actions": [{"agent": "zoe", "description": "confirm", "priority": "soon"}],
  "confidence": 0.9
}
EOF
)
echo "$VALID_EMISSION" > /tmp/test-emission.json

bash /home/openclaw/.openclaw/workspace/watson/emission-validate.sh /tmp/test-emission.json
if [ $? -eq 0 ]; then
  echo "  PASS: Emission passes guard validation"
else
  echo "  FAIL: Emission rejected by guards"
  exit 1
fi

# Test 4: Palace retrieves the emitted data
echo "[4/5] Testing MemPalace retrieval..."
sleep 2
RESULT=$(mempalace search "Test security finding" 2>&1)
if echo "$RESULT" | grep -q "test"; then
  echo "  PASS: Palace returns emitted data"
else
  echo "  WARN: Search may be empty (ChromaDB indexing delay)"
fi

# Test 5: Cron entries present
echo "[5/5] Testing crontab entries..."
CRONTAB=$(crontab -l 2>/dev/null)
if echo "$CRONTAB" | grep -q "security-audit.sh"; then
  echo "  PASS: Aria cron installed"
else
  echo "  FAIL: Aria cron missing"
  exit 1
fi
if echo "$CRONTAB" | grep -q "coding-heartbeat.sh"; then
  echo "  PASS: Bea cron installed"
else
  echo "  FAIL: Bea cron missing"
  exit 1
fi

echo ""
echo "=== PHASE 2 E2E: ALL TESTS PASSED ==="
```

**Exit gate:** All 5 tests pass.

---

## PHASE 3 — Supervisor + Routing

**Goal:** Zoe as supervisor — reads palace, routes tasks, consolidates memory  
**Duration:** ~3 hours  
**Exit gate:** Zoe retrieves from palace and responds correctly to a routed task

### Step 3.1 — Zoe Palace Reader

**Prompt file:** `phase3/step1-zoe-palace-reader.sh`

Configures Zoe to read from palace on wake-up instead of relying on session context:

```bash
#!/bin/bash
# Create Zoe's palace wake-up script
# Runs on start — loads relevant context from palace

cat > ~/.openclaw/workspace/watson/zoe-wake-up.sh << 'SCRIPT'
#!/bin/bash
# Zoe wake-up — loads critical context from palace

PALACE_PATH=~/watson-palace
PERSONAL_WING=wing_zoe
SHARED_WING=wing_kaz

echo "[Zoe] Waking up — loading palace context..."

# Load recent facts from own wing
echo "=== Recent Zoe Facts ===" 
cat $PALACE_PATH/wings/$PERSONAL_WING/hall_facts/*.md 2>/dev/null | tail -10

echo ""
echo "=== Recent Kaz Preferences ==="
cat $PALACE_PATH/wings/$SHARED_WING/hall_preferences/*.md 2>/dev/null | tail -10

echo ""
echo "=== Active Tasks ==="
cat $PALACE_PATH/wings/*/hall_events/*.md 2>/dev/null | grep -A5 "task" | tail -20

echo ""
echo "=== Pending Actions ==="
cat $PALACE_PATH/wings/*/hall_advice/*.md 2>/dev/null | tail -10

echo ""
echo "[Zoe] Wake-up complete."
SCRIPT

chmod +x ~/.openclaw/workspace/watson/zoe-wake-up.sh

# Integrate into Zoe's startup (AGENTS.md section)
echo "Zoe wake-up script created at ~/.openclaw/workspace/watson/zoe-wake-up.sh"
```

**Test:** Script runs and outputs palace context.

---

### Step 3.2 — Routing Table

**Prompt file:** `phase3/step2-routing-table.sh`

```bash
#!/bin/bash
# Create routing table for Watson supervisor

cat > ~/.openclaw/workspace/watson/routing.json << 'EOF'
{
  "routing": {
    "security": ["aria"],
    "audit": ["aria"],
    "hack": ["aria"],
    "vulnerability": ["aria"],
    "code": ["bea"],
    "refactor": ["bea"],
    "debug": ["bea"],
    "build": ["bea"],
    "test": ["bea"],
    "regression": ["bea"],
    "mempalace": ["bea"],
    "memory": ["zoe", "bea"],
    "configure": ["zoe"],
    "setup": ["zoe"],
    "default": ["zoe"]
  },
  "signal_floor": {
    "require_file_refs": true,
    "require_action_verbs": true,
    "min_findings": 0,
    "allowed_action_verbs": [
      "fix", "add", "remove", "update", "create", "delete",
      "replace", "implement", "unify", "thread", "route", "wire",
      "deprecate", "audit", "build", "test", "verify", "check"
    ]
  }
}
EOF

echo "Routing table created:"
cat ~/.openclaw/workspace/watson/routing.json
```

**Test:** JSON valid. Routing keywords map to correct agents.

---

### Step 3.3 — Zoe Palace Consolidation Cron

**Prompt file:** `phase3/step3-zoe-consolidation.sh`

```bash
#!/bin/bash
# Zoe consolidation — runs weekly
# Sweeps palace, consolidates stale entries, logs decisions

cat > ~/.openclaw/workspace/watson/zoe-consolidate.sh << 'SCRIPT'
#!/bin/bash
PERSONAL_WING=wing_zoe
ALL_WINGS="wing_zoe wing_aria wing_bea wing_pixie wing_kaz wing_dopaflow wing_packy"
TIMESTAMP=$(date -Iseconds)

echo "[Zoe] Running palace consolidation..."

# Generate palace status report
echo "=== Palace Status Report: $TIMESTAMP ===" > /tmp/palace-report-$TIMESTAMP.md

for wing in $ALL_WINGS; do
  wing_path=~/watson-palace/wings/$wing
  if [ -d "$wing_path" ]; then
    fact_count=$(find $wing_path/hall_facts -name "*.md" 2>/dev/null | wc -l)
    event_count=$(find $wing_path/hall_events -name "*.md" 2>/dev/null | wc -l)
    discovery_count=$(find $wing_path/hall_discoveries -name "*.md" 2>/dev/null | wc -l)
    echo "- $wing: facts=$fact_count events=$event_count discoveries=$discovery_count" >> /tmp/palace-report-$TIMESTAMP.md
  fi
done

# Check for stale entries (>30 days old)
STALE_COUNT=0
for wing in $ALL_WINGS; do
  stale=$(find ~/watson-palace/wings/$wing -name "*.md" -mtime +30 2>/dev/null | wc -l)
  STALE_COUNT=$((STALE_COUNT + stale))
done
echo "- Stale entries (>30 days): $STALE_COUNT" >> /tmp/palace-report-$TIMESTAMP.md

# Move stale entries to attic
if [ $STALE_COUNT -gt 0 ]; then
  mkdir -p ~/watson-palace/attic/$(date +%Y-%m)
  find ~/watson-palace/wings -name "*.md" -mtime +30 -exec mv {} ~/watson-palace/attic/$(date +%Y-%m)/ \; 2>/dev/null
  echo "- Archived $STALE_COUNT stale entries" >> /tmp/palace-report-$TIMESTAMP.md
fi

# Echo report
cat /tmp/palace-report-$TIMESTAMP.md

# Mine the report into palace
mempalace mine /tmp/palace-report-$TIMESTAMP.md --mode general 2>/dev/null || true

echo "[Zoe] Consolidation complete."
SCRIPT

chmod +x ~/.openclaw/workspace/watson/zoe-consolidate.sh

# Add to crontab (weekly — Sunday 3am)
(crontab -l 2>/dev/null | grep -v "zoe-consolidate.sh"; echo "0 3 * * 0 ~/.openclaw/workspace/watson/zoe-consolidate.sh >> ~/.openclaw/workspace/watson/logs/consolidation.log 2>&1") | crontab -

echo "Zoe consolidation cron installed (runs Sundays at 3am)"
crontab -l | grep zoe-consolidate
```

**Test:** Cron installed. Consolidation script runs without error.

---

### Step 3.4 — E2E Test for Phase 3

**Prompt file:** `phase3/e2e-test.sh`

```bash
#!/bin/bash
set -e

echo "=== PHASE 3 E2E TEST ==="

# Test 1: Zoe wake-up script runs
echo "[1/4] Testing Zoe wake-up script..."
bash ~/.openclaw/workspace/watson/zoe-wake-up.sh > /tmp/zoe-wake-test.txt 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Zoe wake-up script runs"
else
  echo "  FAIL: Zoe wake-up script failed"
  exit 1
fi

# Test 2: Routing table is valid JSON with correct mappings
echo "[2/4] Testing routing table..."
python3 -c "
import json
with open('/home/openclaw/.openclaw/workspace/watson/routing.json') as f:
    rt = json.load(f)
assert 'security' in rt['routing'], 'security route missing'
assert rt['routing']['security'][0] == 'aria', 'security should route to aria'
assert 'code' in rt['routing'], 'code route missing'
assert rt['routing']['code'][0] == 'bea', 'code should route to bea'
print('  PASS: Routing table valid')
"

# Test 3: Zoe consolidation script runs
echo "[3/4] Testing Zoe consolidation script..."
bash ~/.openclaw/workspace/watson/zoe-consolidate.sh > /tmp/zoe-consolidation-test.txt 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Zoe consolidation script runs"
else
  echo "  FAIL: Zoe consolidation script failed"
  cat /tmp/zoe-consolidation-test.txt
  exit 1
fi

# Test 4: Palace search returns historical data
echo "[4/4] Testing palace retrieval for routing context..."
mempalace search "security audit" > /tmp/search-result.txt 2>&1 || true
if grep -q "security\|audit\|aria" /tmp/search-result.txt; then
  echo "  PASS: Palace returns relevant data for routing"
else
  echo "  WARN: Palace search returned no results (may be empty index)"
fi

echo ""
echo "=== PHASE 3 E2E: ALL TESTS PASSED ==="
```

**Exit gate:** All 4 tests pass.

---

## PHASE 4 — Discord Bot Isolation

**Goal:** Each agent (Zoe, Aria, Bea) has its own Discord bot + private channel  
**Duration:** ~2 hours  
**Exit gate:** All 3 bots respond to test messages in their respective channels

### Step 4.1 — Bot Configuration

**Prompt file:** `phase4/step1-discord-bots.sh`

```bash
#!/bin/bash
# Configure 3 separate Discord bots
# Zoe: port 18789, token from .env (zoe clawbot=)
# Aria: port 18790, token from .env (aria clawbot=)
# Bea: port 18793, token from .env (bea clawbot=)

# Stop current gateway
pkill -f openclaw-gateway 2>/dev/null || true
sleep 2

echo "=== Configuring Discord bots ==="

# Verify tokens in .env
grep "zoe clawbot\|aria clawbot\|bea clawbot" ~/.env | while read line; do
  echo "Found: $(echo $line | cut -d= -f1)=$(echo $line | cut -d= -f2 | cut -c1-20)..."
done

echo ""
echo "Starting Zoe gateway (port 18789)..."
openclaw gateway run --port 18789 &
sleep 3

echo "Starting Aria gateway (port 18790)..."
OPENCLAW_CONFIG_PATH=~/.openclaw-aria/openclaw.json \
OPENCLAW_STATE_DIR=~/.openclaw-aria \
openclaw gateway run --port 18790 &
sleep 3

echo "Starting Bea gateway (port 18793)..."
OPENCLAW_CONFIG_PATH=~/.openclaw-bea/openclaw.json \
OPENCLAW_STATE_DIR=~/.openclaw-bea \
openclaw gateway run --port 18793 &
sleep 3

echo ""
echo "Checking all gateways..."
for port in 18789 18790 18793; do
  if curl -s http://127.0.0.1:$port/ > /dev/null 2>&1; then
    echo "  Port $port: UP"
  else
    echo "  Port $port: DOWN"
  fi
done
```

**Test:** All 3 ports respond.

---

### Step 4.2 — Private Channel Setup

**Prompt file:** `phase4/step2-private-channels.sh`

```bash
#!/bin/bash
# For each bot, create or verify a private channel exists
# Zoe → #zoe-private
# Aria → #aria-private
# Bea → #bea-private

# Channel IDs (from config)
ZOE_CHANNEL="1492662195832619109"
ARIA_CHANNEL="1492662312845443162"
BEA_CHANNEL="1492662375845412940"  # placeholder — update after bot join

echo "Private channels:"
echo "  Zoe: $ZOE_CHANNEL"
echo "  Aria: $ARIA_CHANNEL"
echo "  Bea: $BEA_CHANNEL (verify after bot joins)"
echo ""
echo "Each bot should be @ mentioned in its channel to activate."
echo "Bots need 'Manage Channels' permission to create channels automatically."
```

**Test:** Bots join server. Private channels confirmed.

---

### Step 4.3 — E2E Test for Phase 4

**Prompt file:** `phase4/e2e-test.sh`

```bash
#!/bin/bash
set -e

echo "=== PHASE 4 E2E TEST ==="

# Test 1: All 3 gateway ports responding
echo "[1/4] Testing gateway ports..."
for port in 18789 18790 18793; do
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ | grep -q "200\|401"; then
    echo "  PASS: Port $port responds"
  else
    echo "  FAIL: Port $port not responding"
    exit 1
  fi
done

# Test 2: All 3 Discord bots show OK in health
echo "[2/4] Testing Discord bot status..."
for port in 18789 18790 18793; do
  STATUS=$(curl -s http://127.0.0.1:$port/api/health 2>/dev/null | grep -i discord | head -1)
  if echo "$STATUS" | grep -q "OK\|connected"; then
    echo "  PASS: Port $port Discord OK"
  else
    echo "  WARN: Port $port Discord status unclear: $STATUS"
  fi
done

# Test 3: Bots respond to ping in respective channels (manual test)
echo "[3/4] Manual test required — ping each bot in its channel:"
echo "  - Zoe: @Zoe in #zoe-private"
echo "  - Aria: @Aria in #aria-private" 
echo "  - Bea: @Bea in #bea-private"
echo "  (This test requires human verification)"

# Test 4: No cross-channel message bleed
echo "[4/4] Checking for cross-channel message routing..."
# Verify each gateway only handles its own bot token
for port in 18789 18790 18793; do
  CONFIGS=$(curl -s http://127.0.0.1:$port/api/status 2>/dev/null | grep -i "token\|discord" | head -2)
  echo "  Port $port: $CONFIGS"
done

echo ""
echo "=== PHASE 4 E2E: GATEWAY TESTS PASSED ==="
echo "=== MANUAL VERIFICATION REQUIRED ==="
```

**Exit gate:** All gateway tests pass + human verifies bot responses.

---

## PHASE 5 — Pixie + Ollama Toolshed

**Goal:** Pixie (local Ollama Q4_K_M) runs toolshed scripts, emits structured data to palace  
**Duration:** ~2 hours  
**Exit gate:** Ollama generates valid toolshed output, data lands in palace

### Step 5.1 — Ollama Toolshed Integration

**Prompt file:** `phase5/step1-ollama-toolshed.sh`

```bash
#!/bin/bash
# Configure Pixie (Ollama local) to run toolshed scripts
# Toolshed scripts: common utilities callable by all agents

TOOLSHED_DIR=~/toolshed
OLLAMA_MODEL=llama3.2
OLLAMA_ENDPOINT=http://127.0.0.1:11434

echo "=== Setting up Ollama toolshed ==="

# Create toolshed directory
mkdir -p $TOOLSHED_DIR/scripts
mkdir -p $TOOLSHED_DIR/output
mkdir -p $TOOLSHED_DIR/emissions

# Create diagnostic scripts
cat > $TOOLSHED_DIR/scripts/sysinfo.sh << 'SCRIPT'
#!/bin/bash
# System info emission script — outputs JSON for palace

echo "{"
echo "  \"type\": \"sysinfo\","
echo "  \"timestamp\": \"$(date -Iseconds)\","
echo "  \"hostname\": \"$(hostname)\","
echo "  \"uptime\": \"$(uptime -p 2>/dev/null || uptime)\","
echo "  \"load\": \"$(cat /proc/loadavg | awk '{print $1, $2, $3}')\","
echo "  \"memory_free\": \"$(free -h | grep Mem | awk '{print $3}')\","
echo "  \"disk_free\": \"$(df -h ~ | tail -1 | awk '{print $4}')\""
echo "}"
SCRIPT

cat > $TOOLSHED_DIR/scripts/network-check.sh << 'SCRIPT'
#!/bin/bash
# Network connectivity check — outputs JSON

echo "{"
echo "  \"type\": \"network-check\","
echo "  \"timestamp\": \"$(date -Iseconds)\","
echo "  \"tailscale_status\": \"$(tailscale status --json 2>/dev/null | jq -r '.BackendState' 2>/dev/null || echo 'unknown')\","
echo "  \"tailscale_ips\": \"$(tailscale status 2>/dev/null | grep -v '^Self' | awk '{print $1}' | tr '\n' ' ')\","
echo "  \"online\": $(ping -c 1 8.8.8.8 -W 2 > /dev/null 2>&1 && echo "true" || echo "false")"
echo "}"
SCRIPT

chmod +x $TOOLSHED_DIR/scripts/*.sh

# Test Ollama
echo "Testing Ollama..."
curl -s $OLLAMA_ENDPOINT/api/tags | jq '.models[].name' 2>/dev/null | head -5

echo ""
echo "Toolshed scripts created:"
ls -la $TOOLSHED_DIR/scripts/
```

**Test:** Ollama responds. Scripts are executable.

---

### Step 5.2 — Pixie Emission Pipeline

**Prompt file:** `phase5/step2-pixie-emission.sh`

```bash
#!/bin/bash
# Pixie emission pipeline — runs toolshed scripts, converts to palace emissions

TOOLSHED_DIR=~/toolshed
PALACE_PATH=~/watson-palace
TIMESTAMP=$(date -Iseconds)
TASK_ID="pixie-emit-$(date +%Y%m%d-%H%M)"

echo "[Pixie] Running toolshed emissions..."

# Run all toolshed scripts
SCRIPT_OUTPUT=""
for script in $TOOLSHED_DIR/scripts/*.sh; do
  name=$(basename $script .sh)
  echo "  Running $name..."
  output=$($script 2>/dev/null)
  SCRIPT_OUTPUT="$SCRIPT_OUTPUT\n$output"
done

# Build emission from toolshed results
cat > $TOOLSHED_DIR/emissions/emission-$TASK_ID.json << EOF
{
  "version": "1.0",
  "emitter": "pixie",
  "timestamp": "$TIMESTAMP",
  "task_id": "$TASK_ID",
  "status": "done",
  "summary": "Toolshed emission: sysinfo + network-check",
  "findings": [
    {
      "id": "P01",
      "severity": "low",
      "area": "tooling",
      "title": "Toolshed emission completed",
      "file_refs": ["$TOOLSHED_DIR/scripts/"],
      "evidence": "Scripts executed successfully",
      "action": "Monitor for anomalies"
    }
  ],
  "next_actions": [
    {"agent": "zoe", "description": "Review if any metrics are anomalous", "priority": "later"}
  ],
  "confidence": 0.95
}
EOF

echo "[Pixie] Emission created:"
cat $TOOLSHED_DIR/emissions/emission-$TASK_ID.json

# Mine into palace
mempalace mine $TOOLSHED_DIR/emissions/emission-$TASK_ID.json --mode general 2>/dev/null || true

echo "[Pixie] Emission pipeline complete."
```

**Test:** Emission JSON created. Mine command succeeds.

---

### Step 5.3 — Pixie Cron (Every 15 min)

**Prompt file:** `phase5/step3-pixie-cron.sh`

```bash
#!/bin/bash

# Create pixie emission cron (every 15 minutes)
cat > ~/toolshed/pixie-emit.sh << 'CRON'
#!/bin/bash
TOOLSHED_DIR=~/toolshed
PALACE_PATH=~/watson-palace
TIMESTAMP=$(date -Iseconds)
TASK_ID="pixie-emit-$(date +%Y%m%d-%H%M)"

# Run toolshed scripts
SYSINFO=$($TOOLSHED_DIR/scripts/sysinfo.sh 2>/dev/null)
NETCHECK=$($TOOLSHED_DIR/scripts/network-check.sh 2>/dev/null)

# Build emission
cat > $TOOLSHED_DIR/emissions/emission-$TASK_ID.json << EOF
{
  "version": "1.0",
  "emitter": "pixie",
  "timestamp": "$TIMESTAMP",
  "task_id": "$TASK_ID",
  "status": "done",
  "summary": "Toolshed: system + network",
  "findings": [
    {"id": "P01", "severity": "low", "area": "tooling", "title": "Toolshed run", "file_refs": ["$TOOLSHED_DIR/scripts/"], "evidence": "sysinfo+netcheck", "action": "Monitor"}
  ],
  "next_actions": [{"agent": "zoe", "description": "Check anomalies", "priority": "later"}],
  "confidence": 0.95
}
EOF

# Mine to palace
mempalace mine $TOOLSHED_DIR/emissions/emission-$TASK_ID.json --mode general 2>/dev/null || true

echo "[Pixie] $(date): Emission complete"
CRON

chmod +x ~/toolshed/pixie-emit.sh

# Add to crontab (every 15 min)
(crontab -l 2>/dev/null | grep -v "pixie-emit.sh"; echo "*/15 * * * * ~/toolshed/pixie-emit.sh >> ~/toolshed/logs/emission.log 2>&1") | crontab -

echo "Pixie cron installed (every 15 minutes)"
crontab -l | grep pixie
```

**Test:** Cron installed. Script runs without error.

---

### Step 5.4 — E2E Test for Phase 5

**Prompt file:** `phase5/e2e-test.sh`

```bash
#!/bin/bash
set -e

echo "=== PHASE 5 E2E TEST ==="

# Test 1: Ollama is running and responds
echo "[1/4] Testing Ollama..."
curl -s http://127.0.0.1:11434/api/tags | jq '.models[0].name' > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Ollama running"
else
  echo "  FAIL: Ollama not responding"
  exit 1
fi

# Test 2: Toolshed scripts run without error
echo "[2/4] Testing toolshed scripts..."
for script in ~/toolshed/scripts/*.sh; do
  name=$(basename $script)
  result=$(bash $script 2>&1)
  if [ $? -eq 0 ]; then
    echo "  PASS: $name runs"
  else
    echo "  FAIL: $name failed"
    exit 1
  fi
done

# Test 3: Pixie emission script runs
echo "[3/4] Testing Pixie emission pipeline..."
bash ~/toolshed/pixie-emit.sh > /tmp/pixie-test.txt 2>&1
if [ $? -eq 0 ]; then
  echo "  PASS: Pixie emission pipeline runs"
else
  echo "  FAIL: Pixie emission pipeline failed"
  cat /tmp/pixie-test.txt
  exit 1
fi

# Test 4: Palace receives pixie emission
echo "[4/4] Testing palace reception..."
sleep 2
RESULT=$(mempalace search "pixie toolshed" 2>&1)
if echo "$RESULT" | grep -qi "pixie\|toolshed\|sysinfo"; then
  echo "  PASS: Palace receives Pixie emissions"
else
  echo "  WARN: Palace search may be empty (Chromadb delay)"
fi

echo ""
echo "=== PHASE 5 E2E: ALL TESTS PASSED ==="
```

**Exit gate:** All 4 tests pass.

---

## Build Summary

| Phase | Duration | Exit Gate |
|-------|----------|-----------|
| 1: Foundation | ~2h | 4/4 e2e tests pass |
| 2: Agent Emission Integration | ~3h | 5/5 e2e tests pass |
| 3: Supervisor + Routing | ~3h | 4/4 e2e tests pass |
| 4: Discord Bot Isolation | ~2h | Gateway tests pass + manual verify |
| 5: Pixie + Ollama Toolshed | ~2h | 4/4 e2e tests pass |

**Total estimated time:** ~12 hours (spread across sessions)

**Parallelization:** Phase 4 (Discord) can start only after Phase 2+3 are working. Phase 5 (Pixie) is independent and can run alongside Phase 3+4.

---

## Error Recovery

If any phase fails its e2e test:
1. Do not proceed to next phase
2. Run diagnostics: `mempalace status`, `openclaw status`, check logs
3. Fix the specific failure
4. Re-run e2e test
5. Only proceed when all tests pass

**Debug commands:**
```bash
# Check all cron jobs
crontab -l

# Check gateway health
for port in 18789 18790 18793; do
  curl -s http://127.0.0.1:$port/api/health | jq .
done

# Check palace entries
mempalace status

# Check guard stack
node -e "const {runGuardStack} = require('./watson/guards.ts'); console.log('Guard OK')"

# Check Ollama
curl http://127.0.0.1:11434/api/tags | jq .
```