import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// Config
const PORT = process.env.PORT || 8080;
// IMPORTANT: Mongo URI must be supplied via environment variable MONGO_URI at deploy time.
// (Previously a fallback hardcoded credential was present; removed for security.)
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('[backend] FATAL: MONGO_URI environment variable not set');
  process.exit(1);
}
const DB_NAME = 'childBooklet';
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-secret-change';
const SESSION_TTL_S = 3600; // 1 hour

let db; let mongoClient;
async function getDb(){
  if (db) return db;
  mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  // Log sanitized host (no credentials) once to confirm correct cluster
  try {
    const afterAt = MONGO_URI.split('@')[1] || '';
    const host = afterAt.split('/')[0];
    console.log('[backend] Connected to Mongo host:', host);
  } catch {}
  db = mongoClient.db(DB_NAME);
  await db.collection('child_records').createIndex({ healthId:1 }, { unique:true });
  return db;
}

const app = express();
// CORS: library + manual safeguard (some platforms / middleware chains can swallow headers on 401)
app.use(cors({ origin: true }));
// Manual global headers (belt & suspenders) so even early 401/500 responses include CORS
app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age','86400');
  if(req.method==='OPTIONS') return res.status(204).end();
  next();
});
app.use(express.json({ limit:'2mb' }));

