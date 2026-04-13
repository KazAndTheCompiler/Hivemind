// Canonical identifier types
export type LabId = string;
export type PackageId = string;
export type ToolId = string;
export type DetectionId = string;
export type DefenseId = string;
export type ForensicsId = string;

// Enums
export enum LabCategory {
  NETWORK_SECURITY = 'network-security',
  MALWARE_ANALYSIS = 'malware-analysis',
  CRYPTOGRAPHY = 'cryptography',
  WEB_SECURITY = 'web-security',
  FORENSICS = 'forensics',
  SOCIAL_ENGINEERING = 'social-engineering',
  INFRASTRUCTURE = 'infrastructure',
  EXPLOIT_DEVELOPMENT = 'exploit-development',
  THREAT_INTELLIGENCE = 'threat-intelligence',
  IDENTITY_ACCESS = 'identity-access',
  IOT_EMBEDDED = 'iot-embedded',
  CLOUD_DEVOPS = 'cloud-devops',
  RESEARCH = 'research',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum SafetyBoundary {
  DEFENSIVE = 'defensive',
  ANALYSIS = 'analysis',
  SIMULATION = 'simulation',
  DUAL_USE = 'dual-use',
  RESTRICTED_RESEARCH = 'restricted-research',
  LAB_ONLY = 'lab-only',
  DO_NOT_DEPLOY = 'do-not-deploy',
}

export enum ExecutionMode {
  DRY_RUN = 'dry-run',
  SIMULATION = 'simulation',
  ANALYSIS_ONLY = 'analysis-only',
  FULL_EXECUTION = 'full-execution',
}

export enum MaturityLevel {
  DRAFT = 'draft',
  EXPERIMENTAL = 'experimental',
  STABLE = 'stable',
  DEPRECATED = 'deprecated',
}

export enum PackageHealthStatus {
  HEALTHY = 'healthy',
  NEEDS_DOCS = 'needs-docs',
  NEEDS_TESTS = 'needs-tests',
  NEEDS_METADATA = 'needs-metadata',
  DEPRECATED = 'deprecated',
  BROKEN = 'broken',
}

// Core metadata interfaces
export interface BaseMetadata {
  id: PackageId;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  language: string;
  maturity: MaturityLevel;
  riskLevel: RiskLevel;
  safetyBoundary: SafetyBoundary;
  prerequisites: string[];
  setupSteps: string[];
  expectedOutputs: string[];
  testStatus: string;
  docsPath: string;
  owner: string;
  maintainer: string;
  sourceLegacyPath: string;
}

export interface LabMetadata extends BaseMetadata {
  type: 'lab';
  category: LabCategory;
  walkthrough: string[];
  cleanupSteps: string[];
  estimatedDuration: string;
}

export interface ToolMetadata extends BaseMetadata {
  type: 'tool';
  inputs: string[];
  outputs: string[];
  cliUsage: string;
}

export interface DetectionMetadata extends BaseMetadata {
  type: 'detection';
  detectionType: string;
  dataSource: string[];
  falsePositiveRate: string;
  ruleFormat: string;
}

export interface DefenseModuleMetadata extends BaseMetadata {
  type: 'defense';
  hardeningTarget: string;
  baselineConfig: string;
  complianceFrameworks: string[];
}

export interface ForensicsModuleMetadata extends BaseMetadata {
  type: 'forensics';
  evidenceTypes: string[];
  analysisMethods: string[];
  toolsRequired: string[];
}

// Runtime types
export interface RuntimeConfig {
  rootPath: string;
  artifactPath: string;
  fixturesPath: string;
  docsPath: string;
  logLevel: string;
  allowedExecutionModes: ExecutionMode[];
  restrictedLabToggle: boolean;
  environmentValidation: boolean;
  packageDiscoveryConfig: PackageDiscoveryConfig;
}

export interface PackageDiscoveryConfig {
  packagesPath: string;
  includePatterns: string[];
  excludePatterns: string[];
  metadataFileName: string;
}

export interface LogEvent {
  timestamp: string;
  packageId: PackageId;
  labId?: string;
  commandName: string;
  severity: 'debug' | 'info' | 'warn' | 'error';
  executionMode: ExecutionMode;
  correlationId: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface Finding {
  id: string;
  severity: RiskLevel;
  title: string;
  description: string;
  evidence: string;
  recommendation: string;
  sourcePackage: PackageId;
  timestamp: string;
}

export interface EvidenceRecord {
  id: string;
  type: string;
  source: string;
  collectedAt: string;
  hash: string;
  data: Record<string, unknown>;
  chainOfCustody: string[];
}

export interface AlertRecord {
  id: string;
  detectionId: DetectionId;
  severity: RiskLevel;
  timestamp: string;
  description: string;
  context: Record<string, unknown>;
  resolved: boolean;
}

export interface TestFixture {
  name: string;
  description: string;
  inputs: Record<string, unknown>;
  expectedOutputs: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface CliCommandSpec {
  name: string;
  description: string;
  usage: string;
  options: Record<string, string>;
  handler: string;
}

export interface ProjectMigrationRecord {
  legacyPath: string;
  targetDomain: string;
  targetPackage: PackageId;
  status: 'pending' | 'in-progress' | 'completed' | 'archived' | 'docs-only';
  migratedAt?: string;
  notes: string;
}

// Package inventory
export interface PackageInfo {
  id: PackageId;
  name: string;
  version: string;
  type: 'lab' | 'tool' | 'detection' | 'defense' | 'forensics' | 'content';
  path: string;
  metadata: BaseMetadata | LabMetadata | ToolMetadata | DetectionMetadata | DefenseModuleMetadata | ForensicsModuleMetadata;
  healthStatus: PackageHealthStatus;
  hasTests: boolean;
  hasDocs: boolean;
  hasMetadata: boolean;
}
