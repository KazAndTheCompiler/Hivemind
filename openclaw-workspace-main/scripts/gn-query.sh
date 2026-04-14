#!/bin/bash
# gn-query.sh — Query GitNexus knowledge graph (token-efficient)
# Usage: gn-query.sh <repo> <search_query>
# Output: JSON execution flow data

REPO="${1:-DopaFlow}"
QUERY="${2:-}"

if [ -z "$QUERY" ]; then
  echo "Usage: gn-query.sh <repo> <search_query>"
  echo "Example: gn-query.sh DopaFlow 'handle user authentication'"
  exit 1
fi

# Query gitnexus and get structured output
gitnexus query "$QUERY" --repo "$REPO" --format json 2>/dev/null || \
gitnexus query "$QUERY" --repo "$REPO" 2>/dev/null
