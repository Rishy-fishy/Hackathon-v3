import React, { useState, useEffect } from 'react';
import './Header.css';
import Modal from './Modal';
import ESignetAuth from './ESignetAuth';
import ErrorBoundary from './ErrorBoundary';
import ChildForm from '../offline/ChildForm';
import { listChildRecords, updateChildRecord } from '../offline/db';

const Header = ({ onActiveViewChange }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null); // epoch ms
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [showChildForm, setShowChildForm] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [activeNav, setActiveNav] = useState(null); // 'add' | 'view' | 'settings' | 'admin' | null
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleProfileClick = () => {
    setIsLoading(true);
    setIsModalOpen(true);
    setTimeout(() => setIsLoading(false), 80);
  };

  const handleCloseModal = () => {
    console.log('Closing modal');
    setIsModalOpen(false);
    setIsLoading(false);
  };

  useEffect(() => {
    // Check if user is authenticated via eSignet (new flow)
    try {
      // New: handle auth_payload (base64url encoded JSON forwarded from callback server)
      let params = new URLSearchParams(window.location.search);
      let authPayloadB64 = params.get('auth_payload');
      if (!authPayloadB64 && window.location.hash.startsWith('#')) {
        // parse hash style #auth_payload=...&authenticated=true
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        authPayloadB64 = hashParams.get('auth_payload');
        if (authPayloadB64) params = hashParams; // treat hash params for cleanup
      }
      if (authPayloadB64) {
        try {
          const jsonStr = atob(authPayloadB64.replace(/-/g,'+').replace(/_/g,'/'));
          const payload = JSON.parse(jsonStr);
          if (payload.userInfo) {
            sessionStorage.setItem('esignet_authenticated','true');
            sessionStorage.setItem('esignet_user', JSON.stringify(payload.userInfo));
            sessionStorage.setItem('auth_timestamp', Date.now().toString());
            if (payload.access_token) sessionStorage.setItem('access_token', payload.access_token);
          }
          if (payload.userInfo) {
            setUserInfo(payload.userInfo);
            setIsAuthenticated(true);
            console.log('✅ Auth payload processed');
          }
        } catch (e) {
          console.warn('Failed to process auth_payload:', e.message);
        }
        // Clean auth_payload from URL
        params.delete('auth_payload');
        if (window.location.hash && window.location.hash.includes('auth_payload')) {
          // Clean hash
          const newHashParams = new URLSearchParams(params.toString());
          window.history.replaceState({}, document.title, window.location.pathname + (newHashParams.toString()? ('#'+newHashParams.toString()):''));
        } else {
          window.history.replaceState({}, document.title, window.location.pathname + (params.toString()? ('?'+params.toString()):''));
        }
      }

      const esignetAuthenticated = sessionStorage.getItem('esignet_authenticated') === 'true';
      if (esignetAuthenticated) {
        const storedUserInfo = sessionStorage.getItem('esignet_user');
        if (storedUserInfo) {
          const userInfo = JSON.parse(storedUserInfo);
          setUserInfo(userInfo);
          setIsAuthenticated(true);
          console.log('✅ eSignet user loaded:', userInfo.name);
          const ts = parseInt(sessionStorage.getItem('auth_timestamp'),10);
          if (!isNaN(ts)) {
            const expires = ts + 15*60*1000; // 15 minutes
            setSessionExpiresAt(expires);
          }
        }
      } else {
        // Check legacy authentication (old flow)
        const authenticated = localStorage.getItem('is_authenticated') === 'true';
        if (authenticated) {
          const storedUserInfo = localStorage.getItem('user_info');
          if (storedUserInfo) {
            const userInfo = JSON.parse(storedUserInfo);
            setUserInfo(userInfo);
            setIsAuthenticated(true);
            console.log('✅ Legacy user loaded:', userInfo.name);
            const ts = parseInt(localStorage.getItem('auth_timestamp'),10);
            if (!isNaN(ts)) {
              const expires = ts + 15*60*1000;
              setSessionExpiresAt(expires);
            }
          }
        }
      }

      // Check if we just authenticated
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('authenticated') === 'true') {
        // Open modal to show profile
        setIsModalOpen(true);
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      // Clear potentially corrupted data
      localStorage.removeItem('user_info');
      localStorage.removeItem('is_authenticated');
    }
  }, []);

  // Listen for online/offline
  useEffect(()=>{
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  },[]);
  // Load records when view is toggled
  useEffect(()=>{
    if (showRecords) {
      listChildRecords().then(setRecords).catch(()=>{});
    }
  },[showRecords]);

  // Session countdown effect
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const update = () => {
      const now = Date.now();
      const remMs = sessionExpiresAt - now;
      if (remMs <= 0) {
        setRemainingSeconds(0);
        handleLogout();
        return;
      }
      setRemainingSeconds(Math.floor(remMs / 1000));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [sessionExpiresAt]);

  const formatRemaining = () => {
    if (remainingSeconds == null) return '—';
    const m = Math.floor(remainingSeconds / 60);
    const s = remainingSeconds % 60;
    return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  // Removed unused sessionProgressPercent to reduce lint noise.

  const handleLogout = () => {
    // Clear legacy authentication data
    localStorage.removeItem('user_info');
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_timestamp');
    localStorage.removeItem('auth_method');
    
    // Clear eSignet authentication data
    sessionStorage.removeItem('esignet_user');
    sessionStorage.removeItem('esignet_authenticated');
    sessionStorage.removeItem('auth_timestamp');
    sessionStorage.removeItem('esignet_state');
    sessionStorage.removeItem('esignet_nonce');
    
    setUserInfo(null);
    setIsAuthenticated(false);
    setIsModalOpen(false);
    console.log('🚪 User logged out successfully (eSignet + legacy)');
    window.location.reload();
  };

  return (
    <header className="header minimal-header">
      <div className="bw-bar">
        <div className="brand-block">
          <h1 
            className="app-title" 
            onClick={() => {
              setActiveNav(null);
              setShowChildForm(false);
              setShowRecords(false);
              setSelectedRecord(null);
              setEditMode(false);
              onActiveViewChange && onActiveViewChange('home');
            }}
            style={{ cursor: 'pointer' }}
            title="Go to homepage"
          >
            ChildHealthBooklet
          </h1>
          {isAuthenticated && (
            <div className="session-inline" title="Session time remaining">{formatRemaining()}</div>
          )}
        </div>
        <nav className="nav-actions" aria-label="Primary">
          <button
            className={`nav-btn ${activeNav==='add'?'active':''}`}
            onClick={()=>{
              setShowChildForm(true); setShowRecords(false); setActiveNav('add');
              onActiveViewChange && onActiveViewChange('add');
            }}
          >Add Child</button>
          <button
            className={`nav-btn ${activeNav==='view'?'active':''}`}
            onClick={()=>{
              setShowRecords(s=>{ const next=!s; setActiveNav(next?'view':null); onActiveViewChange && onActiveViewChange(next?'view':'home'); return next; });
              if(!showRecords) listChildRecords().then(setRecords);
              setShowChildForm(false);
            }}
          >View Data</button>
          <button
            className={`nav-btn ${activeNav==='settings'?'active':''}`}
            onClick={()=>{ setActiveNav('settings'); onActiveViewChange && onActiveViewChange('settings'); alert('Settings placeholder'); }}
          >Settings</button>
          <button
            className={`nav-btn ${activeNav==='admin'?'active':''}`}
            onClick={()=>{ setActiveNav('admin'); onActiveViewChange && onActiveViewChange('admin'); alert('Admin placeholder'); }}
          >Admin</button>
          <button className="profile-btn" onClick={handleProfileClick} aria-label="Profile & Authentication">Profile</button>
        </nav>
      </div>

  {showChildForm && (
        <div className="panel" role="region" aria-label="Add Child Form">
  <ChildForm onClose={()=> { setShowChildForm(false); setActiveNav(null); onActiveViewChange && onActiveViewChange('home'); }} onSaved={()=> { setShowChildForm(false); setActiveNav(null); onActiveViewChange && onActiveViewChange('home'); }} />
        </div>
      )}

      {showRecords && !showChildForm && (
        <div className="panel records" role="region" aria-label="Child Records List">
          <h2>Records Overview</h2>
          {records.length === 0 && <div className="empty">No records saved yet.</div>}
          {records.map(r => (
            <button
              key={r.healthId}
              type="button"
              className={`record-row selectable ${selectedRecord?.healthId===r.healthId?'active':''}`}
              onClick={()=>{ 
                setSelectedRecord(r); 
                setEditMode(false); 
                setShowDetailModal(true);
              }}
              role="listitem"
              aria-pressed={selectedRecord?.healthId===r.healthId}
            >
                <div className="id">{r.healthId}</div>
                <div className="name">{r.name}</div>
                <div className="age">{r.ageMonths ?? '—'}m</div>
                <div className="wh">{r.weightKg ?? '—'}kg / {r.heightCm ?? '—'}cm</div>
                <div className="status">{r.status}</div>
              </button>
            ))}
          <div className="overview-note">Click on any record to view detailed information in a popup.</div>
        </div>
      )}

      {/* Profile / Auth Modal */}
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Loading...</p>
          </div>
        ) : isAuthenticated && userInfo ? (
          <div className="user-profile">
            <div className="profile-header">
              <div className="profile-avatar">
                {userInfo.picture ? (
                  <img src={userInfo.picture} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    {userInfo.given_name?.charAt(0)}{userInfo.family_name?.charAt(0)}
                  </div>
                )}
              </div>
              <h2>{userInfo.name}</h2>
              <p className="profile-email">{userInfo.email}</p>
            </div>
            
            <div className="profile-details">
              <h3>Profile Information</h3>
              
              {/* Basic Information */}
              <div className="detail-group">
                <h4>Personal Details</h4>
                <div className="detail-row">
                  <span className="detail-label">Full Name:</span>
                  <span className="detail-value">{userInfo.name || 'Not provided'}</span>
                </div>
                {userInfo.given_name && (
                  <div className="detail-row">
                    <span className="detail-label">First Name:</span>
                    <span className="detail-value">{userInfo.given_name}</span>
                  </div>
                )}
                {userInfo.family_name && (
                  <div className="detail-row">
                    <span className="detail-label">Last Name:</span>
                    <span className="detail-value">{userInfo.family_name}</span>
                  </div>
                )}
                {userInfo.uin && (
                  <div className="detail-row">
                    <span className="detail-label">UIN:</span>
                    <span className="detail-value">{userInfo.uin}</span>
                  </div>
                )}
                {userInfo.birthdate && (
                  <div className="detail-row">
                    <span className="detail-label">Date of Birth:</span>
                    <span className="detail-value">{userInfo.birthdate}</span>
                  </div>
                )}
                {userInfo.gender && (
                  <div className="detail-row">
                    <span className="detail-label">Gender:</span>
                    <span className="detail-value">{userInfo.gender}</span>
                  </div>
                )}
              </div>

              {/* Contact Information */}
              <div className="detail-group">
                <h4>Contact Information</h4>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">
                    {userInfo.email || 'Not provided'}
                    {userInfo.email_verified && <span className="verified-badge">✅ Verified</span>}
                  </span>
                </div>
                {userInfo.phone_number && (
                  <div className="detail-row">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">
                      {userInfo.phone_number}
                      {userInfo.phone_number_verified && <span className="verified-badge">✅ Verified</span>}
                    </span>
                  </div>
                )}
              </div>

              {/* Address Information */}
              {userInfo.address && (
                <div className="detail-group">
                  <h4>Address</h4>
                  {typeof userInfo.address === 'string' ? (
                    <div className="detail-row">
                      <span className="detail-label">Address:</span>
                      <span className="detail-value">{userInfo.address}</span>
                    </div>
                  ) : (
                    <>
                      {userInfo.address.formatted && (
                        <div className="detail-row">
                          <span className="detail-label">Address:</span>
                          <span className="detail-value">{userInfo.address.formatted}</span>
                        </div>
                      )}
                      {userInfo.address.locality && (
                        <div className="detail-row">
                          <span className="detail-label">City:</span>
                          <span className="detail-value">{userInfo.address.locality}</span>
                        </div>
                      )}
                      {userInfo.address.region && (
                        <div className="detail-row">
                          <span className="detail-label">State:</span>
                          <span className="detail-value">{userInfo.address.region}</span>
                        </div>
                      )}
                      {userInfo.address.postal_code && (
                        <div className="detail-row">
                          <span className="detail-label">Postal Code:</span>
                          <span className="detail-value">{userInfo.address.postal_code}</span>
                        </div>
                      )}
                      {userInfo.address.country && (
                        <div className="detail-row">
                          <span className="detail-label">Country:</span>
                          <span className="detail-value">{userInfo.address.country}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Authentication Information */}
              <div className="detail-group">
                <h4>Authentication Details</h4>
                <div className="detail-row">
                  <span className="detail-label">User ID:</span>
                  <span className="detail-value">{userInfo.sub || 'Not available'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Authentication Method:</span>
                  <span className="detail-value">eSignet OIDC</span>
                </div>
                {userInfo.iss && (
                  <div className="detail-row">
                    <span className="detail-label">Issuer:</span>
                    <span className="detail-value">{userInfo.iss}</span>
                  </div>
                )}
                {userInfo.auth_method && (
                  <div className="detail-row">
                    <span className="detail-label">Auth Provider:</span>
                    <span className="detail-value">{userInfo.auth_method}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Session:</span>
                  <span className="detail-value">Active</span>
                </div>
                {userInfo.login_timestamp && (
                  <div className="detail-row">
                    <span className="detail-label">Login Time:</span>
                    <span className="detail-value">
                      {new Date(userInfo.login_timestamp).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Debug Information - Show raw data for development */}
              {process.env.NODE_ENV === 'development' && (
                <div className="detail-group">
                  <h4>Debug Information</h4>
                  <div className="detail-row">
                    <span className="detail-label">Available Fields:</span>
                    <span className="detail-value" style={{fontSize: '12px', fontFamily: 'monospace'}}>
                      {Object.keys(userInfo).join(', ')}
                    </span>
                  </div>
                  <details style={{marginTop: '10px'}}>
                    <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>Raw User Data</summary>
                    <pre style={{
                      backgroundColor: '#f5f5f5', 
                      padding: '10px', 
                      fontSize: '12px', 
                      overflow: 'auto', 
                      maxHeight: '200px'
                    }}>
                      {JSON.stringify(userInfo, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
            
            <button className="logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        ) : (
          <ErrorBoundary>
            <ESignetAuth />
          </ErrorBoundary>
        )}
      </Modal>

      {/* Record Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => {
        setShowDetailModal(false);
        setSelectedRecord(null);
        setEditMode(false);
      }}>
        {selectedRecord && (
          <>
            <div className="detail-head">
              <h3>{selectedRecord.name || '—'} <span className="rid">({selectedRecord.healthId})</span></h3>
              <div className="detail-actions">
                {!editMode && <button className="mini-btn" onClick={()=> setEditMode(true)}>Modify</button>}
                {editMode && <button className="mini-btn" onClick={()=> setEditMode(false)}>Cancel</button>}
              </div>
            </div>
            {!editMode && (
              <div className="detail-content">
                {selectedRecord.facePhoto && (
                  <div className="detail-photo">
                    <img src={selectedRecord.facePhoto} alt={`Photo of ${selectedRecord.name}`} className="child-photo" />
                  </div>
                )}
                <div className="detail-grid">
                  <div><strong>Gender:</strong> {selectedRecord.gender||'—'}</div>
                  <div><strong>Age:</strong> {selectedRecord.ageMonths??'—'} m</div>
                  <div><strong>Weight:</strong> {selectedRecord.weightKg??'—'} kg</div>
                  <div><strong>Height:</strong> {selectedRecord.heightCm??'—'} cm</div>
                  <div><strong>Guardian:</strong> {selectedRecord.guardianName||'—'}</div>
                  <div className="full"><strong>Malnutrition Signs:</strong> {selectedRecord.malnutritionSigns||'N/A'}</div>
                  <div className="full"><strong>Recent Illnesses:</strong> {selectedRecord.recentIllnesses||'N/A'}</div>
                  <div><strong>Status:</strong> {selectedRecord.status}</div>
                  <div><strong>Created:</strong> {new Date(selectedRecord.createdAt).toLocaleString()}</div>
                </div>
              </div>
            )}
            {editMode && (
              <RecordEditForm
                record={selectedRecord}
                onSave={async (changes)=>{
                  await updateChildRecord(selectedRecord.healthId, { ...changes, updatedAt: Date.now() });
                  const updated = await listChildRecords();
                  setRecords(updated);
                  const newly = updated.find(r=> r.healthId === selectedRecord.healthId);
                  setSelectedRecord(newly);
                  setEditMode(false);
                  setShowDetailModal(false);
                  setSelectedRecord(null);
                }}
              />
            )}
          </>
        )}
      </Modal>

      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">Offline mode – changes will sync when back online.</div>
      )}
    </header>
  );
};

export default Header;

// Inline lightweight edit form component
function RecordEditForm({ record, onSave }) {
  const [form,setForm] = useState({
    name: record.name||'',
    gender: record.gender||'',
    ageMonths: record.ageMonths||'',
    weightKg: record.weightKg||'',
    heightCm: record.heightCm||'',
    guardianName: record.guardianName||'',
    malnutritionSigns: record.malnutritionSigns||'N/A',
    recentIllnesses: record.recentIllnesses||'N/A',
    facePhoto: record.facePhoto||null
  });
  const handleChange = e => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      const file = files[0];
      if (!file) return;
      // Resize/compress image to max 512px dimension (same logic as ChildForm)
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const maxDim = 512;
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round(height * (maxDim/width));
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round(width * (maxDim/height));
            height = maxDim;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img,0,0,width,height);
          const dataUrl = canvas.toDataURL('image/jpeg',0.7);
          setForm(f => ({...f, facePhoto: dataUrl }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    } else {
      setForm(f=>({...f,[name]:value}));
    }
  };
  const submit = e => {
    e.preventDefault();
    onSave && onSave({
      name: form.name || 'N/A',
      gender: form.gender || 'N/A',
      ageMonths: form.ageMonths? parseInt(form.ageMonths,10): null,
      weightKg: form.weightKg? parseFloat(form.weightKg): null,
      heightCm: form.heightCm? parseFloat(form.heightCm): null,
      guardianName: form.guardianName || 'N/A',
      malnutritionSigns: form.malnutritionSigns || 'N/A',
      recentIllnesses: form.recentIllnesses || 'N/A',
      facePhoto: form.facePhoto
    });
  };
  return (
    <form onSubmit={submit} className="record-edit-form">
      <div className="edit-grid">
        <div className="edit-photo-section">
          <label>Photo</label>
          <div className="edit-photo-container">
            {form.facePhoto ? (
              <div className="edit-photo-preview">
                <img src={form.facePhoto} alt="Child" className="edit-photo-img" />
                <button 
                  type="button" 
                  className="remove-edit-photo" 
                  onClick={()=>setForm(f=>({...f, facePhoto:null}))}
                  aria-label="Remove photo"
                >×</button>
              </div>
            ) : (
              <div className="edit-photo-placeholder">
                <span>No photo</span>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="user" 
              name="facePhoto" 
              onChange={handleChange} 
              className="edit-photo-input"
              title="Update photo" 
            />
          </div>
        </div>
        <label> Name
          <input name="name" value={form.name} onChange={handleChange} />
        </label>
        <label> Gender
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label> Age (m)
          <input name="ageMonths" value={form.ageMonths} onChange={handleChange} inputMode="numeric" />
        </label>
        <label> Weight (kg)
          <input name="weightKg" value={form.weightKg} onChange={handleChange} inputMode="decimal" />
        </label>
        <label> Height (cm)
          <input name="heightCm" value={form.heightCm} onChange={handleChange} inputMode="decimal" />
        </label>
        <label className="full"> Guardian
          <input name="guardianName" value={form.guardianName} onChange={handleChange} />
        </label>
        <label className="full"> Malnutrition Signs
          <textarea name="malnutritionSigns" value={form.malnutritionSigns} onChange={handleChange} />
        </label>
        <label className="full"> Recent Illnesses
          <textarea name="recentIllnesses" value={form.recentIllnesses} onChange={handleChange} />
        </label>
      </div>
      <div className="edit-actions">
        <button type="submit" className="mini-btn primary">Save</button>
      </div>
    </form>
  );
}
