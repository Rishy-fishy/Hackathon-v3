# Hackathon-v3 - eSignet Authentication System

## 🌟 Project Overview

This project implements an eSignet-based authentication system with a React frontend and Node.js callback server. The system is deployed on Google Cloud Platform and provides secure OAuth 2.0 authentication flow with voluntary claims sharing.

## ☁️ Cloud Deployment Details

### Google Cloud Platform Configuration
- **Project ID**: `hackathon-v3-docker`
- **Project Name**: Hackathon v3 Docker
- **Region**: `us-central1`
- **Zone**: `us-central1-a`

### Compute Engine Instance
- **Instance Name**: `hackathon-v3-vm`
- **Machine Type**: e2-medium (2 vCPU, 4 GB memory)
- **Operating System**: Ubuntu 20.04 LTS
- **External IP**: `34.58.198.143`
- **Internal IP**: `10.128.0.2`
- **Boot Disk**: 10 GB Standard persistent disk

### Network Configuration
- **VPC Network**: default
- **Subnet**: default (us-central1)
- **Firewall Rules**: 
  - Allow HTTP traffic (port 80)
  - Allow HTTPS traffic (port 443)
  - Custom rules for ports 3000, 5000, 8088

## 🚀 Deployed Services

### 1. eSignet Backend Service
- **URL**: `http://34.58.198.143:8088`
- **Purpose**: OAuth 2.0 authorization server
- **Technology**: Java Spring Boot
- **Database**: PostgreSQL
- **Status**: ✅ Running

### 2. eSignet UI Service
- **URL**: `http://34.58.198.143:3000`
- **Purpose**: Authentication user interface
- **Technology**: React/Angular frontend
- **Status**: ✅ Running

### 3. Callback Server
- **URL**: `http://34.58.198.143:5000`
- **Purpose**: OAuth callback handler and token exchange
- **Technology**: Node.js + Express
- **Client ID**: `08d8YsjGpeo6kOfoVZYJsMpHGZy1vVOai1Njz8AzZk8`
- **Status**: ✅ Running

### 4. Supporting Services
- **PostgreSQL Database**: Port 5432 (internal)
- **Redis Cache**: Port 6379 (internal)
- **Mock Identity System**: Port 8082 (internal)

## 🏗️ Architecture

```
┌─────────────────────────┐    ┌──────────────────────────────┐
│   Local Development     │    │      Google Cloud VM         │
│                         │    │   (34.58.198.143)            │
│  ┌─────────────────┐    │    │                              │
│  │ React App       │    │    │  ┌─────────────────────────┐ │
│  │ localhost:3001  │◄── ┼────┼──┤ Callback Server :5000   │ │
│  └─────────────────┘    │    │  └─────────────────────────┘ │
│                         │    │                              │
└─────────────────────────┘    │  ┌─────────────────────────┐ │
                               │  │ eSignet UI :3000        │ │
                               │  └─────────────────────────┘ │
                               │                              │
                               │  ┌─────────────────────────┐ │
                               │  │ eSignet Backend :8088   │ │
                               │  └─────────────────────────┘ │
                               │                              │
                               │  ┌─────────────────────────┐ │
                               │  │ PostgreSQL :5432        │ │
                               │  │ Redis :6379             │ │
                               │  │ Mock Identity :8082     │ │
                               │  └─────────────────────────┘ │
                               └──────────────────────────────┘
```

## 🔐 Authentication Flow

1. **User Login**: User accesses local React app at `http://localhost:3001`
2. **Authorization Request**: App redirects to `http://34.58.198.143:3000/authorize`
3. **User Authentication**: User completes authentication on eSignet UI
4. **Authorization Code**: eSignet redirects to `http://34.58.198.143:5000/callback`
5. **Token Exchange**: Callback server exchanges code for access tokens
6. **User Data**: Server retrieves user profile and voluntary claims
7. **Final Redirect**: User redirected back to `http://localhost:3001` with profile data

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Git for version control

