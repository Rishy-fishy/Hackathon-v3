// Sync logic: upload pending/failed records to backend when online & authenticated
import { pendingRecords, updateChildRecord, recordCounts, purgeOldUploaded } from './db';

const API_BASE = 'http://localhost:5000';

let lastSyncInfo = { time: null, result: null };

export function getLastSyncInfo() { return lastSyncInfo; }

export async function syncPendingRecords({ accessToken, uploaderName, retentionDays } = {}) {
  try {
    const token = accessToken || sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
  if (!token) return { skipped: true, reason: 'no_token' };
    const list = await pendingRecords();
    if (!list.length) {
      const counts = await recordCounts();
      window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
      return { skipped: true, reason: 'no_records' };
    }

    // Mark as uploading
    for (const r of list) {
      await updateChildRecord(r.healthId, { status: 'uploading' });
    }

  const res = await fetch(`${API_BASE}/api/child/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ records: list, uploaderName })
    });
    if (!res.ok) {
      for (const r of list) await updateChildRecord(r.healthId, { status: 'failed' });
  window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message:`Sync failed (${res.status})` } }));
  return { error: true, status: res.status };
    }
  const json = await res.json();
  lastSyncInfo = { time: Date.now(), result: json.summary };
    // Update statuses
    for (const r of json.results) {
      if (r.status === 'uploaded') await updateChildRecord(r.healthId, { status: 'uploaded', uploadedAt: Date.now() });
      else if (r.status === 'failed') await updateChildRecord(r.healthId, { status: 'failed' });
    }
  if (retentionDays) await purgeOldUploaded(retentionDays);
  const counts = await recordCounts();
  window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
  window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'success', message:`Synced ${json.summary.uploaded} records` } }));
  return json;
  } catch (e) {
    // revert to failed
    const list = await pendingRecords();
    for (const r of list) await updateChildRecord(r.healthId, { status: 'failed' });
  window.dispatchEvent(new CustomEvent('toast', { detail:{ type:'error', message:`Sync error: ${e.message}` } }));
  const counts = await recordCounts();
  window.dispatchEvent(new CustomEvent('sync-update', { detail:{ counts } }));
  return { error: true, message: e.message };
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
    await syncPendingRecords({ uploaderName: getUploaderName(), retentionDays: 7 });
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
