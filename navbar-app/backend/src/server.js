import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

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
// Mongo URI must be supplied via environment (Secret). No hardcoded fallback in production.
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('[startup] MONGO_URI not set. Exiting.');
  process.exit(1);
}
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
    // Ensure admin user exists without storing raw password in code.
    // We store only a bcrypt hash of the default password 'Admin@123'.
    const adminCol = mongoDb.collection('admin_users');
    await adminCol.createIndex({ username: 1 }, { unique: true });
    const existing = await adminCol.findOne({ username: 'Admin' });
    if (!existing) {
      const DEFAULT_ADMIN_PASSWORD = 'Admin@123'; // Not stored after hashing.
      const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
      await adminCol.insertOne({
        username: 'Admin',
        passwordHash: hash,
        createdAt: new Date(),
        roles: ['admin'],
        forceChange: false
      });
      console.log('[backend] Seeded default Admin user');
    }
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

// ---------------- Admin Auth & Stats ----------------
// Stateless (JWT) mode if ADMIN_JWT_SECRET set; else fallback to in-memory sessions (suitable only for single instance dev).
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET; // Provide via GCP Secret / env var.
const ADMIN_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// In-memory fallback map
const adminSessions = new Map();
function randomHex(bytes=24){ return Buffer.from(Array.from({length:bytes},()=> Math.floor(Math.random()*256))).toString('hex'); }

async function issueToken(username){
  if (ADMIN_JWT_SECRET) {
    const secret = new TextEncoder().encode(ADMIN_JWT_SECRET);
    const jwt = await new SignJWT({ sub: username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now()/1000) + ADMIN_SESSION_TTL_MS/1000)
      .sign(secret);
    return { token: jwt, mode: 'jwt' };
  } else {
    const token = randomHex();
    adminSessions.set(token, { username, expires: Date.now() + ADMIN_SESSION_TTL_MS });
    return { token, mode: 'memory' };
  }
}

async function validateAuthToken(raw){
  if (!raw) return null;
  if (ADMIN_JWT_SECRET) {
    try {
      const secret = new TextEncoder().encode(ADMIN_JWT_SECRET);
      const { payload } = await jwtVerify(raw, secret, { algorithms: ['HS256'] });
      if (payload.role !== 'admin') return null;
      return { username: payload.sub };
    } catch { return null; }
  } else {
    const s = adminSessions.get(raw);
    if (!s) return null;
    if (s.expires < Date.now()) { adminSessions.delete(raw); return null; }
    return { username: s.username };
  }
}

if (!ADMIN_JWT_SECRET) {
  // Cleanup only needed for memory mode
  setInterval(()=>{
    const now = Date.now();
    for (const [k,v] of adminSessions.entries()) if (v.expires < now) adminSessions.delete(k);
  }, 5*60*1000).unref();
}

app.post('/api/admin/login', async (req,res)=>{
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });
    await initMongo();
    const col = mongoDb.collection('admin_users');
    let user = await col.findOne({ username });
    if(!user) {
      // Legacy fallback: collection 'Admin_child' with fields userid & password (plaintext)
      try {
        const legacyCol = mongoDb.collection('Admin_child');
        const legacy = await legacyCol.findOne({ userid: username });
        if (legacy && legacy.password === password) {
          const hash = await bcrypt.hash(password, 10);
          user = { username, passwordHash: hash, createdAt: new Date(), roles: ['admin'], migratedFrom: 'Admin_child' };
          await col.insertOne(user);
          console.log('[backend] Migrated legacy admin user from Admin_child collection');
        }
      } catch (e) {
        console.warn('[backend] legacy admin lookup failed', e.message);
      }
    }
    if(!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if(!ok) return res.status(401).json({ error: 'invalid_credentials' });
  const { token, mode } = await issueToken(username);
  return res.json({ token, username, expiresIn: ADMIN_SESSION_TTL_MS/1000, mode });
  } catch (e) {
    console.error('[backend] admin login error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.get('/api/admin/stats', async (req,res)=>{
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
  const session = await validateAuthToken(token);
  if(!session) return res.status(401).json({ error: 'unauthorized' });
    await initMongo();
    const col = mongoDb.collection('child_records');
    const total = await col.countDocuments();
    const last5 = await col.find({}, { projection: { _id:0, healthId:1, name:1, uploadedAt:1 } }).sort({ uploadedAt: -1 }).limit(5).toArray();
    return res.json({ totalChildRecords: total, recentUploads: last5 });
  } catch (e) {
    console.error('[backend] admin stats error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.listen(port, ()=> console.log(`[backend] listening on :${port}`));
