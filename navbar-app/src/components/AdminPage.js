import React, { useState, useEffect } from 'react';
import './AdminPage.css';

// Backend endpoints expected:
// POST /api/admin/login { username, password } -> { token, username, expiresIn }
// GET  /api/admin/stats  (Authorization: Bearer <token>) -> { totalChildRecords, recentUploads }
// GET  /api/admin/children (Authorization: Bearer <token>) -> { children: [...] }

export default function AdminPage() {
  // Resolution order for backend base URL (first non-empty wins):
  // 1. window.__API_BASE (runtime injected script) e.g. placed in public/runtime-config.js
  // 2. REACT_APP_API_BASE (build-time)
  // 3. If running on localhost frontend dev server -> http://localhost:3002
  // 4. Empty string => same-origin relative calls
  const runtimeBase = typeof window !== 'undefined' && window.__API_BASE ? window.__API_BASE : '';
  const CLOUD_RUN_FALLBACK = 'https://navbar-backend-clean-87485236346.us-central1.run.app';
  const API_BASE = (
    runtimeBase ||
    process.env.REACT_APP_API_BASE ||
    // If developing locally and no override, still use remote backend instead of failing
    (window.location.hostname === 'localhost' ? CLOUD_RUN_FALLBACK : CLOUD_RUN_FALLBACK)
  ).replace(/\/$/,'');
  if (typeof window !== 'undefined') {
    // One-time debug to confirm which backend URL AdminPage is using
    if (!window.__ADMIN_API_BASE_LOGGED) {
      console.log('[AdminPage] Using backend base:', API_BASE);
      window.__ADMIN_API_BASE_LOGGED = true;
    }
  }
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
    
    // Add body class for full-screen admin styling
    document.body.classList.add('admin-body');
    
    // Cleanup function to remove class when component unmounts
    return () => {
      document.body.classList.remove('admin-body');
    };
  },[]);

  useEffect(()=>{
    if (token) {
      fetchStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token]);

  async function login(e){
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = api('/api/admin/login');
      const resp = await fetch(url, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password })
      });
      let json;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        json = await resp.json();
      } else {
        const text = await resp.text();
        throw new Error(`Non-JSON response (${resp.status}) from ${url}: ${text.substring(0,120)}`);
      }
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
      const url = api('/api/admin/stats');
      const resp = await fetch(url, { headers:{ Authorization: `Bearer ${token}` }});
      let json;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        json = await resp.json();
      } else {
        const text = await resp.text();
        throw new Error(`Non-JSON response (${resp.status}) from ${url}: ${text.substring(0,120)}`);
      }
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
      <div className="admin-header">
        <div className="header-top">
          <div className="logo-section">
            <div className="logo-icon">👶</div>
            <span className="logo-text">HealthTrack</span>
          </div>
          <div className="header-actions">
            <div className="user-menu">
              <span className="user-avatar">👤</span>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
        </div>
        
        <div className="page-title">
          <h1>Child Records Management</h1>
          <p>Manage and View Child Health Records</p>
        </div>
      </div>

      <div className="admin-content">
        <div className="content-header">
          <h2>Dashboard Overview</h2>
          <div className="refresh-section">
            <button onClick={fetchStats} disabled={loading} className="refresh-btn">
              {loading ? 'Loading...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {loading && <div className="loading-spinner">Loading...</div>}
        {error && <div className="error-message" role="alert">{error}</div>}

        {stats && (
          <div className="dashboard-stats">
            <div className="stats-cards">
              <div className="stat-card">
                <div className="stat-icon">📊</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.totalChildRecords}</div>
                  <div className="stat-label">Total Child Records</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <div className="stat-info">
                  <div className="stat-value">{stats.recentUploads?.length || 0}</div>
                  <div className="stat-label">Recent Uploads</div>
                </div>
              </div>
              
              <div className="stat-card">
                <div className="stat-icon">🩺</div>
                <div className="stat-info">
                  <div className="stat-value">Active</div>
                  <div className="stat-label">System Status</div>
                </div>
              </div>
            </div>

            <div className="recent-uploads-section">
              <h3>Recent Uploads</h3>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>HEALTH ID</th>
                      <th>NAME</th>
                      <th>UPLOAD DATE</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentUploads?.length ? (
                      stats.recentUploads.map((upload, index) => (
                        <tr key={upload.healthId || index}>
                          <td className="health-id">{upload.healthId || 'N/A'}</td>
                          <td className="name">{upload.name || 'Unknown'}</td>
                          <td className="date">
                            {upload.uploadedAt ? new Date(upload.uploadedAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="action">
                            <button className="view-btn">View</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="no-data">
                          {loading ? 'Loading records...' : 'No uploads yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
