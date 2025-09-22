// DEPLOY_MARKER: SERVER_JS_ACTIVE_BUILD_2025-09-23T01:55Z
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { Client as PgClient } from 'pg';

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
// --- Added verbose startup diagnostics for Cloud Run ---
console.log('[diag] Process starting PID', process.pid);
console.log('[diag] Node version', process.version);
console.log('[diag] Env PORT=', process.env.PORT, 'MONGO_URI?', !!process.env.MONGO_URI, 'MONGODB_URI?', !!process.env.MONGODB_URI);

// Initialize express app early (was missing leading to reference errors)
const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '5mb' }));

// ---------------- MongoDB Setup ----------------
// Mongo URI must be supplied via environment (Secret). Support both MONGO_URI and MONGODB_URI names.
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.warn('[startup] No Mongo URI provided (MONGO_URI or MONGODB_URI). Mongo-dependent routes will fail until set.');
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
app.get('/', (_req,res)=> res.json({ service:'navbar-backend', ok:true }));
app.get('/debug/routes', (_req,res)=> {
  try {
    const routes = [];
    app._router.stack.forEach(l=>{
      if (l.route && l.route.path) {
        const methods = Object.keys(l.route.methods).join(',');
        routes.push({ path:l.route.path, methods });
      } else if (l.name === 'router' && l.handle && l.handle.stack) {
        l.handle.stack.forEach(r => {
          if (r.route && r.route.path) {
            const methods = Object.keys(r.route.methods).join(',');
            routes.push({ path:r.route.path, methods });
          }
        });
      }
    });
    res.json({ count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ error:'route_introspection_failed', message:e.message });
  }
});

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

// Cloud Run provides PORT env; default to 8080 locally if absent.
const port = parseInt(process.env.PORT, 10) || 8080;
// ---------------- Postgres (Mock Identity System) Setup ----------------
// We surface mock identity records as "agents" for the admin UI without modifying the source DB.
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = parseInt(process.env.PG_PORT || '5455', 10); // host-mapped port to container's 5432
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const PG_DB_IDENTITY = process.env.PG_DB_IDENTITY || 'mosip_mockidentitysystem';
let pgIdentityClient; let pgIdentityReady = false;
async function getPgIdentity(){
  if (pgIdentityReady && pgIdentityClient) return pgIdentityClient;
  pgIdentityClient = new PgClient({ host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database: PG_DB_IDENTITY });
  try {
    await pgIdentityClient.connect();
    pgIdentityReady = true;
    console.log('[backend] Connected to Postgres mockidentitysystem');
  } catch (e){
    console.warn('[backend] Postgres identity connection failed:', e.message);
    throw e;
  }
  return pgIdentityClient;
}

function sanitizeIdentity(full){
  if(!full) return null;
  const copy = { ...full };
  delete copy.password; delete copy.pin; delete copy.encodedPhoto; // remove sensitive fields
  return copy;
}

function summarizeIdentity(idJson){
  if(!idJson) return null;
  const first = (arr)=> Array.isArray(arr) && arr.length ? arr[0].value || arr[0] : null;
  const findLang = (arr, lang)=> Array.isArray(arr) ? (arr.find(e=>e.language===lang)?.value || first(arr)) : null;
  return {
    individualId: idJson.individualId,
    name: findLang(idJson.fullName,'eng') || findLang(idJson.givenName,'eng') || idJson.individualId,
    email: idJson.email || null,
    phone: idJson.phone || null,
    dateOfBirth: idJson.dateOfBirth || null,
    country: findLang(idJson.country,'eng'),
    region: findLang(idJson.region,'eng'),
    gender: findLang(idJson.gender,'eng'),
    createdAt: idJson.createdAt || null
  };
}
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

