# ChildHealthBooklet API Documentation

Version: 1.0.0
Last Updated: 2025-09-28

## Quick Start Guide

### Prerequisites
- Node.js v18.x or higher
- MongoDB Atlas account (or local MongoDB instance)
- npm or yarn package manager

### Installation & Setup

#### 1. Backend API Setup
```bash
# Navigate to backend directory
cd navbar-app/backend

# Install dependencies
npm install

# Set environment variables (create .env file)
# Add the following to .env:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/childBooklet
# PORT=8080
# ADMIN_JWT_SECRET=your-secret-key

# Start the server
npm start

# For development (with auto-reload)
npm run dev
```

#### 2. Callback Server Setup
```bash
# Navigate to navbar-app directory
cd navbar-app

# Install dependencies
npm install

# The callback server runs on port 5000 by default
# Start the callback server
node callback-server.js

# Or run in background (Linux/Mac)
nohup node callback-server.js > server.out 2>&1 &

# Or run in background (Windows PowerShell)
Start-Process node -ArgumentList "callback-server.js" -WindowStyle Hidden
```

#### 3. React Frontend Setup
```bash
# Navigate to navbar-app directory (if not already there)
cd navbar-app

# Install dependencies (if not done already)
npm install

# Start the development server
npm start

# Build for production
npm run build
```

### Environment Variables

#### Backend API (.env)
```env
MONGO_URI=mongodb+srv://your-connection-string
MONGO_DB=childBooklet
PORT=8080
ADMIN_JWT_SECRET=your-secret-key
ADMIN_USERNAME=Admin
ADMIN_PASSWORD_HASH=your-bcrypt-hash

# PostgreSQL (optional, for identity system)
PG_HOST=localhost
PG_PORT=5455
PG_USER=postgres
PG_PASSWORD=postgres
PG_DB_IDENTITY=mosip_mockidentitysystem
```

#### Callback Server
```env
PORT=5000
MONGO_URI=mongodb+srv://your-connection-string
MONGO_DB=nutrition_app
NO_MONGO=false
SPA_BASE_URL=http://localhost:3001
CALLBACK_BASE_URL=http://your-server:5000
```

### Starting All Services

#### Development Mode
```bash
# Terminal 1: Start Backend API
cd navbar-app/backend
npm run dev

# Terminal 2: Start Callback Server
cd navbar-app
node callback-server.js

# Terminal 3: Start React Frontend
cd navbar-app
npm start
```

#### Production Mode
```bash
# Backend API
cd navbar-app/backend
npm start

# Callback Server (background)
cd navbar-app
nohup node callback-server.js > server.out 2>&1 &

# Frontend (build and serve)
cd navbar-app
npm run build
# Serve the build folder with a static server (e.g., nginx, serve)
npx serve -s build -p 3001
```

---

## Overview
- This document specifies the HTTP APIs for the ChildHealthBooklet system.
- The system comprises:
  - Backend API (primary data and admin endpoints)
  - Callback Server (OAuth authorization code exchange and SPA redirects)
  - eSignet (external Authorization Server)

Base URLs
- Backend API Base (example): {{BACKEND_API_BASE}}
  - Examples: https://navbar-backend-clean-87485236346.us-central1.run.app or http://34.27.252.72:8080
- Callback Server Base (example): {{CALLBACK_BASE}}
  - Examples: http://localhost:5000 or http://34.58.198.143:5000

Conventions
- Content-Type: application/json unless noted.
- Auth: Bearer tokens via Authorization: Bearer {{ACCESS_TOKEN}}
- Pagination parameters where supported:
  - limit (default varies by endpoint)
  - offset (0-based index)
  - page (1-based index) for some admin endpoints

Authentication
- Field user auth: Obtain an eSignet access_token via the OAuth flow (Callback Server assists).
- Admin auth: Use POST /api/admin/login to obtain an admin token (JWT or in-memory session token depending on server config), then include it as a Bearer token.

