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

gcloud config set project $ProjectId | Out-Null
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com --quiet

# Ensure secret exists / new version
Write-Host "[deploy] Pushing secret MONGO_URI" -ForegroundColor Yellow
try {
  echo $env:MONGO_URI | gcloud secrets versions add MONGO_URI --data-file=- 2>$null
} catch {
  echo $env:MONGO_URI | gcloud secrets create MONGO_URI --data-file=- --replication-policy=automatic
}

$image = "gcr.io/$ProjectId/$ServiceName:local-$(Get-Date -Format yyyyMMddHHmmss)"
Write-Host "[deploy] Building image $image" -ForegroundColor Yellow
docker build -t $image .\navbar-app\backend || exit 1
docker push $image || exit 1

if ($BuildOnly) { Write-Host "[deploy] Build-only flag set. Skipping deploy."; exit 0 }

Write-Host "[deploy] Deploying to Cloud Run" -ForegroundColor Yellow
gcloud run deploy $ServiceName `
  --image $image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --set-env-vars PORT=3002 `
  --set-secrets MONGO_URI=MONGO_URI:latest || exit 1

Write-Host "[deploy] Done." -ForegroundColor Green