> **📌 Important Note:** 
> The **Backend API** and **Callback Server** are already deployed and running on Google Cloud Platform.
> For local development, you only need to run the **React Frontend**.
> 
> - Backend API: `https://navbar-backend-clean-87485236346.us-central1.run.app`
> - Callback Server: `http://34.58.198.143:5000`
> - eSignet Services: `http://34.58.198.143:8088` and `http://34.58.198.143:3000`

### Quick Start (Frontend Only)

#### 1. Clone Repository
```bash
git clone https://github.com/Rishy-fishy/Hackathon-v3.git
cd Hackathon-v3
```

#### 2. Install Frontend Dependencies
```bash
cd navbar-app
npm install
```

#### 3. Start React Frontend
```bash
npm start
# App opens at http://localhost:3001
```

That's it! Your frontend will connect to the cloud-hosted backend services automatically.

---

### Full Stack Development (Optional - If Running Backend Locally)

> **⚠️ Only needed if you want to run the entire stack locally for development/testing**

#### 1. Clone Repository
```bash
git clone https://github.com/Rishy-fishy/Hackathon-v3.git
cd Hackathon-v3
```

#### 2. Install All Dependencies
```bash
# Frontend
cd navbar-app
npm install

# Backend
cd backend
npm install
```

#### 4. Configure Environment Variables

**Frontend (.env in navbar-app/):**
```env
GENERATE_SOURCEMAP=false
ESLINT_NO_DEV_ERRORS=true
SKIP_PREFLIGHT_CHECK=true
FAST_REFRESH=true
# Backend API is already running on Google Cloud - no need to change this
REACT_APP_API_BASE=https://navbar-backend-clean-87485236346.us-central1.run.app
```

**Backend (.env in navbar-app/backend/) - ONLY IF RUNNING LOCALLY:**
```env
MONGO_URI=mongodb+srv://harshbontala188:8I52Oqeh3sWYTDJ7@cluster0.5lsiap2.mongodb.net/childBooklet?retryWrites=true&w=majority&appName=Cluster0
MONGO_DB=childBooklet
PORT=8080
ADMIN_JWT_SECRET=your-secret-key-here
ADMIN_USERNAME=Admin
ADMIN_PASSWORD_HASH=$2b$10$qLkUZJhrTncH0VMlJhmvGOji9VfmYZZkY0wRLo8GYENzHp229R8iy
```

**Callback Server - ONLY IF RUNNING LOCALLY:**
```bash
export MONGO_URI="mongodb+srv://harshbontala188:8I52Oqeh3sWYTDJ7@cluster0.5lsiap2.mongodb.net/childBooklet?retryWrites=true&w=majority&appName=Cluster0"
export MONGO_DB="nutrition_app"
export PORT=5000
```

#### 5. Start Services

**For Normal Development (Recommended):**
```bash
# Only start the React Frontend
cd navbar-app
npm start
# App opens at http://localhost:3001
# It will automatically connect to cloud-hosted backend
```

**For Full Local Stack (Advanced):**

Terminal 1 - Backend API:
```bash
cd navbar-app/backend
npm start
# Server runs on http://localhost:8080
# Update REACT_APP_API_BASE to http://localhost:8080 in .env
```

Terminal 2 - Callback Server:
```bash
cd navbar-app
node callback-server.js
# Server runs on http://localhost:5000
```

Terminal 3 - React Frontend:
```bash
cd navbar-app
npm start
# App opens at http://localhost:3001
```

### Production Build

```bash
# Build the React app
cd navbar-app
npm run build

# Serve the production build
npx serve -s build -p 3001

# Start backend in production mode
cd backend
npm start

# Start callback server in background
nohup node callback-server.js > server.out 2>&1 &
```

## 📝 Available Scripts

### Frontend (navbar-app/)
- `npm start` - Start development server (port 3001) - **This is all you need for local development!**
- `npm run start:fast` - Start with performance optimizations
- `npm run build` - Build production bundle
- `npm test` - Run test suite
- `npm run eject` - Eject from Create React App (irreversible)

### Backend (navbar-app/backend/) - **Already Running on Google Cloud**
> ℹ️ The backend is deployed at: `https://navbar-backend-clean-87485236346.us-central1.run.app`
> 
> Local execution only needed for backend development:
- `npm start` - Start production server (port 8080)
- `npm run dev` - Start with auto-reload using nodemon
- `npm test` - Run tests (if configured)

