import React, { useEffect, useState } from 'react';

export default function AdminAgents({ token }){
  const API_BASE = (process.env.REACT_APP_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3002' : '')).replace(/\/$/, '');
  const api = (path) => `${API_BASE}${path}`;
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=>{ if(token) fetchAgents(); },[token]);

  async function fetchAgents(){
    setLoading(true); setError(null);
    try{
      const resp = await fetch(api('/api/admin/agents'), { headers:{ Authorization: `Bearer ${token}` } });
      const json = await resp.json();
      if(!resp.ok) throw new Error(json.error||'Failed to fetch');
      setAgents(json.items||json||[]);
    }catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="section-wrapper">
      <header className="section-header"><h1>Field Agents</h1><p className="section-desc">Overview of field agent activity and assignments.</p></header>
      {loading && <div className="inline-loading">Loading…</div>}
      {error && <div className="admin-error">{error}</div>}
      <div className="panel-card">
        <ul style={{listStyle:'none',margin:0,padding:0}}>
          {agents.map(a=> <li key={a.id} style={{padding:'8px 0',borderBottom:'1px solid #eef2f7'}}>{a.name} — {a.email||a.phone||'—'}</li>)}
          {!agents.length && <li style={{padding:'12px',color:'#64748b'}}>No agents found.</li>}
        </ul>
      </div>
    </div>
  );
}
