import React, { useEffect, useState } from 'react';
import './App.css';
import  './glass.css';
import Header from './components/Header';
import Settings from './components/settings';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';
import useConnectivity from './offline/useConnectivity';
import { startAutoSync } from './offline/sync';
import AdminPage from './components/AdminPage';

function App() {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'add' | 'view' | 'settings' | 'admin'
  // Connectivity hook retained for potential future UI; currently unused.
  // eslint-disable-next-line no-unused-vars
  const online = useConnectivity();
  // Check if we're on the callback route
  const isCallbackRoute = window.location.pathname === '/callback';
  const isAuthSuccessRoute = window.location.pathname === '/auth-success';

  // Start background sync once
  useEffect(()=>{ startAutoSync(); },[]);

  if (isCallbackRoute) {
    return <AuthCallback />;
  }

  if (isAuthSuccessRoute) {
    return <AuthSuccess />;
  }

  return (
    <div className="App">
      <Header onActiveViewChange={setActiveView} />
      {activeView === 'home' && (
        <main className="main-content minimalist-main" aria-label="Main content">
          <div className="placeholder-message">Select an option from the navigation bar to begin.</div>
        </main>
      )}
      {activeView === 'settings' && (
        <main className="main-content minimalist-main" aria-label="Settings">
          <Settings />
        </main>
      )}
      {activeView === 'admin' && (
        <main className="main-content minimalist-main" aria-label="Admin">
          <AdminPage />
        </main>
      )}
    </div>
  );
}

export default App;
