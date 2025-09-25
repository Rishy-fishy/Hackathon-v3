// DEPLOY_MARKER: SERVER_MERGED_ACTIVE_2025-09-23T02:00Z
// This file consolidates original server.js plus Postgres identity endpoints.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { Client as PgClient } from 'pg';

// ----- OIDC Config -----
const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, REDIRECT_URI } = process.env;
const OIDC_READY = !!(OIDC_ISSUER && OIDC_CLIENT_ID && REDIRECT_URI);

console.log('[diag] Starting server-merged PID', process.pid);
console.log('[diag] Node', process.version, 'PORT=', process.env.PORT);

// Add error handlers to prevent server crashes
process.on('uncaughtException', (error) => {
  console.error('[ERROR] Uncaught Exception:', error.message);
  console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
app.use(cors({ origin:true, credentials:false }));

// JSON parsing middleware
app.use(express.json({ 
  limit:'5mb'
}));

// ----- Mongo Setup (hardcoded MongoDB Atlas URI) -----
const MONGO_URI = "mongodb+srv://harshbontala188:8I52Oqeh3sWYTDJ7@cluster0.5lsiap2.mongodb.net/childBooklet?retryWrites=true&w=majority&appName=Cluster0";
const MONGO_DB = process.env.MONGO_DB || 'childBooklet';
let mongoClient; let mongoDb;
async function initMongo(){
  if (mongoDb) return mongoDb;
  if(!MONGO_URI){
    console.warn('[startup] No Mongo URI provided; Mongo-backed routes limited.');
    return null;
  }
  try {
    mongoClient = new MongoClient(MONGO_URI, { ignoreUndefined:true });
    await mongoClient.connect();
    mongoDb = mongoClient.db(MONGO_DB);
    console.log('[backend] Connected MongoDB');
    const child = mongoDb.collection('child_records');
    await Promise.all([
      child.createIndex({ healthId:1 }, { unique:true }),
      child.createIndex({ createdAt:-1 })
    ]);
    const adminCol = mongoDb.collection('admin_users');
    await adminCol.createIndex({ username:1 }, { unique:true });
    const existing = await adminCol.findOne({ username:'Admin' });
    if(!existing){
      const hash = await bcrypt.hash('Admin@123', 10);
      await adminCol.insertOne({ username:'Admin', passwordHash:hash, roles:['admin'], createdAt:new Date() });
      console.log('[backend] Seeded default Admin user');
    }
  } catch(e){
    console.error('[backend] Mongo connect failed', e.message);
  }
  return mongoDb;
}

// ----- Basic Health -----
app.get('/health', (_req,res)=> res.json({ status:'ok', time:Date.now() }));
app.get('/', (_req,res)=> res.json({ service:'navbar-backend', merged:true }));

// ----- OIDC Exchange (if configured) -----
if (OIDC_READY) app.post('/exchange-token', async (req,res)=>{
  try {
    const { code } = req.body||{}; if(!code) return res.status(400).json({ error:'missing_code' });
    const discovery = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`).then(r=>r.json());
    const tokenEndpoint = discovery.token_endpoint;
    const params = new URLSearchParams();
    params.set('grant_type','authorization_code');
    params.set('code', code);
    params.set('redirect_uri', REDIRECT_URI);
    params.set('client_id', OIDC_CLIENT_ID);
    if(OIDC_CLIENT_SECRET) params.set('client_secret', OIDC_CLIENT_SECRET);
    const tokenResp = await fetch(tokenEndpoint,{ method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: params.toString() });
    const tokenJson = await tokenResp.json();
    if(!tokenResp.ok) return res.status(tokenResp.status).json(tokenJson);
    res.json(tokenJson);
  } catch(e){ res.status(500).json({ error:'exchange_failed', message:e.message }); }
});

// ----- Admin Auth (JWT or memory) -----
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
const ADMIN_SESSION_TTL_MS = 30*60*1000;
const adminSessions = new Map();
function randomHex(n=24){ return Buffer.from(Array.from({length:n},()=>Math.floor(Math.random()*256))).toString('hex'); }
async function issueToken(username){
  if(ADMIN_JWT_SECRET){
    const secret = new TextEncoder().encode(ADMIN_JWT_SECRET);
    const jwt = await new SignJWT({ sub:username, role:'admin' }).setProtectedHeader({ alg:'HS256'}).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)+ADMIN_SESSION_TTL_MS/1000).sign(secret);
    return { token:jwt, mode:'jwt' };
  }
  const token = randomHex();
  adminSessions.set(token,{ username, expires:Date.now()+ADMIN_SESSION_TTL_MS });
  return { token, mode:'memory' };
}
async function validateAuthToken(raw){
  if(!raw) return null;
  if(ADMIN_JWT_SECRET){
    try { const secret = new TextEncoder().encode(ADMIN_JWT_SECRET); const { payload } = await jwtVerify(raw, secret, { algorithms:['HS256'] }); if(payload.role!=='admin') return null; return { username:payload.sub }; } catch { return null; }
  }
  const s = adminSessions.get(raw); if(!s) return null; if(s.expires < Date.now()){ adminSessions.delete(raw); return null; } return { username:s.username };
}
if(!ADMIN_JWT_SECRET){ setInterval(()=>{ const now=Date.now(); for(const [k,v] of adminSessions.entries()) if(v.expires<now) adminSessions.delete(k); }, 300000).unref(); }

app.post('/api/admin/login', async (req,res)=>{
  try {
    const { username, password } = req.body||{};
    if(!username || !password) return res.status(400).json({ error:'missing_credentials' });
    await initMongo();
    if(username !== 'Admin') return res.status(401).json({ error:'invalid_credentials' });
    // In this merged version we always hash-check the default password.
    const ok = password === 'Admin@123';
    if(!ok) return res.status(401).json({ error:'invalid_credentials' });
    const { token, mode } = await issueToken(username);
    res.json({ token, mode, username, expiresIn: ADMIN_SESSION_TTL_MS/1000 });
  } catch(e){ res.status(500).json({ error:'login_failed', message:e.message }); }
});

app.get('/api/admin/stats', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token); if(!session) return res.status(401).json({ error:'unauthorized' });
    await initMongo(); if(!mongoDb) return res.json({ totalChildRecords:0, recentUploads:[], warning:'mongo_disabled' });
    const col = mongoDb.collection('child_records');
    const totalChildRecords = await col.countDocuments();
    const recentUploads = await col.find({}, { projection:{ _id:0, healthId:1, name:1, uploadedAt:1 } }).sort({ uploadedAt:-1 }).limit(5).toArray();
    res.json({ totalChildRecords, recentUploads });
  } catch(e){ res.status(500).json({ error:'stats_failed', message:e.message }); }
});

// ----- Postgres Mock Identity Integration -----
const PG_HOST = process.env.PG_HOST || '34.58.198.143';
const PG_PORT = parseInt(process.env.PG_PORT || '5455',10);
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const PG_DB_IDENTITY = process.env.PG_DB_IDENTITY || 'mosip_mockidentitysystem';
let pgIdentityClient; let pgReady=false;

// Initialize PostgreSQL connection with retry logic
async function initPgIdentity(){
  if(pgReady && pgIdentityClient) return pgIdentityClient;
  
  const maxRetries = 5;
  let retryCount = 0;
  
  while(retryCount < maxRetries) {
    try {
      if(pgIdentityClient) {
        try { await pgIdentityClient.end(); } catch(e) {}
      }
      
      pgIdentityClient = new PgClient({ 
        host: PG_HOST, 
        port: PG_PORT, 
        user: PG_USER, 
        password: PG_PASSWORD, 
        database: PG_DB_IDENTITY,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 1
      });
      
      await pgIdentityClient.connect(); 
      pgReady = true; 
      console.log('[backend] Connected Postgres mockidentitysystem');
      
      // Add connection error handlers
      pgIdentityClient.on('error', (err) => {
        console.error('[postgres] Connection error:', err.message);
        pgReady = false;
      });
      
      return pgIdentityClient;
    } catch(e) { 
      retryCount++;
      console.warn(`[backend] Postgres connect attempt ${retryCount}/${maxRetries} failed:`, e.message);
      if(retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // exponential backoff
      } else {
        throw e;
      }
    }
  }
}

async function getPgIdentity(){
  if(pgReady && pgIdentityClient) return pgIdentityClient;
  return await initPgIdentity();
}
function sanitizeIdentity(full){ if(!full) return null; const c={...full}; delete c.password; delete c.pin; delete c.encodedPhoto; return c; }
function summarizeIdentity(js){ if(!js) return null; const first=a=>Array.isArray(a)&&a.length?(a[0].value||a[0]):null; const find=(a,l)=>Array.isArray(a)?(a.find(x=>x.language===l)?.value||first(a)):null; return { individualId: js.individualId, name: find(js.fullName,'eng')||find(js.givenName,'eng')||js.individualId, email: js.email||null, phone: js.phone||null, dateOfBirth: js.dateOfBirth||null, country: find(js.country,'eng'), region: find(js.region,'eng'), gender: find(js.gender,'eng'), createdAt: js.createdAt||null }; }

app.get('/api/admin/identities', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session && (process.env.ADMIN_JWT_SECRET || MONGO_URI)) return res.status(401).json({ error:'unauthorized' });
    let client; try { client = await getPgIdentity(); } catch { return res.json({ items:[], total:0, warning:'postgres_unavailable' }); }
    const limit = Math.min(parseInt(req.query.limit)||100,500); const offset = parseInt(req.query.offset)||0;
    const result = await client.query('SELECT individual_id, identity_json FROM mockidentitysystem.mock_identity ORDER BY individual_id DESC OFFSET $1 LIMIT $2',[offset,limit]);
    const items=[]; for(const row of result.rows){ try { const p=JSON.parse(row.identity_json); items.push(summarizeIdentity(p)); } catch {} }
    res.json({ items, total: items.length });
  } catch(e){ res.status(500).json({ error:'identity_list_failed', message:e.message }); }
});

app.get('/api/admin/identities/:id', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session && (process.env.ADMIN_JWT_SECRET || MONGO_URI)) return res.status(401).json({ error:'unauthorized' });
    let client; try { client = await getPgIdentity(); } catch { return res.status(503).json({ error:'postgres_unavailable' }); }
    const id = req.params.id;
    const result = await client.query('SELECT identity_json FROM mockidentitysystem.mock_identity WHERE individual_id=$1 LIMIT 1',[id]);
    if(!result.rows.length) return res.status(404).json({ error:'not_found' });
    let parsed; try { parsed = JSON.parse(result.rows[0].identity_json); } catch { return res.status(500).json({ error:'parse_error' }); }
    res.json({ individualId:id, summary:summarizeIdentity(parsed), identity:sanitizeIdentity(parsed) });
  } catch(e){ res.status(500).json({ error:'identity_fetch_failed', message:e.message }); }
});

// Get all child records for admin panel
app.get('/api/admin/children', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token); 
    if(!session) return res.status(401).json({ error:'unauthorized' });
    
    await initMongo(); 
    if(!mongoDb) return res.json({ records:[], total:0, warning:'mongo_disabled' });
    
    const col = mongoDb.collection('child_records');
    const limit = Math.min(parseInt(req.query.limit)||1000, 1000); // Allow up to 1000 records
    const offset = parseInt(req.query.offset)||0;
    
    const records = await col.find({}, { 
      projection:{ _id:0 } 
    }).sort({ uploadedAt:-1 }).skip(offset).limit(limit).toArray();
    
    const total = await col.countDocuments();
    
    res.json({ records, total, limit, offset });
  } catch(e){ 
    console.error('[admin/children] Error:', e.message);
    res.status(500).json({ error:'fetch_failed', message:e.message }); 
  }
});

// Update child record
app.put('/api/admin/child/:id', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) return res.status(401).json({ error:'unauthorized' });
    
    await initMongo();
    if(!mongoDb) return res.status(503).json({ error:'mongo_disabled' });
    
    const col = mongoDb.collection('child_records');
    const healthId = req.params.id;
    const updateData = req.body;
    
    // Clean and validate update data
    const cleanUpdate = {};
    const allowedFields = ['name', 'gender', 'dateOfBirth', 'weightKg', 'heightCm', 'malnutritionStatus', 
                          'guardianName', 'phoneNumber', 'relation', 'aadhaarId', 'location', 
                          'representative', 'photoData'];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        cleanUpdate[field] = updateData[field];
      }
    });
    
    // Add updated timestamp
    cleanUpdate.updatedAt = new Date();
    
    const result = await col.updateOne(
      { healthId: healthId },
      { $set: cleanUpdate }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error:'not_found', message:'Child record not found' });
    }
    
    // Return updated record
    const updatedRecord = await col.findOne({ healthId: healthId }, { projection: { _id: 0 } });
    
    res.json({ 
      message: 'Record updated successfully',
      record: updatedRecord,
      modifiedCount: result.modifiedCount
    });
  } catch(e){
    console.error('[admin/child/update] Error:', e.message);
    res.status(500).json({ error:'update_failed', message:e.message });
  }
});

// Delete child record
app.delete('/api/admin/child/:id', async (req,res)=>{
  try {
    const auth = req.headers.authorization||''; const token = auth.startsWith('Bearer ')? auth.slice(7): null;
    const session = await validateAuthToken(token);
    if(!session) return res.status(401).json({ error:'unauthorized' });
    
    await initMongo();
    if(!mongoDb) return res.status(503).json({ error:'mongo_disabled' });
    
    const col = mongoDb.collection('child_records');
    const healthId = req.params.id;
    
    const result = await col.deleteOne({ healthId: healthId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error:'not_found', message:'Child record not found' });
    }
    
    res.json({ 
      message: 'Record deleted successfully',
      deletedCount: result.deletedCount,
      healthId: healthId
    });
  } catch(e){
    console.error('[admin/child/delete] Error:', e.message);
    res.status(500).json({ error:'delete_failed', message:e.message });
  }
});

// Batch upload endpoint for child records (used by frontend upload button)
app.post('/api/child/batch', async (req,res)=>{
  try {
    console.log('[child/batch] Processing batch upload request');
    
    await initMongo();
    if(!mongoDb) return res.status(503).json({ error:'mongo_disabled', message:'Database unavailable' });
    
    const { records, uploaderName, uploaderEmail, uploaderLocation } = req.body;
    
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error:'invalid_request', message:'records array is required' });
    }
    
    const results = [];
    const col = mongoDb.collection('child_records');
    
    for (const record of records) {
      try {
        // Add upload metadata
        const recordWithMetadata = {
          ...record,
          uploaderName: uploaderName || 'unknown',
          uploaderEmail: uploaderEmail || null,
          uploaderLocation: uploaderLocation || null,
          uploadedAt: new Date().toISOString(),
          source: 'offline_batch'
        };
        
        // Insert or update record
        const result = await col.replaceOne(
          { healthId: record.healthId },
          recordWithMetadata,
          { upsert: true }
        );
        
        results.push({
          healthId: record.healthId,
          status: 'uploaded',
          operation: result.upsertedId ? 'inserted' : 'updated'
        });
        
        console.log(`[child/batch] ${result.upsertedId ? 'Inserted' : 'Updated'} record ${record.healthId}`);
        
      } catch (recordError) {
        console.error(`[child/batch] Failed to process record ${record.healthId}:`, recordError.message);
        results.push({
          healthId: record.healthId,
          status: 'failed',
          error: recordError.message
        });
      }
    }
    
    const uploaded = results.filter(r => r.status === 'uploaded').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`[child/batch] Batch complete: ${uploaded} uploaded, ${failed} failed`);
    
    res.json({
      success: true,
      summary: { uploaded, failed, total: records.length },
      results: results
    });
    
  } catch(e){
    console.error('[child/batch] Error:', e.message);
    res.status(500).json({ error:'batch_failed', message:e.message });
  }
});

// Global error handler for Express routes
app.use((error, req, res, next) => {
  console.error('[ERROR] Express error handler:', error.message);
  console.error('Request:', req.method, req.path, req.headers['content-type']);
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json', message: 'Request contains invalid JSON' });
  }
  
  res.status(500).json({ error: 'internal_server_error', message: 'An unexpected error occurred' });
});

// Handle 404s
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

const PORT = parseInt(process.env.PORT||'8080',10);
app.listen(PORT, '0.0.0.0', async ()=>{
  console.log('[backend] server-merged listening on', PORT);
  console.log('[startup] Identities endpoints active: /api/admin/identities[/ :id]');
  
  // Initialize PostgreSQL connection on startup
  try {
    await initPgIdentity();
    console.log('[startup] PostgreSQL connection initialized successfully');
  } catch (error) {
    console.error('[startup] Failed to initialize PostgreSQL:', error.message);
    console.error('[startup] Identity endpoints will attempt reconnection on first request');
  }
});
