import React, { useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';
import ChildForm from './offline/ChildForm';
import RecordList from './offline/RecordList';
import useConnectivity from './offline/useConnectivity';
import { startAutoSync } from './offline/sync';

function App() {
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
          <ChildForm />
          <RecordList />
        </div>
      </main>
    </div>
  );
}

export default App;
