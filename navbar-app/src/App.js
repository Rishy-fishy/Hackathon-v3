import React from 'react';
import './App.css';
import Header from './components/Header';
import AuthCallback from './components/AuthCallback';
import AuthSuccess from './components/AuthSuccess';

function App() {
  // Check if we're on the callback route
  const isCallbackRoute = window.location.pathname === '/callback';
  const isAuthSuccessRoute = window.location.pathname === '/auth-success';

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
          <h1>Welcome to MyApp</h1>
          <p>This is a React web app with eSignet authentication integration.</p>
          
          <div className="status-section">
            <h2>🔧 eSignet Setup Status</h2>
            <div className="status-item">
              <span className="status-label">React App:</span>
              <span className="status-value running">✅ Running on {window.location.origin}</span>
            </div>
            <div className="status-item">
              <span className="status-label">eSignet Service:</span>
              <span className="status-value running">✅ Mock Server on localhost:8088</span>
            </div>
            <div className="status-item">
              <span className="status-label">Authentication:</span>
              <span className="status-value running">✅ Real eSignet OIDC Flow</span>
            </div>
          </div>
          
          <div className="feature-section">
            <h2>Features</h2>
            <ul>
              <li>✅ Real eSignet OIDC Authentication (OAuth 2.0)</li>
              <li>✅ CSRF token protection</li>
              <li>✅ OAuth-details flow implementation</li>
              <li>✅ User profile display with claims</li>
              <li>✅ Secure token-based authentication</li>
              <li>✅ Responsive and modern design</li>
              <li>✅ Error boundary protection</li>
              <li>✅ Production-ready configuration</li>
            </ul>
          </div>
          <div className="info-section">
            <h2>How to Use</h2>
            <ol>
              <li>✅ <strong>eSignet Service:</strong> Mock eSignet running on localhost:8088</li>
              <li>🖱️ <strong>Click Profile:</strong> Click the Profile icon in the top right corner</li>
              <li>🔐 <strong>Sign In:</strong> Click "Sign in with e-Signet" button</li>
              <li>🔄 <strong>OAuth Flow:</strong> Complete the eSignet authentication flow</li>
              <li>👤 <strong>View Profile:</strong> Your authenticated profile will be displayed</li>
            </ol>
          </div>
          
          <div className="troubleshooting-section">
            <h2>Troubleshooting</h2>
            <div className="troubleshoot-item">
              <strong>eSignet service not responding?</strong>
              <p>Ensure mock eSignet is running on <code>localhost:8088</code></p>
            </div>
            <div className="troubleshoot-item">
              <strong>Authentication errors?</strong>
              <p>Check browser console for CSRF token and OAuth flow details</p>
            </div>
            <div className="troubleshoot-item">
              <strong>Want to use production eSignet?</strong>
              <p>Update baseUrl in ESignetAuth.js to <code>https://esignet.collab.mosip.net</code></p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
