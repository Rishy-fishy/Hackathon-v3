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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  useEffect(()=>{
    const handler = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  },[]);

  const handleProfileClick = () => {
    setIsLoading(true);
    setIsModalOpen(true);
    setTimeout(() => setIsLoading(false), 80);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsLoading(false);
  };

  // Age formatting helpers (restored)
  const formatAgeDisplay = (ageMonths) => {
    if (ageMonths === null || ageMonths === undefined) return '—';
    const today = new Date();
    const birthDate = new Date(today);
    birthDate.setMonth(birthDate.getMonth() - ageMonths);
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    if (days < 0) { months--; const daysInPrev = new Date(today.getFullYear(), today.getMonth(), 0).getDate(); days += daysInPrev; }
    if (months < 0) { years--; months += 12; }
    let ageStr=''; if (years>0) ageStr+=years+'y '; if (months>0) ageStr+=months+'m '; if (days>0) ageStr+=days+'d'; return ageStr.trim()||'Today';
  };
  const calculateAgeFromDOB = (dobString) => {
    if (!dobString) return { years:0, months:0, days:0, totalMonths:0 };
    const birthDate = new Date(dobString); const today=new Date();
    let years=today.getFullYear()-birthDate.getFullYear(); let months=today.getMonth()-birthDate.getMonth(); let days=today.getDate()-birthDate.getDate();
    if (days<0){ months--; const daysInPrev=new Date(today.getFullYear(), today.getMonth(),0).getDate(); days+=daysInPrev; }
    if (months<0){ years--; months+=12; }
    const totalMonths=years*12+months; return { years, months, days, totalMonths };
  };
  const formatAgeFromDOB = (dobString) => {
    if (!dobString) return '—'; const age=calculateAgeFromDOB(dobString); let str=''; if(age.years>0) str+=age.years+'y '; if(age.months>0) str+=age.months+'m '; if(age.days>0) str+=age.days+'d'; return str.trim()||'Today';
  };
  const formatDateOfBirth = (record) => {
    let dobString=''; if (record.dateOfBirth) dobString=record.dateOfBirth; else if (record.ageMonths!=null){ const today=new Date(); const birth=new Date(today); birth.setMonth(birth.getMonth()-record.ageMonths); dobString=birth.toISOString().split('T')[0]; }
    if(!dobString) return '—'; return new Date(dobString).toLocaleDateString();
  };
  
  // Auth check + URL payload processing
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
          <button
            className="hamburger-btn"
            aria-label={mobileMenuOpen? 'Close menu':'Open menu'}
            aria-expanded={mobileMenuOpen}
            onClick={()=> setMobileMenuOpen(o=>!o)}
          >
            <span></span><span></span><span></span>
          </button>
          <h1 
            className="app-title" 
            onClick={() => {
              setActiveNav(null);
              setShowChildForm(false);
              setShowRecords(false);
              setSelectedRecord(null);
              setEditMode(false);
              onActiveViewChange && onActiveViewChange('home');
              setMobileMenuOpen(false);
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
  {!isMobile && (
  <nav className="nav-actions desktop-only" aria-label="Primary">
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
  )}
      </div>

      {/* Mobile slide-out menu */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" role="dialog" aria-label="Navigation Menu">
          <button className="close-drawer" aria-label="Close menu" onClick={()=> setMobileMenuOpen(false)}>×</button>
          <div className="drawer-links">
            <button
              className={`drawer-link ${activeNav==='add'?'active':''}`}
              onClick={()=>{ setShowChildForm(true); setShowRecords(false); setActiveNav('add'); onActiveViewChange && onActiveViewChange('add'); setMobileMenuOpen(false); }}
            >Add Child</button>
            <button
              className={`drawer-link ${activeNav==='view'?'active':''}`}
              onClick={()=>{ setShowRecords(s=>{ const next=!s; setActiveNav(next?'view':null); onActiveViewChange && onActiveViewChange(next?'view':'home'); return next; }); if(!showRecords) listChildRecords().then(setRecords); setShowChildForm(false); setMobileMenuOpen(false); }}
            >View Data</button>
            <button
              className={`drawer-link ${activeNav==='settings'?'active':''}`}
              onClick={()=>{ setActiveNav('settings'); onActiveViewChange && onActiveViewChange('settings'); alert('Settings placeholder'); setMobileMenuOpen(false); }}
            >Settings</button>
            <button
              className={`drawer-link ${activeNav==='admin'?'active':''}`}
              onClick={()=>{ setActiveNav('admin'); onActiveViewChange && onActiveViewChange('admin'); alert('Admin placeholder'); setMobileMenuOpen(false); }}
            >Admin</button>
            <button className="drawer-link" onClick={()=>{ handleProfileClick(); setMobileMenuOpen(false); }}>Profile</button>
          </div>
        </div>
      )}

  {showChildForm && (
        <div className="panel" role="region" aria-label="Add Child Form">
  <ChildForm onClose={()=> { setShowChildForm(false); setActiveNav(null); onActiveViewChange && onActiveViewChange('home'); }} onSaved={()=> { setShowChildForm(false); setActiveNav(null); onActiveViewChange && onActiveViewChange('home'); }} />
        </div>
      )}

      {showRecords && !showChildForm && (
        <div className="panel records" role="region" aria-label="Child Records List">
          <div className="records-header-row" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'1rem'}}>
            <h2 style={{margin:0}}>Records Overview</h2>
            <button
              type="button"
              className="upload-btn"
              disabled={!isAuthenticated}
              onClick={async ()=>{
                if (!isAuthenticated) return;
                try {
                  const { syncPendingRecords } = await import('../offline/sync');
                  const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info');
                  let uploaderName = 'manual_upload';
                  let uploaderEmail = null;
                  if (userStr) {
                    try { const u = JSON.parse(userStr); uploaderName = u.name || uploaderName; uploaderEmail = u.email || null; } catch {}
                  }
                  const res = await syncPendingRecords({ uploaderName, uploaderEmail, allowNoToken: false });
                  if (res && !res.error) {
                    const updated = await listChildRecords();
                    setRecords(updated);
                  }
                } catch (e) { console.warn('Upload failed', e); }
              }}
              title={isAuthenticated? 'Upload pending/failed records to server':'Login required to upload'}
            >Upload</button>
          </div>
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
              aria-pressed={undefined}
            >
                <div className="id">{r.healthId}</div>
                <div className="name">{r.name}</div>
                <div className="age">{
                  r.dateOfBirth 
                    ? formatAgeFromDOB(r.dateOfBirth)
                    : formatAgeDisplay(r.ageMonths)
                }</div>
                <div className="wh">{r.weightKg ?? '—'}kg / {r.heightCm ?? '—'}cm</div>
                <div className="status">{r.status}</div>
              </button>
            ))}
          <div className="overview-note">Click on any record to view detailed information in a popup.</div>
        </div>
      )}

      {/* Profile / Auth Modal */}
  <Modal isOpen={isModalOpen} onClose={handleCloseModal} extraClass="profile-square">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
            <p>Loading...</p>
          </div>
        ) : isAuthenticated && userInfo ? (
          <div className="user-profile sketch-layout">
            <div className="profile-top-row">
              <div className="profile-avatar large">
                {userInfo.picture ? (
                  <img src={userInfo.picture} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    {userInfo.given_name?.charAt(0)}{userInfo.family_name?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="profile-name-block">
                <h2 className="profile-name-main">{userInfo.name}</h2>
              </div>
            </div>
            <div className="profile-info-box">
              <div className="info-row"><span className="info-label">Gender:</span><span className="info-value">{userInfo.gender || '—'}</span></div>
              <div className="info-row"><span className="info-label">Phone No:</span><span className="info-value">{userInfo.phone_number || '—'}</span></div>
              <div className="info-row"><span className="info-label">Birthdate:</span><span className="info-value">{userInfo.birthdate || '—'}</span></div>
              <div className="info-row"><span className="info-label">Email :</span><span className="info-value">{userInfo.email || '—'}</span></div>
            </div>
            <div className="logout-row">
              <button className="logout-btn button" type="button" onClick={handleLogout} aria-label="Logout"><span>LOGOUT</span></button>
            </div>
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
      }} extraClass="with-detail-head">
        {selectedRecord && (
          <>
            <div className="detail-head">
              <h3><span className="rid">{selectedRecord.healthId}</span></h3>
              <div className="detail-actions">
                {!editMode && <button className="mini-btn" onClick={()=> setEditMode(true)}>Modify</button>}
                {editMode && <button className="mini-btn" onClick={()=> setEditMode(false)}>Cancel</button>}
              </div>
            </div>
            {!editMode && (
              <div className="detail-content redesigned-layout">
                <div className="record-quick-layout">
                  <div className="name-and-basic">
                    <div className="name-pill" title="Child name">{selectedRecord.name||'—'}</div>
                    <div className="two-box-row">
                      <div className="mini-box" title="Age">
                        <label>Age</label>
                        <span>{selectedRecord.dateOfBirth 
                          ? formatAgeFromDOB(selectedRecord.dateOfBirth)
                          : formatAgeDisplay(selectedRecord.ageMonths)}</span>
                      </div>
                      <div className="mini-box" title="Gender">
                        <label>Gender</label>
                        <span>{selectedRecord.gender||'—'}</span>
                      </div>
                    </div>
                  </div>
                  {selectedRecord.facePhoto && (
                    <div className="photo-circle-wrap">
                      <img src={selectedRecord.facePhoto} alt={selectedRecord.name} className="photo-circle" />
                    </div>
                  )}
                </div>
                <div className="detail-grid compact-after-layout">
                  <div><strong>Height:</strong> {selectedRecord.heightCm??'—'} cm</div>
                  <div><strong>Weight:</strong> {selectedRecord.weightKg??'—'} kg</div>
                  <div><strong>Date of Birth:</strong> {formatDateOfBirth(selectedRecord)}</div>
                  <div><strong>Aadhaar ID:</strong> {selectedRecord.idReference||'—'}</div>
                  <div><strong>Guardian:</strong> {selectedRecord.guardianName||'—'}</div>
                  <div><strong>Phone:</strong> {selectedRecord.guardianPhone||'—'}</div>
                  <div><strong>Relation:</strong> {selectedRecord.guardianRelation||'—'}</div>
                  <div><strong>Status:</strong> {selectedRecord.status}</div>
                  <div><strong>Created:</strong> {new Date(selectedRecord.createdAt).toLocaleString()}</div>
                  {selectedRecord.uploadedAt && <div><strong>Uploaded:</strong> {new Date(selectedRecord.uploadedAt).toLocaleString()}</div>}
                  <div className="full"><strong>Malnutrition Signs:</strong> {selectedRecord.malnutritionSigns||'N/A'}</div>
                  <div className="full"><strong>Recent Illnesses:</strong> {selectedRecord.recentIllnesses||'N/A'}</div>
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
  // DOB utility functions for this component
  const calculateAgeFromDOB = (dobString) => {
    if (!dobString) return { years: 0, months: 0, days: 0, totalMonths: 0 };
    
    const birthDate = new Date(dobString);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    if (days < 0) {
      months--;
      const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      days += daysInPrevMonth;
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    const totalMonths = years * 12 + months;
    
    return { years, months, days, totalMonths };
  };

  // Malnutrition options (same as ChildForm)
  const malnutritionOptions = [
    "Stunting (low height for age)",
    "Wasting (low weight for height)",
    "Underweight (low weight for age)",
    "Visible ribs/spine",
    "Swollen belly",
    "Pale skin/eyes",
    "Hair changes (color/texture)",
    "Delayed development",
    "Frequent infections",
    "Loss of appetite"
  ];

  const [form,setForm] = useState({
    name: record.name||'',
    gender: record.gender||'',
    // Preserve existing DOB; if absent, derive from ageMonths so it doesn't appear blank when modifying
    dateOfBirth: record.dateOfBirth || (record.ageMonths != null ? (()=>{
      const today = new Date();
      const birth = new Date(today);
      birth.setMonth(birth.getMonth() - record.ageMonths);
      return birth.toISOString().split('T')[0];
    })() : ''),
    idRef: record.idReference || '',
    weightKg: record.weightKg||'',
    heightCm: record.heightCm||'',
    guardianName: record.guardianName||'',
    guardianPhone: record.guardianPhone || '',
    guardianRelation: record.guardianRelation || '',
    malnutritionSigns: record.malnutritionSigns||'N/A',
    recentIllnesses: record.recentIllnesses||'N/A',
    facePhoto: record.facePhoto||null
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Handle clicking outside dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (isDropdownOpen && !event.target.closest('.custom-dropdown')) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Malnutrition dropdown toggle function
  const toggleMalnutritionOption = (option) => {
    if (form.malnutritionSigns === 'N/A') {
      setForm(f => ({...f, malnutritionSigns: [option]}));
    } else {
      // Handle both array and string formats
      let currentSelections = [];
      if (Array.isArray(form.malnutritionSigns)) {
        currentSelections = form.malnutritionSigns;
      } else if (form.malnutritionSigns && form.malnutritionSigns !== 'N/A') {
        // Convert string to array (split by comma or treat as single item)
        currentSelections = form.malnutritionSigns.includes(',') 
          ? form.malnutritionSigns.split(',').map(s => s.trim())
          : [form.malnutritionSigns];
      }
      
      const isSelected = currentSelections.includes(option);
      
      if (isSelected) {
        const newSelections = currentSelections.filter(item => item !== option);
        setForm(f => ({...f, malnutritionSigns: newSelections.length === 0 ? 'N/A' : newSelections}));
      } else {
        setForm(f => ({...f, malnutritionSigns: [...currentSelections, option]}));
      }
    }
  };
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
      let processedValue = value;
      
      // Input validation based on field type (same as ChildForm)
      if (name === 'name' || name === 'guardianName' || name === 'guardianRelation') {
        // Only allow alphabets and spaces
        processedValue = value.replace(/[^a-zA-Z\s]/g, '');
      } else if (name === 'weightKg' || name === 'heightCm') {
        // Only allow numbers and decimal point
        processedValue = value.replace(/[^0-9.]/g, '');
        // Prevent multiple decimal points
        const parts = processedValue.split('.');
        if (parts.length > 2) {
          processedValue = parts[0] + '.' + parts.slice(1).join('');
        }
        // Clamp weight to maximum 250 kg (universal constraint)
        if (name === 'weightKg') {
          const num = parseFloat(processedValue);
            if (!isNaN(num)) {
              if (num > 250) {
                processedValue = '250';
              } else if (num <= 0) {
                // Disallow zero or negative; clear input to force re-entry
                processedValue = '';
              }
            }
        }
        if (name === 'heightCm') {
          const numH = parseFloat(processedValue);
          if (!isNaN(numH) && numH <= 0) {
            processedValue = '';
          }
        }
      } else if (name === 'guardianPhone') {
        // Phone: allow only digits, limit to 10 digits
        processedValue = value.replace(/\D/g, '').slice(0, 10);
      } else if (name === 'idRef') {
        // Aadhaar formatting: allow only digits, format as XXXX-XXXX-XXXX
        const digits = value.replace(/\D/g, '').slice(0, 12);
        const groups = digits.match(/.{1,4}/g) || [];
        processedValue = groups.join('-');
      } else if (name === 'dateOfBirth') {
        // Date of Birth validation
        if (value) {
          const selectedDate = new Date(value);
          const today = new Date();
          const eighteenYearsAgo = new Date();
          eighteenYearsAgo.setFullYear(today.getFullYear() - 18);
          
          // Prevent future dates
          if (selectedDate > today) {
            return; // Don't update if future date
          }
          
          // Prevent age over 18 years
          if (selectedDate < eighteenYearsAgo) {
            return; // Don't update if older than 18
          }
        }
        processedValue = value;
      }
      
      setForm(f=>({...f,[name]:processedValue}));
    }
  };
  const submit = e => {
    e.preventDefault();
    
    // Validate required fields
    if (!form.name || form.name.trim() === '') {
      alert('Name is required');
      return;
    }
    // Enforce universal weight constraint (<= 250 kg)
    if (form.weightKg) {
      const w = parseFloat(form.weightKg);
      if (!isNaN(w) && w > 250) {
        alert('Maximum allowed weight is 250 kg. Value has been adjusted.');
        setForm(f=>({...f, weightKg: '250'}));
        return; // Require user to resubmit after seeing adjusted value
      }
      if (!isNaN(w) && w <= 0) {
        alert('Weight must be greater than 0.');
        setForm(f=>({...f, weightKg: ''}));
        return;
      }
    }
    // Height validation (if provided)
    if (form.heightCm) {
      const h = parseFloat(form.heightCm);
      if (!isNaN(h) && h <= 0) {
        alert('Height must be greater than 0.');
        setForm(f=>({...f, heightCm: ''}));
        return;
      }
    }
    
    onSave && onSave({
      name: form.name.trim(),
      gender: form.gender || 'N/A',
      dateOfBirth: form.dateOfBirth || null,
      ageMonths: form.dateOfBirth ? calculateAgeFromDOB(form.dateOfBirth).totalMonths : null,
      idReference: form.idRef || '',
      weightKg: form.weightKg? parseFloat(form.weightKg): null,
      heightCm: form.heightCm? parseFloat(form.heightCm): null,
      guardianName: form.guardianName || 'N/A',
      guardianPhone: form.guardianPhone || 'N/A',
      guardianRelation: form.guardianRelation || 'N/A',
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
        <label> Name *
          <input name="name" value={form.name} onChange={handleChange} required />
        </label>
        <label> Gender
          <select name="gender" value={form.gender} onChange={handleChange}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </label>
        <label> Date of Birth
          <input 
            name="dateOfBirth" 
            type="date" 
            value={form.dateOfBirth} 
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            min={new Date(new Date().getFullYear() - 18, new Date().getMonth(), new Date().getDate()).toISOString().split('T')[0]}
          />
        </label>
        <label> Aadhaar ID (optional)
          <input 
            name="idRef" 
            value={form.idRef} 
            onChange={handleChange}
            inputMode="numeric" 
            pattern="\d{4}-\d{4}-\d{4}" 
            placeholder="XXXX-XXXX-XXXX"
          />
        </label>
        <label> Weight (kg)
          <input name="weightKg" value={form.weightKg} onChange={handleChange} inputMode="decimal" placeholder="e.g. 11.2" />
        </label>
        <label> Height (cm)
          <input name="heightCm" value={form.heightCm} onChange={handleChange} inputMode="decimal" placeholder="e.g. 82" />
        </label>
        <label className="full"> Guardian
          <input name="guardianName" value={form.guardianName} onChange={handleChange} placeholder="Parent / Guardian" />
        </label>
        <label> Phone Number
          <input 
            name="guardianPhone" 
            value={form.guardianPhone} 
            onChange={handleChange}
            inputMode="numeric" 
            pattern="\d{10}" 
            placeholder="10-digit phone number" 
            maxLength="10"
          />
        </label>
        <label> Relation with Child
          <input 
            name="guardianRelation" 
            value={form.guardianRelation} 
            onChange={handleChange}
            placeholder="e.g. Father, Mother, Uncle"
          />
        </label>
        <div className="full field-container">
          <div className="field-head">
            <label>Malnutrition Signs</label>
            <button 
              type="button" 
              className="pill-toggle" 
              aria-pressed={form.malnutritionSigns==='N/A'} 
              onClick={()=>setForm(f=>({...f, malnutritionSigns: f.malnutritionSigns==='N/A'?[]: 'N/A'}))}
            >
              N/A
            </button>
          </div>
          <div className="custom-dropdown" onClick={() => form.malnutritionSigns !== 'N/A' && setIsDropdownOpen(!isDropdownOpen)}>
            <div className={`dropdown-display ${form.malnutritionSigns === 'N/A' ? 'disabled' : ''}`}>
              <span>
                {form.malnutritionSigns === 'N/A' 
                  ? 'N/A'
                  : (() => {
                      if (Array.isArray(form.malnutritionSigns) && form.malnutritionSigns.length > 0) {
                        return `${form.malnutritionSigns.length} selected`;
                      } else if (typeof form.malnutritionSigns === 'string' && form.malnutritionSigns !== 'N/A' && form.malnutritionSigns !== '') {
                        const selections = form.malnutritionSigns.includes(',') 
                          ? form.malnutritionSigns.split(',').map(s => s.trim())
                          : [form.malnutritionSigns];
                        return `${selections.length} selected`;
                      } else {
                        return 'Select signs of malnutrition';
                      }
                    })()
                }
              </span>
              <svg 
                className={`dropdown-arrow ${isDropdownOpen && form.malnutritionSigns !== 'N/A' ? 'open' : ''}`}
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none"
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {isDropdownOpen && form.malnutritionSigns !== 'N/A' && (
              <div className="dropdown-menu" role="listbox" onClick={(e) => e.stopPropagation()}>
                  {malnutritionOptions.map((option, index) => {
                    // Handle both array and string formats for checking selection
                    let isSelected = false;
                    if (Array.isArray(form.malnutritionSigns)) {
                      isSelected = form.malnutritionSigns.includes(option);
                    } else if (typeof form.malnutritionSigns === 'string' && form.malnutritionSigns !== 'N/A') {
                      const selections = form.malnutritionSigns.includes(',') 
                        ? form.malnutritionSigns.split(',').map(s => s.trim())
                        : [form.malnutritionSigns];
                      isSelected = selections.includes(option);
                    }
                    
                    return (
                      <div
                        key={index}
                        className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMalnutritionOption(option);
                        }}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="option-checkbox">
                          {isSelected && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="option-text">{option}</span>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
        <div className="full field-container">
          <div className="field-head">
            <label>Recent Illnesses</label>
            <button 
              type="button" 
              className="pill-toggle" 
              aria-pressed={form.recentIllnesses==='N/A'} 
              onClick={()=>setForm(f=>({...f, recentIllnesses: f.recentIllnesses==='N/A'?'': 'N/A'}))}
            >
              N/A
            </button>
          </div>
          <textarea 
            name="recentIllnesses" 
            value={form.recentIllnesses} 
            onChange={handleChange}
            placeholder="Describe recent illnesses or conditions"
            disabled={form.recentIllnesses==='N/A'}
            aria-disabled={form.recentIllnesses==='N/A'}
          />
        </div>
      </div>
      <div className="edit-actions">
  <button type="button" className="mini-btn" onClick={()=> setForm(f=>({...f, dateOfBirth: ''}))} title="Clear Date of Birth">Reset DOB</button>
        <button type="submit" className="mini-btn primary">Save</button>
      </div>
    </form>
  );
}

// End of RecordEditForm

