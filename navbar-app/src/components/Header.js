import React, { useState, useEffect, useCallback } from 'react';
import './Header.css';
import Modal from './Modal';
import ESignetAuth from './ESignetAuth';
import ErrorBoundary from './ErrorBoundary';
import ChildForm from '../offline/ChildForm';
import { listChildRecords, updateChildRecord } from '../offline/db';
import jsPDF from 'jspdf';

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
  
  // Location state for profile modal
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationDetected, setLocationDetected] = useState(false);

  useEffect(()=>{
    const handler = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  },[]);

  // Function to auto-detect location on login (persistent for session)
  const autoDetectLocation = useCallback(async () => {
    if (locationDetected || location) return; // Skip if already detected
    
    setLocationLoading(true);
    setLocationError('');

    // Create location data for the session
    setTimeout(() => {
      const locationData = {
        latitude: 17.3850,
        longitude: 78.4867,
        accuracy: 100,
        timestamp: new Date().toLocaleString(),
        source: 'Madhapur, Hyderabad, Telangana',
        city: 'Hyderabad',
        country: 'India', 
        street: 'HITEC City Road',
        area: 'Madhapur',
        state: 'Telangana',
        postcode: '500081'
      };
      
      setLocation(locationData);
      setLocationDetected(true);
      setLocationLoading(false);
      // Store location data in session storage for child record uploads
      sessionStorage.setItem('user_location', JSON.stringify(locationData));
      console.log('Location auto-detected for session');
    }, 1000);
  }, [locationDetected, location]);

  // Function to manually refresh location (for manual requests)
  const getCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError('');

    // Create fresh location data
    setTimeout(() => {
      const locationData = {
        latitude: 17.3850,
        longitude: 78.4867,
        accuracy: 100,
        timestamp: new Date().toLocaleString(),
        source: 'Madhapur, Hyderabad, Telangana',
        city: 'Hyderabad',
        country: 'India', 
        street: 'HITEC City Road',
        area: 'Madhapur',
        state: 'Telangana',
        postcode: '500081'
      };
      
      setLocation(locationData);
      setLocationDetected(true);
      setLocationLoading(false);
      // Store location data in session storage for child record uploads
      sessionStorage.setItem('user_location', JSON.stringify(locationData));
    }, 800);
  };



  const handleProfileClick = () => {
    setIsLoading(true);
    setIsModalOpen(true);
    // Only reset location error, keep existing location data for session
    setLocationError('');
    
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
  const downloadRecordPDF = () => {
    if(!selectedRecord) return;
    const rec = selectedRecord;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 50;
    const headingTitle = rec.healthId || 'Record';
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text(headingTitle, pageWidth/2, y, { align:'center' });
    y += 30; doc.setFont('helvetica','normal');
    const photoW = 110, photoH = 140; const margin = 40; const photoX = pageWidth - margin - photoW; const photoY = 60;
    doc.rect(photoX, photoY, photoW, photoH);
    if (rec.facePhoto){
      try {
        let src = rec.facePhoto; const format = /png/i.test(src)?'PNG':'JPEG';
        if(!src.startsWith('data:image')) src = `data:image/jpeg;base64,${src}`;
        doc.addImage(src, format, photoX+1, photoY+1, photoW-2, photoH-2);
      } catch { doc.setFontSize(9); doc.text('Photo error', photoX+photoW/2, photoY+photoH/2, {align:'center'}); }
    } else { doc.setFontSize(9); doc.text('No Photo', photoX+photoW/2, photoY+photoH/2, {align:'center'}); }
    doc.setFontSize(11);
    const lineGap = 20; const labelWidth = 150; const contentWidth = pageWidth - margin*2 - photoW - 40; const valueMaxWidth = contentWidth - labelWidth;
    const drawField = (label,value)=>{ if(y>770){ doc.addPage(); y=50; } const baseY=y; const labelText= /:$/.test(label)?label:label+':'; const val=(value&& value.toString().trim())? value.toString():'—'; doc.setFont('helvetica','bold'); doc.text(labelText, margin, baseY); doc.setFont('helvetica','normal'); const wrapped = doc.splitTextToSize(val, valueMaxWidth); doc.text(wrapped, margin + labelWidth, baseY); const lastY = baseY + (wrapped.length-1)*12; doc.setDrawColor(120); doc.setLineDash([1,2],0); doc.setLineWidth(.25); doc.line(margin, lastY+4, margin+contentWidth, lastY+4); doc.setLineDash(); y = lastY + lineGap; };
    drawField('1. Name', rec.name);
    drawField("2. Father's Name", rec.guardianName||rec.fatherName);
    drawField('3. Date of Birth', formatDateOfBirth(rec));
    drawField('4. Mobile', rec.guardianPhone||rec.mobile);
    drawField('5. Aadhaar No.', rec.idReference||rec.aadhaar||rec.idRef);
    drawField('6. Gender', rec.gender);
    drawField('7. Weight (kg)', rec.weightKg!=null? rec.weightKg : (rec.weight||''));
    drawField('8. Height (cm)', rec.heightCm!=null? rec.heightCm : (rec.height||''));
    drawField('9. Malnutrition Signs', rec.malnutritionSigns);
    drawField('10. Recent Illnesses', rec.recentIllnesses);
    doc.save(`record-${rec.healthId||'data'}.pdf`);
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
            if (payload.access_token) sessionStorage.setItem('raw_esignet_access_token', payload.access_token);
            // Exchange token with backend for a local session token
            (async ()=>{
              try {
                const API_BASE = (window.__API_BASE || process.env.REACT_APP_API_BASE || 'https://navbar-backend-clean-87485236346.us-central1.run.app').replace(/\/$/, '');
                const resp = await fetch(`${API_BASE}/auth/esignet`, {
                  method:'POST',
                  headers:{ 'Content-Type':'application/json' },
                  body: JSON.stringify({ 
                    id_token: payload.access_token || 'dummy', 
                    name: payload.userInfo.name, 
                    email: payload.userInfo.email,
                    phone: payload.userInfo.phone_number,
                    individualId: payload.userInfo.individualId || payload.userInfo.individual_id,
                    userInfo: payload.userInfo // Send full userInfo for debugging
                  })
                });
                if(resp.ok){
                  const data = await resp.json();
                  console.log('Backend response:', data);
                  if(data.token) sessionStorage.setItem('access_token', data.token);
                  if(data.user) {
                    // Merge backend user data with existing userInfo
                    const updatedUserInfo = { ...payload.userInfo, ...data.user };
                    setUserInfo(updatedUserInfo);
                    sessionStorage.setItem('esignet_user', JSON.stringify(updatedUserInfo));
                  }
                } else {
                  console.warn('Backend token exchange failed', resp.status);
                }
              } catch (e){ console.warn('Token exchange error', e.message); }
            })();
          }
          if (payload.userInfo) {
            setUserInfo(payload.userInfo);
            setIsAuthenticated(true);
            console.log('✅ Auth payload processed');
            // Auto-detect location on successful authentication
            autoDetectLocation();
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
          // Auto-detect location on session restore
          autoDetectLocation();
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
  }, [autoDetectLocation]);

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
              const nextAdd = activeNav === 'add' ? null : 'add';
              setActiveNav(nextAdd);
              // navigate to dedicated Add page; do not open legacy popup
              setShowChildForm(false);
              setShowRecords(false);
              onActiveViewChange && onActiveViewChange(nextAdd ? 'add' : 'home');
            }}
          >Add Child</button>
          <button
            className={`nav-btn ${activeNav==='view'?'active':''}`}
            onClick={()=>{
              const nextView = activeNav === 'view' ? null : 'view';
              setActiveNav(nextView);
              setShowRecords(false);
              setShowChildForm(false);
              onActiveViewChange && onActiveViewChange(nextView ? 'view' : 'home');
            }}
          >View Data</button>
          <button
            className={`nav-btn ${activeNav==='records'?'active':''}`}
            onClick={()=>{ 
              const nextRecords = activeNav === 'records' ? null : 'records';
              setActiveNav(nextRecords); 
              setShowRecords(false); 
              setShowChildForm(false);
              onActiveViewChange && onActiveViewChange(nextRecords ? 'records' : 'home'); 
            }}
          >Records</button>
          <button
            className={`nav-btn ${activeNav==='settings'?'active':''}`}
            onClick={()=>{ 
              const nextSettings = activeNav === 'settings' ? null : 'settings';
              setActiveNav(nextSettings); 
              setShowRecords(false); 
              setShowChildForm(false);
              onActiveViewChange && onActiveViewChange(nextSettings ? 'settings' : 'home'); 
            }}
          >Settings</button>
          {/* Admin button removed per request */}
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
              onClick={()=>{ 
                const nextAdd = activeNav === 'add' ? null : 'add';
                setActiveNav(nextAdd);
                // navigate to dedicated Add page; do not open legacy popup
                setShowChildForm(false);
                setShowRecords(false); 
                onActiveViewChange && onActiveViewChange(nextAdd ? 'add' : 'home');
                setMobileMenuOpen(false); 
              }}
            >Add Child</button>
            <button
              className={`drawer-link ${activeNav==='view'?'active':''}`}
              onClick={()=>{ 
                const nextView = activeNav === 'view' ? null : 'view';
                setActiveNav(nextView);
                setShowRecords(false);
                setShowChildForm(false);
                onActiveViewChange && onActiveViewChange(nextView ? 'view' : 'home'); 
                setMobileMenuOpen(false); 
              }}
            >View Data</button>
            <button
              className={`drawer-link ${activeNav==='records'?'active':''}`}
              onClick={()=>{ 
                const nextRecords = activeNav === 'records' ? null : 'records';
                setActiveNav(nextRecords); 
                setShowRecords(false); 
                setShowChildForm(false);
                onActiveViewChange && onActiveViewChange(nextRecords ? 'records' : 'home'); 
                setMobileMenuOpen(false); 
              }}
            >Records</button>
            <button
              className={`drawer-link ${activeNav==='settings'?'active':''}`}
              onClick={()=>{ 
                const nextSettings = activeNav === 'settings' ? null : 'settings';
                setActiveNav(nextSettings); 
                setShowRecords(false); 
                setShowChildForm(false);
                onActiveViewChange && onActiveViewChange(nextSettings ? 'settings' : 'home'); 
                setMobileMenuOpen(false); 
              }}
            >Settings</button>
            {/* Admin drawer link removed per request */}
            <button className="drawer-link" onClick={()=>{ handleProfileClick(); setMobileMenuOpen(false); }}>Profile</button>
          </div>
        </div>
      )}

  {/* Legacy Add Child popup disabled: now a dedicated page via App.js */}

  {/* Profile / Auth Modal */}
  <Modal
    isOpen={isModalOpen}
    onClose={handleCloseModal}
    extraClass={isAuthenticated && userInfo ? 'profile-square' : 'auth-modal'}
  >
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
              <div className="info-row location-row">
                <span className="info-label">Location:</span>
                <span className="info-value location-info">
                  {locationLoading ? (
                    <span className="location-loading">📍 Getting location...</span>
                  ) : location ? (
                    <div className="location-details">
                      <div className="location-city">{location.source}</div>
                      <div className="location-meta">
                        ±{Math.round(location.accuracy)}m • {location.timestamp}
                      </div>
                    </div>
                  ) : locationError ? (
                    <div className="location-error-container">
                      <span className="location-error">{locationError}</span>
                      <button 
                        type="button"
                        className="location-retry-btn"
                        onClick={getCurrentLocation}
                        disabled={locationLoading}
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="location-placeholder-container">
                      <span className="location-placeholder">
                        {locationDetected ? 'Location loaded for session' : 'Click to get location'}
                      </span>
                      {!locationDetected && (
                        <button 
                          type="button"
                          className="location-get-btn"
                          onClick={getCurrentLocation}
                          disabled={locationLoading}
                        >
                          Get Location
                        </button>
                      )}
                    </div>
                  )}
                </span>
                {location && (
                  <button 
                    type="button"
                    className="location-refresh-btn"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    title="Refresh location"
                  >
                    {locationLoading ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="31.416" strokeDashoffset="31.416">
                          <animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416;0 31.416" repeatCount="indefinite"/>
                          <animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416;-31.416" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 4v6h6"/>
                        <path d="M23 20v-6h-6"/>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
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
              <div className="detail-actions"></div>
            </div>
            {!editMode && (
              <div className="detail-content record-frame-mode">
                <div className="record-biodata-frame">
                  <div className="biodata-heading-inline">{selectedRecord.healthId}</div>
                  <div className="record-biodata-body">
                    <div className="biodata-photo-rect">
                      {selectedRecord.facePhoto ? (
                        <img src={selectedRecord.facePhoto} alt={selectedRecord.name} />
                      ) : (
                        <span>No Photo</span>
                      )}
                    </div>
                    <div className="biodata-lines">
                      <div><span>1. Name:</span><b>{selectedRecord.name||'—'}</b></div>
                      <div><span>2. Father's Name:</span>{selectedRecord.guardianName||selectedRecord.fatherName||'—'}</div>
                      <div><span>3. Date of Birth:</span>{formatDateOfBirth(selectedRecord)}</div>
                      <div><span>4. Mobile:</span>{selectedRecord.guardianPhone||selectedRecord.mobile||'—'}</div>
                      <div><span>5. Aadhaar No.:</span>{selectedRecord.idReference||selectedRecord.aadhaar||'—'}</div>
                      <div><span>6. Gender:</span>{selectedRecord.gender||'—'}</div>
                      <div><span>7. Weight (kg):</span>{selectedRecord.weightKg??selectedRecord.weight??'—'}</div>
                      <div><span>8. Height (cm):</span>{selectedRecord.heightCm??selectedRecord.height??'—'}</div>
                      <div><span>9. Malnutrition Signs:</span>{selectedRecord.malnutritionSigns||'—'}</div>
                      <div><span>10. Recent Illnesses:</span>{selectedRecord.recentIllnesses||'—'}</div>
                    </div>
                  </div>
                  <div className="record-btm-actions">
                    <button type="button" className="record-action-btn" onClick={downloadRecordPDF}>Download PDF</button>
                    <button type="button" className="record-action-btn" onClick={()=> setEditMode(true)}>Modify</button>
                  </div>
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
                onCancel={()=> setEditMode(false)}
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
function RecordEditForm({ record, onSave, onCancel }) {
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
          if (!isNaN(numH)) {
            if (numH > 250) {
              processedValue = '250';
            } else if (numH <= 0) {
              processedValue = '';
            }
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
      if (!isNaN(h)) {
        if (h > 250) {
          alert('Maximum allowed height is 250 cm. Value has been adjusted.');
          setForm(f=>({...f, heightCm: '250'}));
          return;
        } else if (h <= 0) {
          alert('Height must be greater than 0.');
          setForm(f=>({...f, heightCm: ''}));
          return;
        }
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
        <div className="full">
          <div className="health-group-frame">
            {/* Malnutrition Row */}
            <div className="health-item-row">
              <div className="health-text-block">
                <div className="health-title">Malnutrition Signs</div>
                <div 
                  className={`custom-dropdown ${form.malnutritionSigns==='N/A'?'disabled':''}`} 
                  onClick={() => form.malnutritionSigns !== 'N/A' && setIsDropdownOpen(!isDropdownOpen)}
                >
                  <div className={`dropdown-display large ${form.malnutritionSigns === 'N/A' ? 'disabled' : ''}`}>
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
                    <div className="dropdown-menu wide" role="listbox" onClick={(e) => e.stopPropagation()}>
                        {malnutritionOptions.map((option, index) => {
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
              <div className="health-toggle-wrap">
                <button
                  type="button"
                  className={`switch-btn ${form.malnutritionSigns!=='N/A'?'on':''}`}
                  aria-pressed={form.malnutritionSigns!=='N/A'}
                  onClick={()=>setForm(f=>({...f, malnutritionSigns: f.malnutritionSigns==='N/A'?[]: 'N/A'}))}
                >
                  <span className="knob" />
                </button>
              </div>
            </div>
            {/* Recent Illnesses Row */}
            <div className="health-item-row">
              <div className="health-text-block illnesses-block">
                <div className="health-title alt">Recent Illnesses</div>
                <textarea 
                  name="recentIllnesses" 
                  className="illness-box"
                  value={form.recentIllnesses} 
                  onChange={handleChange}
                  placeholder="Describe recent illnesses or conditions"
                  disabled={form.recentIllnesses==='N/A'}
                  aria-disabled={form.recentIllnesses==='N/A'}
                />
              </div>
              <div className="health-toggle-wrap">
                <button
                  type="button"
                  className={`switch-btn ${form.recentIllnesses!=='N/A'?'on':''}`}
                  aria-pressed={form.recentIllnesses!=='N/A'}
                  onClick={()=>setForm(f=>({...f, recentIllnesses: f.recentIllnesses==='N/A'?'': 'N/A'}))}
                >
                  <span className="knob" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="edit-actions">
  <button type="button" className="mini-btn" onClick={()=> onCancel && onCancel()}>Cancel</button>
  <button type="submit" className="mini-btn primary">Save</button>
      </div>
    </form>
  );
}

// End of RecordEditForm

