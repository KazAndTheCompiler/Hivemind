#!/bin/bash
# git-status.sh — Compact git status for agents
# Output: JSON with branch, modified files, staged, ahead/behind

cd "${1:-.}" 2>/dev/null || cd ~ && git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo"; exit 1; }

BRANCH=$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)
MODIFIED=$(git status --porcelain -uno 2>/dev/null | grep "^.M" | awk '{print $2}' | head -20)
STAGED=$(git status --porcelain | grep "^M " | awk '{print $2}' | head -20)
UNTRACKED=$(git status --porcelain | grep "^??" | awk '{print $2}' | head -10)
AHEAD=$(git rev-list --count @{upstream}..HEAD 2>/dev/null || echo "0")
BEHIND=$(git rev-list --count HEAD..@{upstream} 2>/dev/null || echo "0")

cat <<JSON
{
  "branch": "$BRANCH",
  "modified": $(echo "${MODIFIED:-}" | jq -R . | jq -s .),
  "staged": $(echo "${STAGED:-}" | jq -R . | jq -s .),
  "untracked": $(echo "${UNTRACKED:-}" | jq -R . | jq -s .),
  "ahead": $AHEAD,
  "behind": $BEHIND
}
JSON
