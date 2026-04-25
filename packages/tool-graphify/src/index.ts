// Graphify adapter — knowledge graph incremental build, query, subgraph extraction
// Contract interface + local CLI-based implementation using child_process.execFile

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import * as fs from 'fs';
import * as path from 'path';

import { EventBus } from '@openclaw/core-events';
import { Logger } from '@openclaw/core-logging';
import type {
  GraphSubgraph,
  GraphNode,
  GraphEdge,
  EdgeRelation,
  EdgeConfidence,
} from '@openclaw/core-types';

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface GraphifyUpdateResult {
  nodeCount: number;
  edgeCount: number;
  changedFiles: string[];
  durationMs: number;
  error?: string;
}

export interface GraphifyAdapter {
  /** Incremental AST-only rebuild. Zero LLM cost. */
  incrementalUpdate(changedFiles: string[]): Promise<GraphifyUpdateResult>;

  /** Query the graph. Returns a budget-constrained subgraph. */
  query(question: string, budget?: number, mode?: 'bfs' | 'dfs'): Promise<GraphSubgraph>;

  /** Shortest path between two labeled nodes. */
  path(nodeA: string, nodeB: string): Promise<GraphSubgraph>;

  /** Read graph stats from graph.json without CLI overhead. */
  getGraphStats(): Promise<{ nodeCount: number; edgeCount: number; stale: boolean }>;

  /** Emit graphify.graph.updated event. */
  emitUpdateEvent(result: GraphifyUpdateResult): Promise<void>;
}

// ---------------------------------------------------------------------------
// LocalGraphifyAdapter — CLI-based implementation
// ---------------------------------------------------------------------------

export class LocalGraphifyAdapter implements GraphifyAdapter {
  private eventBus: EventBus;
  private logger: Logger;
  private workDir: string;
  private graphifyBin: string;
  private graphPath: string;

  constructor(
    eventBus: EventBus,
    logger: Logger,
    workDir: string,
    options?: { venvPath?: string; graphPath?: string },
  ) {
    this.eventBus = eventBus;
    this.logger = logger.child({ service: 'LocalGraphifyAdapter' });
    this.workDir = workDir;

    const venv = options?.venvPath;
    this.graphifyBin = venv ? `${venv}/bin/graphify` : 'graphify';

    this.graphPath = options?.graphPath ?? path.join(workDir, 'graphify-out', 'graph.json');
  }

  async incrementalUpdate(changedFiles: string[]): Promise<GraphifyUpdateResult> {
    const start = Date.now();
    try {
      await execFileAsync(this.graphifyBin, ['update', this.workDir], {
        cwd: this.workDir,
        timeout: 60_000,
      });

      const stats = await this.getGraphStats();
      const result: GraphifyUpdateResult = {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        changedFiles,
        durationMs: Date.now() - start,
      };

      this.logger.info('graphify.incremental.updated', {
        nodeCount: stats.nodeCount,
        edgeCount: stats.edgeCount,
        durationMs: result.durationMs,
      });

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('graphify.incremental.error', { error: msg });
      return {
        nodeCount: 0,
        edgeCount: 0,
        changedFiles,
        durationMs: Date.now() - start,
        error: msg,
      };
    }
  }

