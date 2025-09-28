# ChildHealthBooklet — Software Documentation

Release 3.0.0
Authors: Project Team (based on template by Dr. Peter Hruschka, arc42)
Date: September 25, 2025

USAGE AND INSTALLATION
1 Relevant Background Information and Pre-Requisites 3
2 Requirements Overview 5
3 Detailed Documentation 7
Index 29

i

ii

Software Documentation, Release 3.0.0

Project Introduction
The ChildHealthBooklet is a progressive web application (PWA) enabling field health workers to securely collect, manage, and synchronize child health data in low-connectivity environments. It integrates with eSignet (MOSIP) for secure OAuth 2.0 authentication, supports offline-first data capture using IndexedDB, and synchronizes to a cloud backend on Google Cloud Platform (GCP). The system comprises a React frontend, a Node.js callback server for OAuth token exchange and APIs, and supporting services in the eSignet ecosystem.

USAGE AND INSTALLATION 1

2 USAGE AND INSTALLATION

CHAPTER ONE
RELEVANT BACKGROUND INFORMATION AND PRE-REQUISITES

Audience and Assumptions
- Field Users: Basic familiarity with using a web/mobile browser and PWA installation on mobile devices.
- Developers: Familiarity with JavaScript/TypeScript, React, Node.js/Express, OAuth 2.0 (authorization code flow), and basics of GCP or Docker for deployment.
- Operators/DevOps: Comfortable with Linux server management, Docker, and basic networking/firewall rules on GCP.

Concepts to Know
- OAuth 2.0 and OIDC: Authorization Code Grant, redirect URIs, client authentication via private_key_jwt.
- Offline-first PWAs: Service workers, IndexedDB, background sync strategies.
- eSignet (MOSIP): Acts as the Authorization Server and identity provider for authentication.
- Data privacy: Handling of sensitive personal data (consent, minimization, secure transport, retention).

Prerequisites (Local Development)
- Node.js v18+
- npm or yarn
- Git
- Optional: MongoDB (local) if running backend with persistence

Prerequisites (Cloud Deployment)
- Google Cloud project with a VM (or Cloud Run) and firewall rules for ports 3000, 5000, 8088
- Docker (if containerizing)
- PM2 (if managing Node process on VM)

Links and References
- Project README for quick start and commands
- Architecture documentation (ARCHITECTURE.md)
- Flowcharts (FLOWCHARTS.md) — Mermaid diagrams of major flows
- API Documentation (docs/API.md) — Complete REST API reference
- eSignet integration guide under navbar-app/docs/eSignet-Integration-Guide.md

4 Chapter 1. Relevant Background Information and Pre-Requisites

CHAPTER TWO
REQUIREMENTS OVERVIEW

This section summarizes the system as a black box with its interfaces.

User Interfaces
- Web PWA (React): Mobile-first UI for field data entry, admin dashboard for analytics and management.
- Admin UI: Administrative dashboard to review uploads, analytics, and manage records/agents.

Technical Interfaces
- eSignet Authorization Server (external): OAuth endpoints for authorization, token exchange, and user info.
- Callback Server (Node/Express): Exposes application APIs for batch record upload, health checks, diagnostics, and PDF generation.
- Data Stores: IndexedDB (offline client cache), MongoDB (cloud persistence).

Runtime Interfaces and Constraints
- Network: HTTP(S) interfaces on ports 3000 (UI), 5000 (callback server), 8088 (eSignet backend), plus internal DB/cache services.
- Resource limits: Typical VM: e2-medium (2 vCPU, 4 GB RAM). Frontend optimized for low bandwidth; offline capture reduces network dependency.
- Availability: Stateless frontend; callback server designed for graceful restarts; background retry for sync.

6 Chapter 2. Requirements Overview