async function issueSession(payload){
  const secret = new TextEncoder().encode(APP_JWT_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg:'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now()/1000)+SESSION_TTL_S)
    .sign(secret);
}
async function verifySession(token){
  if(!token) return null;
  const secret = new TextEncoder().encode(APP_JWT_SECRET);
  try { const { payload } = await jwtVerify(token, secret, { algorithms:['HS256'] }); return payload; } catch { return null; }
}

function decodeJwtLenient(token){
  try {
    const parts = token.split('.');
    if(parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch { return null; }
}

// Placeholder eSignet auth: accept id_token and issue local session token
app.post('/auth/esignet', async (req,res)=>{
  try {
    const { id_token, name, email } = req.body || {};
    if(!id_token) return res.status(400).json({ error:'missing_id_token' });
    const token = await issueSession({ sub: email||'user', name: name||'Unknown', email });
    res.json({ token, expiresIn: SESSION_TTL_S });
  } catch (e){ res.status(500).json({ error:'auth_failed', message:e.message }); }
});

async function requireAuth(req,res,next){
  const auth = req.headers.authorization||'';
  const token = auth.startsWith('Bearer ')? auth.slice(7): null;
  let session = await verifySession(token);
  // Dev fallback: accept unverified eSignet / other JWT by decoding payload (NOT for production security)
  if(!session && token){
    const decoded = decodeJwtLenient(token);
    if(decoded && (decoded.email || decoded.sub)) {
      session = { sub: decoded.sub || decoded.email, name: decoded.name||decoded.preferred_username||'User', email: decoded.email||null, unverified:true };
    }
  }
  if(!session) return res.status(401).json({ error:'unauthorized' });
  req.user = session; next();
}

// Batch upload endpoint matching existing frontend expectation (/api/child/batch)
app.post('/api/child/batch', requireAuth, async (req,res)=>{
  try {
    const { records = [] } = req.body || {};
    if(!Array.isArray(records) || !records.length) return res.status(400).json({ error:'no_records' });
    const database = await getDb();
    const col = database.collection('child_records');
    const nowIso = new Date().toISOString();
    const uploaderName = req.user.name || null;
    const uploaderEmail = req.user.email || null;
    const results = [];
    for(const r of records){
      if(!r.healthId){ results.push({ status:'skipped', reason:'missing_healthId' }); continue; }
      const doc = {
        healthId: r.healthId,
        name: r.name||null,
        ageMonths: r.ageMonths??null,
        createdAt: r.createdAt || nowIso,
        facePhoto: r.facePhoto || null,
        guardianName: r.guardianName||null,
        guardianPhone: r.guardianPhone||null,
        guardianRelation: r.guardianRelation||null,
        heightCm: r.heightCm??null,
        weightKg: r.weightKg??null,
        idReference: r.idReference||null,
        malnutritionSigns: r.malnutritionSigns||null,
        recentIllnesses: r.recentIllnesses||null,
        parentalConsent: !!r.parentalConsent,
        uploadedAt: nowIso,
        uploaderName,
        uploaderEmail
      };
      try {
        await col.updateOne({ healthId: doc.healthId }, { $setOnInsert: doc }, { upsert:true });
        results.push({ healthId: doc.healthId, status:'uploaded' });
      } catch (e) {
        results.push({ healthId: doc.healthId, status:'failed', reason: e.code===11000?'duplicate':e.message });
      }
    }
    res.json({ summary:{ total: records.length, uploaded: results.filter(r=>r.status==='uploaded').length, failed: results.filter(r=>r.status==='failed').length, skipped: results.filter(r=>r.status==='skipped').length }, results });
  } catch (e){ res.status(500).json({ error:'upload_failed', message:e.message }); }
});

app.get('/api/child/stats', requireAuth, async (req,res)=>{
  try {
    const database = await getDb();
    const col = database.collection('child_records');
    const total = await col.countDocuments();
    const recent = await col.find({}, { projection:{ _id:0, healthId:1, uploadedAt:1, uploaderEmail:1 } }).sort({ uploadedAt:-1 }).limit(5).toArray();
    res.json({ total, recent });
  } catch (e){ res.status(500).json({ error:'stats_failed', message:e.message }); }
});

// Lightweight search endpoint used by Settings export PDF feature.
// Query param q matches exact healthId first; if not found tries name prefix (case-insensitive).
// (Currently unauthenticated for convenience; tighten later if needed.)
app.get('/api/child/search', async (req,res)=>{
  try {
    const raw = (req.query.q||'').toString().trim();
    if(!raw) return res.status(400).json({ error:'missing_query' });
    const database = await getDb();
    const col = database.collection('child_records');
    let record = await col.findOne({ healthId: raw });
    if(!record){
      // Escape regex special chars for prefix match
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      record = await col.findOne({ name: { $regex: `^${escaped}`, $options:'i' } });
    }
    if(record){
      delete record._id; // remove internal id
      return res.json({ found:true, record });
    }
    return res.json({ found:false });
  } catch (e){ res.status(500).json({ error:'search_failed', message:e.message }); }
});

app.get('/health', (req,res)=> res.json({ status:'ok', time: Date.now() }));

// Debug route to inspect received headers (remove in production)
app.get('/debug/headers', (req,res)=>{
  res.json({
    method: req.method,
    headers: req.headers,
    authHeaderPresent: !!req.headers['authorization']
  });
});

// --- Admin Auth (minimal) ---
// One admin user: default username Admin, password Admin@123 (hashed below) unless overridden by env vars
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';
// Precomputed bcrypt hash for 'Admin@123'
// bcrypt hash for 'Admin@123'
const DEFAULT_ADMIN_HASH = '$2b$10$qLkUZJhrTncH0VMlJhmvGOji9VfmYZZkY0wRLo8GYENzHp229R8iy';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || DEFAULT_ADMIN_HASH;

function issueAdminToken(username){
  const payload = { role:'admin', sub: `admin:${username}`, username, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600 };
  return new SignJWT(payload).setProtectedHeader({ alg:'HS256' }).sign(new TextEncoder().encode(APP_JWT_SECRET));
}

async function verifyAdmin(req,res,next){
  const auth = req.headers.authorization||'';
  const token = auth.startsWith('Bearer ')? auth.slice(7): null;
  if(!token) return res.status(401).json({ error:'unauthorized' });
  try {
    const secret = new TextEncoder().encode(APP_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms:['HS256'] });
    if(payload.role !== 'admin') return res.status(403).json({ error:'forbidden' });
    req.admin = payload; next();
  } catch { return res.status(401).json({ error:'unauthorized' }); }
}

app.post('/api/admin/login', express.json(), async (req,res)=>{
  try {
    const { username, password } = req.body||{};
    if(!username || !password) return res.status(400).json({ error:'missing_credentials' });
    if(username !== ADMIN_USERNAME) return res.status(401).json({ error:'invalid_credentials' });
    const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if(!ok) return res.status(401).json({ error:'invalid_credentials' });
    const token = await issueAdminToken(username);
    res.json({ token, username, expiresIn:3600 });
  } catch(e){ res.status(500).json({ error:'login_failed', message:e.message }); }
});

app.get('/api/admin/stats', verifyAdmin, async (req,res)=>{
  try {
    const database = await getDb();
    const col = database.collection('child_records');
    const totalChildRecords = await col.countDocuments();
    const recentUploads = await col.find({}, { projection:{ _id:0, healthId:1, name:1, uploadedAt:1 } }).sort({ uploadedAt:-1 }).limit(10).toArray();
    res.json({ totalChildRecords, recentUploads });
  } catch(e){ res.status(500).json({ error:'stats_failed', message:e.message }); }
});

app.listen(PORT, ()=> console.log(`[backend] listening on ${PORT}`));
