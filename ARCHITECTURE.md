# ChildHealthBooklet - Application Architecture

## 🏗️ System Overview

The ChildHealthBooklet is a progressive web application (PWA) designed for field health workers to collect, manage, and upload child health data in areas with limited connectivity. The system uses an **offline-first architecture** with secure OAuth 2.0 authentication through eSignet and cloud-based data synchronization.

## 🎯 Core Objectives

- **Offline-First**: Work seamlessly without internet connectivity
- **Secure Authentication**: Use eSignet (MOSIP) for identity verification
- **Data Integrity**: Prevent data loss through local storage and sync
- **Mobile-Friendly**: Responsive design for field use on various devices
- **Scalable Backend**: Cloud-deployed services for data management

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────────┐ │
│  │ Local Development│    │      Google Cloud Platform          │ │
│  │                 │    │                                      │ │
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

## 🏛️ Technical Stack

### Frontend
- **Framework**: React 18.2.0 with Create React App
- **UI Library**: Material-UI (MUI) v5.15.0 for admin interface
- **Offline Storage**: Dexie.js (IndexedDB wrapper) for local data persistence
- **Icons**: React Icons and MUI Icons
- **Build Tool**: React Scripts with custom optimizations

### Backend Services
- **Primary Backend API**: Node.js + Express (port 8080 or Cloud Run). Handles data APIs including `POST /api/child/batch`, `GET /api/child`, `GET /api/child/:id/pdf`, and admin endpoints under `/api/admin/*`. Persists to MongoDB.
- **Callback Server**: Node.js + Express (port 5000). Handles OAuth 2.0 authorization code exchange (eSignet) and redirects back to the SPA; may expose limited dev/utility endpoints.
- **Authentication**: eSignet OAuth 2.0 (MOSIP ecosystem)
- **Database**: 
  - MongoDB for production data storage
  - IndexedDB for offline client storage
- **PDF Generation**: jsPDF (client-side) and PDFKit (server-side)

### Infrastructure
- **Cloud Platform**: Google Cloud Platform
  - VM Instance: e2-medium (2 vCPU, 4GB RAM)
  - External IP: 34.58.198.143
  - OS: Ubuntu 20.04 LTS
- **Networking**: Custom firewall rules for ports 3000, 5000, 8088
- **Deployment**: Docker containers with PM2 process management

## 🎨 Frontend Architecture

### Component Hierarchy

```
App.js (Main Router)
├── Header.js (Navigation & Auth)
│   ├── ESignetAuth.js (Authentication Modal)
│   └── AuthCallback.js (OAuth Callback Handler)
├── Homepage.js (Welcome Dashboard)
├── Settings.js (Configuration Panel)
├── AdminPage.js (Admin Dashboard)
│   ├── AdminRecords.js
│   ├── AdminAnalytics.js
│   ├── AdminAgents.js
│   └── MapWidget.js
└── offline/
    ├── ChildForm.js (Data Entry Form)
    └── RecordList.js (Data Management)
```

### State Management

The application uses **React's built-in state management** with hooks:
- `useState` for component-level state
- `useEffect` for side effects and lifecycle
- `useContext` for theme management
- **No external state management library** (Redux, Zustand) - keeping it simple

### Routing Strategy

**Single Page Application (SPA)** with **client-side routing**:
- Routes handled by `window.location.pathname` checks
- Key routes:
  - `/` - Main application
  - `/callback` - OAuth callback processing
  - `/auth-success` - Post-authentication redirect
  - `/admin` - Administrative interface

### Offline-First Design

#### Data Flow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │───▶│   IndexedDB     │───▶│  Sync Service   │
│                 │    │  (Local Cache)  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                      │
                                ▼                      ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Dexie.js      │    │   Backend API   │
                       │   (ORM Layer)   │    │   (MongoDB)     │
                       └─────────────────┘    └─────────────────┘
```

#### Local Storage Schema

```javascript
// Dexie Database Schema (IndexedDB)
db.version(2).stores({
  childRecords: '&healthId, localId, status, createdAt, photoHash'
});

