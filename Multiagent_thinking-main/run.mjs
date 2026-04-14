/**
 * run.mjs — Minimal Working Loop
 * 
 * Emission-driven multi-agent coordination in TypeScript.
 * 
 * Flow:
 * 1. Call frontier → ADR (TypeScript)
 * 2. Validate TypeScript (TSGuard)
 * 3. Call agent → Progress (TypeScript)  
 * 4. Validate TypeScript (TSGuard)
 * 5. Run tooling (placeholder)
 * 6. Condense emission (OllamaFilter)
 * 7. repeat
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PHASES = ['init', 'analysis', 'implementation', 'testing', 'verification', 'complete'];

const FILE_PATTERNS = [
    /\.ts$/, /\.js$/, /\.tsx$/, /\.jsx$/, /\.rs$/, /\.py$/,
    /src\//, /tests?\//, /lib\//, /components\//,
];

const ACTION_VERBS = [
    'create', 'update', 'delete', 'fix', 'add', 'remove',
    'implement', 'initialize', 'configure', 'refactor', 'modify',
];

const FORBIDDEN_PHRASES = [
    'completed task', 'done with work', 'finished task', 'as requested',
    'i have completed', 'i have done', 'everything is fine', 'no issues',
    'all good', 'task completed', 'work done', 'finished work',
];

// ============================================================================
// TYPESCRIPT GUARD v2 (Lightweight Compiler-Level Validation)
// ============================================================================

function extractInterfaceBlock(raw, interfaceName) {
    // Handle markdown code blocks
    const codeBlockMatch = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) raw = codeBlockMatch[1];
    
    // Find interface
    const pattern = new RegExp(`interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`);
    const match = raw.match(pattern);
    return match ? match[0] : null;
}

function validateBraceBalance(block) {
    const open = (block.match(/\{/g) || []).length;
    const close = (block.match(/\}/g) || []).length;
    return open === close && open > 0;
}

function parseFieldTypes(block) {
    const fields = new Map();
    
    // Match: fieldName: Type
    const fieldPattern = /(\w+)(\??):\s*([\w[\]]+|\w+\[\])/g;
    let match;
    
    while ((match = fieldPattern.exec(block)) !== null) {
        const [, name,, type] = match;
        fields.set(name, type);
    }
    
    return fields;
}

function validateTypeScriptGuard(raw, interfaceName, requiredFields) {
    const result = {
        passed: false,
        stage: 'start',
        issues: [],
    };
    
    // Stage 1: Extract interface
    const block = extractInterfaceBlock(raw, interfaceName);
    if (!block) {
        result.stage = 'extraction';
        result.issues.push('no_interface_found');
        return result;
    }
    result.extractedInterface = block;
    result.stage = 'extraction';
    
    // Stage 2: Brace balance
    if (!validateBraceBalance(block)) {
        result.stage = 'brace_balance';
        result.issues.push('unbalanced_braces');
        return result;
    }
    result.stage = 'brace_balance';
    
    // Stage 3: Field presence + type validation
    const fields = parseFieldTypes(block);
    
    for (const fieldName of requiredFields) {
        if (!fields.has(fieldName)) {
            result.issues.push(`missing_field:${fieldName}`);
            continue;
        }
        
        // Check array types
        if (['done', 'blockers', 'updates', 'ownedFiles', 'touchedFiles', 'findings'].includes(fieldName)) {
            const type = fields.get(fieldName);
            if (type && !type.includes('[]')) {
                result.issues.push(`invalid_type:${fieldName}: expected array, got ${type}`);
            }
        }
    }
    
    if (result.issues.length > 0) {
        result.stage = 'field_presence';
        return result;
    }
    result.stage = 'field_presence';
    
    // Stage 4: Complete
    result.stage = 'complete';
    result.passed = result.issues.length === 0;
    
    return result;
}

// ============================================================================
// SEMANTIC GUARD v2 (Signal Floor)
// ============================================================================

function containsFileReference(text) {
    return FILE_PATTERNS.some(p => p.test(text));
}

function containsActionVerb(text) {
    const lower = text.toLowerCase();
    return ACTION_VERBS.some(v => lower.includes(v));
}

function validateSemanticGuard(done, blockers) {
    const result = {
        passed: false,
        stage: 'semantic',
        issues: [],
    };
    
    // Rule 1: Empty done without blockers
    if (done.length === 0 && blockers.length === 0) {
        result.issues.push('empty_done_no_blockers');
        return result;
    }
    
    // Rule 2: File references
    const fileCount = done.filter(item => containsFileReference(item)).length;
    if (fileCount === 0) {
        result.issues.push('no_file_references');
    }
    
    // Rule 3: Action verbs
    const actionCount = done.filter(item => containsActionVerb(item)).length;
    if (actionCount === 0) {
        result.issues.push('no_action_verbs');
    }
    
    // Rule 4: Forbidden phrases
    for (const item of done) {
        const lower = item.toLowerCase();
        if (FORBIDDEN_PHRASES.some(p => lower.includes(p))) {
            result.issues.push(`forbidden_phrase:${item.slice(0, 30)}`);
        }
    }
    
    // Rule 5: Signal floor — must have BOTH file refs AND action verbs
    if (fileCount === 0 || actionCount === 0) {
        result.issues.push('signal_floor_not_met');
    }
    
    result.passed = result.issues.length === 0;
    return result;
}

// ============================================================================
// OLLAMA FILTER (Schema-to-Schema Compression)
// ============================================================================

function condenseProgress(progress) {
    return {
        agentId: progress.agent,
        updates: progress.done.slice(0, 3),
        blockers: progress.blockers.slice(0, 1),
        touchedFiles: (progress.touchedFiles || []).slice(0, 5),
        status: progress.blockers.length > 0 ? 'blocked' : 'complete',
    };
}

// ============================================================================
// API CALL (OpenRouter)
// ============================================================================

async function callOpenRouter(apiKey, model, messages, maxTokens = 150) {
    const payload = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.1,
    };
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
}

// ============================================================================
// PARSE ARGS
// ============================================================================

function parseArgs() {
    const args = {};
    const rawArgs = process.argv.slice(2);
    
    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('--')) {
                args[key] = rawArgs[i + 1];
                i++;
            } else if (key === 'verbose') {
                args[key] = true;
            } else {
                args[key] = true;
            }
        }
    }
    
    return args;
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function runLoop(config, task) {
    console.log('\n' + '='.repeat(60));
    console.log('EMISSION-DRIVEN LOOP');
    console.log('='.repeat(60));
    console.log(`Task: ${task}`);
    console.log(`Model: ${config.model}`);
    console.log(`Max iterations: ${config.maxIterations}\n`);
    
    let iteration = 0;
    let condensed = '';
    
    while (iteration < config.maxIterations) {
        iteration++;
        console.log(`\n--- Iteration ${iteration}/${config.maxIterations} ---`);
        
        // ====================================================================
        // STEP 1: Call frontier → ADR (TypeScript)
        // ====================================================================
        console.log('[1] Frontier → ADR (TypeScript)...');
        
        const adrMessages = [
            {
                role: 'system',
                content: `OUTPUT ONLY a TypeScript interface. Nothing else.

interface ADRSchema {
    taskId: string;
    agent: string;
    objective: string;
    ownedFiles: string[];
    constraints?: string[];
    emitFormat: string;
}

Fill in the ADR for this task. TypeScript only - no prose, no markdown.`,
            },
            {
                role: 'user',
                content: `Task: ${task}\n${condensed ? `Previous progress: ${condensed}\n\n` : ''}Create an ADR (Architecture Decision Record).`,
            }
        ];
        
        let adrRaw = '';
        try {
            const adrResponse = await callOpenRouter(config.apiKey, config.model, adrMessages, 150);
            adrRaw = adrResponse.choices?.[0]?.message?.content || '';
        } catch (e) {
            console.log(`    ❌ API error: ${e.message}`);
            continue;
        }
        
        if (config.verbose) {
            console.log(`    Raw: ${adrRaw.slice(0, 100)}...`);
        }
        
        // Validate ADR
        const adrValidation = validateTypeScriptGuard(adrRaw, 'ADRSchema', ['taskId', 'agent', 'objective', 'ownedFiles']);
        
        if (!adrValidation.passed) {
            console.log(`    ❌ ADR validation failed: ${adrValidation.issues.join(', ')}`);
            continue;
        }
        console.log(`    ✅ ADR valid`);
        
        // ====================================================================
        // STEP 2: Call agent → Progress (TypeScript)
        // ====================================================================
        console.log('[2] Agent → Progress (TypeScript)...');
        
        const progressMessages = [
            {
                role: 'system',
                content: `OUTPUT ONLY a TypeScript interface. Nothing else.

interface Progress {
    taskId: string;
    agent: string;
    phase: string;
    done: string[];
    blockers: string[];
    touchedFiles?: string[];
    needsEscalation?: boolean;
}

Fill in your progress. TypeScript only - no prose, no markdown.`,
            },
            {
                role: 'user',
                content: `ADR: ${adrRaw.slice(0, 300)}\n\nExecute the plan. Report progress.`,
            }
        ];
        
        let progressRaw = '';
        try {
            const progressResponse = await callOpenRouter(config.apiKey, config.model, progressMessages, 120);
            progressRaw = progressResponse.choices?.[0]?.message?.content || '';
        } catch (e) {
            console.log(`    ❌ API error: ${e.message}`);
            continue;
        }
        
        if (config.verbose) {
            console.log(`    Raw: ${progressRaw.slice(0, 100)}...`);
        }
        
        // Validate Progress
        const progressValidation = validateTypeScriptGuard(progressRaw, 'Progress', ['phase', 'done', 'blockers']);
        
        if (!progressValidation.passed) {
            console.log(`    ❌ Progress validation failed: ${progressValidation.issues.join(', ')}`);
            continue;
        }
        console.log(`    ✅ Progress valid`);
        
        // ====================================================================
        // STEP 3: Semantic Guard (Signal Floor) - basic check on raw text
        // ====================================================================
        // Extract done items from raw Progress output for semantic check
        const doneMatch = progressRaw.match(/done:\s*\[([^\]]*)\]/);
        const blockersMatch = progressRaw.match(/blockers:\s*\[([^\]]*)\]/);
        
        if (doneMatch && blockersMatch) {
            const doneItems = doneMatch[1].split(',').map(s => s.trim()).filter(s => s);
            const blockerItems = blockersMatch[1].split(',').map(s => s.trim()).filter(s => s && s !== '""' && s !== "''");
            
            const semanticResult = validateSemanticGuard(doneItems, blockerItems);
            if (!semanticResult.passed) {
                console.log(`    ⚠️  Semantic warning: ${semanticResult.issues.join(', ')}`);
            }
        }
        
        // ====================================================================
        // STEP 4: Condense emission
        // ====================================================================
        console.log('[3] Condensing emission...');
        condensed = `Progress: done ${iteration} items, blockers: pending`;
        console.log(`    ✅ Condensed: ${condensed.slice(0, 50)}...`);
        
        // Check for completion
        if (iteration >= config.maxIterations) {
            console.log('\n✅ Max iterations reached');
            break;
        }
        
        // Simple rate limit
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('LOOP COMPLETE');
    console.log('='.repeat(60));
    console.log(`Iterations: ${iteration}`);
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
    const args = parseArgs();
    
    if (args.help) {
        console.log(`
run.mjs — Emission-driven multi-agent loop

Usage:
  node run.mjs [options]

Options:
  --api-key <key>      OpenRouter API key
  --model <model>      Model to use (default: openrouter/free)
  --task <task>        Task description
  --iterations <n>     Max loop iterations (default: 5)
  --verbose            Verbose output
  --help               Show this help
        `);
        return;
    }
    
    const apiKey = args['api-key'] || process.env.OPENROUTER_API_KEY || '';
    if (!apiKey) {
        console.error('Error: --api-key or OPENROUTER_API_KEY required');
        process.exit(1);
    }
    
    const config = {
        apiKey,
        model: args.model || 'openrouter/free',
        maxIterations: parseInt(args.iterations || '5', 10),
        verbose: args.verbose || false,
    };
    
    const task = args.task || 'Build a snake game in JavaScript';
    
    await runLoop(config, task);
}

main().catch(console.error);