CHAPTER THREE
DETAILED DOCUMENTATION

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐ │
│  │ Local Development│    │      Google Cloud Platform          │ │
│  │                 │    │   (34.58.198.143)                   │ │
│  │  ┌─────────────┐│    │                                      │ │
│  │  │ React App   ││    │  ┌─────────────────────────────────┐ │ │
│  │  │ :3001       ││◄───┼──┤ Callback Server (Node.js)      │ │ │
│  │  └─────────────┘│    │  │ :5000                           │ │ │
│  │                 │    │  └─────────────────────────────────┘ │ │
│  └─────────────────┘    │                                      │ │
│                         │  ┌─────────────────────────────────┐ │ │
│                         │  │ eSignet UI Service             │ │ │
│                         │  │ :3000                           │ │ │
│                         │  └─────────────────────────────────┘ │ │
│                         │                                      │ │
│                         │  ┌─────────────────────────────────┐ │ │
│                         │  │ eSignet Backend (Spring Boot)   │ │ │
│                         │  │ :8088                           │ │ │
│                         │  └─────────────────────────────────┘ │ │
│                         │                                      │ │
│                         │  ┌─────────────────────────────────┐ │ │
│                         │  │ Supporting Services:            │ │ │
│                         │  │ • PostgreSQL :5432             │ │ │
│                         │  │ • Redis Cache :6379            │ │ │
│                         │  │ • Mock Identity :8082          │ │ │
│                         │  └─────────────────────────────────┘ │ │
│                         └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

3.1 Installation

Local Development Setup
1. Clone repository
```bash path=null start=null
git clone https://github.com/Rishy-fishy/Hackathon-v3.git
cd Hackathon-v3/navbar-app
```
2. Install dependencies
```bash path=null start=null
npm install
```
3. Configure environment for frontend (.env)
```bash path=null start=null
GENERATE_SOURCEMAP=false
ESLINT_NO_DEV_ERRORS=true
SKIP_PREFLIGHT_CHECK=true
FAST_REFRESH=true
```
4. Start development server
```bash path=null start=null
npm run start:fast
```

Callback Server (local or VM)
- Start locally (development):
```bash path=null start=null
node navbar-app/callback-server.js
```
- On GCP VM (Ubuntu):
```bash path=null start=null
# SSH
gcloud compute ssh hackathon-v3-vm --zone=us-central1-a
# Start (example without Mongo)
cd ~/Hackathon-v3/navbar-app
NO_MONGO=1 nohup node callback-server.js > server.out 2>&1 &
```

Cloud Services (GCP VM)
- eSignet UI: http://34.58.198.143:3000
- eSignet Backend: http://34.58.198.143:8088
- Callback Server: http://34.58.198.143:5000

Health Checks
```bash path=null start=null
curl -m 3 http://34.58.198.143:5000/health
curl -m 3 http://34.58.198.143:8088/actuator/health
```

3.2 Getting Started

