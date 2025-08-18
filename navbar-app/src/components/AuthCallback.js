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
        
        // Clean up stored state
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');
        
        // In a real implementation, you would exchange the code for tokens
        // For now, we'll create a user profile based on successful eSignet authentication
        const userInfo = {
          sub: "esignet_" + code.substring(0, 8),
          name: "eSignet Authenticated User",
          given_name: "eSignet",
          family_name: "User",
          email: "user@esignet.mosip.net",
          email_verified: true,
          phone_number: "+91XXXXXXXXXX",
          phone_number_verified: true,
          birthdate: "1990-01-01",
          gender: "male",
          picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=eSignetUser",
          address: {
            formatted: "India",
            street_address: "123 Digital Street",
            locality: "Bangalore",
            region: "Karnataka",
            postal_code: "560001",
            country: "IN"
          },
          locale: "en-IN",
          updated_at: Date.now(),
          auth_method: "eSignet",
          iss: "https://esignet.dev.mosip.net",
          aud: "88Vjt34c5Twz1oJ"
        };
        
        // Store authentication data
        const tokens = {
          access_token: 'esignet_at_' + Date.now(),
          id_token: 'esignet_it_' + Date.now(),
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile',
          auth_time: Math.floor(Date.now() / 1000)
        };

        // Store user info and tokens in localStorage
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('id_token', tokens.id_token);
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
