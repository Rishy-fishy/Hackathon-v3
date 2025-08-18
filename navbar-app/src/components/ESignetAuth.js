import React, { useState, useEffect } from 'react';
import './ESignetAuth.css';

// OIDC Configuration - these should come from your registered client
const OIDC_CONFIG = {
  baseUrl: process.env.REACT_APP_ESIGNET_BASE_URL || 'https://esignet.collab.mosip.net',
  clientId: process.env.REACT_APP_ESIGNET_CLIENT_ID || 'YOUR_REGISTERED_CLIENT_ID',
  redirectUri: process.env.REACT_APP_ESIGNET_REDIRECT_URI || 'http://localhost:3001/callback',
  scope: process.env.REACT_APP_ESIGNET_SCOPE || 'openid profile',
  acrValues: process.env.REACT_APP_ESIGNET_ACR_VALUES || 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code'
};

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate cryptographically secure random strings
  const generateRandomString = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleESignetLogin = () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if client_id is configured
      if (!OIDC_CONFIG.clientId || OIDC_CONFIG.clientId === 'YOUR_REGISTERED_CLIENT_ID') {
        setError('eSignet client not configured. Please register your OIDC client first.');
        setIsLoading(false);
        return;
      }

      // Generate secure random values
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);

      // Store state and nonce for validation later
      sessionStorage.setItem('esignet_state', state);
      sessionStorage.setItem('esignet_nonce', nonce);
      sessionStorage.setItem('esignet_auth_time', Date.now().toString());

      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: OIDC_CONFIG.clientId,
        redirect_uri: OIDC_CONFIG.redirectUri,
        scope: OIDC_CONFIG.scope,
        state: state,
        nonce: nonce,
        acr_values: OIDC_CONFIG.acrValues,
        claims_locales: 'en',
        ui_locales: 'en',
        display: 'page',
        prompt: 'consent',
        max_age: '21'
      });
      
      const authUrl = `${OIDC_CONFIG.baseUrl}/authorize?${authParams.toString()}`;
      console.log('🚀 Redirecting to eSignet:', authUrl);
      console.log('📋 State:', state);
      console.log('📋 Nonce:', nonce);
      
      window.location.href = authUrl;
    } catch (err) {
      console.error('❌ Authentication error:', err);
      setError('Failed to initiate authentication. Please try again.');
      setIsLoading(false);
    }
  };

  // Check if we have proper configuration
  useEffect(() => {
    if (!OIDC_CONFIG.clientId || OIDC_CONFIG.clientId === 'YOUR_REGISTERED_CLIENT_ID') {
      setError('eSignet not configured. Run the setup script first.');
    }
  }, []);

  if (error) {
    return (
      <div className="esignet-auth-container">
        <div style={{
          padding: '16px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          color: '#dc2626',
          marginBottom: '16px'
        }}>
          <p style={{ margin: 0, fontWeight: '500' }}>Configuration Error</p>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>{error}</p>
          <details style={{ marginTop: '8px', fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer' }}>Setup Instructions</summary>
            <div style={{ marginTop: '8px', paddingLeft: '16px' }}>
              <p>1. Navigate to the scripts directory:</p>
              <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>cd scripts</code>
              
              <p>2. Install dependencies:</p>
              <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>npm install</code>
              
              <p>3. Run the setup script:</p>
              <code style={{ backgroundColor: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>node esignet-client.js setup</code>
              
              <p>4. Copy the generated environment variables to your .env file</p>
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="esignet-auth-container">
      <button 
        onClick={handleESignetLogin}
        disabled={isLoading}
        className="esignet-button"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '12px 24px',
          fontSize: '16px',
          fontWeight: '500',
          border: 'none',
          borderRadius: '6px',
          background: isLoading ? '#9ca3af' : '#FF6B35',
          color: 'white',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          minHeight: '48px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          opacity: isLoading ? 0.7 : 1
        }}
        onMouseEnter={(e) => {
          if (!isLoading) {
            e.target.style.background = '#E55A2B';
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoading) {
            e.target.style.background = '#FF6B35';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }
        }}
      >
        {isLoading ? (
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
            <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"/>
          </svg>
        ) : (
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        )}
        {isLoading ? 'Redirecting...' : 'Sign in with eSignet'}
      </button>
      
      {/* Add CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ESignetAuth;