Security Guidance
- Do not log or echo tokens in plaintext.
- In examples, set tokens to environment variables first and reference them (e.g., in PowerShell: $env:ACCESS_TOKEN = "..."; in bash: export ACCESS_TOKEN=...). Replace {{ACCESS_TOKEN}} in examples with that variable usage.

=======================================
1) Health and Diagnostics
=======================================

1.1 GET /health (Backend API)
- Purpose: Liveness probe
- Auth: None
- Response: 200 OK
  {
    "status": "ok",
    "time": 1690000000000
  }

1.2 GET / (Backend API)
- Purpose: Service info
- Auth: None
- Response: 200 OK
  {
    "service": "navbar-backend",
    "ok": true
  }

1.3 GET /health (Callback Server)
- Purpose: Liveness probe
- Auth: None
- Response: 200 OK
  {
    "status": "OK",
    "port": 5000,
    "mongo": true
  }

1.4 GET /diag (Callback Server)
- Purpose: Diagnostics snapshot (no secrets)
- Auth: None
- Response: 200 OK
  {
    "now": "2025-09-28T05:40:00Z",
    "pid": 12345,
    "node": "v18.x.x",
    "env": {
      "PORT": 5000,
      "HOST": "0.0.0.0",
      "SPA_BASE_URL": "...",
      "CALLBACK_BASE_URL": "...",
      "AUTHORIZE_URI": "...",
      "NO_MONGO": false
    },
    "clientConfigPresent": true,
    "redirectUri": "http://.../callback"
  }

=======================================
2) OAuth (Callback Server)
=======================================

2.1 GET /callback
- Purpose: Handles the Authorization Server redirect with code and state. Exchanges code for tokens, then redirects browser back to SPA with an auth payload (base64) in the hash.
- Auth: None
- Request: Query parameters
  - code (required) – Authorization code
  - state (required) – CSRF protection value
- Response: 200 HTML page with automatic redirect to {{SPA_BASE_URL}}/#auth_payload=...&authenticated=true

2.2 POST /exchange-token
- Purpose: Token exchange via JWT client assertion, returns tokens and user info.
- Auth: None
- Request body:
  {
    "code": "<AUTH_CODE>",
    "state": "<STATE_OPT>"
  }
- Response: 200 OK
  {
    "access_token": "...",
    "id_token": "...",
    "refresh_token": "...", // if provided by AS
    "userInfo": { /* OIDC userinfo claims */ },
    "success": true
  }
- Errors: 400 (Token exchange failed), 500 (Internal error)

2.3 GET /authorize-url
- Purpose: Returns a canonical authorization URL based on the current client configuration.
- Auth: None
- Response: 200 OK
  {
    "authorize_url": "http://.../authorize?...",
    "clientId": "...",
    "redirect_uri": "http://.../callback"
  }

2.4 GET /client-meta
- Purpose: Public metadata for the client
- Auth: None
- Response: 200 OK
  {
    "clientId": "...",
    "authorizeUri": "http://...:3000/authorize",
    "redirect_uri": "http://...:5000/callback"
  }

2.5 POST /auth/esignet (utility)
- Purpose: Enhances userInfo (attempts to extract individualId). Optional diagnostic utility.
- Auth: None
- Request body:
  {
    "userInfo": { /* userinfo claims */ },
    "id_token": "..." // optional
  }
- Response: 200 OK
  {
    "success": true,
    "user": { /* userInfo plus derived individualId */ },
    "token": "..." // echoed if provided
  }

=======================================
3) Child Records (Backend API)
=======================================

3.1 POST /api/child/batch
- Purpose: Bulk upload of child records from the offline client
- Auth: Required – Bearer access token (eSignet) or an admin token
- Headers:
  - Authorization: Bearer {{ACCESS_TOKEN}}
  - Content-Type: application/json
