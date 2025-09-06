// Clean, de-duplicated callback server implementation
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const PDFDocument = require('pdfkit');

const app = express();
const port = 5000;

// ---- MongoDB Setup (simple singleton connection) ----
// Environment variables or fallbacks
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGO_DB || 'nutrition_app';
let mongoClient; // will hold connected client
let mongoDb; // db instance

async function initMongo() {
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGO_DB);
    console.log(`✅ Connected to MongoDB at ${MONGO_URI} db=${MONGO_DB}`);
    // Create indexes (idempotent)
    const col = mongoDb.collection('child_records');
    await col.createIndex({ healthId: 1 }, { unique: true });
    await col.createIndex({ uploaderSub: 1 });
    await col.createIndex({ createdAt: -1 });
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
  return mongoDb;
}

// Obtain a usable private key in PEM form from config (accepts PEM string or JWK object)
function getPrivateKeyPem(keyFromConfig) {
  try {
    if (!keyFromConfig) throw new Error('No private key provided');
    // Case 1: Already a PEM string
    if (typeof keyFromConfig === 'string' && keyFromConfig.includes('BEGIN PRIVATE KEY')) {
      return keyFromConfig; // pass-through
    }
    // Case 2: JWK object (Node >=15 can import directly)
    if (typeof keyFromConfig === 'object' && keyFromConfig.kty === 'RSA') {
      const keyObject = crypto.createPrivateKey({ key: keyFromConfig, format: 'jwk' });
      return keyObject.export({ format: 'pem', type: 'pkcs8' });
    }
    throw new Error('Unsupported private key format');
  } catch (error) {
    console.error('❌ Private key processing failed:', error.message);
    return null;
  }
}

// Enable CORS for all routes
app.use(cors());
app.use(express.json());
// Increase payload limit for potential base64 photos
app.use(express.json({ limit: '5mb' }));

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
    
  // Get PEM private key (supports PEM string or JWK)
  const privateKeyPem = getPrivateKeyPem(clientConfig.privateKey);
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
  const tokenEndpoint = `${clientConfig.baseURL}/v1/esignet/oauth/v2/token`;
    
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
    client_id: clientId,
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
    const userResponse = await fetch(`${clientConfig.baseURL}/v1/esignet/oidc/userinfo`, {
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

  // Prefer an immediate 302 redirect to the SPA with payload in hash
  const target = `http://localhost:3001/#auth_payload=${forwardB64}&authenticated=true`;
  return res.redirect(302, target);

  } catch (error) {
    console.error('❌ Callback processing error:', error);
    
  // Redirect directly back to SPA home on error
  return res.redirect(302, 'http://localhost:3001/?auth_error=1');
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
  res.json({ status: 'OK', port: port, mongo: !!mongoDb });
});

// Public client metadata (safe subset) for front-end to discover current clientId
app.get('/client-meta', (req, res) => {
  res.json({
    clientId: clientConfig.clientId,
  authorizeUri: 'http://34.58.198.143:3000/authorize',
    redirect_uri: clientConfig.redirectUri
  });
});

// ---- Helper: Verify access token (naive decode or remote introspection) ----
// For now we accept a bearer token and trust userInfo passed from client (MUST harden in production)
// Optionally decode JWT if it is a JWT-like token for basic field extraction.
function extractUploaderInfo(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  // Try decode without verification (we may not have public keys) just to extract claims.
  let claims = null;
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = parts[1].replace(/-/g,'+').replace(/_/g,'/');
      const pad = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4));
      const json = Buffer.from(payload + pad, 'base64').toString('utf8');
      claims = JSON.parse(json);
    }
  } catch {/* ignore */}
  return { token, claims };
}

