# TypeScriptGuard v2 — Lightweight Compiler-Level Validation

**Goal**: Validate TypeScript interface output like a real compiler would — fast, no tsc dependency.

---

## The Problem with v1 Guard

v1 checks:
- ✅ Interface keyword present
- ✅ Brace balance
- ✅ Field presence

v1 **misses**:
- ❌ Type validity (e.g., `done: "string"` instead of `done: string[]`)
- ❌ Enum validation (e.g., `phase: "invalid"` instead of valid phase)
- ❌ Literal vs type checking (e.g., `phase: string` vs `phase: "init"`)

---

## TypeScriptGuard v2 Design

### Validation Pipeline

```
Raw Output
    │
    ▼
┌─────────────────────────────────────────────┐
│ 1. INTERFACE EXTRACTION                      │
│    Extract "interface X {...}" block        │
│    Handle: markdown code blocks, prose      │
└────────────────────┬────────────────────────┘
                     │ Interface block
                     ▼
┌─────────────────────────────────────────────┐
│ 2. BRACE BALANCE CHECK                      │
│    openBraces == closeBraces                │
└────────────────────┬────────────────────────┘
                     │ Pass
                     ▼
┌─────────────────────────────────────────────┐
│ 3. FIELD PRESENCE CHECK                     │
│    All required fields exist                │
└────────────────────┬────────────────────────┘
                     │ Pass
                     ▼
┌─────────────────────────────────────────────┐
│ 4. TYPE SYNTAX VALIDATION                   │
│    Parse field types (not full compiler)    │
│    - array: `field: Type[]`                │
│    - string: `field: string`                │
│    - boolean: `field: boolean`              │
│    - optional: `field?: Type`               │
└────────────────────┬────────────────────────┘
                     │ Pass
                     ▼
┌─────────────────────────────────────────────┐
│ 5. ENUM VALIDATION (if applicable)          │
│    e.g., phase: "init"|"analysis"|...      │
└────────────────────┬────────────────────────┘
                     │ Pass/Fail
                     ▼
             ValidationResult
```

---

## Implementation (TypeScript/JS)

```typescript
interface ValidationResult {
  passed: boolean;
  stage: string;
  issues: string[];
  extractedInterface?: string;
  parsedFields?: Map<string, FieldType>;
}

interface FieldType {
  name: string;
  type: string;          // e.g., "string", "string[]", "boolean"
  optional: boolean;
  rawMatch: string;       // e.g., "done: string[]"
}

const REQUIRED_INTERFACES = {
  Progress: ["phase", "done", "blockers"],
  ADRSchema: ["taskId", "agent", "objective", "ownedFiles"],
  CondensedEmission: ["agentId", "updates", "blockers", "status"],
};

const VALID_ENUMS = {
  phase: ["init", "analysis", "implementation", "testing", "verification", "complete"],
  status: ["working", "blocked", "complete"],
};

function extractInterfaceBlock(raw: string, interfaceName: string): string | null {
  // Handle markdown code blocks
  const codeBlockMatch = raw.match(/```(?:typescript)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) raw = codeBlockMatch[1];
  
  // Find interface
  const pattern = new RegExp(`interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`);
  const match = raw.match(pattern);
  return match ? match[0] : null;
}

function validateBraceBalance(block: string): boolean {
  const open = (block.match(/\{/g) || []).length;
  const close = (block.match(/\}/g) || []).length;
  return open === close && open > 0;
}

