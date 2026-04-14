// Checkpoint trigger orchestration
// Manages checkpoint triggers based on mutation count, milestones, or manual command

import type { CheckpointTrigger, AutomationRun } from '@openclaw/automation-core';

export interface CheckpointState {
  mutationCount: number;
  lastCheckpointAt: string | null;
  checkpointCount: number;
}

export class CheckpointTriggerManager {
  private state: CheckpointState;
  private triggers: CheckpointTrigger[];
  private milestoneCallbacks: Array<(label: string) => Promise<void>>;

  constructor(initialMutationCount = 0, triggers?: CheckpointTrigger[]) {
    this.state = {
      mutationCount: initialMutationCount,
      lastCheckpointAt: null,
      checkpointCount: 0,
    };
    this.triggers = triggers ?? [
      { type: 'mutation_count', threshold: 10 },
      { type: 'mutation_count', threshold: 50 },
    ];
    this.milestoneCallbacks = [];
  }

  recordMutations(count: number): void {
    this.state.mutationCount += count;
  }

  shouldTrigger(): CheckpointTrigger | null {
    for (const trigger of this.triggers) {
      if (trigger.type === 'mutation_count') {
        if (this.state.mutationCount >= (trigger.threshold ?? 10)) {
          return trigger;
        }
      }
      if (trigger.type === 'manual') {
        return trigger;
      }
    }
    return null;
  }

  async triggerCheckpoint(label?: string): Promise<void> {
    this.state.lastCheckpointAt = new Date().toISOString();
    this.state.checkpointCount++;
    this.state.mutationCount = 0;

    const checkpointLabel = label ?? `checkpoint_${this.state.checkpointCount}`;

    for (const cb of this.milestoneCallbacks) {
      await cb(checkpointLabel);
    }
  }

  onMilestone(callback: (label: string) => Promise<void>): void {
    this.milestoneCallbacks.push(callback);
  }

  getState(): CheckpointState {
    return { ...this.state };
  }

  resetMutationCount(): void {
    this.state.mutationCount = 0;
  }

  addTrigger(trigger: CheckpointTrigger): void {
    this.triggers.push(trigger);
  }
}

export interface CheckpointContext {
  trigger: CheckpointTrigger;
  label: string;
  previousRun?: AutomationRun;
}

export class CheckpointOrchestrator {
  private manager: CheckpointTriggerManager;
  private prePromotionHooks: Array<(run: AutomationRun) => Promise<boolean>>;
  private checkpointRunners: Array<(ctx: CheckpointContext) => Promise<AutomationRun>>;

  constructor(manager?: CheckpointTriggerManager) {
    this.manager = manager ?? new CheckpointTriggerManager();
    this.prePromotionHooks = [];
    this.checkpointRunners = [];
  }

  recordMutations(count: number): void {
    this.manager.recordMutations(count);
  }

  shouldCheckpoint(): boolean {
    return this.manager.shouldTrigger() !== null;
  }

  async executeCheckpoint(label?: string): Promise<void> {
    await this.manager.triggerCheckpoint(label);
  }

  async executePrePromotionCheck(run: AutomationRun): Promise<boolean> {
    for (const hook of this.prePromotionHooks) {
      const approved = await hook(run);
      if (!approved) return false;
    }
    return true;
  }

  onPrePromotionHook(fn: (run: AutomationRun) => Promise<boolean>): void {
    this.prePromotionHooks.push(fn);
  }

  onCheckpointRunner(fn: (ctx: CheckpointContext) => Promise<AutomationRun>): void {
    this.checkpointRunners.push(fn);
  }

  getManager(): CheckpointTriggerManager {
    return this.manager;
  }

  getNextThreshold(): number | null {
    void this.manager.getState();
    const nextTrigger = this.manager.shouldTrigger();
    if (nextTrigger?.type === 'mutation_count') {
      return nextTrigger.threshold ?? null;
    }
    return null;
  }
}

export const createCheckpointTriggerManager = (
  initialMutationCount?: number,
  triggers?: CheckpointTrigger[],
): CheckpointTriggerManager => new CheckpointTriggerManager(initialMutationCount, triggers);

export const createCheckpointOrchestrator = (
  manager?: CheckpointTriggerManager,
): CheckpointOrchestrator => new CheckpointOrchestrator(manager);
