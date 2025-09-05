import React, { useEffect, useState } from 'react';

export default function AdminLocations({ token }){
  const API_BASE = (process.env.REACT_APP_API_BASE || (window.location.hostname === 'localhost' ? 'http://localhost:3002' : '')).replace(/\/$/, '');
  const api = (path) => `${API_BASE}${path}`;
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=>{ if(token) fetchLocations(); },[token]);

  async function fetchLocations(){
    setLoading(true); setError(null);
    try{
      const resp = await fetch(api('/api/admin/locations'), { headers:{ Authorization: `Bearer ${token}` } });
      const json = await resp.json();
      if(!resp.ok) throw new Error(json.error||'Failed to fetch');
      setLocations(json.items||json||[]);
    }catch(e){ setError(e.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="section-wrapper">
      <header className="section-header"><h1>Locations</h1><p className="section-desc">Administrative locations and coverage.</p></header>
      {loading && <div className="inline-loading">Loading…</div>}
      {error && <div className="admin-error">{error}</div>}
      <div className="panel-card">
        <ul style={{listStyle:'none',margin:0,padding:0}}>
          {locations.map(l=> <li key={l.code} style={{padding:'8px 0',borderBottom:'1px solid #eef2f7'}}>{l.name} — {l.code}</li>)}
          {!locations.length && <li style={{padding:'12px',color:'#64748b'}}>No locations found.</li>}
        </ul>
      </div>
    </div>
  );
}
