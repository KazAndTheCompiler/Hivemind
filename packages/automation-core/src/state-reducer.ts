// System state reducer — pure, deterministic state management
// Supports replay and time-travel debugging

// Local type definitions (compatible with core-types.SystemState)
export interface SystemState {
  tasks: Record<string, unknown>;
  lastUpdated: string;
}

export type StateReducerEvent =
  | {
      kind: 'task.created';
      taskId: string;
      agentId: string;
      status: string;
      timestamp: string;
    }
  | {
      kind: 'task.updated';
      taskId: string;
      status: string;
      result?: unknown;
      timestamp: string;
    }
  | {
      kind: 'task.failed';
      taskId: string;
      error: string;
      timestamp: string;
    }
  | {
      kind: 'relay.delivered';
      taskId: string;
      severity: string;
      timestamp: string;
    };

/**
 * Create initial system state.
 */
export function createInitialState(): SystemState {
  return {
    tasks: {},
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Pure reducer function — immutable state transitions.
 * Deterministic and replayable.
 */
export function reduce(state: SystemState, event: StateReducerEvent): SystemState {
  // Always return new object (immutable)
  const newState = JSON.parse(JSON.stringify(state)) as SystemState;

  switch (event.kind) {
    case 'task.created':
      newState.tasks[event.taskId] = {
        taskId: event.taskId,
        agentId: event.agentId,
        status: event.status,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
      };
      break;

    case 'task.updated':
      if (newState.tasks[event.taskId]) {
        const task = newState.tasks[event.taskId] as any;
        task.status = event.status;
        task.result = event.result;
        task.updatedAt = event.timestamp;
      }
      break;

    case 'task.failed':
      if (newState.tasks[event.taskId]) {
        const task = newState.tasks[event.taskId] as any;
        task.status = 'failed';
        task.error = event.error;
        task.updatedAt = event.timestamp;
      }
      break;

    case 'relay.delivered':
      if (newState.tasks[event.taskId]) {
        const task = newState.tasks[event.taskId] as any;
        task.relayDelivered = true;
        task.relaySeverity = event.severity;
        task.updatedAt = event.timestamp;
      }
      break;

    default:
      break;
  }

  newState.lastUpdated = new Date().toISOString();
  return newState;
}

/**
 * Replay events to rebuild state.
 * Useful for debugging and time-travel.
 */
export function replayEvents(events: StateReducerEvent[]): SystemState {
  let state = createInitialState();

  for (const event of events) {
    state = reduce(state, event);
  }

  return state;
}

/**
 * Get task by ID.
 */
export function getTask(state: SystemState, taskId: string): unknown {
  return state.tasks[taskId] ?? null;
}

/**
 * List all tasks matching a filter.
 */
export function listTasks(
  state: SystemState,
  filter?: (task: any) => boolean,
): unknown[] {
  const tasks = Object.values(state.tasks);
  return filter ? tasks.filter(filter) : tasks;
}

/**
 * Get all tasks in a specific status.
 */
export function getTasksByStatus(state: SystemState, status: string): unknown[] {
  return listTasks(state, (task: any) => task.status === status);
}
