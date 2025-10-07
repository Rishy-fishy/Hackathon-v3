// DEPLOY_IDENTITY_MARKER_2025-09-23A
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { Client as PgClient } from 'pg';

// Config
const PORT = process.env.PORT || 8080;
// IMPORTANT: Mongo URI must be supplied via environment variable MONGO_URI at deploy time.
// (Previously a fallback hardcoded credential was present; removed for security.)
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.warn('[backend] WARN: MONGO_URI not set. Mongo-dependent endpoints will be disabled.');
}
const DB_NAME = 'childBooklet';
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-secret-change';
const SESSION_TTL_S = 3600; // 1 hour

let db; let mongoClient;
async function getDb(){
  if (db) return db;
  if(!MONGO_URI) throw new Error('mongo_unavailable');
  if(!mongoClient){
    mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    await mongoClient.connect();
    try {
      const afterAt = MONGO_URI.split('@')[1] || '';
      const host = afterAt.split('/')[0];
      console.log('[backend] Connected to Mongo host:', host);
    } catch {}
    db = mongoClient.db(DB_NAME);
    await db.collection('child_records').createIndex({ healthId:1 }, { unique:true });
  }
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
    if(!MONGO_URI) return res.status(503).json({ error:'mongo_disabled' });
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
    if(!MONGO_URI) return res.status(503).json({ error:'mongo_disabled' });
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
    if(!MONGO_URI) return res.status(503).json({ error:'mongo_disabled' });
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

// PDF generation endpoint for child health records
app.get('/api/child/:healthId/pdf', async (req,res)=>{
  try {
    if(!MONGO_URI) return res.status(503).json({ error:'mongo_disabled' });
    const { healthId } = req.params;
    const database = await getDb();
    const col = database.collection('child_records');
    const record = await col.findOne({ healthId });
    if(!record) return res.status(404).json({ error:'not_found', message:`No record found for ${healthId}` });
    
    // Generate simple HTML-based PDF response (can be enhanced with a proper PDF library later)
    // For now, return JSON that the frontend can use to generate PDF client-side
    res.json({ 
      success: true, 
      record: {
        healthId: record.healthId,
        name: record.name || '',
        guardianName: record.guardianName || record.fatherName || '',
        dateOfBirth: record.dateOfBirth || '',
        ageMonths: record.ageMonths || '',
        guardianPhone: record.guardianPhone || record.mobile || '',
        idReference: record.idReference || record.aadhaar || '',
        gender: record.gender || '',
        weightKg: record.weightKg || record.weight || '',
        heightCm: record.heightCm || record.height || '',
        malnutritionSigns: record.malnutritionSigns || '',
        recentIllnesses: record.recentIllnesses || '',
        uploaderName: record.uploaderName || '',
        uploadedAt: record.uploadedAt || ''
      }
    });
  } catch (e){ res.status(500).json({ error:'pdf_failed', message:e.message }); }
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
    if(!MONGO_URI) return res.json({ totalChildRecords:0, recentUploads:[], warning:'mongo_disabled' });
    const database = await getDb();
    const col = database.collection('child_records');
    const totalChildRecords = await col.countDocuments();
    const recentUploads = await col.find({}, { projection:{ _id:0, healthId:1, name:1, uploadedAt:1 } }).sort({ uploadedAt:-1 }).limit(10).toArray();
    res.json({ totalChildRecords, recentUploads });
  } catch(e){ res.status(500).json({ error:'stats_failed', message:e.message }); }
});

// --- Agents Collection Helpers ---
async function getAgentsCollection(){
  const database = await getDb();
  const col = database.collection('agents');
  // Create indexes once (ignore errors on recreate)
  try { await col.createIndex({ individualId:1 }, { unique:true }); } catch {}
  try { await col.createIndex({ email:1 }, { sparse:true }); } catch {}
  return col;
}

// Agent schema (stored fields): individualId (string), name, email, phone, region, status, createdAt, updatedAt, raw (optional original JSON)

