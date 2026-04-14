// Canonical agent protocol schemas
// Re-exports from core-schemas with additional protocol-level utilities

export {
  RawAgentSummarySchema,
  NormalizedAgentSummarySchema,
  CondensedRelay200Schema,
  CondensedRelay300Schema,
  ToolFindingSchema,
  OpenClawEventSchema,
  AgentSummaryEventSchema,
  AgentNormalizedEventSchema,
  CondensedRelayEventSchema,
  type RawAgentSummary,
  type NormalizedAgentSummary,
  type CondensedRelay200,
  type CondensedRelay300,
  type ToolFinding,
} from '@openclaw/core-schemas';

// Protocol-level validation helpers
import {
  RawAgentSummarySchema,
  NormalizedAgentSummarySchema,
  CondensedRelay200Schema,
  CondensedRelay300Schema,
  type RawAgentSummary,
  type NormalizedAgentSummary,
  type CondensedRelay200,
  type CondensedRelay300,
} from '@openclaw/core-schemas';
import { SchemaValidationError } from '@openclaw/core-errors';

export function validateRawSummary(data: unknown): RawAgentSummary {
  const result = RawAgentSummarySchema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError('Invalid RawAgentSummary', {
      errors: result.error.flatten(),
      input: data,
    });
  }
  return result.data;
}

export function validateNormalizedSummary(data: unknown): NormalizedAgentSummary {
  const result = NormalizedAgentSummarySchema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError('Invalid NormalizedAgentSummary', {
      errors: result.error.flatten(),
      input: data,
    });
  }
  return result.data;
}

export function validateCondensedRelay200(data: unknown): CondensedRelay200 {
  const result = CondensedRelay200Schema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError('Invalid CondensedRelay200', {
      errors: result.error.flatten(),
      input: data,
    });
  }
  return result.data;
}

export function validateCondensedRelay300(data: unknown): CondensedRelay300 {
  const result = CondensedRelay300Schema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError('Invalid CondensedRelay300', {
      errors: result.error.flatten(),
      input: data,
    });
  }
  return result.data;
}
