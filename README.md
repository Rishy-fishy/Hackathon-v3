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
│                         │    │   (34.58.198.143)           │
│  ┌─────────────────┐   │    │                              │
│  │ React App       │   │    │  ┌─────────────────────────┐ │
│  │ localhost:3001  │◄──┼────┼──┤ Callback Server :5000   │ │
│  └─────────────────┘   │    │  └─────────────────────────┘ │
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

### Installation Steps
1. **Clone Repository**:
   ```bash
   git clone https://github.com/Rishy-fishy/Hackathon-v3.git
   cd Hackathon-v3/navbar-app
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create `.env` file with:
   ```env
   GENERATE_SOURCEMAP=false
   ESLINT_NO_DEV_ERRORS=true
   SKIP_PREFLIGHT_CHECK=true
   FAST_REFRESH=true
   ```

4. **Start Development Server**:
   ```bash
   npm run start:fast
   ```

## 📝 Available Scripts

- `npm start` - Start development server (port 3001)
- `npm run start:fast` - Start with performance optimizations
- `npm run build` - Build production bundle
- `npm test` - Run test suite

## 🔧 Cloud Server Management

### SSH Access
```bash
gcloud compute ssh hackathon-v3-vm --zone=us-central1-a
```

### Service Management
```bash
# Check callback server status
ps aux | grep callback-server

# Restart callback server
pkill -f callback-server.js
cd ~/Hackathon-v3/navbar-app
NO_MONGO=1 nohup node callback-server.js > server.out 2>&1 &

# Check Docker services
docker ps
docker-compose logs -f
```

### Log Monitoring
```bash
# Callback server logs
tail -f ~/Hackathon-v3/navbar-app/server.out

# Docker compose logs
cd ~/Hackathon-v3/navbar-app/docker-compose
docker-compose logs -f
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