// Record Structure
{
  healthId: "CH-2025-001234",     // Unique identifier
  localId: "nanoid_generated",    // Client-side ID
  name: "Child Name",
  ageMonths: 24,
  weightKg: 12.5,
  heightCm: 85,
  guardianName: "Parent Name",
  guardianPhone: "9876543210",
  malnutritionSigns: ["Stunting", "Wasting"],
  facePhoto: "data:image/jpeg;base64,...",
  status: "pending|uploading|uploaded|failed",
  createdAt: 1640995200000,
  uploadedAt: 1640995800000,
  version: 2
}
```

## 🔐 Authentication Architecture

### eSignet Integration Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  React App   │────▶│ eSignet UI   │────▶│ User Login   │
│ (localhost)  │     │ (:3000)      │     │ (Biometric)  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Auth Payload │◄────│ Authorization│◄────│ eSignet      │
│ Processing   │     │ Code         │     │ Backend      │
└──────────────┘     └──────────────┘     └──────────────┘
        │                     │
        ▼                     ▼
┌──────────────┐     ┌──────────────┐
│ Token        │◄────│ Callback     │
│ Storage      │     │ Server       │
└──────────────┘     └──────────────┘
```

### OAuth 2.0 Configuration

```json
{
  "clientId": "08d8YsjGpeo6kOfoVZYJsMpHGZy1vVOai1Njz8AzZk8",
  "authorizeUri": "http://34.58.198.143:3000/authorize",
  "redirectUri": "http://34.58.198.143:5000/callback",
  "scope": "openid profile",
  "responseType": "code",
  "grantType": "authorization_code",
  "clientAuthMethod": "private_key_jwt"
}
```

### Security Features

- **JWT Client Assertions**: RSA256-signed tokens for backend authentication
- **State Parameter Validation**: CSRF protection
- **Secure Token Storage**: sessionStorage for temporary tokens
- **Session Management**: 15-minute auto-expiry with countdown
- **Dual Authentication Support**: eSignet + fallback admin login

## 🔄 Data Synchronization Architecture

### Sync Strategy

The application implements a **background sync mechanism** with the following characteristics:

```javascript
// Auto-sync Configuration
- Interval: 15 seconds
- Conditions: Online + Authenticated
- Retry Logic: Failed records marked for retry
- Conflict Resolution: Server-side deduplication by healthId
```

### Sync State Management

```
┌─────────────────┐
│ Record States   │
├─────────────────┤
│ pending         │ ←── Newly created, awaiting upload
│ uploading       │ ←── Currently being sent to server
│ uploaded        │ ←── Successfully synchronized
│ failed          │ ←── Upload failed, will retry
└─────────────────┘
```

### Batch Upload Process

```javascript
// Batch Upload Endpoint (Backend API):
// POST /api/child/batch
// Headers: Authorization: Bearer <access_token>
{
  records: [
    {
      healthId: "CHXXXX...", // 12-char offline-safe ID (see healthId.js)
      name: "Child Name",
      // ... other fields from IndexedDB schema
    }
  ],
  uploaderName: "Field Worker Name",
  uploaderEmail: "worker@example.com",
  uploaderLocation: {
    source: "browser-geolocation|manual",
    city: "...",
    state: "...",
    country: "...",
    coordinates: [lng, lat],
    accuracy: 15,
    timestamp: "2025-09-28T05:40:00Z"
  }
}

// Response Format
{
  summary: {
    total: 5,
    uploaded: 3,
    failed: 1,
    skipped: 1
  },
  results: [
    { healthId: "CHXXXX...", status: "uploaded" },
    { healthId: "CHYYYY...", status: "failed", reason: "duplicate" }
  ]
}
```

## 🗄️ Backend Architecture

### Callback Server (Node.js)

**Primary Responsibilities:**
- OAuth 2.0 authorization code to token exchange
- JWT client assertion generation and validation
- User info retrieval from eSignet
- Child record batch upload processing
- PDF report generation
- MongoDB data persistence

### API Endpoints

Note: The React app primarily syncs to the Backend API. The Callback Server is responsible for OAuth and SPA redirects.

```
Backend API Endpoints (Primary sync target):
├── POST /api/child/batch       - Bulk record upload [Authorization: Bearer <token>]
├── GET  /api/child             - List/search records
├── GET  /api/child/:id/pdf     - Generate PDF report
├── POST /api/admin/login       - Admin authentication (JWT or session)
├── GET  /api/admin/stats       - Admin dashboard statistics
├── GET  /api/admin/children    - Admin list of child records
├── PUT  /api/admin/child/:id   - Update child record
├── DELETE /api/admin/child/:id - Delete child record
├── POST /api/admin/verify-password - Verify password for sensitive ops
├── GET  /api/admin/identities      - List identities (mock identity system)
└── GET  /api/admin/identities/:id  - Identity detail (sanitized)

Callback Server (OAuth) Endpoints:
├── GET  /callback              - OAuth callback handler (redirects to SPA)
├── POST /exchange-token        - Token exchange via JWT client assertion
├── GET  /authorize-url         - Authorization URL builder (debug)
├── GET  /client-meta           - Public client metadata (safe subset)
└── GET  /health, /diag         - Health/diagnostics
```

