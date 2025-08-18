import React, { useState, useEffect } from 'react';
import './Header.css';
import Modal from './Modal';
import ESignetAuth from './ESignetAuth';

const Header = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleProfileClick = () => {
    setIsLoading(true);
    setIsModalOpen(true);
    // Small delay to ensure modal is rendered before checking auth state
    setTimeout(() => {
      setIsLoading(false);
    }, 100);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsLoading(false);
  };

  useEffect(() => {
    // Check if user is authenticated
    const authenticated = localStorage.getItem('is_authenticated') === 'true';
    if (authenticated) {
      const storedUserInfo = localStorage.getItem('user_info');
      if (storedUserInfo) {
        setUserInfo(JSON.parse(storedUserInfo));
        setIsAuthenticated(true);
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
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user_info');
    localStorage.removeItem('access_token');
    localStorage.removeItem('id_token');
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('auth_timestamp');
    localStorage.removeItem('auth_method');
    sessionStorage.removeItem('esignet_state');
    sessionStorage.removeItem('esignet_nonce');
    setUserInfo(null);
    setIsAuthenticated(false);
    setIsModalOpen(false);
    console.log('🚪 User logged out successfully');
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
              <div className="detail-row">
                <span className="detail-label">First Name:</span>
                <span className="detail-value">{userInfo.given_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Name:</span>
                <span className="detail-value">{userInfo.family_name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Email:</span>
                <span className="detail-value">{userInfo.email}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Phone:</span>
                <span className="detail-value">{userInfo.phone_number}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Birthdate:</span>
                <span className="detail-value">{userInfo.birthdate}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Gender:</span>
                <span className="detail-value">{userInfo.gender}</span>
              </div>
              {userInfo.address && (
                <div className="detail-row">
                  <span className="detail-label">Address:</span>
                  <span className="detail-value">{userInfo.address.formatted}</span>
                </div>
              )}
            </div>
            
            <button className="logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        ) : (
          <ESignetAuth />
        )}
      </Modal>
    </header>
  );
};

export default Header;
