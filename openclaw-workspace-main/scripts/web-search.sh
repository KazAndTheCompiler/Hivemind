#!/bin/bash
# web-search.sh — DuckDuckGo search wrapper for Ollama
# Usage: web-search.sh <query> [count]
set -e
QUERY="${1:?Usage: $0 <query> [count]}"
COUNT="${2:-5}"
~/.watson-venv/bin/python3 /home/openclaw/toolshed/scripts/web-search.py "$QUERY" "$COUNT"
