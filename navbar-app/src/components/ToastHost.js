import React, { useEffect, useState } from 'react';
import './ToastHost.css';

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(()=>{
    const handler = (e) => {
      const { type='info', message } = e.detail || {};
      if (!message) return;
      const id = Date.now()+Math.random();
      setToasts(t => [...t, { id, type, message }]);
      setTimeout(()=> setToasts(t => t.filter(x=> x.id!==id)), 4500);
    };
    window.addEventListener('toast', handler);
    return ()=> window.removeEventListener('toast', handler);
  },[]);

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast-item ${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}
