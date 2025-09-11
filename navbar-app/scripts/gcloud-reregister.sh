#!/usr/bin/env bash
set -euo pipefail

echo "=== e-Signet Client Re-Registration (GCloud VM) ==="

SECRET_VAR="${KEYCLOAK_MGMT_CLIENT_SECRET:-}"
if [ -z "$SECRET_VAR" ]; then
  echo "ERROR: KEYCLOAK_MGMT_CLIENT_SECRET not set." >&2
  echo "Export it first: export KEYCLOAK_MGMT_CLIENT_SECRET=your_secret" >&2
  exit 1
fi

CLIENT_ID_OVERRIDE="${MANUAL_CLIENT_ID:-DoSrV7cOI79RR_9XlQzJIDJmS80nCLc87qcXlLU3fkc}"
export MANUAL_CLIENT_ID="$CLIENT_ID_OVERRIDE"
export REDIRECT_URIS="http://34.58.198.143:5000/callback,http://localhost:5000/callback"
export KEYCLOAK_BASE_URL="${KEYCLOAK_BASE_URL:-http://34.58.198.143:8088}"
export KEYCLOAK_REALM="${KEYCLOAK_REALM:-mosip}"

echo "ClientId: $MANUAL_CLIENT_ID"
echo "Redirect URIs: $REDIRECT_URIS"
echo "Base URL: $KEYCLOAK_BASE_URL"

if [ ! -f client-config.json ]; then
  echo "client-config.json missing in $(pwd)" >&2
  exit 1
fi

echo "Running manual registration script..."
node ./scripts/manual-register-existing-client.js || { echo "Registration failed" >&2; exit 1; }

echo "Attempting to restart callback server (pm2 if available)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart callback-server || echo "pm2 restart failed (maybe not set up)" >&2
else
  echo "pm2 not found; start manually: node callback-server.js" >&2
fi

echo "Fetch client-meta to confirm clientId alignment:" 
curl -s http://34.58.198.143:5000/client-meta || true

echo "Done. Use the printed canonical authorize URL above if needed." 