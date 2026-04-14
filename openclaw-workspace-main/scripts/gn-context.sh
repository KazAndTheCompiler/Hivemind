#!/bin/bash
# gn-context.sh — Get 360-degree symbol context (token-efficient)
# Usage: gn-context.sh <repo> <symbol_name>
# Output: callers, callees, processes

REPO="${1:-DopaFlow}"
SYMBOL="${2:-}"

if [ -z "$SYMBOL" ]; then
  echo "Usage: gn-context.sh <repo> <symbol_name>"
  exit 1
fi

gitnexus context "$SYMBOL" --repo "$REPO" --format json 2>/dev/null || \
gitnexus context "$SYMBOL" --repo "$REPO" 2>/dev/null
