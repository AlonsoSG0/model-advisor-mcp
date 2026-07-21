#!/usr/bin/env bash
set -euo pipefail

executable="${1:-dist/server.js}"
request='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"package-smoke-test","version":"1.0.0"}}}'
response="$(printf '%s\n' "$request" | "$executable")"

if [[ "$response" != *'"id":1'* || "$response" != *'"name":"model-advisor"'* ]]; then
  printf '%s\n' 'MCP initialize handshake: FAIL' >&2
  exit 1
fi

printf '%s\n' 'MCP initialize handshake: PASS'
