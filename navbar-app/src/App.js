import React, { useState } from 'react';
import './App.css';
import  './glass.css';
import Header from './components/Header';
import Homepage from './components/Homepage';
import ViewData from './components/ViewData';
import Records from './components/Records';
import Settings from './components/settings';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';
import useConnectivity from './offline/useConnectivity';
import AdminPage from './components/AdminPage';
import ChildForm from './offline/ChildForm';

function App() {
  const [activeView, setActiveView] = useState('home'); // 'home' | 'add' | 'view' | 'records' | 'settings'
  // Connectivity hook retained for potential future UI; currently unused.
  // eslint-disable-next-line no-unused-vars
  const online = useConnectivity();
  // Check if we're on the callback route
  const pathname = window.location.pathname;
  const isCallbackRoute = pathname === '/callback';
  const isAuthSuccessRoute = pathname === '/auth-success';
  const isAdminRoute = pathname === '/admin';

  // Background sync disabled - data only syncs when Upload button is clicked manually
  // useEffect(()=>{ startAutoSync(); },[]);

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
      {activeView === 'records' && (
        <main className="main-content" aria-label="My Records">
          <Records />
        </main>
      )}
      {activeView === 'add' && (
        <main className="main-content" aria-label="Add Child">
          <ChildForm onSaved={() => setActiveView('home')} onClose={() => setActiveView('home')} />
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