- Request body:
  {
    "records": [
      {
        "healthId": "CHXXXXXXXXXXXX", // 12-char offline-safe ID
        "name": "Child Name",
        "ageMonths": 24,
        "weightKg": 12.5,
        "heightCm": 85,
        "guardianName": "Parent Name",
        "guardianPhone": "9876543210",
        "guardianRelation": "Mother",
        "malnutritionSigns": "Stunting, Wasting",
        "recentIllnesses": "Fever last week",
        "parentalConsent": true,
        "facePhoto": "data:image/jpeg;base64,...", // trimmed if > ~1MB
        "idReference": "1234-5678-9012",
        "createdAt": 1690000000000, // or ISO string
        "version": 2
      }
    ],
    "uploaderName": "Field User",
    "uploaderEmail": "user@example.com",
    "uploaderLocation": {
      "source": "browser-geolocation|manual",
      "city": "...",
      "state": "...",
      "country": "...",
      "coordinates": [lng, lat],
      "accuracy": 15,
      "timestamp": "2025-09-28T05:40:00Z",
      "area": "...",
      "street": "...",
      "postcode": "..."
    }
  }
- Response: 200 OK
  {
    "summary": {
      "total": 5,
      "attempted": 5,
      "uploaded": 3,
      "failed": 1,
      "skipped": 1
    },
    "results": [
      { "healthId": "CH...", "status": "uploaded" },
      { "healthId": "CH...", "status": "failed", "reason": "duplicate" }
    ]
  }
- Errors:
  - 400 { error: "invalid_request" | "no_records" }
  - 401 { error: "Missing or invalid Authorization header" }
  - 500 { error: "batch_upload_failed" }

3.2 GET /api/child
- Purpose: List/search records
- Auth: None (typically), may vary by deployment
- Query parameters:
  - search: string (matches name or healthId)
  - status: string (may be ignored by backend)
  - limit: number (max 100)
  - offset: number (0-based)
- Response: 200 OK
  {
    "total": 120,
    "records": [ { /* MongoDB documents */ } ]
  }
- Errors: 500 { error: "list_failed" | "mongo_unavailable" }

3.3 GET /api/child/:healthId/pdf
- Purpose: Generate PDF “health booklet” for a child
- Auth: None (typically), may vary by deployment
- Response: 200 OK
  - Content-Type: application/pdf
  - Inline PDF stream
- Errors: 404 { error: "not_found" }, 500 { error: "pdf_failed" }

=======================================
4) Admin (Backend API)
=======================================

4.1 POST /api/admin/login
- Purpose: Admin login; returns a token
- Auth: None
- Request body:
  {
    "username": "Admin",
    "password": "Admin@123"
  }
- Response: 200 OK
  {
    "token": "...", // use in Authorization: Bearer
    "username": "Admin",
    "expiresIn": 1800,
    "mode": "jwt" | "memory"
  }
- Errors: 400 { error: "missing_credentials" }, 401 { error: "invalid_credentials" }, 500 { error: "server_error" | "login_failed" }

4.2 GET /api/admin/stats
- Purpose: Dashboard stats
- Auth: Required – Bearer admin token
- Response: 200 OK
  {
    "totalChildRecords": 1847,
    "recentUploads": [
      { "healthId": "CH...", "name": "...", "uploadedAt": "2025-09-28T05:40:00Z" }
    ]
  }
- Errors: 401 { error: "unauthorized" }, 500 { error: "stats_failed" | "server_error" }

4.3 GET /api/admin/children
- Purpose: Paged listing for admin UI
- Auth: Required – Bearer admin token
- Query parameters:
  - page: number (default 1)
  - limit: number (default 50)
  - search: string
  - location: string (optional)
  - status: string (optional)
- Response: 200 OK
  {
    "children": [
      {
        "healthId": "CH...",
        "name": "...",
        "ageMonths": 18,
        "guardianName": "...",
        "location": "...",
        "malnutritionSigns": "...",
        "recentIllnesses": "...",
        "createdAt": 1690000000000,
        "uploadedAt": "2025-09-28T05:40:00Z"
      }
    ],
    "total": 120,
    "page": 1,
    "limit": 50,
    "totalPages": 3
  }
- Errors: 401 { error: "unauthorized" }, 500 { error: "server_error" }

