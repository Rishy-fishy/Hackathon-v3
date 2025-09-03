import React, { useState, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { addChildRecord } from './db';

const initial = { name:'', dob:'', gender:'Male', idRef:'', weight:'', height:'', guardian:'', phone:'', relation:'', malnutrition:'N/A', illnesses:'N/A', consent:false, photo:null };

export default function ChildForm({ onSaved, onClose }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [healthId, setHealthId] = useState(null);
  const [step, setStep] = useState(1); // 1 identity, 2 health, 3 consent
  const [errors, setErrors] = useState({});
  const [progressUpdate, setProgressUpdate] = useState(0); // Force re-render for progress
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Malnutrition options
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

  // Trigger progress update when form or errors change
  useEffect(() => {
    setProgressUpdate(prev => prev + 1);
  }, [form, errors]);

  // Handle clicking outside dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);


  const handleChange = e => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') setForm(f => ({...f, [name]: checked}));
    else if (type === 'file') {
      const file = files[0];
      if (!file) return;
      // Resize/compress image to max 512px dimension
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const maxDim = 512;
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round(height * (maxDim/width));
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round(width * (maxDim/height));
            height = maxDim;
          }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img,0,0,width,height);
            const dataUrl = canvas.toDataURL('image/jpeg',0.7);
            setForm(f => ({...f, photo: dataUrl }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
  } else {
      let processedValue = value;
      
      // Input validation based on field type
      if (name === 'name' || name === 'guardian' || name === 'relation') {
        // Only allow alphabets and spaces
        processedValue = value.replace(/[^a-zA-Z\s]/g, '');
      } else if (name === 'weight' || name === 'height') {
        // Only allow numbers and decimal point
        processedValue = value.replace(/[^0-9.]/g, '');
        // Prevent multiple decimal points
        const parts = processedValue.split('.');
        if (parts.length > 2) {
          processedValue = parts[0] + '.' + parts.slice(1).join('');
        }
      } else if (name === 'phone') {
        // Phone: allow only digits, limit to 10 digits
        processedValue = value.replace(/\D/g, '').slice(0, 10);
      } else if (name === 'dob') {
         // For date picker, we don't need manual text processing
         processedValue = value;
      } else if (name === 'idRef') {
        // Aadhaar formatting: allow only digits, format as XXXX-XXXX-XXXX
        const digits = value.replace(/\D/g, '').slice(0, 12);
        const groups = digits.match(/.{1,4}/g) || [];
        processedValue = groups.join('-');
      } else if (e.target && e.target.multiple) {
        // Handle multi-selects (e.g., malnutrition signs)
        processedValue = Array.from(e.target.selectedOptions).map(o => o.value);
       }
      
      setForm(f => ({...f, [name]: processedValue}));
    }
    
  // Clear error when user starts typing
  if (errors[name]) {
    setErrors(prev => ({ ...prev, [name]: '' }));
  }
};

const generateHealthId = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  
  // Generate random text (5 characters)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let randomText = '';
  for (let i = 0; i < 5; i++) {
    randomText += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return `CH${year}${month}${date}${randomText}`;
};  // Malnutrition dropdown functions
  const toggleMalnutritionOption = (option) => {
    if (form.malnutrition === 'N/A') {
      setForm(f => ({...f, malnutrition: [option]}));
    } else {
      const currentSelections = Array.isArray(form.malnutrition) ? form.malnutrition : [];
      const isSelected = currentSelections.includes(option);
      
      if (isSelected) {
        const newSelections = currentSelections.filter(item => item !== option);
        setForm(f => ({...f, malnutrition: newSelections.length === 0 ? 'N/A' : newSelections}));
      } else {
        setForm(f => ({...f, malnutrition: [...currentSelections, option]}));
      }
    }
  };

  const getSelectedMalnutritionCount = () => {
    if (form.malnutrition === 'N/A' || !Array.isArray(form.malnutrition)) return 0;
    return form.malnutrition.length;
  };

  const getMalnutritionDisplayText = () => {
    if (form.malnutrition === 'N/A') return 'N/A';
    if (!Array.isArray(form.malnutrition) || form.malnutrition.length === 0) return 'Select signs of malnutrition';
    if (form.malnutrition.length === 1) return form.malnutrition[0];
    return `${form.malnutrition.length} signs selected`;
  };

  // Field completion tracking functions
  const getStepCompletion = (stepNumber) => {
    if (stepNumber === 1) {
      const fields = ['name', 'dob', 'gender'];
      const validFields = [];
      
      // Check name field
      if (form.name && form.name.trim() && !errors.name) {
        validFields.push('name');
      }
      
      // Check dob field
      if (form.dob && form.dob.trim() && !errors.dob) {
        validFields.push('dob');
      }
      
      // Check gender field
      if (form.gender && form.gender.trim() && !errors.gender) {
        validFields.push('gender');
      }
      
      return validFields.length / fields.length;
    }
    
    if (stepNumber === 2) {
      const fields = ['weight', 'height', 'guardian', 'phone', 'relation'];
      const validFields = [];
      
      // Check weight field
      if (form.weight && form.weight.trim() && !errors.weight && !isNaN(parseFloat(form.weight))) {
        validFields.push('weight');
      }
      
      // Check height field
      if (form.height && form.height.trim() && !errors.height && !isNaN(parseFloat(form.height))) {
        validFields.push('height');
      }
      
      // Check guardian field
      if (form.guardian && form.guardian.trim() && !errors.guardian) {
        validFields.push('guardian');
      }
      
      // Check phone field
      if (form.phone && form.phone.trim() && !errors.phone && form.phone.length === 10) {
        validFields.push('phone');
      }
      
      // Check relation field
      if (form.relation && form.relation.trim() && !errors.relation) {
        validFields.push('relation');
      }
      
      return validFields.length / fields.length;
    }
    
    if (stepNumber === 3) {
      return form.consent ? 1 : 0;
    }
    
    return 0;
  };

  const isStepCompleted = (stepNumber) => {
    if (stepNumber < step) return true;
    if (stepNumber === step) return getStepCompletion(stepNumber) === 1;
    return false;
  };

  // Date picker functions
  const formatDateForInput = (dateString) => {
    if (!dateString || dateString.length !== 10) return '';
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (dateString) => {
    if (!dateString || dateString.length !== 10) return '';
    return dateString; // Already in DD/MM/YYYY format
  };

  const handleDateChange = (e) => {
    const { value } = e.target;
    if (value) {
      const [year, month, day] = value.split('-');
      const formattedDate = `${day}/${month}/${year}`;
      setForm(f => ({...f, dob: formattedDate}));
      if (errors.dob) {
        setErrors(prev => ({ ...prev, dob: '' }));
      }
    } else {
      setForm(f => ({...f, dob: ''}));
    }
  };

  const calculateAge = (dob) => {
    if (!dob || dob.length !== 10) return null;
    const [day, month, year] = dob.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();
    
    // Adjust for negative months or days
    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    
    return { years, months, days };
  };

  const validateStep = (currentStep) => {
    const newErrors = {};
    
         if (currentStep === 1) {
       if (!form.name.trim()) newErrors.name = 'Fill the required field';
       if (!form.dob.trim()) newErrors.dob = 'Fill the required field';
       else if (form.dob.length !== 10) newErrors.dob = 'Enter date in DD/MM/YYYY format';
       else {
          // Validate date format and check if it's a valid date
          const [day, month, year] = form.dob.split('/').map(Number);
          
          // Check if it's a valid date by comparing with the actual date created
          const birthDate = new Date(year, month - 1, day);
          const today = new Date();
          today.setHours(23, 59, 59, 999); // End of today
          
          // Check if the date components match what was entered (prevents auto-correction)
          const actualDay = birthDate.getDate();
          const actualMonth = birthDate.getMonth() + 1;
          const actualYear = birthDate.getFullYear();
          
          if (day !== actualDay || month !== actualMonth || year !== actualYear) {
            newErrors.dob = 'Invalid date';
          }
          // Check if date is not in the future
          else if (birthDate > today) {
            newErrors.dob = 'Date cannot be in the future';
          } else {
            const age = calculateAge(form.dob);
            if (age === null) newErrors.dob = 'Invalid date';
            else if (age.years > 18) newErrors.dob = 'Age is more than 18';
          }
        }
       if (!form.gender.trim()) newErrors.gender = 'Fill the required field';
       // Optional Aadhaar: if provided, must match XXXX-XXXX-XXXX
       if (form.idRef && !/^\d{4}-\d{4}-\d{4}$/.test(form.idRef)) {
         newErrors.idRef = 'Enter 12 digits (XXXX-XXXX-XXXX)';
       }
     }
    
    if (currentStep === 2) {
      if (!form.weight.trim()) newErrors.weight = 'Fill the required field';
      else if (isNaN(parseFloat(form.weight))) newErrors.weight = 'Enter valid number';
      if (!form.height.trim()) newErrors.height = 'Fill the required field';
      else if (isNaN(parseFloat(form.height))) newErrors.height = 'Enter valid number';
      if (!form.guardian.trim()) newErrors.guardian = 'Fill the required field';
      if (!form.phone.trim()) newErrors.phone = 'Fill the required field';
      else if (form.phone.length !== 10) newErrors.phone = 'Enter exactly 10 digits';
      if (!form.relation.trim()) newErrors.relation = 'Fill the required field';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      if (step < 3) setStep(s=>s+1);
    }
  };
  const prevStep = () => { if (step>1) setStep(s=>s-1); };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.consent) return alert('Parental consent required');
    setSaving(true);
    const hId = generateHealthId();
    // Compute simple hash of photo (if exists)
    let photoHash = null;
    if (form.photo) {
      try {
        const bytes = new TextEncoder().encode(form.photo);
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        photoHash = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,40);
      } catch {/* ignore */}
    }
  const record = {
      healthId: hId,
      localId: nanoid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      name: form.name || 'N/A',
      gender: form.gender || 'N/A',
             ageMonths: form.dob ? (calculateAge(form.dob).years * 12 + calculateAge(form.dob).months) : null,
      weightKg: form.weight? parseFloat(form.weight): null,
      heightCm: form.height? parseFloat(form.height): null,
      guardianName: form.guardian || 'N/A',
      guardianPhone: form.phone || 'N/A',
      guardianRelation: form.relation || 'N/A',
      malnutritionSigns: Array.isArray(form.malnutrition) 
        ? (form.malnutrition.length ? form.malnutrition.join(', ') : 'N/A')
        : (form.malnutrition || 'N/A'),
      recentIllnesses: form.illnesses || 'N/A',
      parentalConsent: form.consent,
      facePhoto: form.photo,
      idReference: form.idRef || '',
      status: 'pending',
      version: 2,
      photoHash
    };
    await addChildRecord(record);
    setHealthId(hId);
    setSaving(false);
  setForm(initial);
    onSaved && onSaved(record);
  };

  return (
  <div className="child-form-wrapper" id="add-child">
      <div className="new-progress-bar" aria-label="Form progress">
        <div className="progress-steps">
          {/* Step 1 */}
          <div className="step-container">
            <div className={`step-circle ${isStepCompleted(1) ? 'completed' : step === 1 ? 'active' : 'inactive'}`}>
              {isStepCompleted(1) ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            {step >= 1 && (
              <div className="step-line-container">
                <div 
                  className="step-line-fill" 
                  style={{
                    width: step > 1 ? '100%' : `${getStepCompletion(1) * 100}%`
                  }}
                ></div>
                <div className="step-line-bg"></div>
              </div>
            )}
          </div>
          
          {/* Step 2 */}
          <div className="step-container">
            <div className={`step-circle ${isStepCompleted(2) ? 'completed' : step === 2 ? 'active' : 'inactive'}`}>
              {isStepCompleted(2) ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10 2V8H14V2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 8V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 18H13L8 22L3 18V10L8 6L13 10H21V18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            {step >= 1 && (
              <div className="step-line-container">
                <div 
                  className="step-line-fill" 
                  style={{
                    width: step > 2 ? '100%' : `${getStepCompletion(2) * 100}%`
                  }}
                ></div>
                <div className="step-line-bg"></div>
              </div>
            )}
          </div>
          
          {/* Step 3 */}
          <div className="step-container">
            <div className={`step-circle ${isStepCompleted(3) ? 'completed' : step === 3 ? 'active' : 'inactive'}`}>
              {isStepCompleted(3) ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>
      <h2>Child Health Data</h2>
      {onClose && (
        <button type="button" className="close-btn" aria-label="Close form" onClick={onClose}>×</button>
      )}
      <form onSubmit={handleSubmit} className="child-form wizard" noValidate>
        {step === 1 && (
          <div className="grid step-grid step-1">
            <div className="photo-box photo-grid-item" aria-label="Face Photo">
              {form.photo ? (
                <>
                  <img src={form.photo} alt="Child" />
                  <button type="button" className="remove-photo" onClick={()=>setForm(f=>({...f, photo:null}))} aria-label="Remove photo">×</button>
                </>
              ) : (
                <div className="add-photo-text" aria-hidden>
                  <span className="plus">+</span>
                  <span className="label">Add photo</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="user" name="photo" onChange={handleChange} title="Add or capture face photo" />
            </div>
            <div className="identity-fields">
              <label htmlFor="cf-name">Child's Name
                <input id="cf-name" name="name" value={form.name} onChange={handleChange} placeholder="Full name" required />
                {errors.name && <div className="error-message">{errors.name}</div>}
              </label>
              <div className="row two-cols">
                <label htmlFor="cf-dob">Date of Birth
                  <input 
                    id="cf-dob" 
                    name="dob" 
                    type="date" 
                    value={formatDateForInput(form.dob)} 
                    onChange={handleDateChange} 
                    max={new Date().toISOString().split('T')[0]}
                    required 
                  />
                  {errors.dob && <div className="error-message">{errors.dob}</div>}
                </label>
                <label htmlFor="cf-gender">Gender
                  <select id="cf-gender" name="gender" value={form.gender} onChange={handleChange} required>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.gender && <div className="error-message">{errors.gender}</div>}
                </label>
              </div>
              <label htmlFor="cf-idRef">Aadhaar ID (optional)
                <input 
                  id="cf-idRef" 
                  name="idRef" 
                  inputMode="numeric" 
                  pattern="\d{4}-\d{4}-\d{4}" 
                  placeholder="XXXX-XXXX-XXXX" 
                  value={form.idRef} 
                  onChange={handleChange}
                />
                {errors.idRef && <div className="error-message">{errors.idRef}</div>}
              </label>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid step-grid step-2">
            <label htmlFor="cf-weight">Weight (kg)
              <input id="cf-weight" name="weight" value={form.weight} onChange={handleChange} inputMode="decimal" placeholder="e.g. 11.2" />
              {errors.weight && <div className="error-message">{errors.weight}</div>}
            </label>
            <label htmlFor="cf-height">Height (cm)
              <input id="cf-height" name="height" value={form.height} onChange={handleChange} inputMode="decimal" placeholder="e.g. 82" />
              {errors.height && <div className="error-message">{errors.height}</div>}
            </label>
            <label htmlFor="cf-guardian" className="field-span-2">Parent/Guardian Name
              <input id="cf-guardian" name="guardian" value={form.guardian} onChange={handleChange} placeholder="Parent / Guardian" />
              {errors.guardian && <div className="error-message">{errors.guardian}</div>}
            </label>
            <div className="contact-row">
              <label htmlFor="cf-phone">Phone Number
                <input 
                  id="cf-phone" 
                  name="phone" 
                  value={form.phone} 
                  onChange={handleChange} 
                  inputMode="numeric" 
                  pattern="\d{10}" 
                  placeholder="10-digit phone number" 
                  maxLength="10"
                />
                {errors.phone && <div className="error-message">{errors.phone}</div>}
              </label>
              <label htmlFor="cf-relation">Relation with Child
                <input 
                  id="cf-relation" 
                  name="relation" 
                  value={form.relation} 
                  onChange={handleChange} 
                  placeholder="e.g. Father, Mother, Uncle" 
                />
                {errors.relation && <div className="error-message">{errors.relation}</div>}
              </label>
            </div>
            <div className="field-span-2 optional-block">
              <div className="field-head">
                <label htmlFor="cf-malnutrition">Visible Signs of Malnutrition</label>
                <button type="button" className="pill-toggle" aria-pressed={form.malnutrition==='N/A'} onClick={()=>setForm(f=>({...f, malnutrition: f.malnutrition==='N/A'?[]: 'N/A'}))}>N/A</button>
              </div>
              <div className="custom-dropdown" ref={dropdownRef}>
                <div 
                  className={`dropdown-trigger ${form.malnutrition === 'N/A' ? 'disabled' : ''}`}
                  onClick={() => form.malnutrition !== 'N/A' && setIsDropdownOpen(!isDropdownOpen)}
                  role="button"
                  tabIndex={form.malnutrition === 'N/A' ? -1 : 0}
                  aria-expanded={form.malnutrition === 'N/A' ? false : isDropdownOpen}
                  aria-haspopup="listbox"
                  aria-disabled={form.malnutrition === 'N/A'}
                >
                  <span className="dropdown-text">{getMalnutritionDisplayText()}</span>
                  <svg 
                    className={`dropdown-arrow ${isDropdownOpen && form.malnutrition !== 'N/A' ? 'rotated' : ''}`}
                    width="12" 
                    height="12" 
                    viewBox="0 0 12 12" 
                    fill="none"
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                {isDropdownOpen && form.malnutrition !== 'N/A' && (
                  <div className="dropdown-menu" role="listbox">
                      {malnutritionOptions.map((option, index) => {
                        const isSelected = Array.isArray(form.malnutrition) && form.malnutrition.includes(option);
                        return (
                          <div
                            key={index}
                            className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleMalnutritionOption(option)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="option-checkbox">
                              {isSelected && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className="option-text">{option}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
            </div>
            <div className="field-span-2 optional-block">
              <div className="field-head">
                <label htmlFor="cf-illnesses">Recent Illnesses</label>
                <button type="button" className="pill-toggle" aria-pressed={form.illnesses==='N/A'} onClick={()=>setForm(f=>({...f, illnesses: f.illnesses==='N/A'?'': 'N/A'}))}>N/A</button>
              </div>
              <textarea id="cf-illnesses" name="illnesses" value={form.illnesses} onChange={handleChange} placeholder="Describe or N/A" disabled={form.illnesses==='N/A'} aria-disabled={form.illnesses==='N/A'} />
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="review-step">
                         <div className="review-grid">
               <div><strong>Name:</strong> {form.name||'—'}</div>
                               <div><strong>Date of Birth:</strong> {form.dob||'—'} {form.dob && (() => {
                  const age = calculateAge(form.dob);
                  return `(${age.years} years, ${age.months} months, ${age.days} days)`;
                })()}</div>
               <div><strong>Gender:</strong> {form.gender||'—'}</div>
               <div><strong>Weight:</strong> {form.weight||'—'}</div>
              <div><strong>Height:</strong> {form.height||'—'}</div>
              <div className="full"><strong>Guardian:</strong> {form.guardian||'—'}</div>
              <div><strong>Phone:</strong> {form.phone||'—'}</div>
              <div><strong>Relation:</strong> {form.relation||'—'}</div>
              <div className="full"><strong>Malnutrition Signs:</strong> {
                Array.isArray(form.malnutrition) 
                  ? (form.malnutrition.length ? form.malnutrition.join(', ') : 'N/A')
                  : (form.malnutrition || 'N/A')
              }</div>
              <div className="full"><strong>Recent Illnesses:</strong> {form.illnesses||'N/A'}</div>
              <div className="full photo-preview-mini">{form.photo && <img src={form.photo} alt="Child" />}</div>
            </div>
            <label className="consent">
              <input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} />
              <span>Parental Consent (required to save)</span>
            </label>
          </div>
        )}
        <div className="wizard-footer">
          {step>1 && <button type="button" className="nav-btn back" onClick={prevStep}>Back</button>}
          {step<3 && <button type="button" className="nav-btn next" onClick={nextStep}>Next</button>}
          {step===3 && <button disabled={saving || !form.consent} type="submit" className="submit-btn">{saving? 'Saving...' : 'Save Offline'}</button>}
        </div>
      </form>
      {healthId && <div className="health-id-banner">Health ID: <strong>{healthId}</strong></div>}
    </div>
  );
}
