Param(
  [string]$VmName = 'hackathon-v3-vm',
  [string]$Zone = 'us-central1-a',
  [string]$SpaBase = 'http://34.58.198.143:3001',
  [string]$CallbackBase = 'http://34.58.198.143:5000',
  [string]$AuthorizeUri = 'http://34.58.198.143:3000/authorize',
  [string]$EsignetBase = 'http://34.58.198.143:8088'
)

Write-Host "[provision-remote] Create + register + start on $VmName" -ForegroundColor Cyan

$remoteScript = @"
set -e
cd ~/Hackathon-v3/navbar-app || exit 1
echo '[remote] Killing old processes'
pkill -f callback-server.js 2>/dev/null || true
pkill -f mini5000.js 2>/dev/null || true
echo '[remote] Generating client'
CALLBACK_BASE_URL=$CallbackBase ESIGNET_BASE_URL=$EsignetBase node create-client.js
echo '[remote] Registering client'
if ! SPA_BASE_URL=$SpaBase CALLBACK_BASE_URL=$CallbackBase AUTHORIZE_URI=$AuthorizeUri ESIGNET_BASE_URL=$EsignetBase node register-client.js; then
  echo '[remote] Registration failed. Aborting start.' >&2
  exit 1
fi
echo '[remote] Starting callback-server.js'
SPA_BASE_URL=$SpaBase CALLBACK_BASE_URL=$CallbackBase AUTHORIZE_URI=$AuthorizeUri HOST=0.0.0.0 PORT=5000 NO_MONGO=1 nohup node callback-server.js > server.out 2>&1 &
sleep 3
echo ====PORT====
(ss -ltnp 2>/dev/null | grep :5000) || (netstat -tlnp 2>/dev/null | grep :5000) || echo PORT_NOT_LISTENING
echo ====HEALTH====
curl -s -m 4 http://127.0.0.1:5000/health || echo HEALTH_FAIL
echo ====META====
curl -s -m 4 http://127.0.0.1:5000/client-meta || echo META_FAIL
echo ====LOG_TAIL====
tail -30 server.out || true
"@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
if (!(gcloud compute ssh $VmName --zone $Zone --command "bash -lc 'echo $b64 | base64 -d > provision.sh && bash provision.sh'")) {
  Write-Error "[provision-remote] Failed"
  exit 1
}

Write-Host "[provision-remote] Completed. Test externally: curl -m 4 $CallbackBase/health" -ForegroundColor Green
