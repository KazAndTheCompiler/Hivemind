// Evolution layer typed events
// All evolution events are versioned and sequenced

import type {
  SchemaVersion,
  EvidenceRef,
  ExtractedLesson,
  MutationCandidate,
  ValidationResult,
  EvolutionScore,
  EvolutionScope,
} from './index';

export interface EvolutionObservationIngestedEvent {
  kind: 'evolution.observation.ingested';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  evidence: EvidenceRef;
  timestamp: string;
}

export interface EvolutionLessonExtractedEvent {
  kind: 'evolution.lesson.extracted';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  lesson: ExtractedLesson;
  timestamp: string;
}

export interface EvolutionCandidateCreatedEvent {
  kind: 'evolution.candidate.created';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidate: MutationCandidate;
  timestamp: string;
}

export interface EvolutionCandidateValidatedEvent {
  kind: 'evolution.candidate.validated';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  validation: ValidationResult;
  timestamp: string;
}

export interface EvolutionCandidateScoredEvent {
  kind: 'evolution.candidate.scored';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  score: EvolutionScore;
  timestamp: string;
}

export interface EvolutionCandidatePromotedEvent {
  kind: 'evolution.candidate.promoted';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  fromStage: EvolutionScope;
  toStage: string;
  timestamp: string;
}

export interface EvolutionCandidateRejectedEvent {
  kind: 'evolution.candidate.rejected';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  reason: string;
  timestamp: string;
}

export interface EvolutionCandidateRolledBackEvent {
  kind: 'evolution.candidate.rolled_back';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  reason: string;
  timestamp: string;
}

export interface EvolutionRolloutStartedEvent {
  kind: 'evolution.rollout.started';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  stage: string;
  timestamp: string;
}

export interface EvolutionRolloutCompletedEvent {
  kind: 'evolution.rollout.completed';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  stage: string;
  success: boolean;
  timestamp: string;
}

export interface EvolutionRollbackCompletedEvent {
  kind: 'evolution.rollback.completed';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  candidateId: string;
  restoredVersion: string;
  timestamp: string;
}

export interface EvolutionMemoryUpdatedEvent {
  kind: 'evolution.memory.updated';
  schemaVersion: SchemaVersion;
  sequence: number;
  streamId: string;
  lessonId: string;
  action: 'created' | 'updated' | 'decayed' | 'suppressed' | 'archived';
  timestamp: string;
}

export type EvolutionEvent =
  | EvolutionObservationIngestedEvent
  | EvolutionLessonExtractedEvent
  | EvolutionCandidateCreatedEvent
  | EvolutionCandidateValidatedEvent
  | EvolutionCandidateScoredEvent
  | EvolutionCandidatePromotedEvent
  | EvolutionCandidateRejectedEvent
  | EvolutionCandidateRolledBackEvent
  | EvolutionRolloutStartedEvent
  | EvolutionRolloutCompletedEvent
  | EvolutionRollbackCompletedEvent
  | EvolutionMemoryUpdatedEvent;

export type EvolutionEventKind = EvolutionEvent['kind'];
