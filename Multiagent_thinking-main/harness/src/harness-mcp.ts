#!/usr/bin/env node
/**
 * harness-mcp.ts - MCP server exposing harness functionality via stdio
 * 
 * Run with: node harness/dist/harness-mcp.js
 * qwen will connect via: qwen mcp add harness node path/to/harness-mcp.js
 */

import { ScenarioRunner } from './scenario-runner.js';
import * as fs from 'fs';
import * as path from 'path';

const HARNESS_DIR = path.join(process.cwd(), 'harness');

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const tools: Tool[] = [
  {
    name: 'run_harness_scenarios',
    description: 'Run all 8 test scenarios with mock provider',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'run_single_scenario',
    description: 'Run a single test scenario (baseline-snake-game, emission-snake-game, failure-loop, overlap-conflict, cross-file-dependency, 3-agent-flow, provider-switching, 15-step-loop)',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string' },
      },
    },
  },
  {
    name: 'run_mock_tests',
    description: 'Run quick mocked tests (3 scenarios)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'print_summary',
    description: 'Print latest test summary',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_results',
    description: 'Get all test results',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'read_result',
    description: 'Read a specific result file',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string' },
        filename: { type: 'string' },
      },
    },
  },
];

function sendResponse(id: number | string, result: unknown): void {
  const response = { jsonrpc: '2.0', id, result };
  console.error(JSON.stringify(response)); // Debug to stderr
}

function sendError(id: number | string, code: number, message: string): void {
  const response = { jsonrpc: '2.0', id, error: { code, message } };
  console.error(JSON.stringify(response));
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'run_harness_scenarios': {
      const runner = new ScenarioRunner({
        useMock: true,
        outputDir: './harness/results',
        verbose: false,
      });
      const results = await runner.runAll([
        './harness/fixtures/baseline-snake-game.json',
        './harness/fixtures/emission-snake-game.json',
        './harness/fixtures/failure-loop.json',
        './harness/fixtures/overlap-conflict.json',
        './harness/fixtures/cross-file-dependency.json',
        './harness/fixtures/3-agent-flow.json',
        './harness/fixtures/provider-switching.json',
        './harness/fixtures/15-step-loop.json',
      ]);
      const stats = runner.getAggregateStats();
      return { 
        passed: stats.passed, 
        total: stats.total, 
        passRate: `${(stats.passRate * 100).toFixed(1)}%`,
        failed: stats.failed 
      };
    }
    
    case 'run_single_scenario': {
      const scenario = args.scenario as string;
      const runner = new ScenarioRunner({
        useMock: true,
        outputDir: './harness/results',
        verbose: false,
      });
      const result = await runner.runSingle(`./harness/fixtures/${scenario}.json`);
      return { 
        scenarioId: result.scenarioId,
        passed: result.passed,
        complianceRate: `${(result.metrics.complianceRate * 100).toFixed(1)}%`,
        totalTokens: result.metrics.totalTokens,
        errors: result.errors,
      };
    }
    
    case 'run_mock_tests': {
      const runner = new ScenarioRunner({
        useMock: true,
        outputDir: './harness/results',
        verbose: false,
      });
      const results = await runner.runAll([
        './harness/fixtures/3-agent-flow.json',
        './harness/fixtures/baseline-snake-game.json',
        './harness/fixtures/emission-snake-game.json',
      ]);
      const stats = runner.getAggregateStats();
      return { 
        passed: stats.passed, 
        total: stats.total, 
        passRate: `${(stats.passRate * 100).toFixed(1)}%` 
      };
    }
    
    case 'print_summary': {
      const resultsDir = path.join(HARNESS_DIR, 'results');
      if (!fs.existsSync(resultsDir)) {
        return { error: 'No results found - run tests first' };
      }
      const dirs = fs.readdirSync(resultsDir)
        .filter(f => fs.statSync(path.join(resultsDir, f)).isDirectory())
        .map(f => ({ name: f, mtime: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (dirs.length === 0) {
        return { error: 'No results found' };
      }
      
      const latestDir = path.join(resultsDir, dirs[0].name);
      const aggregatePath = path.join(latestDir, 'aggregate.json');
      
      if (fs.existsSync(aggregatePath)) {
        return JSON.parse(fs.readFileSync(aggregatePath, 'utf-8'));
      }
      
      return { error: 'No aggregate.json in latest results' };
    }
    
    case 'get_results': {
      const resultsDir = path.join(HARNESS_DIR, 'results');
      if (!fs.existsSync(resultsDir)) {
        return { error: 'No results found' };
      }
      const scenarios = fs.readdirSync(resultsDir)
        .filter(f => fs.statSync(path.join(resultsDir, f)).isDirectory());
      
      const results: Record<string, { summaryExists: boolean; metricsExists: boolean; metrics?: unknown }> = {};
      for (const scenario of scenarios) {
        const metricsPath = path.join(resultsDir, scenario, 'metrics.json');
        
        results[scenario] = {
          summaryExists: fs.existsSync(path.join(resultsDir, scenario, 'summary.md')),
          metricsExists: fs.existsSync(metricsPath),
        };
        
        if (fs.existsSync(metricsPath)) {
          const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
          results[scenario].metrics = metrics;
        }
      }
      return results;
    }
    
    case 'read_result': {
      const scenario = args.scenario as string;
      const filename = args.filename as string;
      const filePath = path.join(HARNESS_DIR, 'results', scenario, filename);
      
      if (!fs.existsSync(filePath)) {
        return { error: `File not found: ${scenario}/${filename}` };
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      return { content };
    }
    
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function processRequest(request: MCPRequest): Promise<void> {
  const { method, params, id } = request;
  
  try {
    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'harness-mcp', version: '1.0.0' },
      });
      return;
    }
    
    if (method === 'tools/list') {
      sendResponse(id, { tools });
      return;
    }
    
    if (method === 'tools/call') {
      const toolName = params?.name as string;
      const toolArgs = (params?.arguments as Record<string, unknown>) || {};
      
      const result = await handleToolCall(toolName, toolArgs);
      
      sendResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      });
      return;
    }
    
    sendError(id, -32601, `Method not found: ${method}`);
  } catch (error) {
    sendError(id, -32603, `Internal error: ${error}`);
  }
}

// Read requests from stdin
let buffer = '';
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line) as MCPRequest;
      processRequest(request);
    } catch (e) {
      // Ignore parse errors for now
    }
  }
});

process.stdin.on('end', () => {
  if (buffer.trim()) {
    try {
      const request = JSON.parse(buffer) as MCPRequest;
      processRequest(request);
    } catch (e) {
      // Ignore
    }
  }
});

// Log startup
console.error('Harness MCP server started');