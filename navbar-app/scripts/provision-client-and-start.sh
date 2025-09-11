#!/usr/bin/env bash
set -euo pipefail

# Composite script: create new client, register it, then start callback-server.js
# Aborts starting the server if registration fails.
# Override defaults by exporting vars before invocation or inline:
#   SPA_BASE_URL=... CALLBACK_BASE_URL=... ESIGNET_BASE_URL=... bash scripts/provision-client-and-start.sh

cd "$(dirname "$0")/.."

export SPA_BASE_URL=${SPA_BASE_URL:-http://34.58.198.143:3001}
export CALLBACK_BASE_URL=${CALLBACK_BASE_URL:-http://34.58.198.143:5000}
export AUTHORIZE_URI=${AUTHORIZE_URI:-http://34.58.198.143:3000/authorize}
export ESIGNET_BASE_URL=${ESIGNET_BASE_URL:-http://34.58.198.143:8088}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-5000}
export NO_MONGO=${NO_MONGO:-1}

echo "[provision] === Environment Summary ==="
echo "SPA_BASE_URL=$SPA_BASE_URL"
echo "CALLBACK_BASE_URL=$CALLBACK_BASE_URL"
echo "AUTHORIZE_URI=$AUTHORIZE_URI"
echo "ESIGNET_BASE_URL=$ESIGNET_BASE_URL"
echo "HOST=$HOST PORT=$PORT NO_MONGO=$NO_MONGO"
echo

echo "[provision] Killing old processes"
pkill -f callback-server.js 2>/dev/null || true
pkill -f mini5000.js 2>/dev/null || true
sleep 0.5

echo "[provision] Generating new client-config.json"
node create-client.js

echo "[provision] Registering client (needs KEYCLOAK_MGMT_CLIENT_SECRET env for success)"
set +e
node register-client.js
RC=$?
set -e
if [ $RC -ne 0 ]; then
  echo "[provision] ❌ Registration failed (exit $RC). Not starting server." >&2
  exit $RC
fi
echo "[provision] ✅ Registration succeeded"

echo "[provision] Starting callback-server.js"
nohup node callback-server.js > server.out 2>&1 &
sleep 3

echo "[provision] Tail logs:" && tail -25 server.out || true
echo "[provision] Port check:" && (ss -ltnp | grep :$PORT || netstat -tlnp 2>/dev/null | grep :$PORT || echo PORT_NOT_LISTENING)
echo "[provision] Health:" && (curl -s -m 4 http://127.0.0.1:$PORT/health || echo HEALTH_FAIL)
echo "[provision] Client Meta:" && (curl -s -m 4 http://127.0.0.1:$PORT/client-meta || echo META_FAIL)
echo "[provision] Done"
