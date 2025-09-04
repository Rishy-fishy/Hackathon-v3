import React, { useState, useEffect } from 'react';
import './AdminPage.css';

// Backend endpoints expected:
// POST /api/admin/login { username, password } -> { token, username, expiresIn }
// GET  /api/admin/stats  (Authorization: Bearer <token>) -> { totalChildRecords, recentUploads }

export default function AdminPage() {
  const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/$/,'');
  const api = (path) => `${API_BASE}${path}`;
  const [username,setUsername] = useState('');
  const [password,setPassword] = useState('');
  const [token,setToken] = useState(null);
  const [error,setError] = useState(null);
  const [stats,setStats] = useState(null);
  const [loading,setLoading] = useState(false);

  // Load token from sessionStorage (so refresh keeps session) but never store password.
  useEffect(()=>{
    const t = sessionStorage.getItem('admin_token');
    if (t) setToken(t);
  },[]);

  useEffect(()=>{
    if (token) fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  async function login(e){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
  const resp = await fetch(api('/api/admin/login'), {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password })
      });
      const json = await resp.json();
      if(!resp.ok){ setError(json.error||'Login failed'); return; }
      setToken(json.token);
      sessionStorage.setItem('admin_token', json.token);
      setPassword(''); // clear password field
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  async function fetchStats(){
    setLoading(true);
    setError(null);
    try {
  const resp = await fetch(api('/api/admin/stats'), { headers:{ Authorization: `Bearer ${token}` }});
      const json = await resp.json();
      if(!resp.ok){
        if (resp.status === 401){
          sessionStorage.removeItem('admin_token');
          setToken(null);
        }
        setError(json.error||'Failed to fetch stats');
        return;
      }
      setStats(json);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  function logout(){
    sessionStorage.removeItem('admin_token');
    setToken(null);
    setStats(null);
  }

  if(!token){
    return (
      <div className="admin-page">
        <h2>Admin Login</h2>
        <form onSubmit={login} className="admin-login-form">
          <label>Username
            <input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          <button type="submit" disabled={loading}>{loading? 'Signing in...':'Login'}</button>
          {error && <div className="admin-error" role="alert">{error}</div>}
          <p className="admin-hint">Default admin: Admin / Admin@123 (hash stored in DB). Change password directly in MongoDB collection 'admin_users'.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-bar">
        <h2>Admin Dashboard</h2>
        <div className="admin-actions">
          <button onClick={fetchStats} disabled={loading}>Refresh</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>
      {loading && <div className="admin-loading">Loading...</div>}
      {error && <div className="admin-error" role="alert">{error}</div>}
      {stats && (
        <div className="admin-stats">
          <div className="stat-box">
            <div className="stat-label">Total Child Records</div>
            <div className="stat-value">{stats.totalChildRecords}</div>
          </div>
          <div className="recent-uploads">
            <h3>Recent Uploads</h3>
            {stats.recentUploads?.length ? (
              <ul>
                {stats.recentUploads.map(r => (
                  <li key={r.healthId} className="recent-item">
                    <span className="rid">{r.healthId}</span>
                    <span className="rname">{r.name||'—'}</span>
                    <span className="rtime">{r.uploadedAt ? new Date(r.uploadedAt).toLocaleString(): '—'}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="empty">No uploads yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