4.4 PUT /api/admin/child/:healthId
- Purpose: Update a child record (admin)
- Auth: Required – Bearer admin token
- Request body (allowed fields only):
  {
    "name": "...",
    "gender": "Male|Female|Other",
    "dateOfBirth": "YYYY-MM-DD",
    "weightKg": 12.3,
    "heightCm": 85,
    "malnutritionStatus": "Normal|Moderate|Severe",
    "guardianName": "...",
    "phoneNumber": "...",
    "relation": "...",
    "aadhaarId": "1234-5678-9012",
    "location": "...",
    "representative": "...",
    "photoData": "data:image/jpeg;base64,..."
  }
- Response: 200 OK
  {
    "message": "Record updated successfully",
    "record": { /* updated document */ },
    "modifiedCount": 1
  }
- Errors: 401 { error: "unauthorized" }, 404 { error: "not_found" }, 500 { error: "update_failed" }

4.5 DELETE /api/admin/child/:healthId
- Purpose: Delete a child record (admin)
- Auth: Required – Bearer admin token
- Response: 200 OK
  {
    "message": "Record deleted successfully",
    "deletedCount": 1,
    "healthId": "CH..."
  }
- Errors: 401 { error: "unauthorized" }, 404 { error: "not_found" }, 500 { error: "delete_failed" }

4.6 POST /api/admin/verify-password
- Purpose: Second-factor confirmation for sensitive operations
- Auth: Required – Bearer admin token
- Request body:
  { "password": "..." }
- Response: 200 OK
  { "message": "Password verified successfully", "verified": true }
- Errors: 400 { error: "password_required" }, 401 { error: "unauthorized" | "invalid_password" }, 500 { error: "verification_failed" }

=======================================
5) Identities (Admin, Backend API)
=======================================

5.1 GET /api/admin/identities
- Purpose: List identities from mock identity system (PostgreSQL)
- Auth: Required – Bearer admin token (dev fallback may allow open read if no auth backend configured)
- Query parameters:
  - limit: number (default 100, max 500)
  - offset: number (default 0)
- Response: 200 OK
  {
    "items": [
      {
        "individualId": "...",
        "name": "...",
        "email": "...",
        "phone": "...",
        "dateOfBirth": "YYYY-MM-DD",
        "country": "...",
        "region": "...",
        "gender": "...",
        "createdAt": "..."
      }
    ],
    "total": 100
  }
- Errors: 401 { error: "unauthorized" }, 503 { error: "postgres_unavailable" }, 500 { error: "identity_list_failed" }

5.2 GET /api/admin/identities/:id
- Purpose: Fetch full identity details by individualId (sanitized)
- Auth: Required – Bearer admin token (dev fallback may allow open read)
- Response: 200 OK
  {
    "individualId": "...",
    "summary": { /* summarized fields */ },
    "identity": { /* full object with sensitive fields removed */ }
  }
- Errors: 401 { error: "unauthorized" }, 404 { error: "not_found" }, 503 { error: "postgres_unavailable" }, 500 { error: "identity_fetch_failed" }

=======================================
6) Common Error Shapes
=======================================

- 400 Bad Request: { "error": "invalid_request", "message": "..." }
- 401 Unauthorized: { "error": "unauthorized" }
- 404 Not Found: { "error": "not_found" }
- 500 Internal Server Error: { "error": "internal_server_error" | "server_error", "message": "..." }
- 503 Service Unavailable: { "error": "mongo_disabled" | "postgres_unavailable" }

=======================================
7) Example Usage (curl)
=======================================

Note: Replace {{BACKEND_API_BASE}}, {{CALLBACK_BASE}}, and use environment variables for tokens.

7.1 Health
```bash
# Backend API health
curl -s {{BACKEND_API_BASE}}/health

# Callback Server health
curl -s {{CALLBACK_BASE}}/health
```

7.2 Token exchange (Callback Server)
```bash
# Exchange authorization code for tokens
curl -s -X POST {{CALLBACK_BASE}}/exchange-token \
  -H "Content-Type: application/json" \
  -d '{"code":"{{AUTH_CODE}}","state":"{{STATE}}"}'
```

