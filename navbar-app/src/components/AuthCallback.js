import React, { useEffect, useState } from 'react';
import './AuthCallback.css';

const AuthCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      if (error) {
        setStatus('error');
        setError(error === 'access_denied' ? 'Authorization was denied' : error);
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      try {
        console.log('Authorization code received:', code);
        console.log('State received:', state);
        
        // Validate state parameter
        const storedState = sessionStorage.getItem('esignet_state');
        if (storedState && state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }
        
        // Clean up stored state and transaction data
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        sessionStorage.removeItem('esignet_transaction_id');
        
        // Exchange authorization code for tokens using eSignet plugin flow
        console.log('🔄 Processing eSignet callback...');
        
        // eSignet configuration (should match the one used in ESignetAuth)
        const esignetConfig = {
          baseUrl: 'http://localhost:8088', // Official eSignet Docker
          client_id: 'IBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq8W2KQ'
        };
        
        let userInfo;
        
        try {
          // Try to exchange the authorization code for tokens using official eSignet API
          console.log('🔄 Attempting token exchange with official eSignet...');
          
          const tokenResponse = await fetch(`${esignetConfig.baseUrl}/v1/esignet/oauth/v2/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + btoa(esignetConfig.client_id + ':')
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: code,
              redirect_uri: 'http://localhost:5000/callback'
            })
          });

          if (tokenResponse.ok) {
            const tokens = await tokenResponse.json();
            console.log('✅ Tokens received from official eSignet:', tokens);

            // Try to get user info
            if (tokens.access_token) {
              const userResponse = await fetch(`${esignetConfig.baseUrl}/v1/esignet/oidc/userinfo`, {
                headers: {
                  'Authorization': `Bearer ${tokens.access_token}`
                }
              });

              if (userResponse.ok) {
                userInfo = await userResponse.json();
                console.log('✅ User info from official eSignet:', userInfo);
                
                // Store actual tokens
                localStorage.setItem('access_token', tokens.access_token);
                if (tokens.id_token) {
                  localStorage.setItem('id_token', tokens.id_token);
                }
              } else {
                throw new Error('Failed to fetch user info from eSignet');
              }
            } else {
              throw new Error('No access token received from eSignet');
            }
          } else {
            throw new Error('Token exchange failed with eSignet');
          }
          
        } catch (esignetError) {
          console.error('❌ eSignet authentication failed:', esignetError.message);
          
          // No fallback - show proper error
          setStatus('error');
          setError('Login failed. Please try again.');
          
          // Clean up any stored session data
          sessionStorage.removeItem('esignet_state');
          sessionStorage.removeItem('esignet_nonce');
          sessionStorage.removeItem('esignet_transaction_id');
          localStorage.removeItem('user_info');
          localStorage.removeItem('access_token');
          localStorage.removeItem('id_token');
          localStorage.removeItem('is_authenticated');
          
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
          return;
        }
        
        // Store user info and session data
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('auth_timestamp', Date.now().toString());
        localStorage.setItem('auth_method', 'esignet');

        setStatus('success');
        console.log('✅ eSignet authentication successful');
        console.log('👤 User authenticated:', userInfo.name);

        // Redirect to home page after a short delay
        setTimeout(() => {
          window.location.href = '/?authenticated=true';
        }, 2000);

      } catch (err) {
        console.error('Authentication error:', err);
        setStatus('error');
        setError(err.message);
        
        // Clean up any stored session data
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        sessionStorage.removeItem('esignet_transaction_id');
        
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-content">
        {status === 'processing' && (
          <>
            <div className="spinner"></div>
            <h2>Processing Authentication</h2>
            <p>Please wait while we complete your sign-in...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="success-icon">✓</div>
            <h2>Authentication Successful!</h2>
            <p>Redirecting you back to the application...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="error-icon">✗</div>
            <h2>Authentication Failed</h2>
            <p>{error}</p>
            <p className="redirect-text">Redirecting you back to the application...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
