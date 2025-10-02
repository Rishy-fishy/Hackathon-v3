import React, { useEffect, useState } from 'react';
import './AuthCallback.css';

const AuthCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);


  // Process user info into standardized format
  const processUserInfo = (userInfo, accessToken) => {
    console.log('🔍 Processing userInfo:', userInfo);
    console.log('🔍 Available keys:', Object.keys(userInfo));
    
    // Handle different possible field names from eSignet
    const fullName = userInfo.name || 
                    userInfo.full_name ||
                    (userInfo.given_name && userInfo.family_name ? 
                      `${userInfo.given_name} ${userInfo.family_name}` : 
                      userInfo.given_name || 
                      userInfo.family_name || 
                      userInfo.preferred_username ||
                      'Authenticated User');
    
    const email = userInfo.email || 
                  userInfo.email_address || 
                  userInfo.preferred_username || 
                  'user@example.com';
    
    return {
      sub: userInfo.sub || userInfo.user_id || userInfo.uin || 'unknown_user',
      name: fullName,
      email: email,
      given_name: userInfo.given_name || userInfo.first_name,
      family_name: userInfo.family_name || userInfo.last_name || userInfo.surname,
      picture: userInfo.picture || userInfo.avatar_url,
      phone_number: userInfo.phone_number || userInfo.phone,
      birthdate: userInfo.birthdate || userInfo.date_of_birth,
      gender: userInfo.gender,
      address: userInfo.address,
      email_verified: userInfo.email_verified,
      phone_number_verified: userInfo.phone_number_verified,
      uin: userInfo.uin,
      authenticated: true,
      auth_method: 'esignet',
      login_timestamp: Date.now(),
      access_token: accessToken
    };
  };

  useEffect(() => {
    const handleCallback = async () => {
      console.log('🔄 Processing OAuth callback...');
      
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      // Check for OAuth errors
      if (error) {
        console.error('❌ OAuth error:', error, errorDescription);
        setStatus('error');
        setError(`Authentication failed: ${error} - ${errorDescription}`);
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      // Check for authorization code
      if (!code) {
        setStatus('error');
        setError('No authorization code received');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
        return;
      }

      try {
        console.log('✅ Authorization code received:', code);
        console.log('✅ State received:', state);

        // Validate state parameter
        const storedState = sessionStorage.getItem('esignet_state');
        if (storedState && state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Use backend /exchange-token (robust JWT client assertion) instead of delegate service.
  console.log('🔄 Exchanging code via backend callback server...');
  const CALLBACK_BASE = (window.__CALLBACK_BASE) || (process.env.REACT_APP_CALLBACK_BASE) || 'http://localhost:5000';
  const exchangeResp = await fetch(`${CALLBACK_BASE}/exchange-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state })
        });
        if (!exchangeResp.ok) {
          const txt = await exchangeResp.text();
          throw new Error('Token exchange failed: ' + txt);
        }
        const result = await exchangeResp.json();
        console.log('✅ Exchange result:', result);

        if (!result.userInfo) throw new Error('No user info in exchange result');

        const userData = processUserInfo(result.userInfo, result.access_token);
        setUserInfo(userData);
        setStatus('success');

        sessionStorage.setItem('esignet_user', JSON.stringify(userData));
        sessionStorage.setItem('esignet_authenticated', 'true');
        sessionStorage.setItem('auth_timestamp', Date.now().toString());
        if (result.access_token) sessionStorage.setItem('access_token', result.access_token);

        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');

        console.log('✅ eSignet authentication successful');
        setTimeout(() => { window.location.href = '/?authenticated=true'; }, 1500);

      } catch (err) {
        console.error('❌ Callback processing failed:', err);
        setStatus('error');
        setError(err.message);
        
        // Clean up any stored session data
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        
  // Redirect back to main app after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    // Process the callback
    handleCallback();
  }, []);

  return (
    <div className="auth-callback">
      <div className="callback-container">
        {status === 'processing' && (
          <div className="processing">
            <div className="spinner"></div>
            <h2>🔐 Processing Authentication...</h2>
            <p>Please wait while we verify your credentials...</p>
          </div>
        )}

        {status === 'success' && userInfo && (
          <div className="success">
            <div className="success-icon">✅</div>
            <h2>Welcome, {userInfo.name}!</h2>
            <div className="user-details">
              <p><strong>Email:</strong> {userInfo.email}</p>
              <p><strong>User ID:</strong> {userInfo.sub}</p>
              <p><strong>Authentication Method:</strong> eSignet</p>
            </div>
            <div className="redirect-message">
              <div className="spinner"></div>
              <p>Redirecting to application...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="error">
            <div className="error-icon">❌</div>
            <h2>Authentication Failed</h2>
            <p className="error-message">{error}</p>
            <div className="redirect-message">
              <div className="spinner"></div>
              <p>Redirecting back to home...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
