import React, { useState, useEffect } from 'react';
import { db } from '../offline/db';
import jsPDF from 'jspdf';
import { IoSettingsOutline, IoNotificationsOutline, IoInformationCircleOutline, IoMoonOutline, IoSunnyOutline } from 'react-icons/io5';
import { themeManager } from '../utils/themeManager';
import './settings.css';

const Settings = ({ onClose }) => {
  // Initialize settings with saved values to prevent theme flicker
  const getInitialSettings = () => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        return {
          theme: 'light',
          language: 'english',
          formSubmissions: true,
          syncUpdates: true,
          exportPDF: true,
          ...parsed // Override defaults with saved values
        };
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
    return {
      theme: 'light',
      language: 'english',
      formSubmissions: true,
      syncUpdates: true,
      exportPDF: true
    };
  };

  const [settings, setSettings] = useState(getInitialSettings());

  // Load settings from localStorage on component mount
  useEffect(() => {
    // Settings are already loaded in useState initializer
    // Just ensure theme is applied on mount
    console.log('Settings component mounted with theme:', settings.theme);
    themeManager.setTheme(settings.theme);
  }, []); // Empty dependency array - run only once on mount

  // Apply theme changes using Dark Reader via theme manager
  useEffect(() => {
    themeManager.setTheme(settings.theme);
  }, [settings.theme]);

  // Save settings to localStorage when settings change
  const handleSettingChange = (key, value) => {
    console.log(`Setting ${key} to:`, value);
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('appSettings', JSON.stringify(newSettings));
    
    // Apply theme immediately if it's a theme change
    if (key === 'theme') {
      try { themeManager.setTheme(value); } catch(e){ console.error('Theme apply error', e); }
    }
  };

  const [showExportModal,setShowExportModal] = useState(false);
  const [searchTerm,setSearchTerm] = useState('');
  const [searching,setSearching] = useState(false);
  const [mergedRecord,setMergedRecord] = useState(null);
  const API_BASE = (
    (typeof window!=='undefined' && window.__API_BASE) ||
    process.env.REACT_APP_API_BASE ||
    'https://navbar-backend-clean-87485236346.us-central1.run.app'
  ).replace(/\/$/,'');

  const openExport = () => { setShowExportModal(true); setSearchTerm(''); setMergedRecord(null); };

  async function handleSearch(e){
    e.preventDefault();
    if(!searchTerm.trim()) return;
    setSearching(true); setMergedRecord(null);
    try {
      // Local lookup (IndexedDB)
      let local = await db.childRecords.get(searchTerm.trim());
      if(!local) {
        // Try name match first in local (simple scan)
        const all = await db.childRecords.toArray();
        local = all.find(r => r.name && r.name.toLowerCase().startsWith(searchTerm.toLowerCase()));
      }
      // Remote fetch
      let remote = null;
      try {
        const resp = await fetch(`${API_BASE}/api/child/search?q=${encodeURIComponent(searchTerm.trim())}`);
        if (resp.ok) {
          const j = await resp.json();
            if (j.found) remote = j.record;
        }
      } catch {}
      // Merge (remote wins for conflicting fields, include local-only fields)
      const merged = remote ? { ...local, ...remote } : local;
      // Normalize Aadhaar field naming
      if (merged) {
        if (!merged.aadhaar) merged.aadhaar = merged.idReference || merged.idRef || merged.id_reference || merged.aadhar || merged.aadharNumber;
        // Also keep a normalized idReference for consistency
        if (!merged.idReference) merged.idReference = merged.aadhaar;
      }
      setMergedRecord(merged||null);
      if(!merged) alert('No matching record found locally or remotely');
    } finally { setSearching(false); }
  }

  // Helper to extract DOB string from different possible field names and compute age
  function getDobAndAge(rec){
    if(!rec) return { dobDisplay:'—', ageYears:'' };
    const candidateKeys = ['dateOfBirth','dob','DOB','birthDate','birthdate','date_of_birth','DateOfBirth'];
    let dobStr = '';
    for (const k of candidateKeys){ if(rec[k]) { dobStr = rec[k]; break; } }
    // Derive from ageMonths if still missing
    if(!dobStr && rec.ageMonths!=null){
      const today = new Date();
      const birth = new Date(today);
      birth.setMonth(birth.getMonth() - Number(rec.ageMonths));
      dobStr = birth.toISOString().split('T')[0];
    }
    // Derive from ageYears if provided
    if(!dobStr && rec.ageYears!=null){
      const today = new Date();
      const birth = new Date(today);
      birth.setFullYear(birth.getFullYear() - Number(rec.ageYears));
      dobStr = birth.toISOString().split('T')[0];
    }
    // Normalize: if in dd/mm/yyyy convert to yyyy-mm-dd for parsing
    let isoForParse = dobStr;
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(dobStr)){
      const [dd,mm,yyyy] = dobStr.split('/');
      isoForParse = `${yyyy}-${mm}-${dd}`;
    }
    let ageYears = '';
    if(isoForParse){
      const d = new Date(isoForParse);
      if(!isNaN(d.getTime())){
        const now = new Date();
        ageYears = Math.floor((now - d)/(365.25*24*3600*1000));
      }
    }
    return { dobDisplay: dobStr || '—', ageYears };
  }

  function exportSinglePDF(){
    if(!mergedRecord) return;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 50;

  // Title now uses Health ID (fallback to BIO-DATA FORM)
  const headingTitle = mergedRecord.healthId || 'BIO-DATA FORM';
  doc.setFontSize(18); doc.setFont('helvetica','bold');
  doc.text(headingTitle, pageWidth/2, y, { align:'center' });
    doc.setFont('helvetica','normal');
    y += 30;

    // Photo placeholder (top-right)
    const photoW = 110, photoH = 140;
    const margin = 40;
    const photoX = pageWidth - margin - photoW;
    const photoY = 60;
    doc.rect(photoX, photoY, photoW, photoH);
    if (mergedRecord.facePhoto) {
      try {
        let src = mergedRecord.facePhoto;
        const format = /png/i.test(src) ? 'PNG' : 'JPEG';
        if (!src.startsWith('data:image')) {
          // assume jpeg base64 without header
          src = `data:image/jpeg;base64,${src}`;
        }
        // Fit image (cover) inside box
        doc.addImage(src, format, photoX+1, photoY+1, photoW-2, photoH-2);
      } catch(err){
        doc.setFontSize(9); doc.text('Photo error', photoX + photoW/2, photoY + photoH/2, {align:'center'});
      }
    } else {
      doc.setFontSize(9); doc.text('No Photo', photoX + photoW/2, photoY + photoH/2, {align:'center'});
    }

    doc.setFontSize(11);
    const lineGap = 20;
    const labelWidth = 150;
    const contentWidth = pageWidth - margin*2 - photoW - 40;
    const valueMaxWidth = contentWidth - labelWidth;
    const drawField = (label, value) => {
      if (y > 770) { doc.addPage(); y = 50; }
      const baseY = y;
      const labelText = /:$/.test(label)? label : label + ':';
      const val = (value && value.toString().trim()) ? value.toString() : '—';
      doc.setFont('helvetica','bold'); doc.text(labelText, margin, baseY);
      doc.setFont('helvetica','normal');
      const wrapped = doc.splitTextToSize(val, valueMaxWidth);
      doc.text(wrapped, margin + labelWidth, baseY);
      const lastY = baseY + (wrapped.length-1)*12;
      doc.setDrawColor(120); doc.setLineDash([1,2],0); doc.setLineWidth(.25);
      doc.line(margin, lastY+4, margin + contentWidth, lastY+4);
      doc.setLineDash();
      y = lastY + lineGap;
    };

  // Unified numbered list including health items (Aadhaar & Health ID separated)
  drawField('1. Name', mergedRecord.name);
  const father = mergedRecord.fatherName || mergedRecord.guardianName;
  drawField("2. Father's Name", father);
  const { dobDisplay, ageYears } = getDobAndAge(mergedRecord);
  drawField('3. Date of Birth', dobDisplay !== '—' ? `${dobDisplay}${ageYears?` (Age ${ageYears} yrs)`:''}` : null);
  drawField('4. Mobile', mergedRecord.mobile || mergedRecord.guardianPhone);
  drawField('5. Aadhaar No.', mergedRecord.aadhaar || mergedRecord.idReference || mergedRecord.idRef || mergedRecord.aadhar || mergedRecord.aadharNumber);
  drawField('6. Health ID', mergedRecord.healthId);
  drawField('7. Gender', mergedRecord.gender);
  drawField('8. Weight (kg)', mergedRecord.weightKg!=null? mergedRecord.weightKg : (mergedRecord.weight || ''));
  drawField('9. Height (cm)', mergedRecord.heightCm!=null? mergedRecord.heightCm : (mergedRecord.height || ''));
  drawField('10. Malnutrition Signs', Array.isArray(mergedRecord.malnutritionSigns)? mergedRecord.malnutritionSigns.join(', ') : mergedRecord.malnutritionSigns);
  drawField('11. Recent Illnesses', mergedRecord.recentIllnesses);

    doc.save(`biodata-${mergedRecord.healthId||'record'}.pdf`);
  }

  const handleExportPDF = () => openExport();

  return (
    <div className="settings-container">
      <div className="settings-panel">
        <div className="settings-content">
          
            {/* Appearance & Language Section */}
            <div className="settings-section">
            <div className="section-header">
              <div className="section-icon">
                <IoSettingsOutline />
              </div>
              <div>
                <h3>Appearance & Language</h3>
                <p>Personalize your interface</p>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <h4>Theme</h4>
                <p>Switch between light, dark, or auto mode</p>
                <small style={{color: '#666', fontSize: '0.75rem'}}>
                  Current: {settings.theme} 
                </small>
              </div>
              <div className="setting-controls">
                <div className="theme-controls">
                  <button 
                    className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('Light theme clicked');
                      handleSettingChange('theme', 'light');
                    }}
                  >
                    <IoSunnyOutline /> Light
                  </button>
                  <button 
                    className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('Dark theme clicked');
                      handleSettingChange('theme', 'dark');
                    }}
                  >
                    <IoMoonOutline /> Dark
                  </button>
                  <button 
                    className={`theme-btn ${settings.theme === 'auto' ? 'active' : ''}`}
                    onClick={() => {
                      console.log('Auto theme clicked');
                      handleSettingChange('theme', 'auto');
                    }}
                  >
                    <IoSettingsOutline /> Auto
                  </button>
                </div>
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
              <div className="section-icon">
                <IoNotificationsOutline />
              </div>
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
              <div className="section-icon">
                <IoInformationCircleOutline />
              </div>
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
     
    {showExportModal && (
      <div className="export-modal">
        <div className="export-dialog">
          <h3>Export Record</h3>
          <form onSubmit={handleSearch} className="export-search-form">
            <input placeholder="Enter Health ID or Name" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
            <button type="submit" disabled={searching}>{searching?'Searching...':'Search'}</button>
            <button type="button" onClick={()=>{ setShowExportModal(false); }}>Close</button>
          </form>
          {mergedRecord && (
            <div className="export-preview">
              <h4>Preview</h4>
              <div className="biodata-preview">
                <div className="biodata-header">{mergedRecord.healthId || 'BIO-DATA FORM'}</div>
                <div className="biodata-photo-box">
                  {mergedRecord.facePhoto ? (
                    <img src={mergedRecord.facePhoto.startsWith('data:image')? mergedRecord.facePhoto : `data:image/jpeg;base64,${mergedRecord.facePhoto}`} alt="Child" />
                  ) : (
                    <span>No Photo</span>
                  )}
                </div>
                <div className="biodata-grid">
                  <div><span>1. Name:</span><b>{mergedRecord.name||'—'}</b></div>
                  <div><span>2. Father's Name:</span>{mergedRecord.fatherName || mergedRecord.guardianName || '—'}</div>
                  <div><span>3. Date of Birth:</span>{getDobAndAge(mergedRecord).dobDisplay}</div>
                  <div><span>4. Mobile:</span>{mergedRecord.mobile || mergedRecord.guardianPhone || '—'}</div>
                  <div><span>5. Aadhaar No.:</span>{mergedRecord.aadhaar || mergedRecord.idReference || mergedRecord.idRef || mergedRecord.aadhar || mergedRecord.aadharNumber || '—'}</div>
                  <div><span>6. Gender:</span>{mergedRecord.gender||'—'}</div>
                  <div><span>7. Weight (kg):</span>{mergedRecord.weightKg??mergedRecord.weight??'—'}</div>
                  <div><span>8. Height (cm):</span>{mergedRecord.heightCm??mergedRecord.height??'—'}</div>
                  <div><span>9. Malnutrition Signs:</span>{Array.isArray(mergedRecord.malnutritionSigns)? mergedRecord.malnutritionSigns.join(', '):(mergedRecord.malnutritionSigns||'—')}</div>
                  <div><span>10. Recent Illnesses:</span>{mergedRecord.recentIllnesses||'—'}</div>
                </div>
              </div>
              <button onClick={exportSinglePDF}>Download PDF</button>
            </div>
          )}
        </div>
      </div>
    )}
    </div>
  );
};

export default Settings;
