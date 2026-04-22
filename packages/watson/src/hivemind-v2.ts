import type {
  HivemindBaseSignal,
  HivemindBuilderProgress,
  HivemindReducedStatePacket,
  HivemindReducerPacket,
  NormalizedAgentSummary,
  ToolFinding,
} from '@openclaw/core-types';

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function summarizeFindings(findings: ToolFinding[]): string[] {
  return findings.slice(0, 3).map((finding) => {
    const files = finding.fileRefs.length > 0 ? ` (${finding.fileRefs.join(', ')})` : '';
    return `${finding.severity}:${finding.source}:${finding.message}${files}`;
  });
}

function deriveRisk(summary: NormalizedAgentSummary): HivemindReducedStatePacket['risk'] {
  if (summary.toolFindings.some((finding) => finding.severity === 'critical')) return 'critical';
  if (summary.toolFindings.some((finding) => finding.severity === 'high')) return 'high';
  if (summary.status === 'failed' || summary.status === 'blocked') return 'high';
  if (summary.toolFindings.some((finding) => finding.severity === 'medium') || summary.confidence < 0.5) {
    return 'medium';
  }
  return 'low';
}

export function buildBuilderProgress(summary: NormalizedAgentSummary): HivemindBuilderProgress {
  const phase: HivemindBuilderProgress['phase'] =
    summary.status === 'blocked'
      ? 'blocked'
      : summary.status === 'done'
        ? 'complete'
        : summary.status === 'failed'
          ? 'verification'
          : 'implementation';

  return {
    taskId: summary.taskId,
    phase,
    done: summary.conciseSummary ? [summary.conciseSummary] : [],
    blockers: dedupe(summary.blockers),
    touchedFiles: dedupe(summary.touchedFiles),
    proposedNext: dedupe(summary.nextActions),
    needsReview: summary.status === 'failed' || summary.status === 'needs_review' || summary.confidence < 0.7,
    evidence: dedupe([
      ...summary.toolFindings.map((finding) => `${finding.source}:${finding.code}`),
      ...summary.toolFindings.flatMap((finding) => finding.fileRefs),
    ]),
  };
}

export function buildProgressSignal(summary: NormalizedAgentSummary): HivemindBaseSignal<HivemindBuilderProgress> {
  const progress = buildBuilderProgress(summary);

  return {
    id: `${summary.taskId}:progress:${summary.timestamp}`,
    taskId: summary.taskId,
    domain: 'progress',
    kind: 'builder.progress',
    source: summary.agentId,
    ts: summary.timestamp,
    value: progress,
    confidence: summary.confidence,
    severity: deriveRisk(summary),
    refs: dedupe(summary.touchedFiles),
    evidence: dedupe([
      ...progress.evidence,
      ...summarizeFindings(summary.toolFindings),
    ]),
    tags: dedupe(summary.tags),
  };
}

export function buildReducedStatePacket(
  summary: NormalizedAgentSummary,
  progressSignal?: HivemindBaseSignal<HivemindBuilderProgress>,
): HivemindReducedStatePacket {
  const progress = progressSignal?.value ?? buildBuilderProgress(summary);
  const findings = summarizeFindings(summary.toolFindings);

  return {
    taskId: summary.taskId,
    summary: dedupe([summary.conciseSummary, ...findings]),
    blockers: dedupe(progress.blockers),
    approvedFacts: dedupe([
      `status:${summary.status}`,
      `confidence:${summary.confidence}`,
      ...progress.done,
    ]),
    conflicts:
      summary.status === 'failed'
        ? ['normalized summary reports failed status']
        : summary.status === 'blocked' && progress.blockers.length === 0
          ? ['blocked status without explicit blocker detail']
          : [],
    touchedFiles: dedupe(progress.touchedFiles),
    evidenceRefs: dedupe([
      ...progress.evidence,
      ...summary.toolFindings.flatMap((finding) => finding.fileRefs),
    ]),
    risk: deriveRisk(summary),
  };
}

export function buildReducerPacket(summary: NormalizedAgentSummary): HivemindReducerPacket {
  const progressSignal = buildProgressSignal(summary);
  const reduced = buildReducedStatePacket(summary, progressSignal);

  return {
    packetId: `${summary.taskId}:reducer:${summary.timestamp}`,
    taskId: summary.taskId,
    signalIds: [progressSignal.id],
    summary: reduced.summary,
    blockers: reduced.blockers,
    approvedFacts: reduced.approvedFacts,
    conflicts: reduced.conflicts,
    touchedFiles: reduced.touchedFiles,
    evidenceRefs: reduced.evidenceRefs,
    risk: reduced.risk,
    recommendedAction:
      reduced.risk === 'critical'
        ? 'escalate'
        : reduced.blockers.length > 0
          ? 'retry'
          : reduced.conflicts.length > 0
            ? 'review'
            : 'accept',
  };
}