  async query(question: string, budget = 500, mode: 'bfs' | 'dfs' = 'bfs'): Promise<GraphSubgraph> {
    try {
      const args = ['query', question, '--budget', String(budget)];
      if (mode === 'dfs') args.push('--dfs');

      const { stdout } = await execFileAsync(this.graphifyBin, args, {
        cwd: this.workDir,
        timeout: 30_000,
      });

      return this.parseQueryOutput(stdout, mode, budget);
    } catch (err) {
      this.logger.warn('graphify.query.fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { nodes: [], edges: [], tokenCost: 0, traversalMode: mode, startNodeIds: [] };
    }
  }

  async path(nodeA: string, nodeB: string): Promise<GraphSubgraph> {
    try {
      const { stdout } = await execFileAsync(
        this.graphifyBin,
        ['path', nodeA, nodeB],
        { cwd: this.workDir, timeout: 15_000 },
      );

      return this.parsePathOutput(stdout);
    } catch (err) {
      this.logger.warn('graphify.path.fallback', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { nodes: [], edges: [], tokenCost: 0, traversalMode: 'dfs', startNodeIds: [] };
    }
  }

  async getGraphStats(): Promise<{ nodeCount: number; edgeCount: number; stale: boolean }> {
    if (!fs.existsSync(this.graphPath)) {
      return { nodeCount: 0, edgeCount: 0, stale: true };
    }

    try {
      const raw = JSON.parse(fs.readFileSync(this.graphPath, 'utf-8'));
      return {
        nodeCount: raw.nodes?.length ?? 0,
        edgeCount: raw.links?.length ?? 0,
        stale: false,
      };
    } catch {
      return { nodeCount: 0, edgeCount: 0, stale: true };
    }
  }

  async emitUpdateEvent(result: GraphifyUpdateResult): Promise<void> {
    if (result.error) return;

    await this.eventBus.emit({
      kind: 'graphify.graph.updated',
      schemaVersion: 'v1',
      sequence: 0,
      streamId: 'graphify',
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
      changedFiles: result.changedFiles,
      durationMs: result.durationMs,
      timestamp: new Date().toISOString(),
    });
  }

  // ---------------------------------------------------------------------------
  // Output parsing
  // ---------------------------------------------------------------------------

  private parseQueryOutput(stdout: string, mode: 'bfs' | 'dfs', _budget: number): GraphSubgraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const startNodeIds: string[] = [];

    for (const line of stdout.split('\n').filter(Boolean)) {
      if (line.startsWith('  NODE ')) {
        const parsed = this.parseNodeLine(line);
        if (parsed) {
          nodes.push(parsed);
          if (startNodeIds.length < 3) startNodeIds.push(parsed.id);
        }
      } else if (line.startsWith('  EDGE ')) {
        const parsed = this.parseEdgeLine(line);
        if (parsed) edges.push(parsed);
      }
    }

    return {
      nodes,
      edges,
      tokenCost: Math.ceil(stdout.length / 4),
      traversalMode: mode,
      startNodeIds,
    };
  }

  private parsePathOutput(stdout: string): GraphSubgraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const startNodeIds: string[] = [];
    const seenNodeIds = new Set<string>();

    for (const line of stdout.split('\n').filter(Boolean)) {
      const edgeMatch = line.match(/^\s*(.+?)\s+--(\w+)-->\s+\[(\w+)\]\s+(.*)/);
      if (edgeMatch) {
        const [, srcLabel, relation, confidence, tgtLabel] = edgeMatch;
        const srcId = this.labelToId(srcLabel);
        const tgtId = this.labelToId(tgtLabel);

        if (!seenNodeIds.has(srcId)) {
          nodes.push({ id: srcId, label: srcLabel, file_type: 'code', source_file: '', source_location: null });
          seenNodeIds.add(srcId);
        }
        if (!seenNodeIds.has(tgtId)) {
          nodes.push({ id: tgtId, label: tgtLabel, file_type: 'code', source_file: '', source_location: null });
          seenNodeIds.add(tgtId);
        }
        edges.push({
          source: srcId,
          target: tgtId,
          relation: relation as EdgeRelation,
          confidence: confidence as EdgeConfidence,
          confidence_score: confidence === 'EXTRACTED' ? 1.0 : confidence === 'INFERRED' ? 0.7 : 0.3,
          source_file: '',
        });
        if (startNodeIds.length === 0) startNodeIds.push(srcId);
      }
    }

    return {
      nodes,
      edges,
      tokenCost: Math.ceil(stdout.length / 4),
      traversalMode: 'dfs',
      startNodeIds,
    };
  }

  private parseNodeLine(line: string): GraphNode | null {
    const match = line.match(/NODE\s+(.+?)\s+\[src=([^\s\]]+)\s+loc=([^\]]*)\]/);
    if (!match) return null;
    const [, label, srcFile, loc] = match;
    return {
      id: this.labelToId(label),
      label,
      file_type: 'code',
      source_file: srcFile,
      source_location: loc || null,
    };
  }

  private parseEdgeLine(line: string): GraphEdge | null {
    const match = line.match(/EDGE\s+(.+?)\s+--(\w+)-->\s+\[(\w+)\]\s+(.*)/);
    if (!match) return null;
    const [, srcLabel, relation, confidence, tgtLabel] = match;
    return {
      source: this.labelToId(srcLabel),
      target: this.labelToId(tgtLabel),
      relation: relation as EdgeRelation,
      confidence: confidence as EdgeConfidence,
      confidence_score: confidence === 'EXTRACTED' ? 1.0 : confidence === 'INFERRED' ? 0.7 : 0.3,
      source_file: '',
    };
  }

  private labelToId(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
}