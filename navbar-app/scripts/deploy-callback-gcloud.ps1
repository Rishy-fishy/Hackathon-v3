param(
  [Parameter(Mandatory=$true)][string]$Instance,
  [Parameter(Mandatory=$true)][string]$Zone,
  [Parameter(Mandatory=$true)][string]$PublicIp,
  [string]$LocalNavbarPath = "C:\\Users\\Harsh\\Documents\\GitHub\\Hackathon-v3\\navbar-app"
)

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "[ERR ] $m" -ForegroundColor Red }

try {
  # Validate gcloud
  Info 'Checking gcloud CLI...'
  $null = gcloud --version

  # Ensure remote base dir
  $REMOTE_BASE = "~/Hackathon-v3"
  $REMOTE_APP = "$REMOTE_BASE/navbar-app"
  Info "Ensuring remote dir $REMOTE_APP"
  gcloud compute ssh $Instance --zone $Zone --command "mkdir -p $REMOTE_APP"

  # Copy navbar-app (latest local changes)
  if (-not (Test-Path $LocalNavbarPath)) { throw "Local path not found: $LocalNavbarPath" }
  Info "Copying navbar-app to VM... (this may take a moment)"
  gcloud compute scp --recurse "$LocalNavbarPath" "${Instance}:$REMOTE_BASE" --zone $Zone

  # Install Node + PM2 and npm deps
  Info 'Installing Node.js/PM2 and dependencies on VM...'
  gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'set -e; if ! command -v node >/dev/null 2>&1; then curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs; fi; sudo npm i -g pm2; cd $REMOTE_APP; npm install --omit=dev'"

  # Create runtime PM2 config locally and copy
  $runtimeConfig = @"
module.exports = {
  apps: [{
    name: "callback-server",
    script: "./callback-server.js",
    env: {
      PORT: 5000,
      HOST: "0.0.0.0",
      SPA_BASE_URL: "http://$PublicIp:3001",
      CALLBACK_BASE_URL: "http://$PublicIp:5000",
      AUTHORIZE_URI: "http://$PublicIp:3000/authorize"
    }
  }]
};
"@
  $tmp = New-TemporaryFile
  Set-Content -LiteralPath $tmp -Value $runtimeConfig -NoNewline -Encoding UTF8
  Info 'Uploading PM2 runtime config...'
  gcloud compute scp "$tmp" "${Instance}:$REMOTE_APP/ecosystem.runtime.config.js" --zone $Zone
  Remove-Item $tmp -Force

  # Start with PM2 and show status
  Info 'Starting with PM2...'
  gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'cd $REMOTE_APP && pm2 start ecosystem.runtime.config.js --update-env && pm2 save && pm2 status && curl -sS http://localhost:5000/health || true'"

  Info "Deployed. Test: http://$PublicIp:5000/health and /client-meta"
}
catch {
  Err $_.Exception.Message
  exit 1
}
