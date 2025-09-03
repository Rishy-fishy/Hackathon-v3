import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { MongoClient } from 'mongodb';

/*
 Simple backend facade for e-Signet auth code -> token exchange & userinfo fetch.
 Environment variables expected:
   OIDC_ISSUER        e.g. https://auth.example.com
   OIDC_CLIENT_ID
   OIDC_CLIENT_SECRET (if using basic / client_secret_post) OR configure private_key_jwt separately
   REDIRECT_URI       must match registered redirect
*/

const {
  OIDC_ISSUER,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  REDIRECT_URI
} = process.env;

const OIDC_READY = !!(OIDC_ISSUER && OIDC_CLIENT_ID && REDIRECT_URI);
if (!OIDC_READY) {
  console.log('[startup] OIDC env vars not set – skipping /exchange-token route (callback-server likely handling auth)');
}

const app = express();
app.use(cors({ origin: true, credentials: false }));
// Allow larger payloads for base64 images (kept modest)
app.use(express.json({ limit: '5mb' }));

// ---------------- MongoDB Setup ----------------
// Use provided env var or fallback to user's Atlas URI (NOTE: storing credentials in code is not recommended)
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://harshbontala188:8I52Oqeh3sWYTDJ7@cluster0.5lsiap2.mongodb.net/childBooklet?retryWrites=true&w=majority&appName=Cluster0';
// Database name (if not implicit in URI). For Atlas SRV with trailing /childBooklet it will pick that DB automatically
const MONGO_DB = process.env.MONGO_DB || 'childBooklet';
let mongoClient; // shared client
let mongoDb;     // db instance

async function initMongo() {
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(MONGO_URI, { ignoreUndefined: true });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGO_DB);
    console.log(`[backend] Connected to MongoDB: ${MONGO_URI} db=${MONGO_DB}`);
    const col = mongoDb.collection('child_records');
    await Promise.all([
      col.createIndex({ healthId: 1 }, { unique: true }),
      col.createIndex({ createdAt: -1 })
    ]);
  } catch (e) {
    console.error('[backend] Mongo connection failed:', e.message);
  }
  return mongoDb;
}

// Health
app.get('/health', (_req,res)=> res.json({ status:'ok', time: Date.now() }));

// Exchange authorization code for tokens (only if env provided)
if (OIDC_READY) app.post('/exchange-token', async (req,res)=> {
  try {
    const { code, state } = req.body || {};
    if (!code) return res.status(400).json({ error:'missing_code' });

    const tokenEndpoint = await discover('token_endpoint');
    const params = new URLSearchParams();
    params.set('grant_type','authorization_code');
    params.set('code', code);
    params.set('redirect_uri', REDIRECT_URI);
    params.set('client_id', OIDC_CLIENT_ID);
    if (OIDC_CLIENT_SECRET) params.set('client_secret', OIDC_CLIENT_SECRET);

    const tokenResp = await fetch(tokenEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('Token error', tokenJson);
      return res.status(tokenResp.status).json(tokenJson);
    }

    const { access_token, id_token } = tokenJson;
    let userInfo = null;
    if (access_token) {
      const userinfoEndpoint = await discover('userinfo_endpoint');
      const uiResp = await fetch(userinfoEndpoint, { headers:{ Authorization: `Bearer ${access_token}` }});
      if (uiResp.ok) userInfo = await uiResp.json();
    }

    // (Optional) verify id_token
    let idTokenClaims = null;
    if (id_token) {
      try {
        const jwksUri = await discover('jwks_uri');
        const JWKS = createRemoteJWKSet(new URL(jwksUri));
        const { payload } = await jwtVerify(id_token, JWKS, { issuer: OIDC_ISSUER, audience: OIDC_CLIENT_ID });
        idTokenClaims = payload;
      } catch (e) {
        console.warn('ID token verify failed', e.message);
      }
    }

    return res.json({
      access_token,
      id_token,
      id_token_claims: idTokenClaims,
      userInfo,
      state
    });
  } catch (e) {
    console.error('Exchange failed', e);
    return res.status(500).json({ error:'exchange_failed', message: e.message });
  }
});

// Minimal discovery cache
let _discoveryCache = null;
async function discover(field) {
  if (!_discoveryCache) {
    const resp = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`);
    if (!resp.ok) throw new Error('discovery_failed');
    _discoveryCache = await resp.json();
  }
  return field ? _discoveryCache[field] : _discoveryCache;
}

const port = process.env.PORT || 3002;
// --------------- Child Record Batch Upload Endpoint ---------------
// Mirrors structure used by frontend offline sync (see src/offline/sync.js)
app.post('/api/child/batch', async (req,res) => {
  try {
  const { records = [], uploaderName, uploaderEmail } = req.body || {};
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ error: 'no_records' });
    }
    await initMongo();
    if (!mongoDb) return res.status(500).json({ error: 'mongo_unavailable' });

    const col = mongoDb.collection('child_records');
  const nowIso = new Date().toISOString();
    const results = [];
    let attempted = 0;
    for (const r of records) {
      if (!r.healthId) {
        results.push({ healthId: null, status: 'skipped', reason: 'missing_healthId' });
        continue;
      }
      attempted++;
      // Trim oversized photo (>1MB) to protect DB
      let facePhoto = r.facePhoto;
      if (facePhoto && facePhoto.length > 1_000_000) facePhoto = null;
      const doc = {
        // Order crafted to match requested output ordering
        healthId: r.healthId,
        name: r.name || null,
        ageMonths: r.ageMonths ?? null,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : (r.createdAt ? new Date(r.createdAt).toISOString() : nowIso),
        facePhoto,
        guardianName: r.guardianName || null,
        guardianPhone: r.guardianPhone || null,
        guardianRelation: r.guardianRelation || null,
        heightCm: r.heightCm ?? null,
        weightKg: r.weightKg ?? null,
        idReference: r.idReference || null,
        malnutritionSigns: r.malnutritionSigns || null,
        recentIllnesses: r.recentIllnesses || null,
        parentalConsent: !!r.parentalConsent,
        source: 'offline_batch',
        uploadedAt: nowIso,
        uploaderEmail: uploaderEmail || null,
        uploaderName: uploaderName || null,
        version: r.version || 1
      };
      try {
        await col.updateOne({ healthId: doc.healthId }, { $setOnInsert: doc }, { upsert: true });
        results.push({ healthId: doc.healthId, status: 'uploaded' });
      } catch (e) {
        results.push({ healthId: doc.healthId, status: 'failed', reason: e.code === 11000 ? 'duplicate' : e.message });
      }
    }
    const summary = {
      total: records.length,
      attempted,
      uploaded: results.filter(r=>r.status==='uploaded').length,
      failed: results.filter(r=>r.status==='failed').length,
      skipped: results.filter(r=>r.status==='skipped').length
    };
    return res.json({ summary, results });
  } catch (e) {
    console.error('[backend] batch upload error', e);
    return res.status(500).json({ error: 'batch_failed', message: e.message });
  }
});

app.listen(port, ()=> console.log(`[backend] listening on :${port}`));
