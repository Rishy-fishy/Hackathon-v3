import React from 'react';
import './BottomNav.css';

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Bottom Navigation">
      <a href="#home" className="bn-item">
        <span className="bn-icon">🏠</span>
        <span className="bn-label">Home</span>
      </a>
      <a href="#add-child" className="bn-item">
        <span className="bn-icon">➕</span>
        <span className="bn-label">Add Child</span>
      </a>
      <a href="#view-data" className="bn-item">
        <span className="bn-icon">🗂</span>
        <span className="bn-label">Records</span>
      </a>
      <a href="#settings" className="bn-item">
        <span className="bn-icon">⚙️</span>
        <span className="bn-label">Settings</span>
      </a>
      <a href="#help" className="bn-item">
        <span className="bn-icon">❓</span>
        <span className="bn-label">Help</span>
      </a>
    </nav>
  );
}


