#!/bin/bash
# fs.sh — Fast file search (grep + find + structure)
# Usage: fs.sh <pattern> [path]
# Output: JSON array of matches with context

PATTERN="${1}"
SCOPE="${2:-.}"

if [ -z "$PATTERN" ]; then
  echo "Usage: fs.sh <pattern> [path]"
  exit 1
fi

# Use ripgrep if available (faster), else grep
if command -v rg &>/dev/null; then
  rg --json -l "$PATTERN" "$SCOPE" 2>/dev/null | head -50
else
  grep -r --include="*.py" --include="*.js" --include="*.ts" --include="*.sh" --include="*.json" -l "$PATTERN" "$SCOPE" 2>/dev/null | head -50
fi
