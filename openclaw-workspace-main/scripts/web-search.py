#!/usr/bin/env python3
"""web-search.py — DuckDuckGo search for Ollama/local models"""
import sys
from ddgs import DDGS

def search(query, count=5):
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=count))
        for r in results:
            print(r.get('title', ''))
            print(r.get('href', ''))
            print(r.get('body', ''))
            print('---')

if __name__ == '__main__':
    q = sys.argv[1] if len(sys.argv) > 1 else ''
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    if not q:
        print("Usage: web-search.py <query> [count]", file=sys.stderr)
        sys.exit(1)
    search(q, n)
