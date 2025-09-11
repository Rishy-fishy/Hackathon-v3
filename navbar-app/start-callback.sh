#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Stop any existing instance
pkill -f callback-server.js 2>/dev/null || true

export SPA_BASE_URL="http://34.58.198.143:3001"
export CALLBACK_BASE_URL="http://34.58.198.143:5000"
export AUTHORIZE_URI="http://34.58.198.143:3000/authorize"
export HOST="0.0.0.0"
export PORT="5000"

echo "Starting callback-server with:" 
echo "  SPA_BASE_URL=$SPA_BASE_URL"
echo "  CALLBACK_BASE_URL=$CALLBACK_BASE_URL"

offset_log() { grep -E "Callback server running|Using redirect URI" server.out 2>/dev/null || tail -n 80 server.out 2>/dev/null || true; }

nohup node callback-server.js > server.out 2>&1 &
PID=$!
echo $PID > server.pid
echo "Started PID $PID"
# Wait a moment for logs
sleep 3
offset_log || true

echo "If everything looks good, access /client-meta to verify public URLs."
