# Backend Cloud Run Deployment

This folder contains the Express backend for offline record uploads. A production Dockerfile is provided plus automation to deploy to Google Cloud Run.

## Prerequisites

* Google Cloud project: `hackathon-v3-mongodb`
* Billing enabled
* gcloud SDK installed locally
* MongoDB Atlas cluster (or another MongoDB URI) with Network Access allowing 0.0.0.0/0 (or later restrict to Cloud Run egress IP)

## Environment

Runtime env var (MANDATORY):

* `MONGO_URI` – full Mongo connection string (SRV or standard). No hardcoded fallback remains.

## One‑Time Setup (Local CLI)

```powershell
gcloud auth login
gcloud config set project hackathon-v3-mongodb
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## Fast Deploy (PowerShell)

```powershell
$env:MONGO_URI="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/childBooklet?retryWrites=true&w=majority"
pwsh ./navbar-app/backend/deploy-backend.ps1
```

After deploy, note the Cloud Run URL and update the frontend `API_BASE` in `src/offline/sync.js` (or make it configurable via env).

## GitHub Actions (CI/CD)

Workflow file: `.github/workflows/deploy-backend.yml`

Repository secrets required:

* `GCP_PROJECT_ID` = `hackathon-v3-mongodb`
* `GCP_SA_KEY` = JSON key for a service account with roles:
  * Cloud Run Admin
  * Service Account User
  * Artifact Registry Writer
  * Secret Manager Secret Accessor
* Secret Manager (in GCP) must contain secret `MONGO_URI` (add initial version manually):
  ```bash
  echo "$MONGO_URI" | gcloud secrets create MONGO_URI --data-file=- --replication-policy=automatic
  # later updates
  echo "$MONGO_URI" | gcloud secrets versions add MONGO_URI --data-file=-
  ```

On push to `main` touching `navbar-app/backend/**`, the workflow builds & deploys.

## Atlas Network Access (Allow All IPs)

In Atlas Project → Network Access → Add IP Address → `0.0.0.0/0`. (Use only for demo; restrict later to Cloud Run egress.)

## Health Check

```
GET https://<cloud-run-url>/health
```

## Notes

* Express listens on `PORT` (default 3002); Cloud Run injects its own port – we set explicitly via env.
* If you later add authentication verification, ensure CORS origin list is tightened.
* For a fixed egress IP (to remove 0.0.0.0/0) set up: Serverless VPC Connector + Cloud NAT, then whitelist NAT IP in Atlas.

## Cleanup

```powershell
gcloud run services delete navbar-backend --region us-central1
gcloud artifacts repositories list # (delete any repo if created manually)
```

---
Generated automation added by assistant.