### Database Schema (MongoDB)

```javascript
// Collection: child_records
{
  _id: ObjectId(),
  healthId: "CH-2025-001234",        // Unique business identifier
  name: "Child Name",
  ageMonths: 24,
  weightKg: 12.5,
  heightCm: 85,
  guardianName: "Parent Name",
  guardianPhone: "9876543210",
  malnutritionSigns: "Stunting, Wasting",
  recentIllnesses: "Fever last week",
  parentalConsent: true,
  facePhoto: "base64_encoded_image",
  idReference: "1234-5678-9012",     // Aadhaar number
  
  // Metadata
  createdAt: 1640995200000,
  uploadedAt: 1640995800000,
  uploaderName: "Field Worker Name",
  uploaderSub: "esignet_user_id",
  source: "offline_sync",
  version: 2,
  
  // Indexes
  // { healthId: 1 } - unique
  // { uploaderSub: 1 }
  // { createdAt: -1 }
}
```

## 📱 User Interface Architecture

### Design System

**Visual Theme:**
- **Color Palette**: Blue primary (#1976d2), success green, warning orange
- **Typography**: Roboto font family, semantic font sizes
- **Spacing**: 8px grid system
- **Components**: Material Design with custom styling

### Responsive Design

```css
/* Breakpoint Strategy */
xs: 0px      /* Mobile portrait */
sm: 600px    /* Mobile landscape */
md: 960px    /* Tablet */
lg: 1280px   /* Desktop */
xl: 1920px   /* Large desktop */
```

### User Experience Flow

```
Application Entry
├── Guest User
│   ├── View Homepage (limited)
│   ├── Add Records (offline only)
│   └── Login Prompt for Upload
└── Authenticated User
    ├── Full Dashboard Access
    ├── Data Upload Capability
    ├── Record Management
    └── Profile Management

Admin Interface (/admin)
├── Authentication Required
├── Dashboard Analytics
├── Record Management
├── Field Agent Performance
└── Data Export Tools
```

## 🔧 Development & Build Process

### Build Configuration

```json
{
  "scripts": {
    "start": "set GENERATE_SOURCEMAP=false && set PORT=3001 && react-scripts start",
    "start:fast": "set GENERATE_SOURCEMAP=false && set ESLINT_NO_DEV_ERRORS=true && set PORT=3001 && react-scripts start",
    "dev": "concurrently \"npm run start\" \"npm run start:callback\"",
    "build": "react-scripts build"
  }
}
```

### Environment Variables

```bash
# Frontend (.env)
GENERATE_SOURCEMAP=false
ESLINT_NO_DEV_ERRORS=true
SKIP_PREFLIGHT_CHECK=true
FAST_REFRESH=true
REACT_APP_API_BASE=https://navbar-backend-clean-87485236346.us-central1.run.app

# Backend (.env)
PORT=5000
HOST=0.0.0.0
SPA_BASE_URL=http://localhost:3001
CALLBACK_BASE_URL=http://34.58.198.143:5000
AUTHORIZE_URI=http://34.58.198.143:3000/authorize
NO_MONGO=false
MONGO_URI=mongodb://localhost:27017
MONGO_DB=nutrition_app
```

## 🚀 Deployment Architecture

### Google Cloud Platform Setup

```yaml
Project Configuration:
  project_id: hackathon-v3-docker
  region: us-central1
  zone: us-central1-a

Compute Instance:
  name: hackathon-v3-vm
  machine_type: e2-medium
  vcpus: 2
  memory: 4GB
  os: Ubuntu 20.04 LTS
  disk: 10GB Standard persistent disk
  external_ip: 34.58.198.143
  internal_ip: 10.128.0.2

Network Configuration:
  vpc: default
  subnet: default (us-central1)
  firewall_rules:
    - allow_http: port 80
    - allow_https: port 443
    - custom_ports: [3000, 5000, 8088]
```

### Service Management

```bash
# PM2 Process Management
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Service Status Check
ps aux | grep callback-server
docker ps
docker-compose logs -f

# Manual Service Restart
pkill -f callback-server.js
cd ~/Hackathon-v3/navbar-app
NO_MONGO=1 nohup node callback-server.js > server.out 2>&1 &
```

## 🔍 Monitoring & Observability

### Health Check Endpoints

```javascript
// Application Health
GET /health
Response: { status: 'OK', port: 5000, mongo: true }

// Service Diagnostics  
GET /diag
Response: {
  now: "2025-09-21T05:32:40Z",
  pid: 12345,
  node: "v18.17.0",
  env: { PORT: 5000, SPA_BASE_URL: "...", ... }
}

// eSignet Services
GET http://34.58.198.143:8088/actuator/health
GET http://34.58.198.143:3000 (UI check)
GET http://34.58.198.143:5000/client-meta (callback server)
```

### Error Handling Strategy

```javascript
// Frontend Error Boundaries
<ErrorBoundary>
  <ESignetAuth />
</ErrorBoundary>

// Backend Error Responses
{
  error: "descriptive_error_code",
  details: "Human readable message",
  status: 400,
  timestamp: "2025-09-21T05:32:40Z"
}
```

## 🔒 Security Considerations

### Data Protection
- **Client-side encryption**: Photos compressed to <1MB, base64 encoded
- **Input validation**: Sanitized user inputs, type checking
- **Authentication tokens**: Short-lived (15 min) with auto-refresh
- **HTTPS enforcement**: Recommended for production deployment

### Privacy Compliance
- **Parental consent**: Required checkbox for data collection
- **Data minimization**: Only collect necessary health information
- **Right to erasure**: Local data can be cleared by user
- **Audit trail**: Track uploader information for accountability

## 🎯 Performance Optimizations

### Frontend Optimizations
- **Code splitting**: Dynamic imports for admin interface
- **Image compression**: Automatic resize to 512px max dimension
- **Bundle optimization**: Source maps disabled, fast refresh enabled
- **PWA features**: Service worker for offline functionality

### Backend Optimizations
- **Database indexing**: Optimized queries on healthId, uploaderSub, createdAt
- **Connection pooling**: Efficient MongoDB connection management
- **Batch processing**: Bulk operations for data uploads
- **Response caching**: Appropriate HTTP cache headers

## 📋 Future Enhancement Opportunities

### Scalability Improvements
1. **Microservices Architecture**: Separate auth, data, and reporting services
2. **Database Sharding**: Partition data by geographic region
3. **CDN Integration**: Faster asset delivery globally
4. **Load Balancing**: Multiple backend instances

### Feature Enhancements
1. **Real-time Sync**: WebSocket-based live updates
2. **Advanced Analytics**: ML-powered malnutrition prediction
3. **Mobile Apps**: Native iOS/Android applications
4. **Offline Maps**: Geographic data visualization

### Operational Improvements
1. **Automated Testing**: CI/CD pipeline with test coverage
2. **Infrastructure as Code**: Terraform/CloudFormation templates
3. **Centralized Logging**: ELK stack for log aggregation
4. **Performance Monitoring**: APM tools integration

## 📚 Technical Dependencies

### Core Dependencies
```json
{
  "react": "^18.2.0",
  "@mui/material": "^5.15.0",
  "dexie": "^4.2.0",
  "jspdf": "^3.0.2",
  "express": "^4.18.2",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.3.0",
  "node-rsa": "^1.1.1"
}
```

### Build & Dev Dependencies
```json
{
  "react-scripts": "5.0.1",
  "concurrently": "^8.2.2",
  "cors": "^2.8.5",
  "node-fetch": "^2.7.0"
}
```

## 🤝 Integration Points

### External Services
- **eSignet Authentication**: MOSIP ecosystem integration
- **Google Cloud Platform**: Infrastructure and hosting
- **MongoDB Atlas**: Database-as-a-Service option
- **Cloud Run**: Serverless backend deployment option

### API Compatibility
- **OAuth 2.0 Standard**: RFC 6749 compliant
- **REST API**: Standard HTTP methods and status codes
- **JSON Web Tokens**: RFC 7519 compliant JWT handling

---

## 📞 Support & Maintenance

### Documentation
- **README.md**: Quick start and deployment guide
- **API Documentation**: Endpoint specifications and examples
- **User Guide**: Field worker instructions
- **Admin Manual**: System administration procedures

### Version Control
- **Repository**: GitHub with feature branch workflow
- **Releases**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Change Log**: Documented in CHANGELOG.md

### Contact Information
- **Issues**: GitHub Issues for bug reports and feature requests
- **Documentation**: README and inline code comments
- **Community**: Contributing guidelines in CONTRIBUTING.md

---

**Last Updated**: September 28, 2025  
**Version**: 3.0.0  
**Status**: ✅ Production Ready

This architecture documentation provides a comprehensive overview of the ChildHealthBooklet application's technical design, implementation, and operational considerations. The system is designed to be robust, scalable, and maintainable while serving the critical need of child health data collection in challenging field conditions.