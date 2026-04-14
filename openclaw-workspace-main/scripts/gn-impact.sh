#!/bin/bash
# gn-impact.sh — Blast radius analysis (what breaks if you change X)
# Usage: gn-impact.sh <repo> <symbol>

REPO="${1:-DopaFlow}"
SYMBOL="${2:-}"

if [ -z "$SYMBOL" ]; then
  echo "Usage: gn-impact.sh <repo> <symbol>"
  exit 1
fi

gitnexus impact "$SYMBOL" --repo "$REPO" --depth 2 2>/dev/null || \
gitnexus impact "$SYMBOL" --repo "$REPO" 2>/dev/null
