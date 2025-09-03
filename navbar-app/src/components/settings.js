import React, { useState, useEffect } from 'react';
import './settings.css';

const Settings = ({ onClose }) => {
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'english',
    formSubmissions: true,
    syncUpdates: true,
    exportPDF: true
  });

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    }
  }, []);

  // Save settings to localStorage when settings change
  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
  };

  const handleExportPDF = () => {
    const records = JSON.parse(localStorage.getItem('childRecords') || '[]');
    if (records.length === 0) {
      alert('No records available to export');
      return;
    }
    
    // Create PDF content
    let pdfContent = 'Child Health Records\n\n';
    records.forEach((record, index) => {
      pdfContent += `Record ${index + 1}:\n`;
      pdfContent += `Name: ${record.name || 'N/A'}\n`;
      pdfContent += `Health ID: ${record.healthId || 'N/A'}\n`;
      pdfContent += `Gender: ${record.gender || 'N/A'}\n`;
      pdfContent += `Date of Birth: ${record.dateOfBirth || 'N/A'}\n`;
      pdfContent += `Weight: ${record.weightKg || 'N/A'} kg\n`;
      pdfContent += `Height: ${record.heightCm || 'N/A'} cm\n`;
      pdfContent += `Guardian: ${record.guardianName || 'N/A'}\n`;
      pdfContent += `Phone: ${record.guardianPhone || 'N/A'}\n`;
      pdfContent += `Relation: ${record.guardianRelation || 'N/A'}\n`;
      pdfContent += `Malnutrition Signs: ${record.malnutritionSigns || 'N/A'}\n`;
      pdfContent += `Recent Illnesses: ${record.recentIllnesses || 'N/A'}\n`;
      pdfContent += '\n---\n\n';
    });
    
    // Create and download as text file (PDF libraries would require additional setup)
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `child-health-records-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Records exported successfully!');
  };

  return (
    <div className="settings-container">
      <div className="settings-panel">
        <div className="settings-content">
          {/* Appearance & Language Section */}
          <div className="settings-section">
            <div className="section-header">
              <div className="section-icon">⚙️</div>
              <div>
                <h3>Appearance & Language</h3>
                <p>Personalize your interface</p>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Theme</h4>
                <p>Switch between light and dark mode</p>
              </div>
              <div className="setting-controls">
                <button 
                  className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                  onClick={() => handleSettingChange('theme', 'light')}
                >
                  ☀️ Light
                </button>
                <button 
                  className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => handleSettingChange('theme', 'dark')}
                >
                  🌙 Dark
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Language</h4>
                <p>Select your preferred language</p>
              </div>
              <div className="setting-controls">
                <select 
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  className="language-select"
                >
                  <option value="english">🇺🇸 English</option>
                  <option value="hindi">🇮🇳 हिंदी</option>
                  <option value="spanish">🇪🇸 Español</option>
                </select>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="settings-section">
            <div className="section-header">
              <div className="section-icon">🔔</div>
              <div>
                <h3>Notifications</h3>
                <p>Manage your alert preferences</p>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Form Submissions</h4>
                <p>Get notified when forms are submitted</p>
              </div>
              <div className="setting-controls">
                <label className="toggle-switch">
                  <input 
                    type="checkbox"
                    checked={settings.formSubmissions}
                    onChange={(e) => handleSettingChange('formSubmissions', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Sync Updates</h4>
                <p>Notifications for data synchronization</p>
              </div>
              <div className="setting-controls">
                <label className="toggle-switch">
                  <input 
                    type="checkbox"
                    checked={settings.syncUpdates}
                    onChange={(e) => handleSettingChange('syncUpdates', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Export Data in PDF Format</h4>
                <p>Download all records as PDF document</p>
              </div>
              <div className="setting-controls">
                <button className="action-btn export-btn" onClick={handleExportPDF}>
                  📄 Export PDF
                </button>
              </div>
            </div>
          </div>

          {/* About & Support Section */}
          <div className="settings-section">
            <div className="section-header">
              <div className="section-icon">ℹ️</div>
              <div>
                <h3>About & Support</h3>
                <p>App information and help resources</p>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>App Version</h4>
                <p>Current version and build info</p>
              </div>
              <div className="setting-controls">
                <div className="version-info">
                  <span className="version-text">v2.1.4</span>
                  <span className="build-text">Build 2024.01</span>
                </div>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Help & Documentation</h4>
                <p>Access user guides and tutorials</p>
              </div>
              <div className="setting-controls">
                <button className="action-btn help-btn" onClick={() => alert('Opening help documentation...')}>
                  📄 Help
                </button>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Contact Support</h4>
                <p>Get help with technical issues</p>
              </div>
              <div className="setting-controls">
                <button className="action-btn contact-btn" onClick={() => alert('Opening contact form...')}>
                  ✉️ Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
