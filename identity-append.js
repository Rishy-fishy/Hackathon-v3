// IDENTITY_APPEND_MARKER_START 2025-09-23
import { Client as PgClient } from 'pg';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || 5455;
const PG_USER = process.env.PG_USER || 'postgres';
const PG_PASSWORD = process.env.PG_PASSWORD || 'postgres';
const PG_DB_IDENTITY = process.env.PG_DB_IDENTITY || 'mosip_mockidentitysystem';
let pgIdentityClient; let pgIdentityReady = false;
async function getPgIdentity(){
  if(pgIdentityReady && pgIdentityClient) return pgIdentityClient;
  pgIdentityClient = new PgClient({ host: PG_HOST, port: PG_PORT, user: PG_USER, password: PG_PASSWORD, database: PG_DB_IDENTITY });
  try { await pgIdentityClient.connect(); pgIdentityReady = true; console.log('[identity] Connected to Postgres'); } catch(e){ console.warn('[identity] Postgres connect failed:', e.message); throw e; }
  return pgIdentityClient;
}
function sanitizeIdentity(full){ if(!full) return null; const c={...full}; delete c.password; delete c.pin; delete c.encodedPhoto; return c; }
function summarizeIdentity(idJson){ if(!idJson) return null; const first=(arr)=>Array.isArray(arr)&&arr.length?(arr[0].value||arr[0]):null; const lang=(arr,l)=>Array.isArray(arr)?(arr.find(e=>e.language===l)?.value||first(arr)):null; return { individualId:idJson.individualId, name: lang(idJson.fullName,'eng')||lang(idJson.givenName,'eng')||idJson.individualId, email:idJson.email||null, phone:idJson.phone||null, dateOfBirth:idJson.dateOfBirth||null, country:lang(idJson.country,'eng'), region:lang(idJson.region,'eng'), gender:lang(idJson.gender,'eng'), createdAt:idJson.createdAt||null }; }
app.get('/api/admin/identities', async (req,res)=>{ try { const auth=req.headers.authorization||''; const token=auth.startsWith('Bearer ')?auth.slice(7):null; const session=await validateAuthToken(token); if(!session) return res.status(401).json({ error:'unauthorized' }); let client; try { client = await getPgIdentity(); } catch { return res.json({ items:[], total:0, warning:'postgres_unavailable' }); } const limit=Math.min(parseInt(req.query.limit)||100,500); const offset=parseInt(req.query.offset)||0; const result=await client.query('SELECT individual_id, identity_json FROM mockidentitysystem.mock_identity ORDER BY individual_id DESC OFFSET $1 LIMIT $2',[offset, limit]); const items=[]; for(const row of result.rows){ try { const parsed=JSON.parse(row.identity_json); items.push(summarizeIdentity(parsed)); } catch{} } return res.json({ items, total: items.length }); } catch(e){ console.error('[identity] list failed', e); return res.status(500).json({ error:'identity_list_failed' }); }});
app.get('/api/admin/identities/:id', async (req,res)=>{ try { const auth=req.headers.authorization||''; const token=auth.startsWith('Bearer ')?auth.slice(7):null; const session=await validateAuthToken(token); if(!session) return res.status(401).json({ error:'unauthorized' }); let client; try { client = await getPgIdentity(); } catch { return res.status(503).json({ error:'postgres_unavailable' }); } const id=req.params.id; const result=await client.query('SELECT identity_json FROM mockidentitysystem.mock_identity WHERE individual_id=$1 LIMIT 1',[id]); if(!result.rows.length) return res.status(404).json({ error:'not_found' }); let parsed; try { parsed=JSON.parse(result.rows[0].identity_json); } catch { return res.status(500).json({ error:'parse_error' }); } return res.json({ individualId:id, summary: summarizeIdentity(parsed), identity: sanitizeIdentity(parsed) }); } catch(e){ console.error('[identity] fetch failed', e); return res.status(500).json({ error:'identity_fetch_failed' }); }});
// IDENTITY_APPEND_MARKER_END 2025-09-23