For Field Users
- Open the app in a browser (development: http://localhost:3001; production: deployed URL).
- Optionally install as a PWA (Add to Home Screen) for offline usage.
- Capture child health records offline; data uploads automatically when you are authenticated and online.

For Admins
- Navigate to /admin to access dashboards and management tools (authentication required).

For Developers
- Review ARCHITECTURE.md for system design and APIs.
- Use FLOWCHARTS.md for end-to-end flow references (Mermaid diagrams).

3.3 Context (System Scope and Context)

Black-box view and neighboring systems
- Neighboring Systems:
  - eSignet UI and Backend (MOSIP): Authentication and token services
  - MongoDB (cloud or Atlas): Persistent data storage
  - Client device local storage (IndexedDB): Offline cache

Motivation
- Ensure interoperability with the eSignet identity system and enable secure, resilient data collection in low-connectivity scenarios.

UML-type context (textual)
- React PWA (user) ⇄ eSignet UI (auth screen)
- React PWA ⇄ Callback Server (token exchange, data APIs)
- Callback Server ⇄ eSignet Backend (token services)
- Callback Server ⇄ MongoDB (data persistence)
- React PWA ⇄ IndexedDB (offline storage)

3.4 Conventions (Coding Guidelines)
- Frontend: Follow React and general JavaScript style conventions; aim for functional components and hooks.
- Linting: react-scripts default; disable dev errors when necessary via ESLINT_NO_DEV_ERRORS.
- Backend: Node.js/Express standard patterns; modular endpoints; environment-driven configuration.
- Documentation: Keep architecture and flowcharts updated along with releases.

3.5 Architecture Constraints

Technical Constraints / Runtime Interface Requirements
- Hard-/Software Infra: GCP VM (e2-medium), Ubuntu 20.04 LTS
- Applied Technologies: React 18, Node.js 18, Express, MongoDB, IndexedDB, eSignet OAuth
- Networking: Open ports 3000, 5000, 8088; optional 5432 (Postgres), 6379 (Redis) for eSignet ecosystem
- Authentication: OAuth 2.0 with private_key_jwt client auth

Operating Constraints
- HTTPS recommended for production
- Data protection and consent required for PII

3.6 Technical Interfaces

OAuth 2.0 with eSignet
- Authorization Endpoint: http://34.58.198.143:3000/authorize
- Redirect URI: http://34.58.198.143:5000/callback
- Grant Type: authorization_code
- Client Auth Method: private_key_jwt
- Scopes: openid profile

Callback Server APIs (selected)
```http path=null start=null
GET  /health                 # Liveness
GET  /diag                   # Diagnostics
GET  /client-meta            # Client configuration
GET  /callback               # OAuth callback handler
POST /exchange-token         # Code-to-token exchange
```

Backend API Endpoints (selected)
```http path=null start=null
# Child Records
POST /api/child/batch             # Bulk upload records (Bearer token)
GET  /api/child                   # List/search records
GET  /api/child/:healthId/pdf     # Generate PDF report

# Admin
POST   /api/admin/login           # Admin authentication
GET    /api/admin/stats           # Dashboard stats
GET    /api/admin/children        # Records list (paged)
PUT    /api/admin/child/:healthId # Update record
DELETE /api/admin/child/:healthId # Delete record
POST   /api/admin/verify-password # Password verification

# Identities (PostgreSQL)
GET  /api/admin/identities        # List identities
GET  /api/admin/identities/:id    # Identity detail (sanitized)
```

Data Models (MongoDB)
```json path=null start=null
{
  "_id": "ObjectId(..)",
  "healthId": "CH-2025-001234",
  "name": "Child Name",
  "ageMonths": 24,
  "weightKg": 12.5,
  "heightCm": 85,
  "guardianName": "Parent Name",
  "guardianPhone": "9876543210",
  "malnutritionSigns": "Stunting, Wasting",
  "recentIllnesses": "Fever last week",
  "parentalConsent": true,
  "facePhoto": "base64_encoded_image",
  "idReference": "1234-5678-9012",
  "createdAt": 1640995200000,
  "uploadedAt": 1640995800000,
  "uploaderName": "Field Worker Name",
  "uploaderSub": "esignet_user_id",
  "source": "offline_sync",
  "version": 2
}
```

Interoperability Levels
- Technical: HTTP over TCP/IP
- Syntactic: JSON payloads
- Semantic: Domain fields aligned with child health records; identifiers like healthId unique across system

3.7 User Interfaces

Dynamic UI Behaviour (summary)
- Guest vs Authenticated modes
- Multi-step data entry form with validation and consent
- Background sync updates record statuses (pending → uploading → uploaded/failed)

Static UI
- Mobile-first UI components with MUI; admin dashboard views for analytics and records

3.8 Design Decisions (Selected)
- Offline-first PWA to ensure data capture without connectivity
- OAuth via eSignet for secure, standards-based authentication
- IndexedDB for local persistence with Dexie.js abstraction
- Batch uploads to reduce network overhead and improve reliability

Considerations
- Protect PII; require explicit consent
- Use unique healthId for deduplication and auditability

3.9 Public Interfaces (API Overview)
- See 3.6 for endpoint list
- Health: /health, /diag
- Configuration: /client-meta
- Data: /api/child, /api/child/batch, /api/child/:id/pdf

3.10 Solution Strategy
- Architecture
  - React PWA frontend with service worker for offline capability
  - Node/Express callback server for OAuth exchange and REST APIs
  - eSignet for identity and token services
  - IndexedDB (client) + MongoDB (server) for resilient storage
- Synchronization
  - Background poll at ~15s intervals when online
  - Status tracking and retry of failed records
  - Server-side deduplication by healthId

3.11 Test Strategy
- Unit tests: React Testing Library for UI; jest for functions
- Manual tests: Authentication flows, offline data capture, sync scenarios, PDF generation
- Health endpoints: /health and /diag for runtime verification

3.12 Building Block View

Overview (whitebox decomposition)
- Frontend (React)
  - App.js (router/state)
  - Header/Auth components (ESignetAuth, AuthCallback)
  - Offline subsystem (Dexie DB, Sync service)
  - Admin views (records, analytics, agents)
- Backend (Node/Express)
  - OAuth controller (callback, token exchange)
  - Data controller (batch upload, list, PDF)
  - Utility endpoints (health, diag, client-meta)

3.13 Runtime View

### Key Runtime Scenarios

#### 1) System Startup Sequence
```
1. Frontend Application Load:
   ├── Initialize React Router and State
   ├── Load Theme Manager (Dark/Light mode)
   ├── Initialize Dexie Database (IndexedDB)
   ├── Register Service Worker (PWA features)
   ├── Start Background Sync Timer (15s interval)
   └── Display Homepage (Guest or Authenticated mode)

2. Backend Service Initialization:
   ├── Load Environment Configuration
   ├── Initialize Express Server (port 5000)
   ├── Connect to MongoDB (if enabled)
   ├── Load OAuth Client Configuration
   ├── Start Health Check Endpoints
   └── Begin Accepting HTTP Requests

3. eSignet Service Dependencies:
   ├── eSignet UI Service (:3000)
   ├── eSignet Backend (:8088)
   ├── PostgreSQL Database (:5432)
   ├── Redis Cache (:6379)
   └── Mock Identity Service (:8082)
```

#### 2) OAuth 2.0 Authentication Flow
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  React App   │────▶│ eSignet UI   │────▶│ User Login   │────▶│ eSignet      │
│ (localhost)  │     │ (:3000)      │     │ (Biometric)  │     │ Backend      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │                     │
        ▼                     ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Callback     │◄────│ Authorization│◄────│ Auth Code    │◄────│ Token        │
│ Handler      │     │ Redirect     │     │ Generation   │     │ Services     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
        │
        ▼
┌──────────────┐
│ Session      │
│ Storage &    │
│ Sync Start   │
└──────────────┘
```

Detailed Steps:
1. User clicks "Sign in with eSignet"
2. App redirects to: `http://34.58.198.143:3000/authorize?client_id=...&redirect_uri=...&scope=openid profile`
3. User completes authentication (credentials/biometric)
4. eSignet redirects to: `http://34.58.198.143:5000/callback?code=...&state=...`
5. Callback server exchanges code for tokens using JWT client assertion
6. Server returns auth_payload to React app: `http://localhost:3001/?auth_payload=...`
7. Frontend stores user info in sessionStorage and enables sync

#### 3) Data Synchronization Process
```
Background Sync Timer (every 15 seconds):
├── Check Network Connectivity
├── Verify Authentication Status
├── Query IndexedDB for Pending Records
├── If records found:
│   ├── Mark records as "uploading"
│   ├── Prepare batch payload:
│   │   ├── Records array
│   │   ├── Uploader metadata
│   │   └── Timestamp info
│   ├── POST to /api/child/batch
│   └── Process API Response:
│       ├── Success: Mark as "uploaded"
│       ├── Duplicate: Mark as "uploaded" 
│       ├── Failed: Mark as "failed" (retry next cycle)
│       └── Error: Keep as "pending" (retry next cycle)
└── Update UI indicators and show notifications
```

#### 4) Child Data Entry Workflow
```
Multi-Step Form Process:
┌─ Step 1: Identity Information ─┐
│ • Child name and gender        │
│ • Date of birth / age          │
│ • Photo capture (camera/upload)│
│ • Aadhaar ID (optional)        │
└────────────┬───────────────────┘
             ▼
┌─ Step 2: Health Assessment ────┐
│ • Weight and height            │
│ • Guardian information         │
│ • Phone number                 │
│ • Malnutrition signs           │
│ • Recent illnesses             │
└────────────┬───────────────────┘
             ▼
┌─ Step 3: Consent & Review ─────┐
│ • Data review summary          │
│ • Parental consent checkbox    │
│ • Save confirmation            │
└────────────┬───────────────────┘
             ▼
┌─ Local Storage (IndexedDB) ────┐
│ • Generate Health ID           │
│ • Set status: "pending"        │
│ • Compress and store photo     │
│ • Add to sync queue            │
└────────────────────────────────┘
```

3.14 Deployment View

Environment
- Google Cloud VM (e2-medium) at 34.58.198.143
- Services and Ports
  - eSignet UI :3000
  - eSignet Backend :8088
  - Callback Server :5000
- Management
  - PM2 for process control (optional)
  - Logs via server.out and docker-compose logs (where applicable)

Firewall
- Allow inbound TCP on 80/443 (recommended), 3000, 5000, 8088

3.15 Libraries and External Software

### Frontend Dependencies
| Library | Version | Purpose | License |
|---------|---------|---------|----------|
| react | ^18.2.0 | Core UI framework | MIT |
| @mui/material | ^5.15.0 | Material Design components | MIT |
| @emotion/react | ^11.11.1 | CSS-in-JS styling | MIT |
| dexie | ^4.2.0 | IndexedDB wrapper for offline storage | Apache-2.0 |
| jspdf | ^3.0.2 | PDF generation client-side | MIT |
| react-icons | ^4.12.0 | Icon library | MIT |
| nanoid | ^5.1.5 | Unique ID generation | MIT |
| darkreader | ^4.9.109 | Dark theme support | MIT |
| @react-google-maps/api | ^2.20.7 | Google Maps integration | MIT |
| workbox-* | ^7.3.0 | Service worker/PWA features | MIT |

### Backend Dependencies
| Library | Version | Purpose | License |
|---------|---------|---------|----------|
| express | ^4.18.2 | Web framework | MIT |
| jsonwebtoken | ^9.0.2 | JWT token handling | MIT |
| mongodb | ^6.3.0 | Database driver | Apache-2.0 |
| node-rsa | ^1.1.1 | RSA encryption for JWT | MIT |
| node-fetch | ^2.7.0 | HTTP client | MIT |
| cors | ^2.8.5 | Cross-origin resource sharing | MIT |
| concurrently | ^8.2.2 | Run multiple commands | MIT |

### Infrastructure Components
| Component | Technology | Version/Config | Purpose |
|-----------|------------|----------------|----------|
| Cloud Platform | Google Cloud Platform | us-central1 | Infrastructure hosting |
| Compute Instance | e2-medium | 2 vCPU, 4GB RAM | Application server |
| Operating System | Ubuntu | 20.04 LTS | Server OS |
| Process Manager | PM2 | Latest | Node.js process management |
| Container Engine | Docker | Latest | Containerization (optional) |
| Database (Cloud) | MongoDB Atlas | 6.0+ | Document database |
| Database (Local) | IndexedDB | Browser native | Client-side storage |

### External Services
| Service | Provider | Purpose | Integration |
|---------|----------|---------|-------------|
| eSignet Authentication | MOSIP | OAuth 2.0 identity provider | REST API |
| Google Cloud VM | Google | Application hosting | SSH/HTTP |
| MongoDB Atlas | MongoDB Inc | Database hosting | Connection string |
| GitHub | Microsoft | Version control | Git repository |

### Build and Development Tools
| Tool | Version | Purpose | Configuration |
|------|---------|---------|---------------|
| Create React App | 5.0.1 | Frontend build tool | react-scripts |
| Node.js | 18+ | Runtime environment | LTS version |
| npm | 8+ | Package manager | Default registry |
| Git | 2.x | Version control | GitHub integration |
| VS Code | Latest | Development IDE | Extensions recommended |

### Licenses and Attribution
- **Project License**: MIT License (see LICENSE file)
- **arc42 Template**: Used under Creative Commons license
- **Third-party Libraries**: See individual library licenses above
- **MOSIP eSignet**: Open source identity platform

3.16 About arc42

arc42, the Template for documentation of software and system architecture.
By Dr. Gernot Starke, Dr. Peter Hruschka and contributors.
Template Revision: 6.5 EN (based on asciidoc)
© We acknowledge that this document uses material from the arc42 architecture template, http://www.arc42.de.

Index
- Authentication flow: 2, 3.13
- APIs: 3.6, 3.9
- Deployment (GCP): 3.14
- Offline-first: 1, 3.10, 3.13
- User Interfaces: 2, 3.7
