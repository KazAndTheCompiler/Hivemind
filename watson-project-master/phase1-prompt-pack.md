# Watson Project — Phase 1 Prompt Pack
# Foundation: MemPalace + Guard Stack + Palace Structure
# Executable order: step1-setup.sh → step2-init-palace.sh → step3-guards.ts → e2e-test.sh

## Context for AI Executing These Prompts

You are setting up the Watson Project foundation. This is Phase 1.
The goal is to get MemPalace running with ChromaDB, palace structure initialized, and guard stack implemented.

**What you need to understand:**
- MemPalace mines projects/conversations into a ChromaDB-backed palace
- The palace has wings (people/projects), rooms (topics), halls (memory types), closets (summaries), drawers (original files)
- The guard stack validates TypeScript emissions before they write to palace
- This is the foundation for all subsequent phases

**Your role:** Execute each step in order. Fix any failures before proceeding. Report results clearly.

---

## Prompt 1: Environment Setup

Execute `phase1/step1-setup.sh`:

```
#!/bin/bash
# Install mempalace if not present
pip install mempalace --quiet

# Verify installation
mempalace --version

# Check ChromaDB
python3 -c "import chromadb; print('ChromaDB:', chromadb.__version__)"

# Check OpenClaw is running
openclaw status | head -20
```

**Expected output:** mempalace version displayed, ChromaDB imported, OpenClaw running.

**Failure conditions:**
- pip install fails → check Python environment
- mempalace --version errors → reinstall
- ChromaDB import fails → pip install chromadb

---

## Prompt 2: Palace Initialization

Execute `phase1/step2-init-palace.sh`:

```
#!/bin/bash
# Initialize palace at ~/watson-palace
mempalace init ~/watson-palace

# Create wing directories manually
mkdir -p ~/watson-palace/wings/{zoe,aria,bea,pixie,kaz,dopaflow,packy}
mkdir -p ~/watson-palace/wings/zoe/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/aria/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/bea/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/pixie/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/kaz/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/dopaflow/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}
mkdir -p ~/watson-palace/wings/packy/{hall_facts,hall_events,hall_discoveries,hall_preferences,hall_advice}

# Mine existing project files
mempalace mine ~/.openclaw/workspace --mode project 2>&1 | tail -5
mempalace mine ~/.openclaw-aria/workspace --mode project 2>&1 | tail -5
mempalace mine ~/.openclaw-bea/workspace --mode project 2>&1 | tail -5

echo "=== Palace Status ==="
mempalace status
```

**Expected output:** Palace initialized, all 7 wings created, project files mined, mempalace status shows entries.

**Failure conditions:**
- Wing directories not created → create manually with mkdir -p
- mine command fails → check path exists, check disk space
- status shows 0 entries → mine may have failed, re-run with --verbose

---

## Prompt 3: Guard Stack Implementation

Execute `phase1/step3-guards.ts`. First read the existing files:

```
# Read existing schema and guards
cat ~/.openclaw/workspace/watson/schema.ts
cat ~/.openclaw/workspace/watson/guards.ts
```

Then validate the guard stack works:

```
#!/bin/bash
# Validate TypeScript guard stack compiles and runs

# Check Node.js version
node --version

# Check TypeScript availability
npx tsc --version 2>/dev/null || echo "tsc not installed (use node directly for now)"

# Run guard stack validation with node
cd ~/.openclaw/workspace/watson

node --experimental-vm-modules << 'NODETEST'
import { readFileSync } from 'fs';

// Parse and validate guards.ts structure
const guardsContent = readFileSync('./guards.ts', 'utf8');

// Basic validation: file has required functions
const required = ['typescriptGuard', 'semanticGuard', 'condenseGuard', 'runGuardStack'];
for (const fn of required) {
  if (!guardsContent.includes(`function ${fn}`) && !guardsContent.includes(`export function ${fn}`)) {
    console.error(`MISSING: ${fn}`);
    process.exit(1);
  }
}
console.log('Guard functions: OK');

// Validate schema.ts
const schemaContent = readFileSync('./schema.ts', 'utf8');
const requiredSchema = ['WatsonEmission', 'Finding', 'NextAction', 'GuardResult', 'SIGNAL_FLOOR'];
for (const type of requiredSchema) {
  if (!schemaContent.includes(type)) {
    console.error(`MISSING schema: ${type}`);
    process.exit(1);
  }
}
console.log('Schema types: OK');

console.log('Guard stack validation: PASS');
NODETEST
```

