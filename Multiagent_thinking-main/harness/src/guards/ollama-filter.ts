import { CondensedEmission, ProgressSchema } from '../schemas/index.js';

const MAX_UPDATES = 3;
const MAX_BLOCKERS = 1;
const MAX_TOUCHED_FILES = 5;

export function condenseProgress(progress: ProgressSchema): CondensedEmission {
  return {
    agentId: progress.agent,
    updates: progress.done.slice(0, MAX_UPDATES),
    blockers: progress.blockers.slice(0, MAX_BLOCKERS),
    touchedFiles: (progress.touchedFiles || []).slice(0, MAX_TOUCHED_FILES),
    status: progress.blockers.length > 0 ? 'blocked' : 
            progress.phase === 'complete' ? 'complete' : 'working',
  };
}

export function condenseFromRaw(
  agentId: string,
  phase: string,
  done: string[],
  blockers: string[],
  touchedFiles?: string[]
): CondensedEmission {
  return {
    agentId,
    updates: done.slice(0, MAX_UPDATES),
    blockers: blockers.slice(0, MAX_BLOCKERS),
    touchedFiles: (touchedFiles || []).slice(0, MAX_TOUCHED_FILES),
    status: blockers.length > 0 ? 'blocked' : 
            phase === 'complete' ? 'complete' : 'working',
  };
}

export function capOutputSize(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars - 3) + '...';
}

export class OllamaFilter {
  condense(progress: ProgressSchema): CondensedEmission {
    return condenseProgress(progress);
  }
  
  condenseRaw(
    agentId: string,
    phase: string,
    done: string[],
    blockers: string[],
    touchedFiles?: string[]
  ): CondensedEmission {
    return condenseFromRaw(agentId, phase, done, blockers, touchedFiles);
  }
}