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
      const esignetAuthenticated = sessionStorage.getItem('esignet_authenticated') === 'true';
      if (esignetAuthenticated) {
        const storedUserInfo = sessionStorage.getItem('esignet_user');
        if (storedUserInfo) {
          const userInfo = JSON.parse(storedUserInfo);
          setUserInfo(userInfo);
          setIsAuthenticated(true);
          console.log('✅ eSignet user loaded:', userInfo.name);
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
        {/* Logo/Brand section */}
        <div className="nav-brand">
          <h2>MyApp</h2>
        </div>
        
        {/* Navigation links */}
        <nav className="nav-menu">
          <ul className="nav-list">
            <li className="nav-item">
              <a href="#home" className="nav-link">Home</a>
            </li>
            <li className="nav-item">
              <a href="#about" className="nav-link">About</a>
            </li>
            <li className="nav-item">
              <a href="#services" className="nav-link">Services</a>
            </li>
            <li className="nav-item">
              <a href="#contact" className="nav-link">Contact</a>
            </li>
          </ul>
        </nav>
        
        {/* Profile icon on the right */}
        <div className="nav-profile" onClick={handleProfileClick}>
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
                  <span className="detail-value">{userInfo.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">First Name:</span>
                  <span className="detail-value">{userInfo.given_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Name:</span>
                  <span className="detail-value">{userInfo.family_name}</span>
                </div>
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
                    {userInfo.email}
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
                  <div className="detail-row">
                    <span className="detail-label">Address:</span>
                    <span className="detail-value">{userInfo.address.formatted}</span>
                  </div>
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
                </div>
              )}

              {/* Authentication Information */}
              <div className="detail-group">
                <h4>Authentication Details</h4>
                <div className="detail-row">
                  <span className="detail-label">User ID:</span>
                  <span className="detail-value">{userInfo.sub}</span>
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
                <div className="detail-row">
                  <span className="detail-label">Session:</span>
                  <span className="detail-value">Active</span>
                </div>
              </div>
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
    </header>
  );
};

export default Header;
