import React, { useState, useEffect } from 'react';
import './ViewData.css';
import Modal from './Modal';
import { listChildRecords, updateChildRecord } from '../offline/db';
import jsPDF from 'jspdf';

const ViewData = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    // Check authentication status
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

    // Load records
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      const fetchedRecords = await listChildRecords();
      setRecords(fetchedRecords);
      setFilteredRecords(fetchedRecords);
    } catch (error) {
      console.warn('Failed to load records:', error);
    }
  };

  // Filter records based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredRecords(records);
    } else {
      const filtered = records.filter(record =>
        record.healthId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.guardianName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.gender?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredRecords(filtered);
    }
  }, [searchTerm, records]);

  // Age formatting functions
  const formatAgeFromDOB = (dobString) => {
    if (!dobString) return '—';
    
    const birthDate = new Date(dobString);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    
    if (today.getDate() < birthDate.getDate()) {
      months--;
    }
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    if (years === 0) {
      return `${months} months`;
    } else if (months === 0) {
      return `${years} years`;
    } else {
      return `${years}y ${months}m`;
    }
  };

  const formatAgeDisplay = (ageMonths) => {
    if (ageMonths == null) return '—';
    
    const years = Math.floor(ageMonths / 12);
    const months = ageMonths % 12;
    
    if (years === 0) {
      return `${months} months`;
    } else if (months === 0) {
      return `${years} years`;
    } else {
      return `${years}y ${months}m`;
    }
  };

  const formatDateOfBirth = (record) => {
    if (record.dateOfBirth) {
      return new Date(record.dateOfBirth).toLocaleDateString();
    }
    return '—';
  };

  const handleUpload = async () => {
    if (!isAuthenticated || uploadLoading) {
      console.log('🚫 Upload blocked - isAuthenticated:', isAuthenticated, 'uploadLoading:', uploadLoading);
      return;
    }
    
    console.log('🚀 Starting upload process...');
    setUploadLoading(true);
    setUploadSuccess(false);
    
    try {
      console.log('📋 Loading sync module...');
      const { syncPendingRecords } = await import('../offline/sync');
      
      // Debug authentication state
      const userStr = sessionStorage.getItem('esignet_user') || localStorage.getItem('user_info');
      const accessToken = sessionStorage.getItem('access_token') || 
        sessionStorage.getItem('raw_esignet_access_token') ||
        localStorage.getItem('access_token');
      
      console.log('🔐 Authentication debug:');
      console.log('- User string exists:', !!userStr);
      console.log('- Access token exists:', !!accessToken);
      console.log('- Token preview:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');
      
      let uploaderName = 'manual_upload';
      let uploaderEmail = null;
      if (userStr) {
        try { 
          const u = JSON.parse(userStr); 
          uploaderName = u.name || uploaderName; 
          uploaderEmail = u.email || null;
          console.log('👤 Uploader info - Name:', uploaderName, 'Email:', uploaderEmail);
        } catch (parseError) {
          console.error('❌ Failed to parse user info:', parseError);
        }
      }
      
      // Check for pending records before sync
      const { pendingRecords, listChildRecords } = await import('../offline/db');
      const pendingList = await pendingRecords();
      console.log('📊 Found', pendingList.length, 'pending records to upload');
      
      // If no pending records, check for records that need upload (not uploaded or failed)
      if (pendingList.length === 0) {
        console.log('🔍 No records with pending/failed status, checking for unuploaded records...');
        const allRecords = await listChildRecords();
        const unuploadedRecords = allRecords.filter(r => !r.uploadedAt || r.status === 'failed' || r.status !== 'uploaded');
        console.log('📊 Found', unuploadedRecords.length, 'unuploaded records');
        
        if (unuploadedRecords.length === 0) {
          console.log('ℹ️ No records to upload - all records appear to be uploaded');
          // Removed the alert popup as requested
          return;
        }
        
        // Update unuploaded records to have pending status
        const { updateChildRecord } = await import('../offline/db');
        console.log('🔄 Updating', unuploadedRecords.length, 'records to pending status...');
        for (const record of unuploadedRecords) {
          await updateChildRecord(record.healthId, { status: 'pending' });
        }
        // Refresh the pending list
        const updatedPendingList = await pendingRecords();
        console.log('📊 Updated pending records count:', updatedPendingList.length);
      }
      
      console.log('🔄 Starting sync...');
      const res = await syncPendingRecords({ 
        uploaderName, 
        uploaderEmail, 
        allowNoToken: false 
      });
      
      console.log('📡 Sync result:', res);
      
      if (res && !res.error) {
        console.log('✅ Upload successful!');
        loadRecords(); // Refresh records after upload
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000); // Hide success state after 3 seconds
        alert(`Upload successful! ${res.summary?.uploaded || 0} records uploaded.`);
      } else if (res && res.error) {
        console.error('❌ Upload failed with error:', res);
        alert(`Upload failed: ${res.message || 'Unknown error'}`);
      } else if (res && res.skipped) {
        console.log('⏭️ Upload skipped:', res.reason);
        alert(`Upload skipped: ${res.reason}`);
      }
    } catch (e) { 
      console.error('❌ Upload error:', e);
      alert(`Upload error: ${e.message}`);
    } finally {
      setUploadLoading(false);
    }
  };

  const downloadRecordPDF = () => {
    if (!selectedRecord) return;
    
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Child Health Record', 20, 20);
    
    doc.setFontSize(12);
    let yPos = 40;
    
    const fields = [
      ['Health ID:', selectedRecord.healthId],
      ['Name:', selectedRecord.name || '—'],
      ['Father\'s Name:', selectedRecord.guardianName || selectedRecord.fatherName || '—'],
      ['Date of Birth:', formatDateOfBirth(selectedRecord)],
      ['Mobile:', selectedRecord.guardianPhone || selectedRecord.mobile || '—'],
      ['Aadhaar No.:', selectedRecord.idReference || selectedRecord.aadhaar || '—'],
      ['Gender:', selectedRecord.gender || '—'],
      ['Weight (kg):', selectedRecord.weightKg ?? selectedRecord.weight ?? '—'],
      ['Height (cm):', selectedRecord.heightCm ?? selectedRecord.height ?? '—'],
      ['Malnutrition Signs:', selectedRecord.malnutritionSigns || '—'],
      ['Recent Illnesses:', selectedRecord.recentIllnesses || '—']
    ];
    
    fields.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, 20, yPos);
      yPos += 10;
    });
    
    doc.save(`${selectedRecord.healthId}_health_record.pdf`);
  };

  // Status helper functions
  const getStatusText = (record) => {
    if (record.uploadedAt && record.status === 'uploaded') {
      return 'Uploaded';
    } else if (record.status === 'pending' || !record.uploadedAt) {
      return 'Pending Upload';
    } else if (record.status === 'failed') {
      return 'Upload Failed';
    } else if (record.status === 'recording' || record.isRecording) {
      return 'Recording';
    } else {
      return 'Recorded';
    }
  };

  const getStatusClass = (record) => {
    if (record.uploadedAt && record.status === 'uploaded') {
      return 'status-uploaded';
    } else if (record.status === 'pending' || !record.uploadedAt) {
      return 'status-pending';
    } else if (record.status === 'failed') {
      return 'status-failed';
    } else if (record.status === 'recording' || record.isRecording) {
      return 'status-recording';
    } else {
      return 'status-recorded';
    }
  };

  return (
    <div className="view-data-container">
      <div className="records">
        <div className="records-header-row">
          <h2>Child Health Records ({filteredRecords.length})</h2>
          <div className="header-controls">
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search by ID, Name, Guardian, or Gender..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <button
              type="button"
              className={`upload-btn ${uploadLoading ? 'loading' : ''} ${uploadSuccess ? 'success' : ''}`}
              disabled={!isAuthenticated || uploadLoading}
              onClick={handleUpload}
              title={isAuthenticated? 'Upload pending/failed records to server':'Login required to upload'}
            >
              {uploadLoading ? (
                <>
                  <div className="loading-dots">
                    <div></div>
                    <div></div>
                    <div></div>
                  </div>
                  Upload
                </>
              ) : uploadSuccess ? (
                <>
                  <div className="checkmark-icon"></div>
                  Upload
                </>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </div>
        
        {filteredRecords.length === 0 && searchTerm && (
          <div className="empty">No records match your search criteria.</div>
        )}
        
        {filteredRecords.length === 0 && !searchTerm && (
          <div className="empty">No records saved yet.</div>
        )}
        
        {filteredRecords.length > 0 && (
          <>
            <div className="records-table-header">
              <div className="records-table-header-row">
                <div className="header-id">Health ID</div>
                <div className="header-name">Name</div>
                <div className="header-age">Age</div>
                <div className="header-gender">Gender</div>
                <div className="header-weight">Weight (kg)</div>
                <div className="header-height">Height (cm)</div>
                <div className="header-guardian">Guardian</div>
                <div className="header-status">Status</div>
              </div>
            </div>
            
            <div className="records-table-body">
              {filteredRecords.map(r => (
                <div
                  key={r.healthId}
                  className={`record-row ${selectedRecord?.healthId===r.healthId?'active':''}`}
                  onClick={()=>{ 
                    setSelectedRecord(r); 
                    setEditMode(false); 
                    setShowDetailModal(true);
                  }}
                >
                  <div className="id">{r.healthId}</div>
                  <div className="name">{r.name}</div>
                  <div className="age">{
                    r.dateOfBirth 
                      ? formatAgeFromDOB(r.dateOfBirth)
                      : formatAgeDisplay(r.ageMonths)
                  }</div>
                  <div className="gender">{r.gender || '—'}</div>
                  <div className="weight">{r.weightKg ?? '—'}</div>
                  <div className="height">{r.heightCm ?? '—'}</div>
                  <div className="guardian">{r.guardianName || '—'}</div>
                  <div className="status">
                    <span className={`status-badge ${getStatusClass(r)}`}>
                      {getStatusText(r)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        
        <div className="overview-note">Click on any record row to view detailed information in a popup.</div>
      </div>

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
                  loadRecords(); // Refresh records
                  const updated = await listChildRecords();
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
    </div>
  );
};

// Inline lightweight edit form component (same as in Header.js)
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

  const handleMalnutritionChange = (option) => {
    const current = form.malnutritionSigns === 'N/A' ? [] : form.malnutritionSigns.split(', ');
    const isSelected = current.includes(option);
    
    let updated;
    if (isSelected) {
      updated = current.filter(item => item !== option);
    } else {
      updated = [...current, option];
    }
    
    setForm({ ...form, malnutritionSigns: updated.length > 0 ? updated.join(', ') : 'N/A' });
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setForm({ ...form, facePhoto: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const ageData = calculateAgeFromDOB(form.dateOfBirth);
    onSave({
      ...form,
      idReference: form.idRef,
      ageMonths: ageData.totalMonths
    });
  };

  return (
    <div className="record-edit-form">
      <h3>Edit Record</h3>
      
      <div className="form-row">
        <label>Name:</label>
        <input 
          type="text" 
          value={form.name} 
          onChange={(e) => setForm({...form, name: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>Gender:</label>
        <select 
          value={form.gender} 
          onChange={(e) => setForm({...form, gender: e.target.value})}
        >
          <option value="">Select</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </div>
      
      <div className="form-row">
        <label>Date of Birth:</label>
        <input 
          type="date" 
          value={form.dateOfBirth} 
          onChange={(e) => setForm({...form, dateOfBirth: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>ID Reference:</label>
        <input 
          type="text" 
          value={form.idRef} 
          onChange={(e) => setForm({...form, idRef: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>Weight (kg):</label>
        <input 
          type="number" 
          step="0.1"
          value={form.weightKg} 
          onChange={(e) => setForm({...form, weightKg: parseFloat(e.target.value) || ''})}
        />
      </div>
      
      <div className="form-row">
        <label>Height (cm):</label>
        <input 
          type="number" 
          value={form.heightCm} 
          onChange={(e) => setForm({...form, heightCm: parseFloat(e.target.value) || ''})}
        />
      </div>
      
      <div className="form-row">
        <label>Guardian Name:</label>
        <input 
          type="text" 
          value={form.guardianName} 
          onChange={(e) => setForm({...form, guardianName: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>Guardian Phone:</label>
        <input 
          type="tel" 
          value={form.guardianPhone} 
          onChange={(e) => setForm({...form, guardianPhone: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>Guardian Relation:</label>
        <input 
          type="text" 
          value={form.guardianRelation} 
          onChange={(e) => setForm({...form, guardianRelation: e.target.value})}
        />
      </div>
      
      <div className="form-row">
        <label>Malnutrition Signs:</label>
        <div className="custom-dropdown">
          <div 
            className="dropdown-selected"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {form.malnutritionSigns}
            <span className="dropdown-arrow">▼</span>
          </div>
          {isDropdownOpen && (
            <div className="dropdown-options">
              {malnutritionOptions.map(option => {
                const currentSigns = form.malnutritionSigns === 'N/A' ? [] : form.malnutritionSigns.split(', ');
                const isSelected = currentSigns.includes(option);
                return (
                  <div 
                    key={option}
                    className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleMalnutritionChange(option)}
                  >
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      readOnly
                    />
                    {option}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <div className="form-row">
        <label>Recent Illnesses:</label>
        <textarea 
          value={form.recentIllnesses} 
          onChange={(e) => setForm({...form, recentIllnesses: e.target.value})}
          rows={3}
        />
      </div>
      
      <div className="form-row">
        <label>Update Photo:</label>
        <input 
          type="file" 
          accept="image/*" 
          capture="user"
          onChange={handlePhotoCapture}
        />
        {form.facePhoto && (
          <img 
            src={form.facePhoto} 
            alt="Current" 
            style={{width: '100px', height: '100px', objectFit: 'cover', marginTop: '10px'}}
          />
        )}
      </div>
      
      <div className="form-actions">
        <button type="button" onClick={handleSave} className="save-btn">Save Changes</button>
        <button type="button" onClick={onCancel} className="cancel-btn">Cancel</button>
      </div>
    </div>
  );
}

export default ViewData;