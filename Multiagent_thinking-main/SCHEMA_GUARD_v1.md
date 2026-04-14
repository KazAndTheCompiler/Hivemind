# SCHEMA_GUARD_v1 — Complete Robustness Stack

**This is NOT optional. This IS the system.**

---

## The Problem Discovered Through Testing

| Test | Expected Compliance | Actual Compliance |
|------|-------------------|-------------------|
| 2-5 steps (JSON) | ~70% | ~50-70% |
| Single task (JSON) | ~70% | ~70% |
| 3-agent relay (JSON) | ~70% | ~33% |
| 15-step loop (JSON) | ~70% | **13%** |
| 5-step loop (TypeScript) | ~70% | **100%** | ← NEW |

**Key finding**: The compliance problem was format, not model. TypeScript interfaces achieve 100% compliance where JSON fails at 13%.

---

## The Solution: TypeScript as Emission Format

TypeScript interfaces create **structural contracts**:
- Extra prose breaks compilation
- The model fears a broken build more than ignoring instructions
- No Semantic Guard needed for prose detection — it's implicit

```
JSON:   "OUTPUT JSON ONLY" → Model: "Here's the JSON: {prose}"
TypeScript: "OUTPUT ONLY TypeScript" → Model: "interface Progress {...}"
```

---

## The Stack

```
Raw Model Output
      │
      ▼
┌─────────────┐
│ Schema Guard │ ← Structure (JSON? Fields? Types?)
└──────┬──────┘
       │ PASS
       ▼
┌─────────────┐
│Semantic Guard│ ← Meaning (Signal? Files? Actions?)
└──────┬──────┘
       │ PASS
       ▼
┌─────────────┐
│Retry Policy │ ← Bounded retries with backoff
└──────┬──────┘
       │
   RETRY │ ESCALATE
   │     │
   ▼     ▼
  Again  Frontier
         │
         ▼
  Escalation Rules
```

---

## 1. TypeScript Guard (Structure)

```rust
pub struct TypeScriptGuard {
    required_interface: String,
    required_fields: Vec<String>,
    max_output_tokens: usize,
}

impl TypeScriptGuard {
    pub fn validate(&self, raw: &str) -> ValidationResult {
        // 1. Extract TypeScript interface
        let interface_block = extract_typescript_interface(raw, &self.required_interface)?;
        
        // 2. Parse check (structure, not full TypeScript compilation)
        let has_fields = self.required_fields.iter().all(|f| interface_block.contains(f));
        if !has_fields {
            return ValidationResult::Retry { 
                reason: format!("Missing fields: {:?}", self.required_fields) 
            };
        }
        
        // 3. Check for interface keyword
        if !interface_block.contains("interface") {
            return ValidationResult::Retry { reason: "no_interface_keyword" };
        }
        
        // 4. Check brace balance (basic syntax check)
        let open_braces = interface_block.matches("{").count();
        let close_braces = interface_block.matches("}").count();
        if open_braces != close_braces {
            return ValidationResult::Retry { reason: "unbalanced_braces" };
        }
        
        ValidationResult::Pass
    }
}
```

**Handles**: No interface found, missing fields, unbalanced braces, structure errors.

**Key advantage**: Prose is **implicitly rejected** — extra text breaks the interface block extraction.

---

## 2. Semantic Guard (Meaning)

```rust
pub struct SemanticGuard {
    min_file_refs: usize,
    forbidden: Vec<String>,
    filler_patterns: Vec<String>,
}

impl SemanticGuard {
    pub fn validate(&self, emission: &ProgressSchema) -> SemanticResult {
        // Rule 1: No empty done without blockers
        if emission.done.is_empty() && emission.blockers.is_empty() {
            return SemanticResult::Reject { 
                issue: "empty_done_no_blockers" 
            };
        }
        
        // Rule 2: Must have file references
        let file_count = count_file_refs(&emission.done);
        if file_count < self.min_file_refs {
            return SemanticResult::Reject {
                issue: "no_file_references"
            };
        }
        
        // Rule 3: No forbidden phrases
        for phrase in &self.forbidden {
            if contains_phrase(&emission.done, phrase) {
                return SemanticResult::Reject {
                    issue: "forbidden_phrase"
                };
            }
        }
        
        // Rule 4: Low signal density
        let density = calc_signal_density(&emission.done);
        if density < 0.3 {
            return SemanticResult::Reject {
                issue: "low_signal_density"
            };
        }
        
        SemanticResult::Pass
    }
}
```

**Handles**: Empty outputs, generic filler ("completed task"), no file references, template outputs.

