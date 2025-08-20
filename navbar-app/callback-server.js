// Clean, de-duplicated callback server implementation
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const port = 5000;

// Convert JWK to PEM format
function jwkToPem(jwk) {
  try {
    // Use Node.js crypto to create PEM from JWK
    const keyObject = crypto.createPrivateKey({
      key: jwk,
      format: 'jwk'
    });
    
    return keyObject.export({
      format: 'pem',
      type: 'pkcs8'
    });
  } catch (error) {
    console.error('❌ Failed to convert JWK to PEM:', error.message);
    return null;
  }
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Load client configuration ONCE
let clientConfig;
try {
  clientConfig = JSON.parse(fs.readFileSync('./client-config.json', 'utf8'));
  // Standardize redirect URI to callback server (must match what was registered with eSignet)
  clientConfig.redirectUri = 'http://localhost:5000/callback';
  clientConfig.baseURL = clientConfig.baseURL || 'http://localhost:8088';
  console.log('✅ Client configuration loaded');
  console.log('📋 Client ID:', clientConfig.clientId);
  console.log('🔁 Using redirect URI:', clientConfig.redirectUri);
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
    iss: clientId || clientConfig.clientId,
    sub: clientId || clientConfig.clientId,
    aud: audience || `${clientConfig.baseURL}/v1/esignet/oauth/v2/token`,
    jti: jti,
    exp: now + 300, // 5 minutes from now
    iat: now
  };

  try {
    console.log('🔐 Creating JWT client assertion...');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    
    // Convert JWK to PEM format
    const privateKeyPem = jwkToPem(clientConfig.privateKey);
    if (!privateKeyPem) {
      throw new Error('Failed to convert private key to PEM format');
    }
    
    const token = jwt.sign(payload, privateKeyPem, { 
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
// Keep simple in-memory set of processed authorization codes to avoid repeated exchanges (dev only)
const processedCodes = new Set();

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
    if (processedCodes.has(code)) {
      console.log('🔁 Authorization code already processed, ignoring duplicate.');
      return res.redirect('http://localhost:3001/?authenticated=true');
    }

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
  redirect_uri: clientConfig.redirectUri,
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

    // Mark code processed (whether userinfo succeeds or not)
    processedCodes.add(code);

    // Helper: try decoding JWS (header.payload.signature)
    const tryDecodeJws = (input) => {
      if (typeof input !== 'string') return null;
      const parts = input.split('.');
      if (parts.length !== 3) return null;
      try {
        const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = payloadB64.length % 4 === 0 ? '' : '='.repeat(4 - (payloadB64.length % 4));
        const jsonStr = Buffer.from(payloadB64 + pad, 'base64').toString('utf8');
        return JSON.parse(jsonStr);
      } catch {
        return null;
      }
    };

    // Get user info (may be raw JSON or signed JWS per additionalConfig.userinfo_response_type)
    let userInfo = null;
    if (tokens.access_token) {
      try {
        const userResponse = await fetch('http://localhost:8088/v1/esignet/oidc/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });
        if (userResponse.ok) {
          const text = await userResponse.text();
            // Try JSON parse first
            try {
              userInfo = JSON.parse(text);
              console.log('✅ User info (JSON) received.');
            } catch {
              // Maybe JWS
              userInfo = tryDecodeJws(text);
              if (userInfo) {
                console.log('✅ User info (JWS decoded) received.');
              } else {
                console.warn('⚠️ User info neither JSON nor decodable JWS. Storing raw.');
                userInfo = { raw: text };
              }
            }
        } else {
          console.warn('⚠️ Failed to fetch user info, status:', userResponse.status);
        }
      } catch (userError) {
        console.warn('⚠️ User info request failed:', userError.message);
      }
    }

    // Build auth payload to forward to SPA origin (different port so we cannot rely on storage written here)
    const forwardPayload = {
      access_token: tokens.access_token || null,
      id_token: tokens.id_token || null,
      userInfo: userInfo || null
    };
    const forwardB64 = Buffer.from(JSON.stringify(forwardPayload)).toString('base64url');

    // Create success HTML page that immediately redirects with base64 payload (auth_payload) to React app
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
              console.log('Preparing redirect with encoded auth payload...');
              const target = 'http://localhost:3001/?auth_payload=${forwardB64}&authenticated=true';
              // small delay so user sees success state briefly
              setTimeout(()=>{ window.location.replace(target); }, 600);
              
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

// Exchange authorization code for tokens using proper JWT client assertion
app.post('/exchange-token', async (req, res) => {
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('🔄 Processing token exchange for code:', code);

    // Generate JWT client assertion
    const clientAssertion = generateClientAssertion(clientConfig.clientId, `${clientConfig.baseURL}/v1/esignet/oauth/v2/token`);
    
    if (!clientAssertion) {
      return res.status(500).json({ error: 'Failed to generate client assertion' });
    }
    
    // Exchange code for tokens with proper client_id
    const tokenResponse = await fetch(`${clientConfig.baseURL}/v1/esignet/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
  client_id: clientConfig.clientId,
  code: code,
  redirect_uri: clientConfig.redirectUri,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText);
      return res.status(400).json({ 
        error: 'Token exchange failed', 
        details: errorText,
        status: tokenResponse.status 
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Tokens received:', tokenData);

    // Get user info using the access token
    console.log('🔄 Fetching user information...');
    
    const userInfoResponse = await fetch(`${clientConfig.baseURL}/v1/esignet/oidc/userinfo`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      console.error('❌ UserInfo fetch failed:', userInfoResponse.status, errorText);
      return res.status(400).json({ 
        error: 'Failed to fetch user info', 
        details: errorText,
        status: userInfoResponse.status,
        access_token: tokenData.access_token 
      });
    }

    const userInfo = await userInfoResponse.json();
    console.log('✅ User info received:', userInfo);

    // Return both tokens and user info
    res.json({
      access_token: tokenData.access_token,
      id_token: tokenData.id_token,
      refresh_token: tokenData.refresh_token,
      userInfo: userInfo,
      success: true
    });

  } catch (error) {
    console.error('❌ Token exchange error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', port: port });
});

// Public client metadata (safe subset) for front-end to discover current clientId
app.get('/client-meta', (req, res) => {
  res.json({
    clientId: clientConfig.clientId,
    authorizeUri: 'http://localhost:3000/authorize',
    redirect_uri: clientConfig.redirectUri
  });
});

// Simple delegate style endpoint (GET) to mimic workshop example
// Usage: /delegate/fetchUserInfo?code=AUTH_CODE
app.get('/delegate/fetchUserInfo', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'missing_code' });
  try {
    const clientAssertion = generateClientAssertion(clientConfig.clientId, `${clientConfig.baseURL}/v1/esignet/oauth/v2/token`);
    if (!clientAssertion) return res.status(500).json({ error: 'assertion_failed' });

    const tokenResp = await fetch(`${clientConfig.baseURL}/v1/esignet/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: clientConfig.redirectUri,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion,
        client_id: clientConfig.clientId
      })
    });
    const tokenJson = await tokenResp.json().catch(()=>({}));
    if (!tokenResp.ok) return res.status(tokenResp.status).json({ error: 'token_exchange_failed', details: tokenJson });
    const accessToken = tokenJson.access_token;
    if (!accessToken) return res.status(400).json({ error: 'no_access_token', details: tokenJson });
    const uiResp = await fetch(`${clientConfig.baseURL}/v1/esignet/oidc/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const userInfo = await uiResp.json().catch(()=>({}));
    if (!uiResp.ok) return res.status(uiResp.status).json({ error: 'userinfo_failed', details: userInfo, access_token: accessToken });
    res.json({ ...userInfo, access_token: accessToken });
  } catch (e) {
    res.status(500).json({ error: 'delegate_internal_error', message: e.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Callback server running on http://localhost:${port}`);
  console.log(`📝 Callback URL: http://localhost:${port}/callback`);
});
