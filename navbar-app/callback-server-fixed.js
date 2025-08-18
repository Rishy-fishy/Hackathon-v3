const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const port = 5000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Load client configuration
let clientConfig;
try {
  clientConfig = JSON.parse(fs.readFileSync('./client-config.json', 'utf8'));
  console.log('✅ Client configuration loaded');
  console.log('📋 Client ID:', clientConfig.clientId);
} catch (error) {
  console.error('❌ Failed to load client configuration:', error.message);
  console.log('💡 Run "node create-client.js" to generate a new client configuration');
  process.exit(1);
}

// Create client assertion JWT for OAuth token exchange
function generateClientAssertion(clientId, audience) {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomBytes(16).toString('hex');
  
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: audience,
    jti: jti,
    exp: now + 300, // 5 minutes from now
    iat: now
  };

  try {
    console.log('🔐 Creating JWT client assertion...');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    
    const token = jwt.sign(payload, clientConfig.privateKey, { 
      algorithm: 'RS256',
      header: { 
        alg: 'RS256', 
        typ: 'JWT' 
      }
    });
    
    console.log('✅ JWT client assertion created successfully');
    return token;
  } catch (error) {
    console.error('❌ JWT signing failed:', error.message);
    return null;
  }
}

// Serve static HTML for callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  console.log('📨 Callback received:', { code: code ? 'present' : 'missing', state, error });

  if (error) {
    console.error('❌ Authentication error:', error);
    return res.redirect(`http://localhost:3001/callback?error=${encodeURIComponent(error)}&state=${encodeURIComponent(state || '')}`);
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return res.redirect(`http://localhost:3001/callback?error=no_code`);
  }

  try {
    // Exchange authorization code for tokens
    console.log('🔄 Exchanging authorization code for tokens...');
    
    const clientId = clientConfig.clientId;
    const tokenEndpoint = 'http://localhost:8088/v1/esignet/oauth/v2/token';
    
    // Generate JWT client assertion
    const clientAssertion = generateClientAssertion(clientId, tokenEndpoint);
    
    if (!clientAssertion) {
      console.error('❌ Failed to generate client assertion');
      throw new Error('Client assertion generation failed');
    }
    
    console.log('🔐 Using JWT client assertion for authentication');
    console.log('📋 Client ID:', clientId);
    console.log('📋 Token endpoint:', tokenEndpoint);
    
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'http://localhost:5000/callback',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
      
      // Create error HTML page
      const errorHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Authentication Failed</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
              .error { color: #dc3545; }
              .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #dc3545; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="spinner"></div>
            <h2 class="error">❌ Login Failed</h2>
            <p>Authentication failed. Please try again.</p>
            <script>
              // Clean up any stored data
              localStorage.removeItem('access_token');
              localStorage.removeItem('id_token');
              localStorage.removeItem('user_info');
              localStorage.removeItem('is_authenticated');
              localStorage.removeItem('auth_timestamp');
              localStorage.removeItem('auth_method');
              
              // Redirect back to app
              setTimeout(() => {
                window.location.href = 'http://localhost:3001/';
              }, 2000);
            </script>
        </body>
        </html>
      `;
      
      return res.send(errorHtml);
    }

    const tokens = await tokenResponse.json();
    console.log('✅ Tokens received:', { access_token: tokens.access_token ? 'present' : 'missing' });

    // Get user info if we have access token
    let userInfo = null;
    if (tokens.access_token) {
      try {
        const userResponse = await fetch('http://localhost:8088/v1/esignet/oidc/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        });

        if (userResponse.ok) {
          userInfo = await userResponse.json();
          console.log('✅ User info received:', userInfo.name || userInfo.sub);
        } else {
          console.warn('⚠️ Failed to fetch user info');
        }
      } catch (userError) {
        console.warn('⚠️ User info request failed:', userError.message);
      }
    }

    // Create success HTML page that will store data and redirect
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Authentication Success</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
            .success { color: #28a745; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
      </head>
      <body>
          <div class="spinner"></div>
          <h2 class="success">✅ Authentication Successful!</h2>
          <p>Storing your profile information...</p>
          <script>
            try {
              // Store authentication data in localStorage
              localStorage.setItem('access_token', ${JSON.stringify(tokens.access_token || '')});
              ${tokens.id_token ? `localStorage.setItem('id_token', ${JSON.stringify(tokens.id_token)});` : ''}
              ${userInfo ? `localStorage.setItem('user_info', ${JSON.stringify(JSON.stringify(userInfo))});` : ''}
              localStorage.setItem('is_authenticated', 'true');
              localStorage.setItem('auth_timestamp', Date.now().toString());
              localStorage.setItem('auth_method', 'esignet');
              
              console.log('✅ Authentication data stored successfully');
              
              // Redirect to React app
              setTimeout(() => {
                window.location.href = 'http://localhost:3001/?authenticated=true';
              }, 1500);
              
            } catch (error) {
              console.error('❌ Error storing authentication data:', error);
              // Fallback redirect with code for React app to handle
              window.location.href = 'http://localhost:3001/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}';
            }
          </script>
      </body>
      </html>
    `;

    res.send(html);

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    
    // Create error HTML page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
            .error { color: #dc3545; }
            .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #dc3545; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
      </head>
      <body>
          <div class="spinner"></div>
          <h2 class="error">❌ Login Failed</h2>
          <p>Authentication error occurred. Please try again.</p>
          <script>
            // Clean up any stored data
            localStorage.removeItem('access_token');
            localStorage.removeItem('id_token');
            localStorage.removeItem('user_info');
            localStorage.removeItem('is_authenticated');
            localStorage.removeItem('auth_timestamp');
            localStorage.removeItem('auth_method');
            
            // Redirect back to app
            setTimeout(() => {
              window.location.href = 'http://localhost:3001/';
            }, 2000);
          </script>
      </body>
      </html>
    `;
    
    res.send(errorHtml);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: port });
});

app.listen(port, () => {
  console.log(`✅ Callback server running on http://localhost:${port}`);
  console.log(`📝 Callback URL: http://localhost:${port}/callback`);
});