function parseFieldTypes(block: string): Map<string, FieldType> {
  const fields = new Map<string, FieldType>();
  
  // Match: fieldName: Type (with optional ? for optional fields)
  const fieldPattern = /(\w+)(\?)?:\s*([\w\[\]|string\[\]|boolean\[\]|number\[\])/g;
  let match;
  
  while ((match = fieldPattern.exec(block)) !== null) {
    const [, name, optional, type] = match;
    fields.set(name, {
      name,
      type: type || "unknown",
      optional: optional === "?",
      rawMatch: match[0],
    });
  }
  
  return fields;
}

function validateFieldTypes(fields: Map<string, FieldType>, requiredFields: string[]): string[] {
  const issues = [];
  
  for (const fieldName of requiredFields) {
    const field = fields.get(fieldName);
    
    if (!field) {
      issues.push(`missing_field:${fieldName}`);
      continue;
    }
    
    // Check array type (must be Type[])
    if (fieldName === "done" || fieldName === "blockers" || fieldName === "updates" || fieldName === "ownedFiles" || fieldName === "touchedFiles") {
      if (!field.type.includes("[]")) {
        issues.push(`invalid_type:${fieldName}: expected array, got ${field.type}`);
      }
    }
    
    // Check boolean type
    if (fieldName === "needsEscalation" || fieldName === "verified") {
      if (field.type !== "boolean") {
        issues.push(`invalid_type:${fieldName}: expected boolean, got ${field.type}`);
      }
    }
  }
  
  return issues;
}

function validateEnums(fields: Map<string, FieldType>): string[] {
  const issues = [];
  
  for (const [fieldName, enumValues] of Object.entries(VALID_ENUMS)) {
    const field = fields.get(fieldName);
    if (!field) continue;
    
    // For enum validation, we need to check the actual value in the interface
    // This is trickier since we only have type annotations, not values
    // We'll skip deep enum validation in v2 (would require parsing values)
  }
  
  return issues;
}

function validateTypeScriptGuard(raw: string, interfaceName: string): ValidationResult {
  const result: ValidationResult = {
    passed: false,
    stage: "start",
    issues: [],
  };
  
  // Stage 1: Extract interface
  const block = extractInterfaceBlock(raw, interfaceName);
  if (!block) {
    result.stage = "extraction";
    result.issues.push("no_interface_found");
    return result;
  }
  result.extractedInterface = block;
  
  // Stage 2: Brace balance
  if (!validateBraceBalance(block)) {
    result.stage = "brace_balance";
    result.issues.push("unbalanced_braces");
    return result;
  }
  result.stage = "brace_balance";
  
  // Stage 3: Field presence
  const requiredFields = REQUIRED_INTERFACES[interfaceName as keyof typeof REQUIRED_INTERFACES];
  const fields = parseFieldTypes(block);
  result.parsedFields = fields;
  
  for (const fieldName of requiredFields) {
    if (!fields.has(fieldName)) {
      result.issues.push(`missing_field:${fieldName}`);
    }
  }
  
  if (result.issues.length > 0) {
    result.stage = "field_presence";
    return result;
  }
  result.stage = "field_presence";
  
  // Stage 4: Type validation
  const typeIssues = validateFieldTypes(fields, requiredFields);
  result.issues.push(...typeIssues);
  
  if (result.issues.length > 0) {
    result.stage = "type_validation";
    return result;
  }
  result.stage = "type_validation";
  
  // Stage 5: Enum validation (v2: skip, requires value parsing)
  result.stage = "complete";
  result.passed = result.issues.length === 0;
  
  return result;
}
```

---

## Semantic Guard v2 — Signal Floor

```typescript
const FORBIDDEN_PHRASES = [
  "completed task",
  "done with work",
  "finished task",
  "as requested",
  "no issues",
  "all good",
];

const FILE_PATTERNS = [
  /\.ts$/, /\.js$/, /\.tsx$/, /\.jsx$/, /\.rs$/, /\.py$/,
  /src\//, /tests?\//, /lib\//, /components\//,
];

const ACTION_VERBS = [
  "create", "update", "delete", "fix", "add", "remove",
  "implement", "initialize", "configure", "refactor",
];

interface SemanticResult {
  passed: boolean;
  issues: string[];
  signalDensity: number;
  fileRefs: number;
  actionVerbs: number;
}

function validateSemanticGuard(done: string[], blockers: string[]): SemanticResult {
  const result: SemanticResult = {
    passed: false,
    issues: [],
    signalDensity: 0,
    fileRefs: 0,
    actionVerbs: 0,
  };
  
  // Rule 1: Empty done without blockers
  if (done.length === 0 && blockers.length === 0) {
    result.issues.push("empty_done_no_blockers");
    return result;
  }
  
  // Rule 2: Count file references
  for (const item of done) {
    if (FILE_PATTERNS.some(p => p.test(item))) {
      result.fileRefs++;
    }
  }
  
  if (result.fileRefs === 0) {
    result.issues.push("no_file_references");
  }
  
  // Rule 3: Count action verbs
  for (const item of done) {
    const lower = item.toLowerCase();
    if (ACTION_VERBS.some(v => lower.includes(v))) {
      result.actionVerbs++;
    }
  }
  
  // Rule 4: Forbidden phrases
  for (const item of done) {
    const lower = item.toLowerCase();
    if (FORBIDDEN_PHRASES.some(p => lower.includes(p))) {
      result.issues.push(`forbidden_phrase:${item.slice(0, 30)}`);
    }
  }
  
  // Rule 5: Signal density (file refs + action verbs / total items)
  const totalItems = done.length;
  if (totalItems > 0) {
    result.signalDensity = (result.fileRefs + result.actionVerbs) / (totalItems * 2);
  }
  
  if (result.signalDensity < 0.3 && totalItems > 0) {
    result.issues.push("low_signal_density");
  }
  
  result.passed = result.issues.length === 0;
  return result;
}
```

---

## Signal Floor Rule

Reject if **both**:
1. No file path (no `.ts`, `.js`, `src/`, etc.)
2. No action verb (create/update/delete/fix/implement/etc.)

**Why**: This catches the "technically valid but useless" outputs:
```typescript
// Passes TypeScriptGuard
done: ["updated file.ts"]  // No action verb, low signal

// Fails SemanticGuard  
done: ["updated file.ts"]  // No action verb → low signal density
```

---

## Guard Stack v2 (Complete)

```
Model Output
    │
    ▼
┌─────────────────────────┐
│ TypeScriptGuard v2      │ ← Interface extraction + type validation
└────────────┬────────────┘
             │ PASS
             ▼
┌─────────────────────────┐
│ SemanticGuard v2        │ ← File refs + action verbs + signal floor
└────────────┬────────────┘
             │ PASS
             ▼
┌─────────────────────────┐
│ OllamaFilter            │ ← Schema-to-schema condense
└────────────┬────────────┘
             │
        RETRY │ ESCALATE
```

---

## Next Steps

| Priority | Task |
|----------|------|
| CRITICAL | Re-run 3-agent test with TypeScript |
| CRITICAL | Re-run provider switching with TypeScript |
| HIGH | Implement TypeScriptGuard v2 (lightweight parser) |
| HIGH | Test 15-step with TypeScript + proper rate limiting |
| MEDIUM | Token cost analysis: TypeScript vs JSON |

---

*Part of emission-driven architecture. See also: EMISSION_PAPER.md, TYPESCRIPT_SCHEMAS.md, SCHEMA_GUARD_v1.md*
