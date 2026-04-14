#!/bin/bash
# search.sh — Unified search across MemPalace + GitNexus + filesystem
# Usage: search.sh <query> [--palace|--gitnexus|--fs|--all]

QUERY="${1}"
MODE="${2:---all}"

if [ -z "$QUERY" ]; then
  echo "Usage: search.sh <query> [--palace|--gitnexus|--fs|--all]"
  exit 1
fi

case "$MODE" in
  --palace|--p)
    ~/.watson-venv/bin/mempalace search "$QUERY" 2>/dev/null
    ;;
  --gitnexus|--g)
    gitnexus query "$QUERY" --repo DopaFlow 2>/dev/null | head -30
    ;;
  --fs|--f)
    ~/toolshed/scripts/fs.sh "$QUERY" 2>/dev/null | head -30
    ;;
  --all|-a|*)
    echo "=== MEMPALACE ===" && ~/.watson-venv/bin/mempalace search "$QUERY" 2>/dev/null | head -15
    echo ""
    echo "=== GITNEXUS ===" && gitnexus query "$QUERY" --repo DopaFlow 2>/dev/null | head -15
    ;;
esac
