Param(
  [string]$ProjectId = "hackathon-v3-mongodb",
  [string]$Region = "us-central1",
  [string]$ServiceName = "navbar-backend",
  [switch]$BuildOnly
)

Write-Host "[deploy] Project: $ProjectId Region: $Region Service: $ServiceName" -ForegroundColor Cyan

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  Write-Error "gcloud CLI not found. Install from https://cloud.google.com/sdk/"; exit 1
}

if (-not $env:MONGO_URI) {
  Write-Error "MONGO_URI env var not set. Export it in this session: `$env:MONGO_URI='mongodb+srv://user:pass@cluster/db?retryWrites=true&w=majority'"; exit 1
}

# Generate ADMIN_JWT_SECRET if not provided (stateless admin auth). Strong random 48 bytes base64.
if (-not $env:ADMIN_JWT_SECRET) {
  $bytes = New-Object byte[] 48
  (New-Object System.Random).NextBytes($bytes)
  $env:ADMIN_JWT_SECRET = [Convert]::ToBase64String($bytes)
  Write-Host "[deploy] Generated ephemeral ADMIN_JWT_SECRET (set this env variable yourself next time to rotate deterministically)" -ForegroundColor Yellow
}

gcloud config set project $ProjectId | Out-Null
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --quiet

# Ensure secret exists / new version
Write-Host "[deploy] Pushing secret MONGO_URI" -ForegroundColor Yellow
try {
  echo $env:MONGO_URI | gcloud secrets versions add MONGO_URI --data-file=- 2>$null
} catch {
  echo $env:MONGO_URI | gcloud secrets create MONGO_URI --data-file=- --replication-policy=automatic
}

Write-Host "[deploy] Pushing secret ADMIN_JWT_SECRET" -ForegroundColor Yellow
try {
  echo $env:ADMIN_JWT_SECRET | gcloud secrets versions add ADMIN_JWT_SECRET --data-file=- 2>$null
} catch {
  echo $env:ADMIN_JWT_SECRET | gcloud secrets create ADMIN_JWT_SECRET --data-file=- --replication-policy=automatic
}

$image = "gcr.io/$ProjectId/$ServiceName:local-$(Get-Date -Format yyyyMMddHHmmss)"
Write-Host "[deploy] Building image $image" -ForegroundColor Yellow
docker build -t $image .\navbar-app\backend
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker build failed'; exit 1 }
docker push $image
if ($LASTEXITCODE -ne 0) { Write-Error 'Docker push failed'; exit 1 }

if ($BuildOnly) { Write-Host "[deploy] Build-only flag set. Skipping deploy."; exit 0 }

Write-Host "[deploy] Deploying to Cloud Run" -ForegroundColor Yellow
gcloud run deploy $ServiceName `
  --image $image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars PORT=3002 `
  --set-secrets MONGO_URI=MONGO_URI:latest,ADMIN_JWT_SECRET=ADMIN_JWT_SECRET:latest
if ($LASTEXITCODE -ne 0) { Write-Error 'Cloud Run deploy failed'; exit 1 }

Write-Host "[deploy] Done." -ForegroundColor Green
