import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { unregister } from './serviceWorkerRegistration';

// Proactively remove any legacy static heading/back link before React mounts (cache bust helper)
(() => {
  try {
    const killTexts = [/^\s*admin dashboard\s*$/i, /^\s*←?\s*back\s*$/i];
    document.querySelectorAll('h1,h2,h3,a,button').forEach(el => {
      const t = (el.textContent||'').trim();
      if (killTexts.some(rx => rx.test(t))) el.remove();
    });
  } catch(_) { /* ignore */ }
})();

// Unregister any previously installed service worker so fresh bundle always loads
unregister();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
