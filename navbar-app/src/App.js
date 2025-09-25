import React, { useEffect, useState } from 'react';
import './App.css';
import  './glass.css';
import Header from './components/Header';
import Homepage from './components/Homepage';
import ViewData from './components/ViewData';
import Settings from './components/settings';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';
import useConnectivity from './offline/useConnectivity';
import { startAutoSync } from './offline/sync';
import AdminPage from './components/AdminPage';
import { themeManager } from './utils/themeManager';

function App() {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'add' | 'view' | 'settings'
  // Connectivity hook retained for potential future UI; currently unused.
  // eslint-disable-next-line no-unused-vars
  const online = useConnectivity();
  // Check if we're on the callback route
  const pathname = window.location.pathname;
  const isCallbackRoute = pathname === '/callback';
  const isAuthSuccessRoute = pathname === '/auth-success';
  const isAdminRoute = pathname === '/admin';

  // Start background sync once
  useEffect(()=>{ startAutoSync(); },[]);

  if (isCallbackRoute) {
    return <AuthCallback />;
  }

  if (isAuthSuccessRoute) {
    return <AuthSuccess />;
  }

  if (isAdminRoute) {
    return (
      <div className="admin-standalone-page">
        
        <main className="admin-standalone-main" aria-label="Admin">
          <AdminPage />
        </main>
        <footer className="app-footer">
          <p>Thank you for your efforts, they make a change</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="App">
      <Header onActiveViewChange={setActiveView} />
      {activeView === 'home' && (
        <main className="main-content" aria-label="Main content">
          <Homepage />
        </main>
      )}
      {activeView === 'view' && (
        <main className="main-content" aria-label="View Data">
          <ViewData />
        </main>
      )}
      {activeView === 'settings' && (
        <main className="main-content minimalist-main" aria-label="Settings">
          <Settings />
        </main>
      )}
      <footer className="app-footer">
        <p>Thank you for your efforts, they make a change</p>
      </footer>
    </div>
  );
}

export default App;
