// Sync logic: upload pending/failed records to backend when online & authenticated
import { pendingRecords, updateChildRecord, recordCounts, purgeOldUploaded } from './db';

// Cloud Run backend base URL resolution (first non-empty wins):
// 1. window.__API_BASE (runtime-config.js)
// 2. REACT_APP_API_BASE (build-time)
// 3. Fallback to current deployed clean backend URL
const API_BASE = (
  (typeof window !== 'undefined' && window.__API_BASE) ||
  process.env.REACT_APP_API_BASE ||
  'https://navbar-backend-clean-87485236346.us-central1.run.app'
).replace(/\/$/, '');

let lastSyncInfo = { time: null, result: null };
let syncInProgress = false;

export function getLastSyncInfo() { return lastSyncInfo; }

export async function syncPendingRecords({ accessToken, uploaderName, uploaderEmail, retentionDays, allowNoToken } = {}) {
  if (syncInProgress) {
    console.log('⏳ Sync already in progress, skipping...');
    return { skipped: true, reason: 'sync_in_progress' };
  }
  
  syncInProgress = true;
  
  try {
    const token = accessToken || 
      sessionStorage.getItem('access_token') || 
      sessionStorage.getItem('raw_esignet_access_token') ||
      localStorage.getItem('access_token');
    
    if (!token && !allowNoToken) {
      console.log('🚫 No token available for sync');
      return { skipped: true, reason: 'no_token' };
    }
    
    console.log('🔄 Starting sync to:', `${API_BASE}/api/child/batch`);
    const list = await pendingRecords();
    console.log(`📊 Found ${list.length} records to sync`);
    
    if (!list.length) {
      const counts = await recordCounts();
      window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
      return { skipped: true, reason: 'no_records' };
    }

    // Mark as uploading
    console.log('🔄 Marking records as uploading...');
    for (const r of list) {
      await updateChildRecord(r.healthId, { status: 'uploading' });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const uploaderLocation = getUploaderLocation(); // Get location data from session storage
    
    console.log('📡 Sending request to backend...');
    const res = await fetch(`${API_BASE}/api/child/batch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        records: list, 
        uploaderName, 
        uploaderEmail,
        uploaderLocation // Include location data in the request
      })
    });
    
    console.log(`📬 Backend response: ${res.status} ${res.statusText}`);
    
    if (!res.ok) {
      console.error('❌ Sync failed with status:', res.status);
      for (const r of list) await updateChildRecord(r.healthId, { status: 'failed' });
  window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message:`Sync failed (${res.status})` } }));
  return { error: true, status: res.status };
    }
    
    console.log('✅ Parsing response...');
    const json = await res.json();
    console.log('📄 Backend response data:', json);
    
    lastSyncInfo = { time: Date.now(), result: json.summary };
    
    // Update statuses
    console.log('🔄 Updating record statuses...');
    for (const r of json.results) {
      if (r.status === 'uploaded') {
        await updateChildRecord(r.healthId, { status: 'uploaded', uploadedAt: new Date().toISOString() });
        console.log(`✅ Marked ${r.healthId} as uploaded`);
      } else if (r.status === 'failed') {
        await updateChildRecord(r.healthId, { status: 'failed' });
        console.log(`❌ Marked ${r.healthId} as failed`);
      }
    }
    
    if (retentionDays) await purgeOldUploaded(retentionDays);
    const counts = await recordCounts();
    window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
    window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'success', message:`Synced ${json.summary.uploaded} records` } }));
    
    console.log('🎉 Sync completed successfully!', json.summary);
    return json;
  } catch (e) {
    console.error('❌ Sync error occurred:', e.message);
    // revert to failed
    const list = await pendingRecords();
    for (const r of list) await updateChildRecord(r.healthId, { status: 'failed' });
    window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message:`Sync error: ${e.message}` } }));
    const counts = await recordCounts();
    window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
    return { error: true, message: e.message };
  } finally {
    syncInProgress = false;
  }
}

// Initialize auto-sync polling
let started = false;
export function startAutoSync(intervalMs = 15000) {
  if (started) return;
  started = true;
  const tick = async () => {
    if (!navigator.onLine) return;
    const auth = sessionStorage.getItem('esignet_authenticated') === 'true' || localStorage.getItem('is_authenticated') === 'true';
    if (!auth) return;
    await syncPendingRecords({ 
      uploaderName: getUploaderName(), 
      retentionDays: 7,
      uploaderLocation: getUploaderLocation()
    });
  };
  setInterval(tick, intervalMs);
  // Run once after short delay
  setTimeout(tick, 3000);
}

function getUploaderName() {
  try {
    const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return user.name || user.preferred_username || null;
  } catch { return null; }
}

// Get uploader location data from session storage (set by Header component)
function getUploaderLocation() {
  try {
    const locationStr = sessionStorage.getItem('user_location');
    if (!locationStr) return null;
    const location = JSON.parse(locationStr);
    return location;
  } catch { return null; }
}
