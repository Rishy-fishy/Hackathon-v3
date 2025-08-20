import React, { useEffect, useState, useMemo } from 'react';
import { listChildRecords } from './db';

export default function RecordList() {
  const [records, setRecords] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const all = await listChildRecords();
    setRecords(all);
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
        <span className="badge pending">P {records.filter(r=>r.status==='pending').length}</span>
        <span className="badge uploading">U {records.filter(r=>r.status==='uploading').length}</span>
        <span className="badge failed">F {records.filter(r=>r.status==='failed').length}</span>
        <span className="badge uploaded">OK {records.filter(r=>r.status==='uploaded').length}</span>
      </div>
      <table className="records-table">
        <thead>
          <tr>
            <th>Health ID</th><th>Name</th><th>Age(m)</th><th>Status</th><th>Created</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.healthId} className={`status-${r.status}`}>
              <td>{r.healthId}</td>
              <td>{r.name}</td>
              <td>{r.ageMonths ?? '-'}</td>
              <td><span className={`status-badge ${r.status}`}>{r.status}</span></td>
              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {!filtered.length && <tr><td colSpan={5}>No matching records.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