**Critical example**:
```json
// Passes Schema Guard ❌
{"done": ["completed task"], "blockers": []}

// Fails Semantic Guard ✅
{"done": ["completed task"], "blockers": []}
// → "completed task" is forbidden phrase
// → No file references
```

---

## 3. Retry Policy (Bounded Retries)

```rust
pub struct RetryPolicy {
    max_retries: u32,
    base_backoff_ms: u64,
    max_backoff_ms: u64,
}

impl RetryPolicy {
    pub fn should_retry(&self, attempt: u32, reason: &str) -> RetryDecision {
        // Hard limits
        if attempt >= self.max_retries {
            return RetryDecision::Escalate;
        }
        
        // Non-retryable errors
        if reason.contains("rate_limit") {
            return RetryDecision::Escalate;
        }
        
        // Exponential backoff
        let backoff = std::cmp::min(
            self.base_backoff_ms * 2u64.pow(attempt),
            self.max_backoff_ms
        );
        
        RetryDecision::Retry { backoff_ms: backoff }
    }
}
```

**Limits**:
- MAX_RETRIES = 3
- BASE_BACKOFF = 500ms
- MAX_BACKOFF = 4000ms

---

## 4. Escalation Rules (When to Call Frontier)

```rust
pub enum EscalationType {
    SchemaViolation,
    SemanticViolation,
    CrossAgentConflict,
    DependencyBreak,
    MaxIterationsExceeded,
    Unknown,
}

pub struct EscalationRules;

impl EscalationRules {
    pub fn should_escalate(&self, failure: &Failure) -> bool {
        match failure.issue {
            // MUST escalate
            "max_retries_exceeded" => true,
            "cross_agent_conflict" => true,
            "dependency_break" => true,
            
            // CAN handle locally
            "tool_failure" => false,
            "test_failure_known_fix" => false,
            
            // Use judgment
            _ => failure.cumulative_cost > 1000,
        }
    }
    
    pub fn create_escalation(&self, failure: &Failure) -> EscalationMessage {
        EscalationMessage {
            escalation_type: failure.issue.clone(),
            task_id: failure.task_id.clone(),
            attempted_actions: failure.history.clone(),
            reason: failure.reason.clone(),
            cost_so_far: failure.cumulative_cost,
            frontier_action: self.suggest_action(failure),
        }
    }
}
```

---

## 5. Ollama Filter (Local Compression)

```rust
pub struct OllamaFilter {
    max_updates: usize,
    max_blockers: usize,
    max_output_tokens: usize,
}

impl OllamaFilter {
    /// Schema-to-schema conversion only. NO summarization.
    pub fn condense(&self, raw: &str) -> CondensedEmission {
        // Tool-based extraction (regex, patterns)
        let updates = extract_done_items(raw);
        let blockers = extract_blockers(raw);
        let files = extract_file_refs(raw);
        
        // Hard truncation (not summarization)
        let updates = updates.into_iter().take(self.max_updates).collect();
        let blockers = blockers.into_iter().take(self.max_blockers).collect();
        
        CondensedEmission {
            updates,
            blockers,
            files_touched: files,
            // ... schema fields
        }
    }
}
```

**Key**: No LLM inference. Tool extraction only. Prevents drift.

---

## Complete Flow

```
Model Output
    │
    ▼
Schema Guard (structure)
    │ PASS
    ▼
Semantic Guard (meaning)
    │ PASS
    ▼
Ollama Filter (compress)
    │
    ▼
Retry Policy (if failed)
    │
    ▼
Escalation Rules (if max retries)
    │
    ▼
Emit to next agent / frontier sweep
```

---

## What Each Component Adds

| Component | Problem Solved |
|-----------|---------------|
| Schema Guard | JSON extraction, parse errors, missing fields |
| Semantic Guard | Empty outputs, filler, no file refs |
| Retry Policy | Prevents infinite loops, bounds cost |
| Escalation Rules | Clear boundaries for frontier involvement |
| Ollama Filter | Local compression, no API calls |

---

## Testing Summary

| Test | Without Guards | With Guards |
|------|--------------|------------|
| 15-step loop | 13% compliance | TBD |
| 3-agent relay | ~33% compliance | TBD |
| Provider switching | Unstable | TBD |

**Note**: Guards tested conceptually. Integration test pending.

---

## The Honest Truth

> Schema Guard + Semantic Guard + Retry Policy + Escalation Rules + Ollama Filter
> = robust emission system
> 
> Without guards = 13% compliance over 15 steps
> With guards = TBD (but structurally sound)

---

*Part of the emission-driven architecture. See also: EMISSION_PAPER.md, SEMANTIC_GUARD_v1.md*