7.3 Admin login (Backend API)
```bash
# PowerShell (Windows)
$env:BACKEND_API_BASE = "{{BACKEND_API_BASE}}"
$env:ACCESS_TOKEN = (curl -s -X POST "$env:BACKEND_API_BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"Admin@123"}' | \
  jq -r .token)

# bash (Linux/macOS)
export BACKEND_API_BASE={{BACKEND_API_BASE}}
export ACCESS_TOKEN=$(curl -s -X POST "$BACKEND_API_BASE/api/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"Admin","password":"Admin@123"}' | jq -r .token)
```

7.4 Batch upload (Backend API)
```bash
curl -s -X POST {{BACKEND_API_BASE}}/api/child/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "records": [
      {"healthId":"CHXXXXYYYYZZZ","name":"Child A","ageMonths":12,"weightKg":8.2,"heightCm":72,"guardianName":"Parent A","guardianPhone":"9999999999","parentalConsent":true}
    ],
    "uploaderName":"Field User",
    "uploaderEmail":"user@example.com",
    "uploaderLocation":{"source":"manual","city":"City","state":"State","country":"Country"}
  }'
```

7.5 List/search children (Backend API)
```bash
curl -s "{{BACKEND_API_BASE}}/api/child?search=CHXXXX&limit=20&offset=0"
```

7.6 PDF for a child (Backend API)
```bash
curl -s -D - "{{BACKEND_API_BASE}}/api/child/CHXXXXYYYYZZZ/pdf" -o CHXXXXYYYYZZZ.pdf
```

7.7 Admin stats (Backend API)
```bash
curl -s "{{BACKEND_API_BASE}}/api/admin/stats" -H "Authorization: Bearer $ACCESS_TOKEN"
```

7.8 Admin children (Backend API)
```bash
curl -s "{{BACKEND_API_BASE}}/api/admin/children?page=1&limit=50&search=anita" -H "Authorization: Bearer $ACCESS_TOKEN"
```

7.9 Update child (Backend API)
```bash
curl -s -X PUT "{{BACKEND_API_BASE}}/api/admin/child/CHXXXXYYYYZZZ" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"malnutritionStatus":"Moderate","location":"District A"}'
```

7.10 Delete child (Backend API)
```bash
curl -s -X DELETE "{{BACKEND_API_BASE}}/api/admin/child/CHXXXXYYYYZZZ" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

=======================================
8) Data Models (Reference)
=======================================

8.1 Child record (MongoDB)
```json
{
  "_id": "ObjectId(...)",
  "healthId": "CHXXXXXXXXXXXX",
  "name": "Child Name",
  "ageMonths": 24,
  "weightKg": 12.5,
  "heightCm": 85,
  "guardianName": "Parent Name",
  "guardianPhone": "9876543210",
  "guardianRelation": "Mother",
  "malnutritionSigns": "Stunting, Wasting",
  "recentIllnesses": "Fever last week",
  "parentalConsent": true,
  "facePhoto": "base64...",
  "idReference": "1234-5678-9012",
  "createdAt": 1690000000000,
  "uploadedAt": "2025-09-28T05:40:00Z",
  "uploaderName": "Field User",
  "uploaderEmail": "user@example.com",
  "uploaderSub": "esignet_sub",
  "uploaderLocation": { /* see request example */ },
  "source": "offline_sync",
  "version": 2
}
```

8.2 Admin session
```json
{
  "token": "<bearer token>",
  "mode": "jwt" | "memory",
  "expiresIn": 1800
}
```

=======================================
9) Notes & Operational Considerations
=======================================

- OAuth flow is handled by the Callback Server which redirects to the SPA; the SPA maintains session state in sessionStorage/localStorage as implemented.
- The React offline sync posts to the Backend API /api/child/batch, typically every ~15 seconds when authenticated and online.
- Photos larger than ~1MB are dropped server-side during batch to protect the database.
- Duplicates by healthId are treated as uploaded or indicated as duplicate depending on endpoint implementation.
- MongoDB is required for data endpoints; if unavailable, endpoints may return mongo_unavailable or mongo_disabled.
- The Identities endpoints rely on PostgreSQL availability (mock identity system). If unavailable, endpoints return postgres_unavailable.

-- End of Document --
