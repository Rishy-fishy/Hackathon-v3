# Mock e-Signet OIDC Authentication Setup Guide

## Overview

This project implements a complete mock e-Signet OIDC authentication flow with a React frontend and Express backend. The system simulates the entire OAuth 2.0/OpenID Connect flow including authorization, token exchange, and user profile retrieval.

## Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│                 │       │                  │       │                 │
│  React App      │◄─────►│  Mock Auth       │◄─────►│  e-Signet       │
│  (Port 3001)    │       │  Server          │       │  Plugin         │
│                 │       │  (Port 3002)     │       │  (Port 3000)    │
└─────────────────┘       └──────────────────┘       └─────────────────┘
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Docker (for e-Signet server) - already running in your setup
- Postman (optional, for API testing)

## Project Structure

```
navbar-app/
├── src/
│   ├── components/
│   │   ├── Header.js           # Main navigation with profile
│   │   ├── ESignetAuth.js      # e-Signet button component
│   │   ├── AuthCallback.js     # OAuth callback handler
│   │   └── Modal.js            # Modal for auth/profile
│   └── App.js                  # Main app with routing
├── public/
│   ├── sign-in-button-plugin.js  # e-Signet plugin
│   └── esignet-wrapper.js        # Custom element wrapper
├── mock-auth-server/
│   ├── server.js               # Mock OIDC server
│   └── package.json            # Server dependencies
└── Mock_eSignet_OIDC.postman_collection.json
```

## Installation & Setup

### Step 1: Install Dependencies

#### For the React App (already done):
```bash
cd navbar-app
npm install
```

#### For the Mock Auth Server:
```bash
cd mock-auth-server
npm install
```

### Step 2: Start the Mock Authentication Server

```bash
cd mock-auth-server
npm start
```

The server will run on `http://localhost:3002`

You should see:
```
Mock e-Signet server running on http://localhost:3002

Available endpoints:
  Authorization: http://localhost:3002/authorize
  Token:         http://localhost:3002/token
  UserInfo:      http://localhost:3002/userinfo
  Admin:         http://localhost:3002/admin/*
  Health:        http://localhost:3002/health
```

### Step 3: Start the React Application

In a new terminal:
```bash
cd navbar-app
npm start
```

The app will run on `http://localhost:3001`

## How to Use

### 1. Basic Authentication Flow

1. **Open the React App**: Navigate to `http://localhost:3001`
2. **Click Profile Icon**: Click the profile icon in the top-right corner
3. **Sign In**: Click the "Sign in with e-Signet" button
4. **Authorize**: You'll be redirected to the mock consent page
5. **Grant Access**: Click "Allow" to grant permissions
6. **View Profile**: You'll be redirected back and can view your profile

### 2. Customize User Data via Postman

Import the `Mock_eSignet_OIDC.postman_collection.json` file into Postman.

#### Available Endpoints:

##### Get Current User Data
```http
GET http://localhost:3002/admin/user
```

##### Update User Data
```http
POST http://localhost:3002/admin/user
Content-Type: application/json

{
  "name": "Your Name",
  "given_name": "Your",
  "family_name": "Name",
  "email": "your.email@example.com",
  "phone_number": "+1234567890",
  "birthdate": "1990-01-01",
  "gender": "male",
  "picture": "https://api.dicebear.com/7.x/avataaars/svg?seed=YourName",
  "address": {
    "formatted": "123 Street, City, Country",
    "street_address": "123 Street",
    "locality": "City",
    "region": "State",
    "postal_code": "12345",
    "country": "Country"
  }
}
```

##### Reset to Default User
```http
POST http://localhost:3002/admin/reset
```

### 3. Testing the Complete OIDC Flow Manually

#### Step 1: Authorization Request
Open in browser:
```
http://localhost:3002/authorize?client_id=mock-client-id&redirect_uri=http://localhost:3001/callback&response_type=code&scope=openid profile email phone address&state=test123
```

#### Step 2: Exchange Code for Tokens
After authorization, extract the `code` parameter from the redirect URL and:
```http
POST http://localhost:3002/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=YOUR_CODE&client_id=mock-client-id&redirect_uri=http://localhost:3001/callback
```

#### Step 3: Get User Info
Use the access token from step 2:
```http
GET http://localhost:3002/userinfo
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Configuration Details

### Client Configuration
- **Client ID**: `mock-client-id`
- **Redirect URI**: `http://localhost:3001/callback`
- **Authorization Endpoint**: `http://localhost:3002/authorize`
- **Token Endpoint**: `http://localhost:3002/token`
- **UserInfo Endpoint**: `http://localhost:3002/userinfo`

### Available Scopes
- `openid` - OpenID Connect authentication
- `profile` - Basic profile information
- `email` - Email address
- `phone` - Phone number
- `address` - Physical address

## User Data Schema

The mock server returns user data following the OpenID Connect standard claims:

```javascript
{
  "sub": "1234567890",              // Subject identifier
  "name": "John Doe",                // Full name
  "given_name": "John",              // First name
  "family_name": "Doe",              // Last name
  "email": "john.doe@example.com",  // Email address
  "email_verified": true,            // Email verification status
  "phone_number": "+1234567890",    // Phone number
  "phone_number_verified": true,    // Phone verification status
  "birthdate": "1990-01-01",        // Date of birth
  "gender": "male",                  // Gender
  "picture": "URL",                  // Profile picture URL
  "address": {                       // Address object
    "formatted": "Full address",
    "street_address": "Street",
    "locality": "City",
    "region": "State",
    "postal_code": "12345",
    "country": "Country"
  },
  "locale": "en-US",                 // Locale
  "updated_at": 1234567890           // Last update timestamp
}
```

## Security Notes

⚠️ **This is a MOCK authentication server for development purposes only!**

- No real authentication is performed
- Tokens are signed with a static secret
- No actual user validation occurs
- Authorization codes are stored in memory only
- All endpoints are open (no client authentication)

**DO NOT use this in production!**

## Troubleshooting

### Issue: "e-Signet script failed to load"
**Solution**: Ensure the e-Signet Docker container is running on port 3000

### Issue: "Failed to exchange authorization code"
**Solution**: Check that the mock auth server is running on port 3002

### Issue: Profile not showing after authentication
**Solution**: Clear browser localStorage and try again:
```javascript
localStorage.clear()
```

### Issue: Port already in use
**Solution**: Change the port in the respective package.json or server.js file

## Testing Workflow

1. **Start mock auth server** (port 3002)
2. **Start React app** (port 3001)
3. **Use Postman** to customize user data if needed
4. **Test authentication flow** through the UI
5. **Verify profile data** displays correctly
6. **Test logout** functionality

## API Flow Diagram

```
User clicks "Sign in with e-Signet"
            ↓
Browser redirects to /authorize
            ↓
User clicks "Allow" on consent page
            ↓
Redirect to /callback with code
            ↓
App exchanges code for tokens
            ↓
App fetches user info with token
            ↓
User profile displayed in modal
```

## Next Steps

To integrate with real e-Signet:

1. Replace mock server URLs with actual e-Signet endpoints
2. Configure proper client credentials
3. Implement proper token storage (consider using httpOnly cookies)
4. Add PKCE flow for enhanced security
5. Implement token refresh logic
6. Add proper error handling for production

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify all services are running on correct ports
3. Ensure Docker is running for e-Signet services
4. Check network tab in browser DevTools for API calls

## License

This is a development/mock implementation for testing purposes only.
