# TypeScript Schemas for Emission Architecture

**Key insight**: TypeScript interfaces achieve 100% compliance where JSON fails. The compile step is the guard.

---

## Core Schemas

### ADR Schema (Architecture Decision Record)

```typescript
// Frontier model emits this to coordinate agent work
interface ADRSchema {
  taskId: string;
  agent: string;
  objective: string;
  ownedFiles: string[];
  forbiddenFiles?: string[];
  constraints?: string[];
  definitionOfDone?: string[];
  emitFormat: "progress_v1" | "typescript_v1";
  context?: EmissionContext;
}

interface EmissionContext {
  mood?: KeywordScore[];
  relations?: RelationScore[];
}

interface KeywordScore {
  keyword: string;
  score: number;
}

interface RelationScore {
  entityA: string;
  entityB: string;
  relationType: string;
  score: number;
}
```

### Progress Schema (Agent emits during work)

```typescript
// Small models emit this on each step
interface ProgressSchema {
  taskId: string;
  agent: string;
  phase: Phase;
  done: string[];
  blockers: string[];
  next?: string;
  touchedFiles?: string[];
  needsEscalation?: boolean;
}

// Phase labels
type Phase = "init" | "analysis" | "implementation" | "testing" | "verification" | "complete";
```

### Condensed Emission (Ollama filter output)

```typescript
// Ollama filter condenses to this minimal form
interface CondensedEmission {
  agentId: string;
  updates: string[];      // max 3
  blockers: string[];      // max 1
  touchedFiles: string[]; // max 5
  status: "working" | "blocked" | "complete";
}
```

### Verification Schema (Frontier sweep result)

```typescript
interface VerificationSchema {
  taskId: string;
  verified: boolean;
  confidence: number;      // 0.0 - 1.0
  findings: string[];
  escalations: string[];
  nextAction: "continue" | "retry" | "abort";
}
```

---

## TypeScript Guard Validation

```typescript
interface TypeScriptGuard {
  requiredInterface: string;
  requiredFields: string[];
  maxOutputTokens: number;
}

function validateTypeScriptOutput(
  raw: string,
  guard: TypeScriptGuard
): ValidationResult {
  // 1. Extract interface block
  const interfaceBlock = extractInterface(raw, guard.requiredInterface);
  if (!interfaceBlock) {
    return { passed: false, reason: "no_interface_found" };
  }

  // 2. Check brace balance
  const openBraces = (interfaceBlock.match(/\{/g) || []).length;
  const closeBraces = (interfaceBlock.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    return { passed: false, reason: "unbalanced_braces" };
  }

  // 3. Check required fields
  for (const field of guard.requiredFields) {
    if (!interfaceBlock.includes(field)) {
      return { passed: false, reason: `missing_field_${field}` };
    }
  }

  // 4. Check for types (not just strings)
  // Must have actual types, not "string" as literal
  const hasTypes = guard.requiredFields.every(field => {
    const fieldPattern = new RegExp(`${field}:\\s*\\w+`);
    return fieldPattern.test(interfaceBlock);
  });
  if (!hasTypes) {
    return { passed: false, reason: "missing_types" };
  }

  return { passed: true, interfaceBlock };
}
```

---

## Ollama Filter (TypeScript-to-TypeScript)

```typescript
// Schema-to-schema only. NO summarization (prevents drift).
function condenseProgress(ts: ProgressSchema): CondensedEmission {
  return {
    agentId: ts.agent,
    updates: ts.done.slice(0, 3),           // max 3 facts
    blockers: ts.blockers.slice(0, 1),       // max 1 blocker
    touchedFiles: ts.touchedFiles?.slice(0, 5) ?? [],
    status: ts.blockers.length > 0 ? "blocked" : "working",
  };
}
```

---

## Usage in Prompts

### System Prompt for Frontier (ADR emit)

```
OUTPUT ONLY valid TypeScript code. Define the interface and fill in values.

interface ADRSchema {
    taskId: string;
    agent: string;
    objective: string;
    ownedFiles: string[];
    constraints?: string[];
}

Output ONLY the ADRSchema interface filled in. No prose. No explanation.
The code MUST compile. TypeScript only.
```

### System Prompt for Small Model (Progress emit)

```
OUTPUT ONLY a TypeScript interface. Nothing else.

interface Progress {
    taskId: string;
    agent: string;
    phase: "init" | "analysis" | "implementation" | "testing" | "verification" | "complete";
    done: string[];
    blockers: string[];
    touchedFiles?: string[];
}

Fill in actual values for your current progress. Valid TypeScript only.
```

### Example Output

```typescript
interface Progress {
    taskId: "snake-game-001",
    agent: "worker-1",
    phase: "implementation",
    done: [
        "Created index.html with canvas element",
        "Added CSS for game board styling",
        "Initialized snake position in game.js"
    ],
    blockers: [],
    touchedFiles: ["index.html", "styles.css", "game.js"]
}
```

---

*Part of the emission-driven architecture. See also: EMISSION_PAPER.md, SCHEMA_GUARD_v1.md*
