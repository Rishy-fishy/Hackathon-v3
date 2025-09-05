import React, { useEffect, useState } from 'react';

export default function AdminChildren({ token }){
  const API_BASE = (process.env.REACT_APP_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3002' : '')).replace(/\/$/, '');
  const api = (path) => `${API_BASE}${path}`;
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=>{ if(token) fetchChildren(); },[token]);

  async function fetchChildren(){
    setLoading(true); setError(null);
    try{
      const resp = await fetch(api('/api/admin/children'), { headers:{ Authorization: `Bearer ${token}` } });
      const json = await resp.json();
      if(!resp.ok) throw new Error(json.error||'Failed to fetch');
      setChildren(json.items||json||[]);
    }catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="section-wrapper">
      <header className="section-header"><h1>Children</h1><p className="section-desc">View and search child records.</p></header>
      {loading && <div className="inline-loading">Loading…</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
      <div className="panel-card">
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr><th style={{textAlign:'left',padding:'8px'}}>Health ID</th><th style={{textAlign:'left',padding:'8px'}}>Name</th><th style={{textAlign:'left',padding:'8px'}}>DOB</th></tr></thead>
          <tbody>
            {children.map(c=> (
              <tr key={c.healthId}><td style={{padding:'8px'}}>{c.healthId}</td><td style={{padding:'8px'}}>{c.name||'—'}</td><td style={{padding:'8px'}}>{c.dob||'—'}</td></tr>
            ))}
            {!children.length && <tr><td colSpan={3} style={{padding:'12px',color:'#64748b'}}>No children found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