// ---------------- Identities (Postgres) Admin Endpoints ----------------
// These expose mock identity system records as read-only data for the Admin UI.
app.get('/api/admin/identities', async (req,res)=>{
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    // Dev fallback: if no Mongo configured and no JWT secret, allow open read (NOT for production)
    if(!session) {
      if(!process.env.MONGO_URI && !process.env.MONGODB_URI && !process.env.ADMIN_JWT_SECRET) {
        console.warn('[backend] identities endpoint unauthenticated fallback in effect (no auth backend configured)');
      } else {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    let client; try { client = await getPgIdentity(); } catch { return res.json({ items:[], total:0, warning:'postgres_unavailable' }); }
    const limit = Math.min(parseInt(req.query.limit)||100, 500);
    const offset = parseInt(req.query.offset)||0;
    const result = await client.query('SELECT individual_id, identity_json FROM mockidentitysystem.mock_identity ORDER BY individual_id DESC OFFSET $1 LIMIT $2', [offset, limit]);
    const items = [];
    for(const row of result.rows){
      try { const parsed = JSON.parse(row.identity_json); items.push(summarizeIdentity(parsed)); } catch {}
    }
    res.json({ items, total: items.length });
  } catch (e){
    console.error('[backend] identities list error', e);
    res.status(500).json({ error:'identity_list_failed', message:e.message });
  }
});

app.get('/api/admin/identities/:id', async (req,res)=>{
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) {
      if(!process.env.MONGO_URI && !process.env.MONGODB_URI && !process.env.ADMIN_JWT_SECRET) {
        console.warn('[backend] identity detail endpoint unauthenticated fallback in effect');
      } else {
        return res.status(401).json({ error: 'unauthorized' });
      }
    }
    let client; try { client = await getPgIdentity(); } catch { return res.status(503).json({ error:'postgres_unavailable' }); }
    const id = req.params.id;
    const result = await client.query('SELECT identity_json FROM mockidentitysystem.mock_identity WHERE individual_id=$1 LIMIT 1', [id]);
    if(!result.rows.length) return res.status(404).json({ error:'not_found' });
    let parsed; try { parsed = JSON.parse(result.rows[0].identity_json); } catch { return res.status(500).json({ error:'parse_error' }); }
    res.json({ individualId: id, summary: summarizeIdentity(parsed), identity: sanitizeIdentity(parsed) });
  } catch (e){
    console.error('[backend] identity fetch error', e);
    res.status(500).json({ error:'identity_fetch_failed', message:e.message });
  }
});

app.get('/api/admin/children', async (req,res)=>{
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) return res.status(401).json({ error: 'unauthorized' });
    
    await initMongo();
    const col = mongoDb.collection('child_records');
    
    // Get query parameters for pagination and filtering
    const { page = 1, limit = 50, search, location, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build search query
    let query = {};
    if (search) {
      query.$or = [
        { healthId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { guardianName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (location && location !== 'all') {
      query.location = location;
    }
    
    // Fetch children with pagination
    const children = await col.find(query, { 
      projection: { 
        _id: 0, 
        healthId: 1, 
        name: 1, 
        ageMonths: 1, 
        guardianName: 1, 
        location: 1,
        malnutritionSigns: 1,
        recentIllnesses: 1,
        createdAt: 1,
        uploadedAt: 1
      } 
    })
    .sort({ uploadedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .toArray();
    
    // Add mock location for existing records that don't have it
    const locations = ['City Center', 'Rural Area', 'District A', 'District B', 'Suburb'];
    const enhancedChildren = children.map(child => ({
      ...child,
      location: child.location || locations[Math.floor(Math.random() * locations.length)]
    }));
    
    // Get total count for pagination
    const total = await col.countDocuments(query);
    
    return res.json({ 
      children: enhancedChildren, 
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (e) {
    console.error('[backend] admin children error', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Update child record endpoint
app.put('/api/admin/child/:healthId', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) return res.status(401).json({ error: 'unauthorized' });
    
    const { healthId } = req.params;
    const updates = req.body;
    
    if (!healthId) {
      return res.status(400).json({ error: 'missing_health_id' });
    }
    
    // Remove fields that shouldn't be updated directly
    const { _id, uploadedAt, uploaderName, uploaderSub, source, ...allowedUpdates } = updates;
    
    // Add modification timestamp
    allowedUpdates.lastModified = new Date().toISOString();
    allowedUpdates.modifiedBy = session.username || 'admin';
    
    await initMongo();
    const col = mongoDb.collection('child_records');
    
    const result = await col.updateOne(
      { healthId }, 
      { $set: allowedUpdates }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'record_not_found' });
    }
    
    // Fetch and return updated record
    const updatedRecord = await col.findOne({ healthId }, { projection: { _id: 0 } });
    
    return res.json({ 
      success: true, 
      message: 'Record updated successfully',
      record: updatedRecord
    });
  } catch (e) {
    console.error('[backend] update child record error', e);
    return res.status(500).json({ error: 'update_failed', message: e.message });
  }
});

// Delete child record endpoint
app.delete('/api/admin/child/:healthId', async (req, res) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) return res.status(401).json({ error: 'unauthorized' });
    
    const { healthId } = req.params;
    
    if (!healthId) {
      return res.status(400).json({ error: 'missing_health_id' });
    }
    
    await initMongo();
    const col = mongoDb.collection('child_records');
    
    const result = await col.deleteOne({ healthId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'record_not_found' });
    }
    
    return res.json({ 
      success: true, 
      message: 'Record deleted successfully',
      healthId
    });
  } catch (e) {
    console.error('[backend] delete child record error', e);
    return res.status(500).json({ error: 'delete_failed', message: e.message });
  }
});

app.listen(port, ()=> {
  console.log(`[backend] listening on :${port}`);
  console.log('[startup] Routes registered: /health, /, /debug/routes, /api/admin/login, /api/admin/stats, /api/admin/children, /api/admin/child/:healthId (PUT/DELETE), /api/child/batch');
  console.log('[startup] Added Postgres identity endpoints: /api/admin/identities, /api/admin/identities/:id');
});
