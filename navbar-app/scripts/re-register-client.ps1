<#
Re-register existing OIDC client on the cloud VM.
Usage (PowerShell on VM in navbar-app directory):

  # Set management secret (if required by server)
  $env:KEYCLOAK_MGMT_CLIENT_SECRET = "<secret>"

  # Optional overrides
  $env:KEYCLOAK_BASE_URL = "http://34.58.198.143:8088"
  $env:KEYCLOAK_REALM = "mosip"

  # Run
  ./scripts/re-register-client.ps1

Outputs status and verifies redirect + client-meta.
#>

param(
  [string]$BaseUrl = $env:KEYCLOAK_BASE_URL,         # eSignet/Keycloak base
  [string]$Realm = $env:KEYCLOAK_REALM,              # Realm
  [string]$MgmtSecret = $env:KEYCLOAK_MGMT_CLIENT_SECRET,
  [switch]$VerboseCurl
)

Write-Host "=== Re-registering OIDC client ===" -ForegroundColor Cyan
if (-not (Test-Path ./client-config.json)) { throw 'client-config.json not found in current directory.' }

$cfg = Get-Content ./client-config.json -Raw | ConvertFrom-Json
$clientId = $cfg.clientId
$redirect = "http://34.58.198.143:5000/callback"
Write-Host "ClientId: $clientId" -ForegroundColor Yellow
Write-Host "Expected Redirect: $redirect"

if (-not $MgmtSecret) {
  Write-Warning 'KEYCLOAK_MGMT_CLIENT_SECRET not set. Registration may fail or not update redirectUris.'
}

# Run registration (will rebuild request if needed)
Write-Host "Running register-client.js..." -ForegroundColor Cyan
node register-client.js

if ($LASTEXITCODE -ne 0) {
  Write-Warning "register-client.js exited with $LASTEXITCODE"
}

# Quick verify: show client-meta from local callback server (assumes it is running)
try {
  Write-Host "Fetching /client-meta ..." -ForegroundColor Cyan
  $meta = Invoke-RestMethod -Uri "http://34.58.198.143:5000/client-meta" -TimeoutSec 5
  Write-Host "client-meta => $( $meta | ConvertTo-Json -Compress )"
} catch { Write-Warning "client-meta fetch failed: $_" }

# Build canonical authorize URL
$authorizeUrl = "http://34.58.198.143:3000/authorize?client_id=$clientId&redirect_uri=$([uri]::EscapeDataString($redirect))&response_type=code&scope=openid%20profile"
Write-Host "Canonical authorize URL:" -ForegroundColor Cyan
Write-Host $authorizeUrl

Write-Host "Hard refresh browser and use the URL above if the plugin still produces an invalid one." -ForegroundColor Green
