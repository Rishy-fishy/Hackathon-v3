param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [string]$ProjectName = $ProjectId,
  [string]$BillingAccount,
  [string]$OrgId,
  [string]$Region = 'us-central1',
  [string]$Zone = 'us-central1-a',
  [string]$InstanceName = 'callback-vm',
  [string]$MachineType = 'e2-small',
  [string]$LocalNavbarPath = "C:\\Users\\Harsh\\Documents\\GitHub\\Hackathon-v3\\navbar-app"
)

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Err($m){ Write-Host "[ERR ] $m" -ForegroundColor Red }

try {
  # Preflight
  Info 'Checking gcloud CLI and auth...'
  $null = gcloud --version
  $acct = (gcloud auth list --filter=status:ACTIVE --format="value(account)")
  if (-not $acct) { throw 'No active gcloud account. Run: gcloud auth login' }

  # Create project (skip if exists)
  $existingProject = (gcloud projects describe $ProjectId --format="value(projectId)" 2>$null)
  if ($existingProject) {
    Info "Project $ProjectId already exists. Skipping creation."
  } else {
    Info "Creating project $ProjectId"
    $createArgs = @('projects','create',$ProjectId,'--name',$ProjectName)
    if ($OrgId) { $createArgs += @('--organization',$OrgId) }
    gcloud @createArgs
  }

  # Set current project
  gcloud config set project $ProjectId | Out-Null

  # Link billing if provided
  if ($BillingAccount) {
    Info "Linking billing account $BillingAccount"
    gcloud beta billing projects link $ProjectId --billing-account $BillingAccount | Out-Null
  } else {
    Warn 'No BillingAccount provided. Ensure billing is linked before creating VMs.'
  }

  # Enable required APIs (idempotent)
  Info 'Enabling required APIs (compute, iamcredentials)'
  gcloud services enable compute.googleapis.com iamcredentials.googleapis.com --quiet

  # Create VM if not exists
  $vmExists = (gcloud compute instances describe $InstanceName --zone $Zone --format="value(name)" 2>$null)
  if ($vmExists) {
    Info "VM $InstanceName already exists in $Zone. Skipping creation."
  } else {
    Info "Creating VM $InstanceName in $Zone"
    gcloud compute instances create $InstanceName `
      --zone $Zone `
      --machine-type $MachineType `
      --image-family ubuntu-2204-lts `
      --image-project ubuntu-os-cloud `
      --tags callback `
      --quiet | Out-Null
  }

  # Open firewall for 5000 (idempotent)
  $fwExists = (gcloud compute firewall-rules describe allow-callback-5000 --format="value(name)" 2>$null)
  if ($fwExists) {
    Info 'Firewall rule allow-callback-5000 already exists.'
  } else {
    Info 'Creating firewall rule allow-callback-5000'
    gcloud compute firewall-rules create allow-callback-5000 --allow=tcp:5000 --direction=INGRESS --priority=1000 --target-tags=callback -q
  }

  # Fetch public IP
  $PublicIp = (gcloud compute instances describe $InstanceName --zone $Zone --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
  if (-not $PublicIp) { throw 'Failed to fetch VM public IP' }
  Info ("VM Public IP: {0}" -f $PublicIp)

  # Create remote dir
  $REMOTE_BASE = "~/Hackathon-v3"
  $REMOTE_APP = "$REMOTE_BASE/navbar-app"
  gcloud compute ssh $InstanceName --zone $Zone --command "mkdir -p $REMOTE_APP"

  # Copy app
  if (-not (Test-Path $LocalNavbarPath)) { throw "Local path not found: $LocalNavbarPath" }
  Info 'Copying navbar-app to VM (rsync-like overwrite)...'
  gcloud compute scp --recurse "$LocalNavbarPath" "${InstanceName}:$REMOTE_BASE" --zone $Zone --quiet

  # Install Node/PM2 + deps, create PM2 config, start
  $remote = @"
set -e
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm i -g pm2
cd $REMOTE_APP
npm install --omit=dev
cat > ecosystem.runtime.config.js <<EOF
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
EOF
pm2 start ecosystem.runtime.config.js --update-env
pm2 save
curl -sS http://localhost:5000/health || true
"@
  Info 'Starting (or updating) callback-server on VM via PM2...'
  gcloud compute ssh $InstanceName --zone $Zone --command "bash -lc '$remote'" 2>&1 | Out-String | ForEach-Object { $_ }

  Info ("Deployed. Test: http://{0}:5000/health and /client-meta" -f $PublicIp)
}
catch {
  Err $_.Exception.Message
  exit 1
}
