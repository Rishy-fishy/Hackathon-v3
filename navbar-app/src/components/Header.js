import React, { useState, useEffect } from 'react';
import './Header.css';
import Modal from './Modal';
import ESignetAuth from './ESignetAuth';
import ErrorBoundary from './ErrorBoundary';

const Header = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null); // epoch ms
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark_mode') === 'true');
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [syncCounts, setSyncCounts] = useState({ pending: 0, failed: 0 });
  const [online, setOnline] = useState(navigator.onLine);

  const handleProfileClick = () => {
    console.log('Profile button clicked');
    setIsLoading(true);
    setIsModalOpen(true);
    // Small delay to ensure modal is rendered before checking auth state
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
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

  // Install prompt capture
  useEffect(()=>{
    const handler = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return ()=> window.removeEventListener('beforeinstallprompt', handler);
  },[]);

  // Dark mode effect
  useEffect(()=>{
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('dark_mode', darkMode ? 'true':'false');
  },[darkMode]);

  // Sync indicator listener (custom events dispatched by sync.js)
  useEffect(()=>{
    const handler = (e) => {
      const detail = e.detail || {};
      if (detail.counts) setSyncCounts(detail.counts);
    };
    window.addEventListener('sync-update', handler);
    return ()=> window.removeEventListener('sync-update', handler);
  },[]);

  const triggerInstall = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    try { await installPromptEvent.userChoice; } catch {}
    setInstallPromptEvent(null);
  };

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
    <header className="header">
      <div className="nav-container">
        <div className="nav-left">
          {/* Hamburger for mobile */}
          <button
            className={`hamburger ${showMobileMenu ? 'active' : ''}`}
            aria-label="Toggle navigation menu"
            aria-expanded={showMobileMenu}
            onClick={() => setShowMobileMenu(v => !v)}
          >
            <span />
            <span />
            <span />
          </button>
          {/* Logo/Brand section */}
          <div className="nav-brand" aria-label="App Home">
            <h2>Child Health Records</h2>
          </div>
        </div>

        {/* Right side controls */}
        <div className="nav-right">
          <div className="nav-item compact-hide">
            <select className="lang-select" aria-label="Language selector" defaultValue="en">
              <option value="en">us English</option>
              <option value="hi">हिन्दी</option>
            </select>
          </div>
          <div className="nav-item compact-hide">
            <button className="bell" aria-label="Notifications">🔔</button>
          </div>
          <div className="nav-item compact-hide">
            <button className="dark-toggle" onClick={()=> setDarkMode(d => !d)} aria-label="Toggle dark mode">{darkMode ? '🌙' : '☀️'}</button>
          </div>
          {installPromptEvent && (
            <div className="nav-item compact-hide">
              <button className="install-btn" onClick={triggerInstall}>Install App</button>
            </div>
          )}
        </div>
        
        {/* Profile icon on the right */}
        <div className="nav-profile" onClick={handleProfileClick}>
          {/* Sync status indicator (small bullets) */}
          <div className="sync-indicator" title={`Pending: ${syncCounts.pending} Failed: ${syncCounts.failed}`} aria-label="Sync status">
            <span className={`dot pending ${syncCounts.pending? 'active':''}`}></span>
            <span className={`dot failed ${syncCounts.failed? 'active':''}`}></span>
          </div>
          {isAuthenticated && remainingSeconds !== null && (
            <div className="session-countdown-wrapper" title="Session time remaining">
              <span className="session-countdown-label">Session</span>
              <span className={`session-countdown ${remainingSeconds < 60 ? 'warn' : ''}`}>{formatRemaining()}</span>
            </div>
          )}
          <div className="profile-icon-group">
            <div className="profile-icon">
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="7" r="3" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <span className="profile-text">Profile</span>
          </div>
        </div>
      </div>
      
      {/* Authentication Modal */}
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
      {!online && (
        <div className="offline-banner" role="status" aria-live="polite">Offline mode – changes will sync when back online.</div>
      )}
    </header>
  );
};

export default Header;
