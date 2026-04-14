#!/usr/bin/env node
/**
 * openrouter-drift-test.ts - Test TypeScript compliance via OpenRouter API
 * Uses qwen via OpenRouter to test 50 iterations
 */

import * as fs from 'fs';
import * as path from 'path';

const ITERATIONS = 50;
const OUTPUT_DIR = './harness/results/openrouter-drift-test';

const API_KEY = process.env.OPENROUTER_API_KEY || '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';
const MODEL = 'openrouter/free'; // Default free model on OpenRouter

const TEST_PROMPT = `Output ONLY a TypeScript interface. Nothing else.

interface Progress {
    taskId: string;
    agent: string;
    phase: "init" | "analysis" | "implementation" | "testing" | "verification" | "complete";
    done: string[];
    blockers: string[];
}

Fill in actual values for building a snake game. TypeScript only - no prose, no markdown.`;

interface DriftResult {
  iteration: number;
  output: string;
  passedTS: boolean;
  passedSem: boolean;
  passed: boolean;
  tsErrors: string[];
  semErrors: string[];
  tokens: number;
  timestamp: string;
}

function validateTypeScriptGuard(raw: string): { passed: boolean; issues: string[] } {
  const codeBlockMatch = raw.match(/```typescript\n?([\s\S]*?)```/i) || raw.match(/```\n?([\s\S]*?)```/i);
  const content = codeBlockMatch ? codeBlockMatch[1] : raw;
  
  const interfaceMatch = content.match(/interface\s+Progress\s*\{([^}]*)\}/);
  if (!interfaceMatch) {
    return { passed: false, issues: ['no_interface_found'] };
  }
  
  const body = interfaceMatch[1];
  const hasPhase = /phase:\s*"/.test(body) || /phase:\s*'/.test(body);
  const hasDone = /done:\s*\[/.test(body);
  const hasBlockers = /blockers:\s*\[/.test(body);
  
  const errors: string[] = [];
  if (!hasPhase) errors.push('missing_phase');
  if (!hasDone) errors.push('missing_done');
  if (!hasBlockers) errors.push('missing_blockers');
  
  return { passed: errors.length === 0, issues: errors };
}

function validateSemanticGuard(raw: string): { passed: boolean; issues: string[] } {
  const doneMatch = raw.match(/done:\s*\[([^\]]*)\]/);
  if (!doneMatch) return { passed: false, issues: ['no_done_array'] };
  
  const content = doneMatch[1];
  const items = content.split(',').map(s => s.trim()).filter(s => s && s !== '""' && s !== "''");
  
  if (items.length === 0) {
    return { passed: false, issues: ['empty_done_array'] };
  }
  
  const filePattern = /\.(ts|js|tsx|jsx|html|css|py|rs|src|tests?)/i;
  const actionPattern = /(created|added|updated|deleted|implemented|fixed|configured|initialized)/i;
  
  const hasFileRef = items.some(item => filePattern.test(item));
  const hasActionVerb = items.some(item => actionPattern.test(item));
  
  const errors: string[] = [];
  if (!hasFileRef) errors.push('no_file_references');
  if (!hasActionVerb) errors.push('no_action_verbs');
  
  return { passed: errors.length === 0, issues: errors };
}

