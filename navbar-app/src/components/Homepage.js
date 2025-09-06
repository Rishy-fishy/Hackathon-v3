import React, { useState, useEffect } from 'react';
import './Homepage.css';
import { listChildRecords } from '../offline/db';
import { FaChartBar, FaClock } from 'react-icons/fa';

const Homepage = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Helper: decode base64url string
    const base64UrlDecode = (str) => {
      try {
        return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        return null;
      }
    };

    // Process auth payload from URL hash or query and persist to sessionStorage
    const processAuthFromURL = () => {
      try {
        let params = new URLSearchParams(window.location.search);
        let authPayloadB64 = params.get('auth_payload');
        if (!authPayloadB64 && window.location.hash.startsWith('#')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          authPayloadB64 = hashParams.get('auth_payload');
          if (authPayloadB64) params = hashParams; // operate on hash params if present
        }
        if (authPayloadB64) {
          const jsonStr = base64UrlDecode(authPayloadB64);
          if (jsonStr) {
            try {
              const payload = JSON.parse(jsonStr);
              if (payload.userInfo) {
                sessionStorage.setItem('esignet_authenticated', 'true');
                sessionStorage.setItem('esignet_user', JSON.stringify(payload.userInfo));
                sessionStorage.setItem('auth_timestamp', Date.now().toString());
                if (payload.access_token) sessionStorage.setItem('raw_esignet_access_token', payload.access_token);
                setUserInfo(payload.userInfo);
                setIsAuthenticated(true);
              }
            } catch {}
          }
          // Clean URL fragment/query
          params.delete('auth_payload');
          if (window.location.hash && window.location.hash.includes('auth_payload')) {
            const newHashParams = new URLSearchParams(params.toString());
            window.history.replaceState({}, document.title, window.location.pathname + (newHashParams.toString() ? ('#' + newHashParams.toString()) : ''));
          } else {
            window.history.replaceState({}, document.title, window.location.pathname + (params.toString() ? ('?' + params.toString()) : ''));
          }
        }
      } catch {}
    };

    // Handle auth payload if present
    processAuthFromURL();

    // Get user info from session/local storage
    const esignetUser = sessionStorage.getItem('esignet_user');
    const legacyUser = localStorage.getItem('user_info');
    const esignetAuth = sessionStorage.getItem('esignet_authenticated') === 'true';
    const legacyAuth = localStorage.getItem('is_authenticated') === 'true';
    
    if (esignetUser && esignetAuth) {
      try {
        setUserInfo(JSON.parse(esignetUser));
        setIsAuthenticated(true);
      } catch (e) {
        console.warn('Failed to parse eSignet user info');
      }
    } else if (legacyUser && legacyAuth) {
      try {
        setUserInfo(JSON.parse(legacyUser));
        setIsAuthenticated(true);
      } catch (e) {
        console.warn('Failed to parse legacy user info');
      }
    }

    // Get records statistics
    const loadStats = async () => {
      try {
        const records = await listChildRecords();
        setRecordsCount(records.length);
        
        // Count pending uploads (records without uploadedAt or with status 'pending')
        const pending = records.filter(record => 
          !record.uploadedAt || record.status === 'pending'
        ).length;
        setPendingUploads(pending);
      } catch (error) {
        console.warn('Failed to load records stats:', error);
      }
    };

    // Always load stats regardless of authentication status
    loadStats();

    // Re-check shortly after mount in case another component (Header) stores auth a tick later
    const t = setTimeout(() => {
      try {
        const esignetUser2 = sessionStorage.getItem('esignet_user');
        const esignetAuth2 = sessionStorage.getItem('esignet_authenticated') === 'true';
        if (esignetUser2 && esignetAuth2) {
          setUserInfo(JSON.parse(esignetUser2));
          setIsAuthenticated(true);
        }
      } catch {}
    }, 300);

    // Update if hash changes (e.g., when returning from callback)
    const onHashChange = () => {
      processAuthFromURL();
      try {
        const esignetUser3 = sessionStorage.getItem('esignet_user');
        const esignetAuth3 = sessionStorage.getItem('esignet_authenticated') === 'true';
        if (esignetUser3 && esignetAuth3) {
          setUserInfo(JSON.parse(esignetUser3));
          setIsAuthenticated(true);
        }
      } catch {}
    };
    window.addEventListener('hashchange', onHashChange);

    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  const getWelcomeMessage = () => {
    if (!userInfo) {
      return "Welcome User";
    }
    
    const name = userInfo.name || userInfo.given_name || "User";
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
      greeting = "Good morning";
    } else if (hour < 17) {
      greeting = "Good afternoon";
    } else {
      greeting = "Good evening";
    }
    
    return `${greeting}, ${name}!`;
  };

  return (
    <div className="homepage-container">
      <div className="homepage-content">
        {/* Welcome Section */}
        <div className="welcome-section">
          <div className="user-profile-section">
            {userInfo && (
              <div className="profile-picture">
                {userInfo.picture ? (
                  <img src={userInfo.picture} alt="Profile" />
                ) : (
                  <div className="profile-initials">
                    {userInfo.given_name?.charAt(0)}{userInfo.family_name?.charAt(0)}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="welcome-message">
            <h1>{getWelcomeMessage()}</h1>
            <p>Manage child health records efficiently and securely</p>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="stats-section">
          <div className="stat-card">
            <div className="stat-icon">
              <FaChartBar />
            </div>
            <div className="stat-content">
              <h3>Records Uploaded</h3>
              {isAuthenticated ? (
                <>
                  <div className="stat-number">{recordsCount - pendingUploads}</div>
                  <p>Successfully uploaded to server</p>
                </>
              ) : (
                <>
                  <div className="stat-message">Please login first</div>
                  <p>Authentication required to view upload statistics</p>
                </>
              )}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <FaClock />
            </div>
            <div className="stat-content">
              <h3>Pending Uploads</h3>
              <div className="stat-number">{pendingUploads}</div>
              <p>Records waiting to be uploaded</p>
            </div>
          </div>
        </div>

        {/* Instructions Section */}
        <div className="instructions-section">
          <h2>How to Use ChildHealthBooklet</h2>
          <div className="instruction-points">
            <div className="instruction-item">
              <span className="step-number">1</span>
              <div className="step-content">
                <h4>Add Child Records</h4>
                <p>Click "ADD CHILD" to create new health records with photos and detailed information</p>
              </div>
            </div>
            
            <div className="instruction-item">
              <span className="step-number">2</span>
              <div className="step-content">
                <h4>View & Manage Data</h4>
                <p>Use "VIEW DATA" to browse, edit, and manage all stored child health records</p>
              </div>
            </div>
            
            <div className="instruction-item">
              <span className="step-number">3</span>
              <div className="step-content">
                <h4>Upload to Server</h4>
                <p>Authenticate with eSignet and upload records securely to the central database</p>
              </div>
            </div>
            
            <div className="instruction-item">
              <span className="step-number">4</span>
              <div className="step-content">
                <h4>Customize Settings</h4>
                <p>Access "SETTINGS" to configure app preferences, language, and data export options</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Homepage;
