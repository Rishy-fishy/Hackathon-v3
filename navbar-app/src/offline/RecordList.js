import React, { useEffect, useState, useMemo } from 'react';
import { listChildRecords, updateChildRecord } from './db';
import { syncPendingRecords } from './sync';

export default function RecordList() {
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [retryTimers, setRetryTimers] = useState({});
  const [retryingRecords, setRetryingRecords] = useState(new Set());

  const load = async () => {
    const all = await listChildRecords();
    setRecords(all);
    
    // Start retry timers for failed records
    const failedRecords = all.filter(r => r.status === 'failed');
    const newTimers = {};
    
    failedRecords.forEach(record => {
      // Use uploadedAt (when it failed) or createdAt as fallback
      const failedTime = new Date(record.uploadedAt || record.createdAt).getTime();
      const now = Date.now();
      const elapsed = now - failedTime;
      
      if (elapsed >= 10000) {
        // Already past 10 seconds, show retry immediately
        newTimers[record.healthId] = 'ready';
      } else {
        // Set timer for remaining time
        const remainingTime = 10000 - elapsed;
        newTimers[record.healthId] = 'waiting';
        
        setTimeout(() => {
          setRetryTimers(prev => ({
            ...prev,
            [record.healthId]: 'ready'
          }));
        }, remainingTime);
      }
    });
    
    setRetryTimers(prev => {
      // Clear timers for records that are no longer failed
      const updated = {};
      failedRecords.forEach(record => {
        updated[record.healthId] = newTimers[record.healthId] || prev[record.healthId];
      });
      return updated;
    });
  };

  const retryFailedRecord = async (record) => {
    setRetryingRecords(prev => new Set([...prev, record.healthId]));
    
    try {
      // Reset record status to pending for retry
      await updateChildRecord(record.healthId, { status: 'pending' });
      
      // Get uploader info
      const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info');
      let uploaderName = 'manual_upload';
      let uploaderEmail = null;
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          uploaderName = u.name || uploaderName;
          uploaderEmail = u.email || null;
        } catch {}
      }
      
      // Attempt sync for this specific record
      const result = await syncPendingRecords({ uploaderName, uploaderEmail, allowNoToken: false });
      
      if (result && !result.error) {
        // Remove from retry timers if successful
        setRetryTimers(prev => {
          const updated = { ...prev };
          delete updated[record.healthId];
          return updated;
        });
        
        window.dispatchEvent(new CustomEvent('toast', { 
          detail: { type: 'success', message: `Successfully retried upload for ${record.name || record.healthId}` } 
        }));
      } else {
        // If still failed, restart the timer
        setTimeout(() => {
          setRetryTimers(prev => ({
            ...prev,
            [record.healthId]: 'ready'
          }));
        }, 10000);
        
        window.dispatchEvent(new CustomEvent('toast', { 
          detail: { type: 'error', message: `Retry failed for ${record.name || record.healthId}` } 
        }));
      }
      
      load(); // Refresh the list
    } catch (error) {
      console.error('Retry error:', error);
      window.dispatchEvent(new CustomEvent('toast', { 
        detail: { type: 'error', message: `Retry error: ${error.message}` } 
      }));
    } finally {
      setRetryingRecords(prev => {
        const updated = new Set(prev);
        updated.delete(record.healthId);
        return updated;
      });
    }
  };

  useEffect(()=>{ 
    load(); 
    const id = setInterval(load, 5000); // periodic refresh to reflect sync status changes
    return ()=> clearInterval(id);
  },[]);

  const filtered = useMemo(()=> {
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (r.healthId||'').toLowerCase().includes(q) || (r.name||'').toLowerCase().includes(q);
      }
      return true;
    });
  }, [records, statusFilter, search]);

  return (
    <div className="record-list" id="view-data">
      <h2>Local Records</h2>
      <div className="record-filters">
        <input placeholder="Search healthId / name" value={search} onChange={e=> setSearch(e.target.value)} />
        <select value={statusFilter} onChange={e=> setStatusFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="uploading">Uploading</option>
          <option value="failed">Failed</option>
          <option value="uploaded">Uploaded</option>
        </select>
  <button type="button" className="upload-btn" disabled={!(sessionStorage.getItem('esignet_authenticated')==='true' || localStorage.getItem('is_authenticated')==='true')} onClick={async ()=> { const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info'); let uploaderName='manual_upload'; let uploaderEmail=null; if(userStr){ try{ const u=JSON.parse(userStr); uploaderName = u.name || uploaderName; uploaderEmail = u.email || null; }catch{} } await syncPendingRecords({ uploaderName, uploaderEmail, allowNoToken:false }); load(); }}>Upload</button>
        
        <span className="badge pending">P {records.filter(r=>r.status==='pending').length}</span>
        <span className="badge uploading">U {records.filter(r=>r.status==='uploading').length}</span>
        <span className="badge failed">F {records.filter(r=>r.status==='failed').length}</span>
        <span className="badge uploaded">OK {records.filter(r=>r.status==='uploaded').length}</span>
      </div>
      <table className="records-table">
        <thead>
          <tr>
            <th>Health ID</th><th>Name</th><th>Age(m)</th><th>Status</th><th>Created</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.healthId} className={`status-${r.status}`}>
              <td>{r.healthId}</td>
              <td>{r.name}</td>
              <td>{r.ageMonths ?? '-'}</td>
              <td>
                <span className={`status-badge ${r.status}`}>{r.status}</span>
                {r.status === 'failed' && retryTimers[r.healthId] === 'waiting' && (
                  <span className="retry-countdown" title="Retry available in 10 seconds">⏳</span>
                )}
              </td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
              <td>
                {r.status === 'failed' && retryTimers[r.healthId] === 'ready' && (
                  <button
                    type="button"
                    className="retry-btn"
                    onClick={() => retryFailedRecord(r)}
                    disabled={retryingRecords.has(r.healthId)}
                    title="Retry failed upload"
                  >
                    {retryingRecords.has(r.healthId) ? '⏳' : '🔄'}
                  </button>
                )}
                {r.status === 'failed' && retryTimers[r.healthId] === 'waiting' && (
                  <span className="retry-waiting" title="Retry will be available after 10 seconds">
                    Wait 10s
                  </span>
                )}
              </td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={6}>No matching records.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
