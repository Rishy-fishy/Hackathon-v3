Param(
  [string]$VmName = 'hackathon-v3-vm',
  [string]$Zone = 'us-central1-a'
)

Write-Host "[diagnose-port] Running remote mini server test on $VmName ($Zone)" -ForegroundColor Cyan

$remoteScript = @'
set -e
cd ~/Hackathon-v3/navbar-app || exit 1
echo "[remote] Node version: $(node -v 2>/dev/null || echo missing)"
echo "[remote] Killing old processes" && pkill -f mini5000.js 2>/dev/null || true && pkill -f callback-server.js 2>/dev/null || true
NO_MONGO=1 PORT=5000 HOST=0.0.0.0 node mini5000.js > mini.out 2>&1 &
sleep 2
echo ====PORT====
(ss -ltnp 2>/dev/null | grep :5000) || (netstat -tlnp 2>/dev/null | grep :5000) || echo PORT_NOT_LISTENING
echo ====LOCAL_HEALTH====
curl -s -m 3 http://127.0.0.1:5000/health || echo HEALTH_FAIL
echo ====MINI_LOG_LAST====
tail -5 mini.out || true
'@

$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
if (!(gcloud compute ssh $VmName --zone $Zone --command "bash -lc 'echo $b64 | base64 -d > diag-mini.sh && bash diag-mini.sh'")) {
  Write-Error "Remote diagnostic failed"
  exit 1
}

Write-Host "[diagnose-port] If PORT_NOT_LISTENING appeared, check mini.out after increasing sleep or investigate Node." -ForegroundColor Yellow
