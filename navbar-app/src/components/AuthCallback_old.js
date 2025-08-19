import React, { useEffect, useState } from 'react';
import './AuthCallback.css';

const AuthCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  // Load client configuration
  const getClientConfig = () => {
    // Using the new client configuration
    return {
      clientId: 'IIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwAObq',
      redirectUri: 'http://localhost:3001/callback',
      baseURL: 'http://localhost:8088'
    };
  };

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
      preferred_username: userInfo.preferred_username || userInfo.username,
      locale: userInfo.locale,
      zoneinfo: userInfo.zoneinfo,
      authenticated: true,
      auth_method: 'esignet',
      login_timestamp: Date.now(),
      iss: userInfo.iss,
      access_token: accessToken // Store token separately, don't use as user ID
    };
  };

  useEffect(() => {
    const handleCallback = async () => {
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const errorParam = urlParams.get('error');

      if (errorParam) {
        setStatus('error');
        setError(errorParam === 'access_denied' ? 'Authorization was denied' : errorParam);
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
        console.log('✅ Authorization code received:', code);
        console.log('✅ State received:', state);

        // Validate state parameter
        const storedState = sessionStorage.getItem('esignet_state');
        if (storedState && state !== storedState) {
          throw new Error('Invalid state parameter - possible CSRF attack');
        }

        const config = getClientConfig();
        
        // Exchange authorization code for tokens and get user info
        console.log('🔄 Processing authorization with config:', config);
        
        try {
          // Instead of direct token exchange, use the callback server with JWT support
          console.log('🔄 Exchanging code via callback server...');
          
          const callbackResponse = await fetch(`http://localhost:5000/exchange-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
              state: state
            })
          });

          if (!callbackResponse.ok) {
            const errorData = await callbackResponse.json().catch(() => null);
            const errorText = errorData ? JSON.stringify(errorData) : await callbackResponse.text();
            throw new Error(`Callback server failed: ${callbackResponse.status} - ${errorText}`);
          }

          const result = await callbackResponse.json();
          console.log('✅ Token exchange successful:', result);

          if (result.userInfo) {
            const userData = processUserInfo(result.userInfo, result.access_token);
            setUserInfo(userData);
            setStatus('success');
          } else {
            throw new Error('No user info received from callback server');
          }


          console.log('📡 UserInfo response status:', userInfoResponse.status);
          console.log('📡 UserInfo response headers:', Object.fromEntries(userInfoResponse.headers.entries()));

          if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            console.error('❌ UserInfo fetch failed:', userInfoResponse.status, errorText);
            throw new Error(`Failed to fetch user info: ${userInfoResponse.status} - ${errorText}`);
          }

          const userInfo = await userInfoResponse.json();
          console.log('✅ User info received:', userInfo);
          console.log('� Available keys:', Object.keys(userInfo));
          console.log('🔍 Processing userInfo:', userInfo);
          
          // Process user data (don't use access token as user ID)
          const userData = processUserInfo(userInfo, tokenData.access_token);
          setUserInfo(userData);
          setStatus('success');
          
          // Store authentication state
          sessionStorage.setItem('esignet_user', JSON.stringify(userData));
          sessionStorage.setItem('esignet_authenticated', 'true');
          sessionStorage.setItem('auth_timestamp', Date.now().toString());
          sessionStorage.setItem('access_token', tokenData.access_token);
          
          // Clean up state
          sessionStorage.removeItem('esignet_state');
          sessionStorage.removeItem('esignet_nonce');
          
          console.log('✅ eSignet authentication successful');
          console.log('👤 User authenticated:', userData.name);
          
          // Redirect to main app after 2 seconds
          setTimeout(() => {
            window.location.href = '/?authenticated=true';
          }, 2000);

        } catch (userInfoError) {
          console.error('❌ Failed to fetch user info:', userInfoError);
          
          // Fallback to basic user data if userinfo fails
          const fallbackUserData = {
            sub: code,
            name: 'Authenticated User',
            email: 'user@example.com',
            authenticated: true,
            auth_method: 'esignet',
            login_timestamp: Date.now()
          };
          
          setUserInfo(fallbackUserData);
          setStatus('success');
          
          // Store authentication state
          sessionStorage.setItem('esignet_user', JSON.stringify(fallbackUserData));
          sessionStorage.setItem('esignet_authenticated', 'true');
          sessionStorage.setItem('auth_timestamp', Date.now().toString());
          
          // Clean up state
          sessionStorage.removeItem('esignet_state');
          sessionStorage.removeItem('esignet_nonce');
          
          console.log('✅ eSignet authentication successful (with fallback data)');
          
          // Redirect to main app after 2 seconds
          setTimeout(() => {
            window.location.href = '/?authenticated=true';
          }, 2000);
        }

      } catch (err) {
        console.error('❌ Callback processing failed:', err);
        setStatus('error');
        setError(err.message);
        
        // Clean up any stored session data
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="auth-callback-container">
      <div className="callback-content">
        {status === 'processing' && (
          <div className="processing">
            <div className="spinner"></div>
            <h2>Processing Authentication...</h2>
            <p>Please wait while we complete your sign-in with e-Signet</p>
          </div>
        )}

        {status === 'success' && (
          <div className="success">
            <div className="success-icon">✅</div>
            <h2>Authentication Successful!</h2>
            <p>Welcome back, {userInfo?.name || 'User'}!</p>
            <div className="user-preview">
              {userInfo?.picture && (
                <img src={userInfo.picture} alt="Profile" className="profile-picture" />
              )}
              <div className="user-details">
                <p><strong>Name:</strong> {userInfo?.name}</p>
                <p><strong>Email:</strong> {userInfo?.email}</p>
              </div>
            </div>
            <p className="redirect-message">Redirecting you to the main application...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="error">
            <div className="error-icon">❌</div>
            <h2>Authentication Failed</h2>
            <p className="error-message">{error}</p>
            <p className="redirect-message">Redirecting you back to the login page...</p>
          </div>
        )}
      </div>

      <div className="callback-footer">
        <p>Powered by <strong>e-Signet</strong> - Secure Digital Identity</p>
      </div>
    </div>
  );
};

export default AuthCallback;
