import React, { useEffect } from 'react';
import './App.css';
import  './glass.css';
import Header from './components/Header';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';
import ChildForm from './offline/ChildForm';
import RecordList from './offline/RecordList';
import useConnectivity from './offline/useConnectivity';
import { startAutoSync } from './offline/sync';
import SyncStatus from './offline/SyncStatus';
import ToastHost from './components/ToastHost';

function App() {
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
      <Header />
      <main className="main-content">
        <div className="content-container">
          <ToastHost />
          <SyncStatus />
          <ChildForm />
          <RecordList />
        </div>
      </main>
    </div>
  );
}

export default App;
