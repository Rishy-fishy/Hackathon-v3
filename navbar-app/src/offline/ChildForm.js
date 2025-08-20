import React, { useState } from 'react';
import { nanoid } from 'nanoid';
import { addChildRecord } from './db';

const initial = { name:'', age:'', weight:'', height:'', guardian:'', malnutrition:'', illnesses:'', consent:false, photo:null, idRef:'' };

export default function ChildForm({ onSaved }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [healthId, setHealthId] = useState(null);

  const handleChange = e => {
    const { name, value, type, checked, files } = e.target;
    if (type === 'checkbox') setForm(f => ({...f, [name]: checked}));
    else if (type === 'file') {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setForm(f => ({...f, photo: reader.result }));
      reader.readAsDataURL(file);
    } else setForm(f => ({...f, [name]: value}));
  };

  const generateHealthId = () => 'H-' + nanoid(10).toUpperCase();

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.consent) return alert('Parental consent required');
    setSaving(true);
    const hId = generateHealthId();
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
      version: 1
    };
    await addChildRecord(record);
    setHealthId(hId);
    setSaving(false);
    setForm(initial);
    onSaved && onSaved(record);
  };

  return (
    <div className="child-form-wrapper">
      <h2>New Child Data</h2>
      <form onSubmit={handleSubmit} className="child-form">
        <div className="grid">
          <label>Name<input name="name" value={form.name} onChange={handleChange} /></label>
          <label>Age (months)<input name="age" value={form.age} onChange={handleChange} /></label>
          <label>Weight (kg)<input name="weight" value={form.weight} onChange={handleChange} /></label>
          <label>Height (cm)<input name="height" value={form.height} onChange={handleChange} /></label>
          <label>Guardian Name<input name="guardian" value={form.guardian} onChange={handleChange} /></label>
          <label>ID Ref<input name="idRef" value={form.idRef} onChange={handleChange} /></label>
          <label>Malnutrition Signs<textarea name="malnutrition" value={form.malnutrition} onChange={handleChange} placeholder="N/A" /></label>
          <label>Recent Illnesses<textarea name="illnesses" value={form.illnesses} onChange={handleChange} placeholder="N/A" /></label>
          <label>Photo<input type="file" accept="image/*" name="photo" onChange={handleChange} /></label>
          <label className="consent"><input type="checkbox" name="consent" checked={form.consent} onChange={handleChange} /> Parental Consent</label>
        </div>
        <button disabled={saving || !form.consent} type="submit">{saving? 'Saving...' : 'Save Offline'}</button>
      </form>
      {healthId && <div className="health-id-banner">Health ID: <strong>{healthId}</strong></div>}
    </div>
  );
}