// ---- Batch upload endpoint ----
// Receives: { records: [...] } where each record matches IndexedDB schema subset
// Adds uploader attribution (name, sub) and writes to MongoDB.
app.post('/api/child/batch', async (req, res) => {
  try {
    const { records, uploaderName } = req.body;
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'No records provided' });
    }
    const uploader = extractUploaderInfo(req);
    if (!uploader) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    await initMongo();
    if (!mongoDb) return res.status(500).json({ error: 'MongoDB not available' });

    const col = mongoDb.collection('child_records');
    const now = Date.now();
    const toInsert = [];
    const results = [];

    for (const r of records) {
      if (!r.healthId) {
        results.push({ healthId: r.healthId || null, status: 'skipped', reason: 'missing_healthId' });
        continue;
      }
      // Prepare document; prevent huge photos > ~1MB (basic guard)
      let facePhoto = r.facePhoto;
      if (facePhoto && facePhoto.length > 1_000_000) {
        facePhoto = null; // drop large image to protect DB
      }
      toInsert.push({
        healthId: r.healthId,
        name: r.name || null,
        ageMonths: r.ageMonths ?? null,
        weightKg: r.weightKg ?? null,
        heightCm: r.heightCm ?? null,
        guardianName: r.guardianName || null,
        malnutritionSigns: r.malnutritionSigns || null,
        recentIllnesses: r.recentIllnesses || null,
        parentalConsent: !!r.parentalConsent,
        idReference: r.idReference || null,
        facePhoto,
        createdAt: r.createdAt || now,
        uploadedAt: now,
        uploaderName: uploaderName || (uploader.claims && (uploader.claims.name || uploader.claims.preferred_username)) || null,
        uploaderSub: uploader.claims && uploader.claims.sub || null,
        source: 'offline_sync',
        version: r.version || 1
      });
    }

    // Insert documents; handle duplicates gracefully
    for (const doc of toInsert) {
      try {
        await col.updateOne({ healthId: doc.healthId }, { $setOnInsert: doc }, { upsert: true });
        results.push({ healthId: doc.healthId, status: 'uploaded' });
      } catch (e) {
        results.push({ healthId: doc.healthId, status: 'failed', reason: e.code === 11000 ? 'duplicate' : e.message });
      }
    }

    const summary = {
      total: records.length,
      attempted: toInsert.length,
      uploaded: results.filter(r=>r.status==='uploaded').length,
      failed: results.filter(r=>r.status==='failed').length,
      skipped: results.filter(r=>r.status==='skipped').length
    };
    res.json({ summary, results });
  } catch (err) {
    console.error('❌ Batch upload error:', err);
    res.status(500).json({ error: 'batch_upload_failed', details: err.message });
  }
});

// List/search child records with pagination
// /api/child?search=abc&status=pending&limit=20&offset=0
app.get('/api/child', async (req, res) => {
  try {
    await initMongo();
    if (!mongoDb) return res.status(500).json({ error: 'mongo_unavailable' });
    const { search='', status, limit=20, offset=0 } = req.query;
    const q = {};
    if (status) q.status = status; // status not currently stored server side, ignore for now
    if (search) {
      q.$or = [
        { healthId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }
    const col = mongoDb.collection('child_records');
    const docs = await col.find(q).sort({ createdAt: -1 }).skip(parseInt(offset,10)).limit(Math.min(100, parseInt(limit,10))).toArray();
    const total = await col.countDocuments(q);
    res.json({ total, records: docs });
  } catch (e) {
    res.status(500).json({ error: 'list_failed', message: e.message });
  }
});

// PDF "health booklet" generation for a child record
app.get('/api/child/:healthId/pdf', async (req, res) => {
  try {
    await initMongo();
    if (!mongoDb) return res.status(500).json({ error: 'mongo_unavailable' });
    const { healthId } = req.params;
    const col = mongoDb.collection('child_records');
    const doc = await col.findOne({ healthId });
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${healthId}.pdf"`);
    const pdf = new PDFDocument({ margin: 50 });
    pdf.pipe(res);
    pdf.fontSize(18).text('Child Health Booklet', { align:'center' });
    pdf.moveDown();
    pdf.fontSize(12);
    const fields = [
      ['Health ID', doc.healthId],
      ['Name', doc.name||''],
      ['Age (months)', doc.ageMonths??''],
      ['Weight (kg)', doc.weightKg??''],
      ['Height (cm)', doc.heightCm??''],
      ['Guardian', doc.guardianName||''],
      ['Recent Illnesses', doc.recentIllnesses||''],
      ['Malnutrition Signs', doc.malnutritionSigns||''],
      ['Consent', doc.parentalConsent? 'Yes':'No'],
      ['Uploader', doc.uploaderName||''],
      ['Uploaded At', doc.uploadedAt? new Date(doc.uploadedAt).toLocaleString():'' ]
    ];
    fields.forEach(([k,v])=> { pdf.text(`${k}: ${v}`); });
    if (doc.facePhoto) {
      try {
        // Assume base64 image data URL
        const base64 = doc.facePhoto.split(',')[1] || doc.facePhoto;
        const buf = Buffer.from(base64, 'base64');
        pdf.addPage();
        pdf.fontSize(16).text('Photo', { align:'center' });
        pdf.moveDown();
        pdf.image(buf, { fit:[400,400], align:'center', valign:'center' });
      } catch {}
    }
    pdf.end();
  } catch (e) {
    res.status(500).json({ error: 'pdf_failed', message: e.message });
  }
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
  initMongo();
});
