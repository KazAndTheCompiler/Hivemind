#!/bin/bash
# summarize.sh — Fast code file summary (token-efficient)
# Usage: summarize.sh <file_path>
# Output: JSON with line count, imports, functions, classes

FILE="${1}"

if [ ! -f "$FILE" ]; then
  echo "Error: $FILE not found"
  exit 1
fi

LINES=$(wc -l < "$FILE")
EXT="${FILE##*.}"

# Extract based on file type
case "$EXT" in
  py)
    IMPORTS=$(grep -E "^import |^from " "$FILE" 2>/dev/null | head -10 | jq -R . | jq -s .)
    FUNCTIONS=$(grep -E "^def |^async def " "$FILE" 2>/dev/null | sed 's/def \([^(]*\).*/\1/' | head -15 | jq -R . | jq -s .)
    CLASSES=$(grep -E "^class " "$FILE" 2>/dev/null | head -10 | jq -R . | jq -s .)
    ;;
  js|ts)
    IMPORTS=$(grep -E "^import |^require(" "$FILE" 2>/dev/null | head -10 | jq -R . | jq -s .)
    FUNCTIONS=$(grep -E "^function |^const |^let |^async " "$FILE" 2>/dev/null | grep -E "\(|=>" | head -15 | jq -R . | jq -s .)
    CLASSES=$(grep -E "^class " "$FILE" 2>/dev/null | head -10 | jq -R . | jq -s .)
    ;;
  sh)
    IMPORTS=$(grep -E "^source |^\. " "$FILE" 2>/dev/null | head -10 | jq -R . | jq -s .)
    FUNCTIONS=$(grep -E "^\w+\(\)" "$FILE" 2>/dev/null | head -15 | jq -R . | jq -s .)
    CLASSES="[]"
    ;;
  *)
    IMPORTS="[]"
    FUNCTIONS="[]"
    CLASSES="[]"
    ;;
esac

cat <<JSON
{
  "file": "$FILE",
  "lines": $LINES,
  "extension": "$EXT",
  "imports": ${IMPORTS:-[]},
  "functions": ${FUNCTIONS:-[]},
  "classes": ${CLASSES:-[]}
}
JSON