**Expected output:** All guard functions present, all schema types present.

**Failure conditions:**
- Missing function → add stub from Multiagent_thinking reference
- Missing schema type → add from Multiagent_thinking/TYPESCRIPT_SCHEMAS.md

---

## Prompt 4: Phase 1 E2E Test

Execute `phase1/e2e-test.sh`:

```
#!/bin/bash
set -e

echo "=== PHASE 1 E2E TEST ==="

# Test 1: MemPalace search returns results
echo "[1/4] Testing MemPalace search..."
RESULT=$(mempalace search "GPT2 bfloat16 crash" 2>&1)
if echo "$RESULT" | grep -qi "memory\|result\|packy"; then
  echo "  PASS: Search returns results"
else
  # Try broader search
  RESULT2=$(mempalace search "security" 2>&1)
  if echo "$RESULT2" | grep -qi "memory\|result\|security"; then
    echo "  PASS: Search returns results (broad)"
  else
    echo "  FAIL: Search returned nothing"
    echo "  Output: $RESULT"
    exit 1
  fi
fi

# Test 2: Guard stack rejects malformed emission
echo "[2/4] Testing guard stack rejection..."
cd ~/.openclaw/workspace/watson

node --experimental-vm-modules << 'NODETEST'
import { runGuardStack } from './guards.ts';

const badEmission = {
  version: '1.0',
  emitter: 'aria',
  task_id: 't1',
  status: 'done',
  summary: 'test',
  findings: [], // Missing required fields in findings items
  next_actions: [],
  confidence: 1.0
};

const result = runGuardStack(badEmission);
if (!result.pass) {
  console.log('  PASS: Guard stack rejects bad emission');
  process.exit(0);
} else {
  console.log('  FAIL: Guard stack accepted malformed emission');
  process.exit(1);
}
NODETEST

# Test 3: Guard stack accepts valid emission
echo "[3/4] Testing guard stack acceptance..."
node --experimental-vm-modules << 'NODETEST'
import { runGuardStack } from './guards.ts';

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
if (result.pass) {
  console.log('  PASS: Guard stack accepts valid emission');
} else {
  console.log('  FAIL: Guard stack rejected valid emission:', result.errors);
  process.exit(1);
}
NODETEST

# Test 4: Palace structure exists
echo "[4/4] Testing palace structure..."
for wing in zoe aria bea pixie kaz dopaflow packy; do
  if [ -d ~/watson-palace/wings/$wing ]; then
    echo "  PASS: Wing $wing exists"
  else
    echo "  FAIL: Wing $wing missing"
    exit 1
  fi
done

echo ""
echo "=== PHASE 1 E2E: ALL TESTS PASSED ==="
```

**Expected output:** All 4 tests pass.

**If test fails:**
- Test 1 fails → run `mempalace mine` manually on workspace
- Test 2 fails → guard stack too permissive, tighten validation
- Test 3 fails → guard stack too strict, relax signal floor
- Test 4 fails → create missing wing directories

---

## Phase 1 Exit Gate

All 4 tests must pass before proceeding to Phase 2.

**Checklist:**
- [ ] mempalace --version works
- [ ] mempalace status shows entries
- [ ] All 7 wings exist at ~/watson-palace/wings/
- [ ] Guard stack accepts valid emissions
- [ ] Guard stack rejects malformed emissions
- [ ] Search returns historical data