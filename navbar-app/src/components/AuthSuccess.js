import React, { useEffect, useState } from 'react';
import './AuthCallback.css';

const AuthSuccess = () => {
  const [authData, setAuthData] = useState(null);

  useEffect(() => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setAuthData({ error: error });
    } else if (code) {
      setAuthData({ code: code, state: state });
    }

    // Listen for messages from callback window
    const handleMessage = (event) => {
      if (event.origin === 'http://localhost:5000') {
        setAuthData(event.data);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReturnToApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-content">
        <h1>🎉 Authentication Successful!</h1>
        
        {authData?.error ? (
          <div className="error-section">
            <h2>❌ Authentication Error</h2>
            <p className="error-message">Error: {authData.error}</p>
            <button onClick={handleReturnToApp} className="return-button error">
              Return to App
            </button>
          </div>
        ) : authData?.code ? (
          <div className="success-section">
            <h2>✅ Authorization Code Received</h2>
            <div className="auth-details">
              <div className="detail-item">
                <span className="label">Authorization Code:</span>
                <span className="value code">{authData.code.substring(0, 20)}...</span>
              </div>
              {authData.state && (
                <div className="detail-item">
                  <span className="label">State:</span>
                  <span className="value">{authData.state}</span>
                </div>
              )}
            </div>
            <p className="success-message">
              You have successfully authenticated with eSignet! The authorization code has been received 
              and can now be exchanged for an access token.
            </p>
            <button onClick={handleReturnToApp} className="return-button success">
              Continue to App
            </button>
          </div>
        ) : (
          <div className="loading-section">
            <h2>🔄 Processing Authentication...</h2>
            <p>Please wait while we process your authentication response.</p>
          </div>
        )}

        <div className="info-section">
          <h3>What happened?</h3>
          <ol>
            <li>✅ You authenticated with eSignet</li>
            <li>✅ eSignet redirected you back to our callback URL</li>
            <li>✅ Authorization code was successfully received</li>
            <li>🔄 Ready to exchange code for access token</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default AuthSuccess;
