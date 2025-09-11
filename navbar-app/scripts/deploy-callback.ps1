param(
  [Parameter(Mandatory = $true)][string]$Instance,
  [Parameter(Mandatory = $true)][string]$Zone,
  [string]$Project,
  [int]$Port = 5000,
  [string]$PublicIp
)

$ErrorActionPreference = 'Stop'
function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "[ERR ] $m" -ForegroundColor Red }

try {
  if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) { throw 'gcloud is not installed or not on PATH' }
  if ($Project) { & gcloud config set project $Project | Out-Null }

  $LocalAppDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $RemoteBase = "~/Hackathon-v3"
  $RemoteAppDir = "$RemoteBase/navbar-app"

  # Ensure firewall rule exists and tag instance
  Info "Ensuring firewall rule allow-callback-5000..."
  try { & gcloud compute firewall-rules describe allow-callback-5000 | Out-Null } catch { & gcloud compute firewall-rules create allow-callback-5000 --allow=tcp:5000 --direction=INGRESS --priority=1000 --target-tags=callback -q | Out-Null }
  Info "Tagging instance with 'callback'..."
  & gcloud compute instances add-tags $Instance --zone $Zone --tags callback -q | Out-Null

  # Create remote directory and copy app using gcloud scp
  Info "Ensuring remote directories..."
  & gcloud compute ssh $Instance --zone $Zone --command "mkdir -p $RemoteBase && mkdir -p $RemoteAppDir" | Out-Null
  Info "Copying navbar-app to VM..."
  # Copy the whole navbar-app folder into the base dir to avoid wildcard/quoting issues
  $dest = "$Instance`:$RemoteBase"
  & gcloud compute scp --recurse $LocalAppDir $dest --zone $Zone | Out-Null

  if (-not $PublicIp) {
    Info "Fetching instance external IP..."
    $PublicIp = (& gcloud compute instances describe $Instance --zone $Zone --format "get(networkInterfaces[0].accessConfigs[0].natIP)").Trim()
  }
  if (-not $PublicIp) { throw 'Could not determine Public IP' }

  Info "Installing Node, PM2, dependencies and starting PM2..."
  $cmd1 = "bash -lc 'command -v node >/dev/null 2>&1 || (curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs)'"
  & gcloud compute ssh $Instance --zone $Zone --command $cmd1 | Out-Null
  & gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'sudo npm i -g pm2'" | Out-Null
  & gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'cd $RemoteAppDir && npm install --omit=dev'" | Out-Null
  # Update ecosystem.config.js to reflect current public IP if present
  & gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'if [ -f $RemoteAppDir/ecosystem.config.js ]; then sed -i s#http://[0-9.]*:#http://${PublicIp}:#g $RemoteAppDir/ecosystem.config.js; fi'" | Out-Null
  & gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'cd $RemoteAppDir && pm2 start ecosystem.config.js --name callback-server --update-env || pm2 restart callback-server && pm2 save'" | Out-Null
  & gcloud compute ssh $Instance --zone $Zone --command "bash -lc 'curl -sS http://localhost:$Port/health || true'"

  Info ("Deployed. Test: http://{0}:{1}/health and /client-meta" -f ${PublicIp}, ${Port})
}
catch {
  Err $_.Exception.Message
  exit 1
}
