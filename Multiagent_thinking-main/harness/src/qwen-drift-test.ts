#!/usr/bin/env node
/**
 * qwen-drift-test.ts - Test qwen's TypeScript compliance over 50 runs
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const ITERATIONS = 50;
const OUTPUT_DIR = './harness/results/qwen-drift-test';
const TEST_PROMPT = 'Output ONLY a TypeScript interface for progress tracking. Interface Progress should have: taskId (string), agent (string), phase ("init"|"analysis"|"implementation"|"testing"|"verification"|"complete"), done (string array), blockers (string array). Fill in actual values for building a snake game. No prose, no markdown - just the interface.';

interface QwenResult {
  iteration: number;
  output: string;
  passedTS: boolean;
  passedSem: boolean;
  passed: boolean;
  tsErrors: string[];
  semErrors: string[];
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

function callQwen(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('qwen', [prompt, '--silent'], {
      timeout: 30000,
      shell: true,
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0 || stdout) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`qwen exited with code ${code}: ${stderr}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function runQwenDriftTest(): Promise<void> {
  console.log(`Starting qwen drift test: ${ITERATIONS} iterations...`);
  console.log('Prompt:', TEST_PROMPT.slice(0, 80) + '...');
  console.log('');
  
  const results: QwenResult[] = [];
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const output = await callQwen(TEST_PROMPT);
      
      const tsValidation = validateTypeScriptGuard(output);
      const semValidation = validateSemanticGuard(output);
      
      const result: QwenResult = {
        iteration: i + 1,
        output,
        passedTS: tsValidation.passed,
        passedSem: semValidation.passed,
        passed: tsValidation.passed && semValidation.passed,
        tsErrors: tsValidation.issues,
        semErrors: semValidation.issues,
        timestamp: new Date().toISOString(),
      };
      
      results.push(result);
      
      if (result.passed) {
        passed++;
        process.stdout.write('✅');
      } else {
        failed++;
        process.stdout.write('❌');
      }
    } catch (err) {
      const result: QwenResult = {
        iteration: i + 1,
        output: `ERROR: ${err}`,
        passedTS: false,
        passedSem: false,
        passed: false,
        tsErrors: ['call_failed'],
        semErrors: [],
        timestamp: new Date().toISOString(),
      };
      results.push(result);
      failed++;
      process.stdout.write('⚠️');
    }
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(` [${i + 1}/${ITERATIONS}]\n`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n');
  console.log('='.repeat(60));
  console.log('QWEN DRIFT TEST RESULTS');
  console.log('='.repeat(60));
  console.log('');
  
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.filter(r => !r.passed).length;
  const tsPassRate = results.filter(r => r.passedTS).length / ITERATIONS * 100;
  const semPassRate = results.filter(r => r.passedSem).length / ITERATIONS * 100;
  
  console.log(`Total Runs: ${ITERATIONS}`);
  console.log(`Full Pass (TS + Sem): ${totalPassed} (${(totalPassed / ITERATIONS * 100).toFixed(1)}%)`);
  console.log(`TypeScript Guard Pass: ${tsPassRate.toFixed(1)}%`);
  console.log(`Semantic Guard Pass: ${semPassRate.toFixed(1)}%`);
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
  
  const sampleOutputs = results.slice(0, 3).map((r, i) => ({
    iteration: i + 1,
    output: r.output.slice(0, 200) + (r.output.length > 200 ? '...' : ''),
    passed: r.passed,
  }));
  
  console.log('Sample Outputs (first 3):');
  for (const s of sampleOutputs) {
    console.log(`  [${s.iteration}] ${s.passed ? '✅' : '❌'}: ${s.output.slice(0, 100)}...`);
  }
  console.log('');
  
  const summary = {
    timestamp: new Date().toISOString(),
    iterations: ITERATIONS,
    passed: totalPassed,
    failed: totalFailed,
    tsPassRate,
    semPassRate,
    tsFailureTypes: Object.fromEntries(tsFailureTypes),
    semFailureTypes: Object.fromEntries(semFailureTypes),
    results: results.map(r => ({
      iteration: r.iteration,
      passed: r.passed,
      tsErrors: r.tsErrors,
      semErrors: r.semErrors,
    })),
  };
  
  const summaryPath = path.join(OUTPUT_DIR, 'qwen-drift-summary.json');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Detailed results saved to: ${summaryPath}`);
  console.log('');
  
  if (tsPassRate >= 80 && semPassRate >= 60) {
    console.log('✅ THESIS VALIDATED - Qwen demonstrates strong TypeScript compliance');
  } else if (tsPassRate >= 50) {
    console.log('⚠️ PARTIAL VALIDATION - TypeScript compliance present but semantic guard shows gaps');
  } else {
    console.log('❌ THESIS NOT VALIDATED - Low compliance suggests format pressure insufficient');
  }
}

runQwenDriftTest().catch(console.error);