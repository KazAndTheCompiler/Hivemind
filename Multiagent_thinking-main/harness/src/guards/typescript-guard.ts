import {
  ValidationResult,
  FieldType,
  REQUIRED_INTERFACES,
} from '../schemas/index.js';

export function extractInterfaceBlock(raw: string, interfaceName: string): string | null {
  const codeBlockMatch = raw.match(/```(?:typescript|ts)?\s*([\s\S]*?)```/);
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
  
  const lines = block.split('\n');
  for (const line of lines) {
    const match = line.match(/(\w+)(\?)?:\s*([^\n;]+)/);
    if (match) {
      const [, name, optional, typeStr] = match;
      fields.set(name, {
        name,
        type: typeStr.trim(),
        optional: optional === "?",
        rawMatch: line.trim(),
      });
    }
  }
  
  return fields;
}

export function validateFieldTypes(fields: Map<string, FieldType>, requiredFields: string[]): string[] {
  const issues: string[] = [];
  
  for (const fieldName of requiredFields) {
    const field = fields.get(fieldName);
    
    if (!field) {
      issues.push(`missing_field:${fieldName}`);
      continue;
    }
    
    const arrayFields = ["done", "blockers", "updates", "ownedFiles", "touchedFiles", "findings"];
    const looksLikeArray = field.type.trim().startsWith('[') && field.type.trim().endsWith(']');
    if (arrayFields.includes(fieldName) && !looksLikeArray) {
      issues.push(`invalid_type:${fieldName}: expected array, got ${field.type}`);
    }
    
    const booleanFields = ["needsEscalation", "verified"];
    if (booleanFields.includes(fieldName) && field.type.trim() !== 'boolean') {
      issues.push(`invalid_type:${fieldName}: expected boolean, got ${field.type}`);
    }
    
    const numberFields = ["confidence", "score"];
    if (numberFields.includes(fieldName) && field.type.trim() !== 'number' && !field.type.includes('number')) {
      issues.push(`invalid_type:${fieldName}: expected number, got ${field.type}`);
    }
  }
  
  return issues;
}

export function validateTypeScriptGuard(raw: string, interfaceName: string): ValidationResult {
  const result: ValidationResult = {
    passed: false,
    stage: "start",
    issues: [],
  };
  
  const block = extractInterfaceBlock(raw, interfaceName);
  if (!block) {
    result.stage = "extraction";
    result.issues.push("no_interface_found");
    return result;
  }
  result.extractedInterface = block;
  result.stage = "extraction";
  
  if (!validateBraceBalance(block)) {
    result.stage = "brace_balance";
    result.issues.push("unbalanced_braces");
    return result;
  }
  result.stage = "brace_balance";
  
  const requiredFields = REQUIRED_INTERFACES[interfaceName as keyof typeof REQUIRED_INTERFACES] || [];
  const fields = parseFieldTypes(block);
  result.parsedFields = fields;
  
  for (const fieldName of requiredFields) {
    if (!fields.has(fieldName)) {
      result.issues.push(`missing_field:${fieldName}`);
    }
  }
  
  if (result.issues.length > 0) {
    result.stage = "field_presence";
    return result;
  }
  result.stage = "field_presence";
  
  const typeIssues = validateFieldTypes(fields, requiredFields);
  result.issues.push(...typeIssues);
  
  if (result.issues.length > 0) {
    result.stage = "type_validation";
    return result;
  }
  result.stage = "complete";
  result.passed = result.issues.length === 0;
  
  return result;
}

export function validateInterfaceName(raw: string, expectedName: string): boolean {
  const pattern = new RegExp(`interface\\s+${expectedName}\\s*\\{`);
  return pattern.test(raw);
}

export class TypeScriptGuard {
  private interfaceName: string;
  private requiredFields: string[];
  
  constructor(interfaceName: string, requiredFields: string[]) {
    this.interfaceName = interfaceName;
    this.requiredFields = requiredFields;
  }
  
  validate(raw: string): ValidationResult {
    return validateTypeScriptGuard(raw, this.interfaceName);
  }
  
  getRequiredFields(): string[] {
    return [...this.requiredFields];
  }
  
  getInterfaceName(): string {
    return this.interfaceName;
  }
}