import React, { useState, useEffect } from 'react';
import './ViewData.css'; // Reuse ViewData styles
import Modal from './Modal';
import { listChildRecords } from '../offline/db';

const Records = () => {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

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
    setLoading(true);
    try {
      const fetchedRecords = await listChildRecords();
      
      // Filter records by user if authenticated
      let userRecords = fetchedRecords;
      if (isAuthenticated && userInfo) {
        // Filter records that belong to this user
        const userIdentifiers = [
          userInfo.name,
          userInfo.email,
          userInfo.individualId,
          userInfo.individual_id,
          userInfo.phone_number
        ].filter(Boolean);
        
        userRecords = fetchedRecords.filter(record => 
          userIdentifiers.some(id => 
            record.representative === id ||
            record.uploaderName === id ||
            record.uploaderEmail === id ||
            record.uploadedBy === id
          )
        );
      }
      
      setRecords(userRecords);
      setFilteredRecords(userRecords);
    } catch (error) {
      console.warn('Failed to load records:', error);
    } finally {
      setLoading(false);
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

  // Status helper functions
  const getStatusText = (record) => {
    if (record.uploadedAt && record.status === 'uploaded') {
      return 'Uploaded';
    } else if (record.status === 'pending' || !record.uploadedAt) {
      return 'Pending Upload';
    } else if (record.status === 'failed') {
      return 'Upload Failed';
    } else {
      return 'Local';
    }
  };

  const getStatusClass = (record) => {
    if (record.uploadedAt && record.status === 'uploaded') {
      return 'status-uploaded';
    } else if (record.status === 'pending' || !record.uploadedAt) {
      return 'status-pending';
    } else if (record.status === 'failed') {
      return 'status-failed';
    } else {
      return 'status-recorded';
    }
  };

  if (loading) {
    return (
      <div className="view-data-container">
        <div className="records">
          <div className="records-header-row">
            <h2>My Records</h2>
          </div>
          <div className="empty">Loading your records...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="view-data-container">
        <div className="records">
          <div className="records-header-row">
            <h2>My Records</h2>
          </div>
          <div className="empty">
            <p>Please log in to view your personal records.</p>
            <p>Click the "Profile" button to authenticate with eSignet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="view-data-container">
      <div className="records">
        <div className="records-header-row">
          <h2>My Records ({filteredRecords.length})</h2>
          {userInfo && (
            <div className="user-info">
              <span>Logged in as: {userInfo.name || 'User'}</span>
            </div>
          )}
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
          </div>
        </div>
        
        {filteredRecords.length === 0 && searchTerm && (
          <div className="empty">No records match your search criteria.</div>
        )}
        
        {filteredRecords.length === 0 && !searchTerm && (
          <div className="empty">You haven't created any records yet. Use "Add Child" to create your first record.</div>
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
      }} extraClass="with-detail-head">
        {selectedRecord && (
          <>
            <div className="detail-head">
              <h3><span className="rid">{selectedRecord.healthId}</span></h3>
            </div>
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
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Records;