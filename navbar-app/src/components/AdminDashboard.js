import React, { useEffect, useState } from 'react';

export default function AdminDashboard({ token }) {
  const API_BASE = (process.env.REACT_APP_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3002' : '')).replace(/\/$/, '');
  const api = (path) => `${API_BASE}${path}`;
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=>{ if(token) fetchStats(); },[token]);

  async function fetchStats(){
    setLoading(true); setError(null);
    try{
      const resp = await fetch(api('/api/admin/stats'), { headers: { Authorization: `Bearer ${token}` } });
      const json = await resp.json();
      if(!resp.ok) throw new Error(json.error || 'Failed to load stats');
      setStats(json);
    }catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="section-wrapper">
      <header className="section-header">
        <h1>Dashboard</h1>
        <p className="section-desc">Overview of key child health record metrics and recent activity.</p>
      </header>

      {loading && <div className="inline-loading">Loading stats…</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}

      <div className="cards-grid">
        <div className="metric-card">
          <div className="metric-label">Total Child Records</div>
          <div className="metric-value">{stats?.totalChildRecords ?? '—'}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Recent Uploads (24h)</div>
          <div className="metric-value">{stats?.recentUploads ? stats.recentUploads.length : '—'}</div>
        </div>
      </div>

      <div className="recent-card">
        <div className="recent-head">Recent Uploads</div>
        {stats?.recentUploads?.length ? (
          <ul className="recent-list">
            {stats.recentUploads.map(r=> (
              <li key={r.healthId} className="recent-row">
                <span className="r1">{r.healthId}</span>
                <span className="r2">{r.name || '—'}</span>
                <span className="r3">{r.uploadedAt ? new Date(r.uploadedAt).toLocaleString() : '—'}</span>
              </li>
            ))}
          </ul>
        ) : <div className="empty small">No uploads yet.</div>}
      </div>
    </div>
  );
}