async function callOpenRouter(model: string, prompt: string, maxTokens = 150): Promise<{ output: string; tokens: number }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://claw-code.dev',
          'X-Title': 'Emission Harness Drift Test',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.1,
        }),
      });
      
      if (response.status === 429) {
        const delay = (attempt + 1) * 5000;
        console.log(`  Rate limited, waiting ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error(`Rate limited (429)`);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        output: data.choices?.[0]?.message?.content || '',
        tokens: data.usage?.total_tokens || 0,
      };
    } catch (err) {
      lastError = err as Error;
    await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  throw lastError || new Error('Failed after 3 attempts');
}

async function runDriftTest(): Promise<void> {
  console.log(`Starting OpenRouter drift test: ${ITERATIONS} iterations`);
  console.log(`Model: ${MODEL}`);
  console.log('');
  
  const results: DriftResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const { output, tokens } = await callOpenRouter(MODEL, TEST_PROMPT);
      
      const tsValidation = validateTypeScriptGuard(output);
      const semValidation = validateSemanticGuard(output);
      
      const result: DriftResult = {
        iteration: i + 1,
        output,
        passedTS: tsValidation.passed,
        passedSem: semValidation.passed,
        passed: tsValidation.passed && semValidation.passed,
        tsErrors: tsValidation.issues,
        semErrors: semValidation.issues,
        tokens,
        timestamp: new Date().toISOString(),
      };
      
      results.push(result);
      
      if (result.passed) {
        passed++;
        process.stdout.write('✅');
      } else {
        failed++;
        const tsFail = result.tsErrors.join(',');
        const semFail = result.semErrors.join(',');
        process.stdout.write(`❌(${tsFail || semFail})`);
      }
    } catch (err) {
      const result: DriftResult = {
        iteration: i + 1,
        output: `ERROR: ${err}`,
        passedTS: false,
        passedSem: false,
        passed: false,
        tsErrors: ['call_failed'],
        semErrors: [],
        tokens: 0,
        timestamp: new Date().toISOString(),
      };
      results.push(result);
      failed++;
      process.stdout.write('⚠️');
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` [${i + 1}/${ITERATIONS}]\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n');
  console.log('='.repeat(60));
  console.log('OPENROUTER DRIFT TEST RESULTS');
  console.log('='.repeat(60));
  console.log('');
  
  const totalPassed = results.filter(r => r.passed).length;
  const tsPassRate = results.filter(r => r.passedTS).length / ITERATIONS * 100;
  const semPassRate = results.filter(r => r.passedSem).length / ITERATIONS * 100;
  const avgTokens = results.reduce((a, r) => a + r.tokens, 0) / Math.max(results.filter(r => r.tokens > 0).length, 1);
  
  console.log(`Total Runs: ${ITERATIONS}`);
  console.log(`Full Pass (TS + Sem): ${totalPassed} (${(totalPassed / ITERATIONS * 100).toFixed(1)}%)`);
  console.log(`TypeScript Guard Pass: ${tsPassRate.toFixed(1)}%`);
  console.log(`Semantic Guard Pass: ${semPassRate.toFixed(1)}%`);
  console.log(`Average Tokens: ${avgTokens.toFixed(0)}`);
  console.log('');
  
  const tsFailureTypes = new Map<string, number>();
  const semFailureTypes = new Map<string, number>();
  
  for (const r of results) {
    for (const e of r.tsErrors) {
      tsFailureTypes.set(e, (tsFailureTypes.get(e) || 0) + 1);
    }
    for (const e of r.semErrors) {
      semFailureTypes.set(e, (semFailureTypes.get(e) || 0) + 1);
    }
  }
  
  console.log('TypeScript Guard Failures:');
  if (tsFailureTypes.size === 0) {
    console.log('  (none)');
  } else {
    for (const [type, count] of tsFailureTypes) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log('');
  
  console.log('Semantic Guard Failures:');
  if (semFailureTypes.size === 0) {
    console.log('  (none)');
  } else {
    for (const [type, count] of semFailureTypes) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log('');
  
  const samplePasses = results.filter(r => r.passed).slice(0, 3);
  const sampleFails = results.filter(r => !r.passed).slice(0, 3);
  
  console.log('Sample Passing Outputs:');
  for (const s of samplePasses) {
    console.log(`  [${s.iteration}] ${s.output.slice(0, 80)}...`);
  }
  console.log('');
  
  console.log('Sample Failing Outputs:');
  for (const s of sampleFails) {
    console.log(`  [${s.iteration}] ${s.tsErrors.join(',') || s.semErrors.join(',')}: ${s.output.slice(0, 80)}...`);
  }
  console.log('');
  
  const summary = {
    timestamp: new Date().toISOString(),
    model: MODEL,
    iterations: ITERATIONS,
    passed: totalPassed,
    failed,
    tsPassRate,
    semPassRate,
    avgTokens,
    tsFailureTypes: Object.fromEntries(tsFailureTypes),
    semFailureTypes: Object.fromEntries(semFailureTypes),
    results: results.map(r => ({
      iteration: r.iteration,
      passed: r.passed,
      tsErrors: r.tsErrors,
      semErrors: r.semErrors,
      tokens: r.tokens,
    })),
  };
  
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const summaryPath = path.join(OUTPUT_DIR, 'openrouter-drift-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Detailed results saved to: ${summaryPath}`);
  console.log('');
  
  if (tsPassRate >= 80) {
    console.log('✅ THESIS VALIDATED - Strong TypeScript compliance on qwen');
  } else if (tsPassRate >= 50) {
    console.log('⚠️ PARTIAL VALIDATION - TypeScript compliance present but needs guard retry');
  } else {
    console.log('❌ THESIS NOT VALIDATED - Low compliance');
  }
}

runDriftTest().catch(console.error);