const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3002;

// Secret key for JWT signing
const JWT_SECRET = 'mock-esignet-secret-key-2024';

// Enable CORS for all origins
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage for mock data
let users = {};
let authorizationCodes = {};
let accessTokens = {};

// Default mock user data
const defaultUser = {
  sub: "1234567890",
  name: "John Doe",
  given_name: "John",
  family_name: "Doe",
  email: "john.doe@example.com",
  email_verified: true,
  phone_number: "+1234567890",
  phone_number_verified: true,
  birthdate: "1990-01-01",
  gender: "male",
  picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=John",
  address: {
    formatted: "123 Main St, Anytown, USA 12345",
    street_address: "123 Main St",
    locality: "Anytown",
    region: "State",
    postal_code: "12345",
    country: "USA"
  },
  locale: "en-US",
  updated_at: Date.now()
};

// Set current user to default
let currentUser = { ...defaultUser };

// Store session data
let sessions = {};

// Authorization page - Step 1: Login page
app.get('/authorize', (req, res) => {
  const { 
    client_id, 
    redirect_uri, 
    response_type, 
    scope, 
    state,
    nonce 
  } = req.query;

  // Validate required parameters
  if (!client_id || !redirect_uri || !response_type || !scope) {
    return res.status(400).json({ 
      error: 'invalid_request',
      error_description: 'Missing required parameters' 
    });
  }

  // Create session
  const sessionId = uuidv4();
  sessions[sessionId] = {
    client_id,
    redirect_uri,
    scope,
    state,
    nonce,
    step: 'login'
  };

  // Send HTML consent page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mock e-Signet Authorization</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }
        .container {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 450px;
          width: 90%;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          width: 60px;
          height: 60px;
          background: #ff6b35;
          border-radius: 12px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          color: white;
          font-weight: bold;
        }
        h1 {
          color: #333;
          font-size: 24px;
          margin: 0 0 10px;
        }
        .subtitle {
          color: #666;
          font-size: 14px;
        }
        .app-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 25px;
        }
        .app-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
        }
        .permissions {
          margin-top: 20px;
        }
        .permission-header {
          font-weight: 600;
          color: #333;
          margin-bottom: 15px;
          font-size: 14px;
        }
        .permission-item {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          color: #555;
          font-size: 14px;
        }
        .permission-item::before {
          content: "✓";
          color: #4CAF50;
          margin-right: 10px;
          font-weight: bold;
        }
        .user-info {
          display: flex;
          align-items: center;
          margin-bottom: 25px;
          padding: 15px;
          background: #f0f4f8;
          border-radius: 8px;
        }
        .user-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          margin-right: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 20px;
        }
        .user-details {
          flex: 1;
        }
        .user-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }
        .user-email {
          color: #666;
          font-size: 14px;
        }
        .button-group {
          display: flex;
          gap: 10px;
        }
        button {
          flex: 1;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .allow-btn {
          background: #ff6b35;
          color: white;
        }
        .allow-btn:hover {
          background: #e85a2a;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
        }
        .cancel-btn {
          background: #e0e0e0;
          color: #333;
        }
        .cancel-btn:hover {
          background: #d0d0d0;
        }
        .notice {
          margin-top: 20px;
          padding: 15px;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
          color: #856404;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">eS</div>
          <h1>Mock e-Signet Authorization</h1>
          <div class="subtitle">Sign in to continue</div>
        </div>

        <div class="user-info">
          <div class="user-avatar">${currentUser.given_name.charAt(0)}${currentUser.family_name.charAt(0)}</div>
          <div class="user-details">
            <div class="user-name">${currentUser.name}</div>
            <div class="user-email">${currentUser.email}</div>
          </div>
        </div>

        <div class="app-info">
          <div class="app-name">MyApp is requesting access to:</div>
          <div class="permissions">
            <div class="permission-header">This app will be able to:</div>
            <div class="permission-item">View your basic profile information</div>
            <div class="permission-item">Access your email address</div>
            <div class="permission-item">Access your phone number</div>
            <div class="permission-item">View your birthdate and gender</div>
            <div class="permission-item">Access your address information</div>
          </div>
        </div>

        <div class="button-group">
          <button class="allow-btn" onclick="authorize()">Allow</button>
          <button class="cancel-btn" onclick="cancel()">Cancel</button>
        </div>

        <div class="notice">
          <strong>Note:</strong> This is a mock authentication server for development purposes only. 
          By clicking "Allow", you'll be redirected back to the application with mock user data.
        </div>
      </div>

      <script>
        function authorize() {
          // Redirect back with authorization code
          const redirectUrl = '${redirect_uri}?code=${code}&state=${state || ''}';
          window.location.href = redirectUrl;
        }

        function cancel() {
          // Redirect back with error
          const redirectUrl = '${redirect_uri}?error=access_denied&state=${state || ''}';
          window.location.href = redirectUrl;
        }
      </script>
    </body>
    </html>
  `);
});

// Token endpoint
app.post('/token', (req, res) => {
  const { grant_type, code, client_id, redirect_uri } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ 
      error: 'unsupported_grant_type' 
    });
  }

  // Validate authorization code
  const authCode = authorizationCodes[code];
  if (!authCode) {
    return res.status(400).json({ 
      error: 'invalid_grant',
      error_description: 'Invalid authorization code' 
    });
  }

  // Check if code is expired
  if (Date.now() > authCode.expires_at) {
    delete authorizationCodes[code];
    return res.status(400).json({ 
      error: 'invalid_grant',
      error_description: 'Authorization code expired' 
    });
  }

  // Validate client_id and redirect_uri
  if (authCode.client_id !== client_id || authCode.redirect_uri !== redirect_uri) {
    return res.status(400).json({ 
      error: 'invalid_grant',
      error_description: 'Invalid client or redirect URI' 
    });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { 
      sub: authCode.user.sub,
      scope: authCode.scope,
      client_id: client_id
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const idToken = jwt.sign(
    {
      ...authCode.user,
      aud: client_id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: authCode.nonce
    },
    JWT_SECRET
  );

  // Store access token for userinfo endpoint
  accessTokens[accessToken] = authCode.user;

  // Clean up used authorization code
  delete authorizationCodes[code];

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    id_token: idToken,
    scope: authCode.scope
  });
});

// UserInfo endpoint
app.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'invalid_token',
      error_description: 'Missing or invalid authorization header' 
    });
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user data associated with this token
    const user = accessTokens[token];
    
    if (!user) {
      return res.status(401).json({ 
        error: 'invalid_token',
        error_description: 'Token not found' 
      });
    }

    res.json(user);
  } catch (err) {
    return res.status(401).json({ 
      error: 'invalid_token',
      error_description: 'Invalid or expired token' 
    });
  }
});

// Admin endpoint to update mock user data
app.post('/admin/user', (req, res) => {
  currentUser = { ...defaultUser, ...req.body };
  res.json({
    message: 'User data updated successfully',
    user: currentUser
  });
});

// Admin endpoint to get current user data
app.get('/admin/user', (req, res) => {
  res.json(currentUser);
});

// Admin endpoint to reset to default user
app.post('/admin/reset', (req, res) => {
  currentUser = { ...defaultUser };
  authorizationCodes = {};
  accessTokens = {};
  res.json({
    message: 'Server reset to defaults',
    user: currentUser
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'Mock e-Signet Server',
    endpoints: {
      authorize: `http://localhost:${PORT}/authorize`,
      token: `http://localhost:${PORT}/token`,
      userinfo: `http://localhost:${PORT}/userinfo`,
      admin_update_user: `http://localhost:${PORT}/admin/user`,
      admin_get_user: `http://localhost:${PORT}/admin/user`,
      admin_reset: `http://localhost:${PORT}/admin/reset`
    }
  });
});

app.listen(PORT, () => {
  console.log(`Mock e-Signet server running on http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  Authorization: http://localhost:${PORT}/authorize`);
  console.log(`  Token:         http://localhost:${PORT}/token`);
  console.log(`  UserInfo:      http://localhost:${PORT}/userinfo`);
  console.log(`  Admin:         http://localhost:${PORT}/admin/*`);
  console.log(`  Health:        http://localhost:${PORT}/health`);
});
