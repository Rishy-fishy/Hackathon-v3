import React from 'react';
import './App.css';
import Header from './components/Header';
import AuthCallback from './components/AuthCallback';

function App() {
  // Check if we're on the callback route
  const isCallbackRoute = window.location.pathname === '/callback';

  if (isCallbackRoute) {
    return <AuthCallback />;
  }

  return (
    <div className="App">
      <Header />
      <main className="main-content">
        <div className="content-container">
          <h1>Welcome to MyApp</h1>
          <p>This is a React web app with mock e-Signet authentication.</p>
          <div className="feature-section">
            <h2>Features</h2>
            <ul>
              <li>Mock e-Signet OIDC Authentication</li>
              <li>User profile display with all claims</li>
              <li>Secure token-based authentication</li>
              <li>Responsive and modern design</li>
            </ul>
          </div>
          <div className="info-section">
            <h2>How to Use</h2>
            <ol>
              <li>Click the Profile icon in the top right corner</li>
              <li>Click "Sign in with e-Signet" button</li>
              <li>Authorize the application on the mock consent page</li>
              <li>View your profile information after authentication</li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
