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
      clientId: 'IIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1l35c',
      redirectUri: 'http://localhost:3001/callback',
      baseURL: 'http://localhost:8088'
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
        
        // For now, we'll handle the successful authorization
        // In a real implementation, you would exchange the code for tokens using JWT client assertion
        console.log('🔄 Processing authorization with config:', config);
        
        // Simulate successful authentication
        setStatus('success');
        
        // Use Siddharth's user data (in real implementation, this would come from userinfo endpoint after token exchange)
        const siddharthUserData = {
          sub: 'siddharth-km-123',
          name: 'Siddharth K Mansour',
          email: 'siddhartha.km@gmail.com',
          picture: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Salman_Khan_in_2023_%281%29_%28cropped%29.jpg/250px-Salman_Khan_in_2023_%281%29_%28cropped%29.jpg',
          phone_number: '+919427357934',
          birthdate: '1987-11-25',
          gender: 'Male',
          given_name: 'Siddharth K Mansour',
          family_name: 'Mansour',
          preferred_username: 'Siddharth K Mansour',
          locale: 'en',
          zoneinfo: 'test zone',
          address: {
            street_address: 'Slung',
            locality: 'yuanwee',
            region: 'yuanwee',
            postal_code: '45009',
            country: 'Cmattey'
          }
        };
        
        setUserInfo(siddharthUserData);
        
        // Store authentication state
        sessionStorage.setItem('esignet_user', JSON.stringify(siddharthUserData));
        sessionStorage.setItem('esignet_authenticated', 'true');
        sessionStorage.setItem('auth_timestamp', Date.now().toString());
        
        // Clean up state
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        
        console.log('✅ eSignet authentication successful');
        console.log('👤 User authenticated:', siddharthUserData.name);
        
        // Redirect to main app after 2 seconds
        setTimeout(() => {
          window.location.href = '/?authenticated=true';
        }, 2000);

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
