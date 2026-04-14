// TypeScriptGuard v2 — Lightweight Compiler-Level Validation
// Validates TypeScript interface output like a real compiler would — fast, no tsc dependency
// Based on EMISSION_PAPER.md and TYPESCRIPT_GUARD_v2.md

export interface ValidationResult {
  passed: boolean;
  stage: string;
  issues: string[];
  extractedInterface?: string;
  parsedFields?: Map<string, FieldType>;
}

export interface FieldType {
  name: string;
  type: string;
  optional: boolean;
  rawMatch: string;
}

export const REQUIRED_INTERFACES: Record<string, string[]> = {
  Progress: ['taskId', 'agent', 'phase', 'done', 'blockers'],
  ADRSchema: ['taskId', 'agent', 'objective', 'ownedFiles'],
  CondensedEmission: ['agentId', 'updates', 'blockers', 'status'],
  NormalizedAgentSummary: ['taskId', 'agentId', 'status', 'conciseSummary'],
  RawAgentSummary: ['taskId', 'agentId', 'status', 'summary'],
};

export function extractInterfaceBlock(raw: string, interfaceName: string): string | null {
  const codeBlockMatch = raw.match(/```(?:typescript)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) raw = codeBlockMatch[1];

  const pattern = new RegExp(`interface\\s+${interfaceName}\\s*\\{([^}]*)\\}`);
  const match = raw.match(pattern);
  return match ? match[0] : null;
}

export function validateBraceBalance(block: string): boolean {
  const open = (block.match(/\{/g) || []).length;
  const close = (block.match(/\}/g) || []).length;
  return open === close && open > 0;
}

export function parseFieldTypes(block: string): Map<string, FieldType> {
  const fields = new Map<string, FieldType>();

  const fieldPattern = /(\w+)(\?)?:\s*(.+)/g;
  let match;

  while ((match = fieldPattern.exec(block)) !== null) {
    const [, name, optional, type] = match;
    fields.set(name, {
      name,
      type: type || 'unknown',
      optional: optional === '?',
      rawMatch: match[0],
    });
  }

  return fields;
}

export function validateFieldTypes(fields: Map<string, FieldType>, requiredFields: string[]): string[] {
  const issues = [];

  for (const fieldName of requiredFields) {
    const field = fields.get(fieldName);

    if (!field) {
      issues.push(`missing_field:${fieldName}`);
      continue;
    }

    if (fieldName === 'done' || fieldName === 'blockers' || fieldName === 'updates' || fieldName === 'touchedFiles' || fieldName === 'nextActions') {
      if (!field.type.includes('[]')) {
        issues.push(`invalid_type:${fieldName}: expected array, got ${field.type}`);
      }
    }

    if (fieldName === 'verified' || fieldName === 'needsEscalation') {
      if (field.type !== 'boolean') {
        issues.push(`invalid_type:${fieldName}: expected boolean, got ${field.type}`);
      }
    }
  }

  return issues;
}

export interface TypeScriptGuardOptions {
  requiredInterface: string;
  maxOutputTokens?: number;
}

export class TypeScriptGuard {
  private options: TypeScriptGuardOptions;

  constructor(options: TypeScriptGuardOptions) {
    this.options = options;
  }

  validate(raw: string): ValidationResult {
    const result: ValidationResult = {
      passed: false,
      stage: 'start',
      issues: [],
    };

    const interfaceName = this.options.requiredInterface;

    const block = extractInterfaceBlock(raw, interfaceName);
    if (!block) {
      result.stage = 'extraction';
      result.issues.push('no_interface_found');
      return result;
    }
    result.extractedInterface = block;
    result.stage = 'extraction';

    if (!validateBraceBalance(block)) {
      result.stage = 'brace_balance';
      result.issues.push('unbalanced_braces');
      return result;
    }
    result.stage = 'brace_balance';

    const requiredFields = REQUIRED_INTERFACES[interfaceName] || [];
    const fields = parseFieldTypes(block);
    result.parsedFields = fields;

    for (const fieldName of requiredFields) {
      if (!fields.has(fieldName)) {
        result.issues.push(`missing_field:${fieldName}`);
      }
    }

    if (result.issues.length > 0) {
      result.stage = 'field_presence';
      return result;
    }
    result.stage = 'field_presence';

    const typeIssues = validateFieldTypes(fields, requiredFields);
    result.issues.push(...typeIssues);

    if (result.issues.length > 0) {
      result.stage = 'type_validation';
      return result;
    }
    result.stage = 'type_validation';

    result.stage = 'complete';
    result.passed = result.issues.length === 0;

    return result;
  }

  validateMulti(raw: string, interfaceNames: string[]): ValidationResult {
    for (const name of interfaceNames) {
      const result = new TypeScriptGuard({ requiredInterface: name }).validate(raw);
      if (result.passed) return result;
    }
    return new TypeScriptGuard({ requiredInterface: interfaceNames[0] }).validate(raw);
  }
}

export const createTypeScriptGuard = (options: TypeScriptGuardOptions): TypeScriptGuard => {
  return new TypeScriptGuard(options);
};