const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8888;

// Enable CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load client configuration
let clientConfig;
try {
  const configPath = path.join(__dirname, 'client-config.json');
  clientConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('✅ Client configuration loaded');
  console.log('📋 Client ID:', clientConfig.clientId);
} catch (error) {
  console.error('❌ Failed to load client configuration:', error.message);
  process.exit(1);
}

// Convert JWK to PEM format
function jwkToPem(jwk) {
  const crypto = require('crypto');
  try {
    // Create a KeyObject from the JWK
    const keyObject = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
    // Export as PEM format
    return keyObject.export({ type: 'pkcs8', format: 'pem' });
  } catch (error) {
    console.error('❌ JWK to PEM conversion failed:', error.message);
    // Fallback: try to use the private key directly from the JWK
    if (typeof jwk === 'object' && jwk.privateKey) {
      return jwk.privateKey;
    }
    throw error;
  }
}

// Generate JWT client assertion
function generateClientAssertion(clientId, tokenUrl) {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: tokenUrl,
    jti: `${Date.now()}-${Math.random()}`,
    exp: now + 300, // 5 minutes
    iat: now,
    nbf: now
  };

  try {
    console.log('🔐 Creating JWT client assertion...');
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));
    
    // Try different approaches to get the private key
    let privateKey;
    
    if (typeof clientConfig.privateKey === 'string') {
      // If it's already a PEM string
      privateKey = clientConfig.privateKey;
      console.log('✅ Using private key as PEM string');
    } else if (typeof clientConfig.privateKey === 'object') {
      // If it's a JWK object, convert to PEM
      try {
        privateKey = jwkToPem(clientConfig.privateKey);
        console.log('✅ Converted JWK to PEM format');
      } catch (conversionError) {
        console.log('⚠️ JWK conversion failed, trying direct usage');
        // Try using the JWK directly with the JWT library
        const token = jwt.sign(payload, clientConfig.privateKey, { 
          algorithm: 'RS256',
          header: { 
            alg: 'RS256', 
            typ: 'JWT' 
          },
          keyid: clientConfig.privateKey.kid
        });
        console.log('✅ JWT client assertion created using JWK directly');
        return token;
      }
    }
    
    const token = jwt.sign(payload, privateKey, { 
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
    console.error('❌ Private key type:', typeof clientConfig.privateKey);
    console.error('❌ Private key preview:', JSON.stringify(clientConfig.privateKey).substring(0, 100) + '...');
    return null;
  }
}

// Delegate endpoint to fetch user info
app.get('/delegate/fetchUserInfo', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('🔄 Processing user info request for code:', code);

    const baseURL = 'http://localhost:8088';
    const tokenUrl = `${baseURL}/v1/esignet/oauth/v2/token`;
    
    // Generate JWT client assertion
    const clientAssertion = generateClientAssertion(clientConfig.clientId, tokenUrl);
    
    if (!clientAssertion) {
      return res.status(500).json({ error: 'Failed to generate client assertion' });
    }
    
    // Exchange code for tokens
    const tokenResponse = await fetch(tokenUrl, {
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
    
    const userInfoResponse = await fetch(`${baseURL}/v1/esignet/oidc/userinfo`, {
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

    // Return user info directly (like your Python approach)
    res.json(userInfo);

  } catch (error) {
    console.error('❌ Delegate service error:', error);
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

app.listen(port, () => {
  console.log(`✅ Delegate service running on http://localhost:${port}`);
  console.log(`📝 Endpoint: http://localhost:${port}/delegate/fetchUserInfo?code=<authCode>`);
});
