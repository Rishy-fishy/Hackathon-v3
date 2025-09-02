import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { addChildRecord } from './db';

const initial = { name:'', age:'', idRef:'', weight:'', height:'', guardian:'', malnutrition:'N/A', illnesses:'N/A', consent:false, photo:null };

export default function ChildForm({ onSaved, onClose }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [healthId, setHealthId] = useState(null);
  const [step, setStep] = useState(1); // 1 identity, 2 health, 3 consent

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
  } else setForm(f => ({...f, [name]: value}));
  };

  const generateHealthId = () => 'H-' + nanoid(10).toUpperCase();

  const nextStep = () => {
    if (step === 1 && !form.name) return; // require name first step
    if (step < 3) setStep(s=>s+1);
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
      ageMonths: form.age ? parseInt(form.age,10) : null,
      weightKg: form.weight? parseFloat(form.weight): null,
      heightCm: form.height? parseFloat(form.height): null,
      guardianName: form.guardian || 'N/A',
      malnutritionSigns: form.malnutrition || 'N/A',
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
  <div className="child-form-wrapper wizard-container" id="add-child">
      <div className="responsive-progress-bar" aria-label="Form progress">
        <div className="progress-container">
          <div className="step-wrapper completed">
            <div className="step-number">1</div>
          </div>
          <div className="progress-line completed"></div>
          <div className="step-wrapper active">
            <div className="step-number">2</div>
          </div>
          <div className="progress-line inactive"></div>
          <div className="step-wrapper inactive">
            <div className="step-number">3</div>
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
            <label htmlFor="cf-name" className="field-span-2">Child's Name
              <input id="cf-name" name="name" value={form.name} onChange={handleChange} placeholder="Full name" required />
            </label>
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
            <label htmlFor="cf-age">Age (months)
              <input id="cf-age" name="age" value={form.age} onChange={handleChange} inputMode="numeric" placeholder="e.g. 18" />
            </label>
            <label htmlFor="cf-idRef">ID (Local Tracking)
              <input id="cf-idRef" name="idRef" value={form.idRef} onChange={handleChange} placeholder="Generated / Enter" />
            </label>
          </div>
        )}
        {step === 2 && (
          <div className="grid step-grid step-2">
            <label htmlFor="cf-weight">Weight (kg)
              <input id="cf-weight" name="weight" value={form.weight} onChange={handleChange} inputMode="decimal" placeholder="e.g. 11.2" />
            </label>
            <label htmlFor="cf-height">Height (cm)
              <input id="cf-height" name="height" value={form.height} onChange={handleChange} inputMode="decimal" placeholder="e.g. 82" />
            </label>
            <label htmlFor="cf-guardian" className="field-span-2">Parent/Guardian Name
              <input id="cf-guardian" name="guardian" value={form.guardian} onChange={handleChange} placeholder="Parent / Guardian" />
            </label>
            <div className="field-span-2 optional-block">
              <div className="field-head">
                <label htmlFor="cf-malnutrition">Visible Signs of Malnutrition</label>
                <button type="button" className="pill-toggle" aria-pressed={form.malnutrition==='N/A'} onClick={()=>setForm(f=>({...f, malnutrition: f.malnutrition==='N/A'?'': 'N/A'}))}>N/A</button>
              </div>
              <textarea id="cf-malnutrition" name="malnutrition" value={form.malnutrition} onChange={handleChange} placeholder="Describe or N/A" disabled={form.malnutrition==='N/A'} aria-disabled={form.malnutrition==='N/A'} />
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
              <div><strong>Age (months):</strong> {form.age||'—'}</div>
              <div><strong>ID:</strong> {form.idRef||'—'}</div>
              <div><strong>Weight:</strong> {form.weight||'—'}</div>
              <div><strong>Height:</strong> {form.height||'—'}</div>
              <div className="full"><strong>Guardian:</strong> {form.guardian||'—'}</div>
              <div className="full"><strong>Malnutrition Signs:</strong> {form.malnutrition||'N/A'}</div>
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
          {step<3 && <button type="button" className="nav-btn next" onClick={nextStep} disabled={step===1 && !form.name}>Next</button>}
          {step===3 && <button disabled={saving || !form.consent} type="submit" className="submit-btn">{saving? 'Saving...' : 'Save Offline'}</button>}
        </div>
      </form>
      {healthId && <div className="health-id-banner">Health ID: <strong>{healthId}</strong></div>}
    </div>
  );
}
