#!/usr/bin/env bash
set -euo pipefail

# Simple helper to (re)start the callback server with sane defaults
# Usage (on VM):
#   cd ~/Hackathon-v3/navbar-app
#   bash scripts/start-callback.sh

cd "$(dirname "$0")/.."

# Defaults (override by exporting before calling or inline: SPA_BASE_URL=... bash scripts/start-callback.sh)
export SPA_BASE_URL=${SPA_BASE_URL:-http://34.58.198.143:3001}
export CALLBACK_BASE_URL=${CALLBACK_BASE_URL:-http://34.58.198.143:5000}
export AUTHORIZE_URI=${AUTHORIZE_URI:-http://34.58.198.143:3000/authorize}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-5000}

echo "[start-callback] Using:"
echo "  SPA_BASE_URL=$SPA_BASE_URL"
echo "  CALLBACK_BASE_URL=$CALLBACK_BASE_URL"
echo "  AUTHORIZE_URI=$AUTHORIZE_URI"
echo "  HOST=$HOST PORT=$PORT"

echo "[start-callback] Killing any existing callback-server.js processes..."
pkill -f callback-server.js 2>/dev/null || true
sleep 0.5

echo "[start-callback] Starting server..."
nohup node callback-server.js > server.out 2>&1 &
sleep 2

echo "[start-callback] Last 25 log lines:" && (tail -25 server.out || true)

echo "[start-callback] Port check ($PORT):"
if command -v ss >/dev/null 2>&1; then
  ss -ltnp | grep ":$PORT" || echo "PORT_NOT_LISTENING"
else
  netstat -tlnp 2>/dev/null | grep ":$PORT" || echo "PORT_NOT_LISTENING"
fi

echo "[start-callback] Health check:"
curl -s -m 3 "http://127.0.0.1:$PORT/health" || echo "HEALTH_FAIL"

echo "[start-callback] Client meta:"
curl -s -m 3 "http://127.0.0.1:$PORT/client-meta" || echo "META_FAIL"

echo "[start-callback] Done. If PORT_NOT_LISTENING appeared, inspect server.out"