#!/bin/bash
# emit-progress.sh — Emit ProgressSchema to MemPalace
# Usage: emit-progress.sh <taskId> <agent> <phase> <done_json> <blockers_json> [next] [touchedFiles_json]

TASK_ID="${1}"
AGENT="${2}"
PHASE="${3}"
DONE="${4}"
BLOCKERS="${5}"
NEXT="${6:-}"
TOUCHED="${7:-}"

# Build JSON emission
cat <<JSON
{
  "type": "ProgressSchema",
  "taskId": "$TASK_ID",
  "agent": "$AGENT",
  "phase": "$PHASE",
  "done": $DONE,
  "blockers": $BLOCKERS,
  "next": "$NEXT",
  "touchedFiles": $TOUCHED
}
JSON
