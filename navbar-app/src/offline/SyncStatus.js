import React, { useEffect, useState } from 'react';
import { recordCounts } from './db';
import { syncPendingRecords, getLastSyncInfo } from './sync';

export default function SyncStatus() {
  const [counts, setCounts] = useState({ pending:0, failed:0, uploaded:0 });
  const [busy, setBusy] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const refresh = async () => {
    setCounts(await recordCounts());
    const info = getLastSyncInfo();
    setLastSync(info.time ? new Date(info.time).toLocaleTimeString() : null);
  };

  const manualSync = async () => {
    if (busy) return;
    setBusy(true);
    await syncPendingRecords({ uploaderName: getUploaderName(), retentionDays:7 });
    await refresh();
    setBusy(false);
  };

  function getUploaderName() {
    try {
      const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info');
      if (!userStr) return null;
      const user = JSON.parse(userStr);
      return user.name || user.preferred_username || null;
    } catch { return null; }
  }

  useEffect(()=>{ refresh(); const id = setInterval(refresh, 8000); return ()=> clearInterval(id); },[]);

  return (
    <div className="sync-status">
      <div className="sync-row">
        <span>Pending: {counts.pending}</span>
        <span>Failed: {counts.failed}</span>
        <span>Uploaded: {counts.uploaded}</span>
        <button onClick={manualSync} disabled={busy}>
          {busy? 'Syncing...' : 'Sync Now'}
        </button>
      </div>
      <div className="sync-row meta">
        <span>Last Sync: {lastSync || '—'}</span>
      </div>
    </div>
  );
}
