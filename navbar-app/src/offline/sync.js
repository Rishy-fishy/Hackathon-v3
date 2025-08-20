// Sync logic: upload pending/failed records to backend when online & authenticated
import { pendingRecords, updateChildRecord } from './db';

const API_BASE = 'http://localhost:5000';

export async function syncPendingRecords({ accessToken, uploaderName } = {}) {
  try {
    const token = accessToken || sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    if (!token) return { skipped: true, reason: 'no_token' };
    const list = await pendingRecords();
    if (!list.length) return { skipped: true, reason: 'no_records' };

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
      return { error: true, status: res.status };
    }
    const json = await res.json();
    // Update statuses
    for (const r of json.results) {
      if (r.status === 'uploaded') await updateChildRecord(r.healthId, { status: 'uploaded', uploadedAt: Date.now() });
      else if (r.status === 'failed') await updateChildRecord(r.healthId, { status: 'failed' });
    }
    return json;
  } catch (e) {
    // revert to failed
    const list = await pendingRecords();
    for (const r of list) await updateChildRecord(r.healthId, { status: 'failed' });
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
    await syncPendingRecords({ uploaderName: getUploaderName() });
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
