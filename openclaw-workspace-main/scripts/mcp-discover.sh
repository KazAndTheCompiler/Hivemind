#!/bin/bash
# mcp-discover.sh — Discover available MCP tools (token-efficient)
# Output: JSON list of available tools grouped by server

# Check for MCP servers
MCP_SERVERS=""

# Check openclaw MCP
if curl -s http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  MCP_SERVERS="$MCP_SERVERS ollama"
fi

# Check gitnexus MCP
gitnexus mcp --help >/dev/null 2>&1 && MCP_SERVERS="$MCP_SERVERS gitnexus"

# Check for custom MCP servers in config
if [ -f ~/.openclaw/mcp_servers.json ]; then
  CUSTOM=$(jq -r 'keys[]' ~/.openclaw/mcp_servers.json 2>/dev/null | tr '\n' ' ' || echo "")
  MCP_SERVERS="$MCP_SERVERS $CUSTOM"
fi

cat <<JSON
{
  "available_servers": ["ollama", "gitnexus", "openclaw"],
  "toolshed_path": "$HOME/toolshed/scripts",
  "mcp_servers": $(echo "$MCP_SERVERS" | jq -R . | jq -s .)
}
JSON
