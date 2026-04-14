// Enforcement policy evaluation and decision logic
// Evaluates tool results against policy rules to make proceed/repair decisions

import { Logger } from '@openclaw/core-logging';
import { DEFAULT_ENFORCEMENT_POLICY } from '@openclaw/automation-core';
import type {
  ToolExecutionResult,
  ToolName,
  EnforcementPolicy,
  EnforcementDecision,
  ToolPolicy,
  AutomationMode,
} from '@openclaw/automation-core';

export class PolicyEvaluator {
  private logger: Logger;
  private policy: EnforcementPolicy;

  constructor(logger: Logger, policy?: EnforcementPolicy) {
    this.logger = logger.child({ service: 'PolicyEvaluator' });
    this.policy = policy ?? DEFAULT_ENFORCEMENT_POLICY;
  }

  evaluate(results: ToolExecutionResult[], mode: AutomationMode): EnforcementDecision {
    const blockingTools: ToolName[] = [];
    const warningTools: ToolName[] = [];
    const skippedTools: ToolName[] = [];

    for (const result of results) {
      const toolPolicy = this.policy[result.tool];

      if (!toolPolicy) {
        this.logger.warn('policy.evaluator.unknown_tool', { tool: result.tool });
        continue;
      }

      if (!toolPolicy.allowedModes.includes(mode)) {
        skippedTools.push(result.tool);
        continue;
      }

      if (result.status === 'skipped') {
        skippedTools.push(result.tool);
        continue;
      }

      if (result.status === 'failed' || result.status === 'timed_out') {
        if (toolPolicy.blockerOnFailure) {
          blockingTools.push(result.tool);
        } else if (toolPolicy.warnOnFailure) {
          warningTools.push(result.tool);
        }
      }

      if (result.status === 'partial') {
        if (toolPolicy.blockerOnFailure && result.blockerCount > 0) {
          blockingTools.push(result.tool);
        } else if (toolPolicy.warnOnFailure) {
          warningTools.push(result.tool);
        }
      }
    }

    const canProceed = blockingTools.length === 0 || !this.policy.failClosed;

    const rationale = this.buildRationale(canProceed, blockingTools, warningTools, skippedTools);

    this.logger.info('policy.evaluation.complete', {
      canProceed,
      blockingTools,
      warningTools,
      skippedTools,
    });

    return {
      canProceed,
      blockingTools,
      warningTools,
      rationale,
    };
  }

  getToolPolicy(tool: ToolName): ToolPolicy | undefined {
    return this.policy[tool];
  }

  isToolRequired(tool: ToolName, mode: AutomationMode): boolean {
    const toolPolicy = this.policy[tool];
    if (!toolPolicy) return false;
    return toolPolicy.required && toolPolicy.allowedModes.includes(mode);
  }

  getRequiredTools(mode: AutomationMode): ToolName[] {
    return (['prettier', 'eslint', 'tsc', 'knip', 'gitnexus'] as ToolName[]).filter((tool) =>
      this.isToolRequired(tool, mode),
    );
  }

  shouldRetry(tool: ToolName, currentRetryCount: number): boolean {
    const toolPolicy = this.policy[tool];
    if (!toolPolicy) return false;
    return currentRetryCount < toolPolicy.maxRetries;
  }

  getTimeout(tool: ToolName): number {
    const toolPolicy = this.policy[tool];
    return toolPolicy?.timeoutMs ?? 60_000;
  }

  updateToolPolicy(tool: ToolName, policy: Partial<ToolPolicy>): void {
    if (this.policy[tool]) {
      this.policy[tool] = { ...this.policy[tool], ...policy };
    }
  }

  private buildRationale(
    canProceed: boolean,
    blockingTools: ToolName[],
    warningTools: ToolName[],
    skippedTools: ToolName[],
  ): string {
    if (canProceed) {
      const parts: string[] = ['No blocking failures'];
      if (warningTools.length > 0) {
        parts.push(`warnings from: ${warningTools.join(', ')}`);
      }
      if (skippedTools.length > 0) {
        parts.push(`skipped: ${skippedTools.join(', ')}`);
      }
      return parts.join('. ');
    }

    const blockers = blockingTools.map((t) => {
      const result = this.findBlockingResult(t);
      return result ? `${t} (${result.blockerCount} blockers)` : t;
    });

    return `Blocked by: ${blockers.join(', ')}`;
  }

  private findBlockingResult(_tool: ToolName): ToolExecutionResult | undefined {
    return undefined;
  }
}

export const createPolicyEvaluator = (
  logger: Logger,
  policy?: EnforcementPolicy,
): PolicyEvaluator => {
  return new PolicyEvaluator(logger, policy);
};