### Callback Server (navbar-app/) - **Already Running on Google Cloud**
> ℹ️ The callback server is deployed at: `http://34.58.198.143:5000`
> 
> Local execution only needed for OAuth flow testing:
- `node callback-server.js` - Start callback server (port 5000)
- MongoDB connection required for full functionality

## 🔧 Cloud Server Management

### SSH Access
```bash
# Using gcloud CLI
gcloud compute ssh hackathon-v3-vm --zone=us-central1-a

# Or specify project
gcloud compute ssh hackathon-v3-vm --project=hackathon-v3-docker --zone=us-central1-a
```

### Callback Server Management

**Check Status:**
```bash
ps aux | grep callback-server
# or
ps aux | grep "node callback"
```

**Start Callback Server:**
```bash
# Navigate to app directory
cd /home/Harsh/Hackathon-v3/navbar-app

# Start in foreground (for testing)
node callback-server.js

# Start in background (production)
nohup node callback-server.js > server.out 2>&1 &

# Start with MongoDB connection
export MONGO_URI=$(cat /home/Harsh/Hackathon-v3/mongo-uri.txt)
export MONGO_DB=nutrition_app
nohup node callback-server.js > server.out 2>&1 &
```

**Restart Callback Server:**
```bash
# Kill existing process
pkill -f callback-server.js
# or
sudo pkill -f "node callback-server"

# Wait a moment
sleep 2

# Start again
cd /home/Harsh/Hackathon-v3/navbar-app
nohup node callback-server.js > server.out 2>&1 &
```

**View Logs:**
```bash
# Real-time logs
tail -f /home/Harsh/Hackathon-v3/navbar-app/server.out

# Last 50 lines
tail -50 /home/Harsh/Hackathon-v3/navbar-app/server.out

# View with sudo if permission denied
sudo tail -f /home/Harsh/Hackathon-v3/navbar-app/server.out
```

### Docker Services Management

**Check Docker Status:**
```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Check specific container logs
docker logs docker-compose-esignet-1
docker logs docker-compose-esignet-ui-1
```

**Start/Stop Services:**
```bash
# Navigate to docker-compose directory
cd ~/Hackathon-v3/navbar-app/docker-compose

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart specific service
docker-compose restart esignet

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f esignet
```

**Service Health Checks:**
```bash
# eSignet backend health
curl http://localhost:8088/actuator/health

# eSignet UI
curl http://localhost:3000

# Callback server
curl http://localhost:5000/health
curl http://localhost:5000/client-meta
```

## 🔍 Troubleshooting

### Common Issues

1. **Callback Server Not Responding**
   - Check if process is running: `ps aux | grep callback-server`
   - Restart server: See service management commands above

2. **eSignet Services Down**
   - Check Docker containers: `docker ps`
   - Restart services: `docker-compose up -d`

3. **Authentication Redirects Failing**
   - Verify client configuration in `client-config.json`
   - Check redirect URIs match cloud IP addresses

### Health Check URLs
- eSignet UI: `http://34.58.198.143:3000`
- eSignet Backend: `http://34.58.198.143:8088/actuator/health`
- Callback Server: `http://34.58.198.143:5000/client-meta`

## 🔐 Security Considerations

- **HTTPS**: Consider enabling SSL certificates for production
- **Firewall**: Restrict access to necessary ports only
- **Authentication**: Client uses private_key_jwt authentication method
- **Keys**: RSA keys stored securely in client-config.json

## 📊 Monitoring & Maintenance

### Regular Checks
- Monitor VM resource usage in Google Cloud Console
- Check application logs for errors
- Verify SSL certificate expiration (when implemented)
- Review authentication success rates

### Backup Strategy
- Client configuration files backed up locally
- Database backups via PostgreSQL dumps
- Code repository maintained in GitHub

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📞 Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/Rishy-fishy/Hackathon-v3/issues)
- **Documentation**: Check this README and inline code comments

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Last Updated**: September 12, 2025
**Version**: 3.0.0
**Status**: ✅ Production Ready
