import React, { useState } from 'react';
import './Header.css';
import Modal from './Modal';
import ESignetAuth from './ESignetAuth';

const Header = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleProfileClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
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
        <ESignetAuth />
      </Modal>
    </header>
  );
};

export default Header;