// List agents (basic pagination optional via ?limit=&offset=)
app.get('/api/admin/agents', verifyAdmin, async (req,res)=>{
  try {
    const limit = Math.min(parseInt(req.query.limit)||100, 500);
    const skip = parseInt(req.query.offset)||0;
    const col = await getAgentsCollection();
    const cursor = col.find({}, { projection:{ _id:0 } }).sort({ createdAt:-1 }).skip(skip).limit(limit);
    const items = await cursor.toArray();
    res.json({ items, total: await col.estimatedDocumentCount() });
  } catch(e){ res.status(500).json({ error:'list_failed', message:e.message }); }
});

// Create new agent
app.post('/api/admin/agents', verifyAdmin, async (req,res)=>{
  try {
    const { individualId, name, email, phone, region, status, raw } = req.body||{};
    if(!individualId || !name) return res.status(400).json({ error:'missing_fields' });
    const now = new Date().toISOString();
    const doc = { individualId: String(individualId), name: String(name), email: email||null, phone: phone||null, region: region||null, status: status||'Active', raw: raw||null, createdAt: now, updatedAt: now };
    const col = await getAgentsCollection();
    await col.insertOne(doc);
    const { _id, ...clean } = doc;
    res.status(201).json(clean);
  } catch(e){
    if(e.code === 11000) return res.status(409).json({ error:'duplicate_individualId' });
    res.status(500).json({ error:'create_failed', message:e.message });
  }
});

// Get agent by individualId
app.get('/api/admin/agents/:id', verifyAdmin, async (req,res)=>{
  try {
    const id = req.params.id;
    const col = await getAgentsCollection();
    const doc = await col.findOne({ individualId: id }, { projection:{ _id:0 } });
    if(!doc) return res.status(404).json({ error:'not_found' });
    res.json(doc);
  } catch(e){ res.status(500).json({ error:'fetch_failed', message:e.message }); }
});

// Postgres (Mock Identity System) optional integration
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || 5455; // mapped host port to container's 5432
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const PG_DB_IDENTITY = process.env.PG_DB_IDENTITY || 'mosip_mockidentitysystem';
let pgIdentityClient; let pgIdentityReady = false;
async function getPgIdentity(){
  if(pgIdentityReady && pgIdentityClient) return pgIdentityClient;
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
  // remove sensitive fields
  delete copy.password; delete copy.pin; delete copy.encodedPhoto; // raw photo URL optional to hide
  return copy;
}

// Build summary record from identity_json
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

// List identities (summary)
app.get('/api/admin/identities', verifyAdmin, async (req,res)=>{
  try {
    let client; try { client = await getPgIdentity(); } catch { return res.json({ items:[], total:0, warning:'postgres_unavailable' }); }
    const limit = Math.min(parseInt(req.query.limit)||100, 500);
    const offset = parseInt(req.query.offset)||0;
    const result = await client.query('SELECT individual_id, identity_json FROM mockidentitysystem.mock_identity ORDER BY individual_id DESC OFFSET $1 LIMIT $2', [offset, limit]);
    const items = [];
    for(const row of result.rows){
      try { const parsed = JSON.parse(row.identity_json); items.push(summarizeIdentity(parsed)); } catch {}
    }
    res.json({ items, total: items.length });
  } catch(e){ res.status(500).json({ error:'identity_list_failed', message:e.message }); }
});

// Get full identity
app.get('/api/admin/identities/:id', verifyAdmin, async (req,res)=>{
  try {
    let client; try { client = await getPgIdentity(); } catch { return res.status(503).json({ error:'postgres_unavailable' }); }
    const id = req.params.id;
    const result = await client.query('SELECT identity_json FROM mockidentitysystem.mock_identity WHERE individual_id=$1 LIMIT 1', [id]);
    if(!result.rows.length) return res.status(404).json({ error:'not_found' });
    let parsed; try { parsed = JSON.parse(result.rows[0].identity_json); } catch { return res.status(500).json({ error:'parse_error' }); }
    res.json({ individualId: id, summary: summarizeIdentity(parsed), identity: sanitizeIdentity(parsed) });
  } catch(e){ res.status(500).json({ error:'identity_fetch_failed', message:e.message }); }
});

app.listen(PORT, ()=> console.log(`[backend] listening on ${PORT}`));
