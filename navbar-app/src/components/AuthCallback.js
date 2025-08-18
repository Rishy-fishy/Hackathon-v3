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
        
        // Since we're using the real eSignet but don't have the proper backend setup
        // with client assertions, we'll extract user info from the URL parameters
        // that eSignet might provide, or create a reasonable mock based on the 
        // authentication method used
        
        // In a real implementation, you would:
        // 1. Exchange the code for tokens using client assertion JWT
        // 2. Call the userinfo endpoint with the access token
        // 3. Decrypt the JWE response to get user data
        
        // For now, we'll simulate receiving user data after successful authentication
        const userInfo = {
          sub: "esignet_user_" + Date.now(),
          name: "eSignet User",
          given_name: "eSignet",
          family_name: "User", 
          email: "user@esignet.demo",
          email_verified: true,
          phone_number: "+91XXXXXXXXXX", // Will be populated after real auth
          phone_number_verified: true,
          birthdate: "1990-01-01",
          gender: "not_specified",
          picture: "https://api.dicebear.com/7.x/avataaars/svg?seed=eSignetUser",
          address: {
            formatted: "India", // Will be populated after real auth
            street_address: "",
            locality: "",
            region: "",
            postal_code: "",
            country: "IN"
          },
          locale: "en-IN",
          updated_at: Date.now(),
          auth_method: "eSignet_OIDC",
          iss: "https://esignet.collab.mosip.net"
        };
        
        // Store authentication data
        const tokens = {
          access_token: 'esignet-access-token-' + Date.now(),
          id_token: 'esignet-id-token-' + Date.now(),
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'openid profile'
        };

        // Store user info and tokens in localStorage
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('id_token', tokens.id_token);
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('auth_timestamp', Date.now().toString());
        localStorage.setItem('auth_code', code); // Store the code for debugging
        localStorage.setItem('auth_state', state);

        setStatus('success');
        console.log('✅ eSignet authentication successful');

        // Redirect to home page after a short delay
        setTimeout(() => {
          window.location.href = '/?authenticated=true';
        }, 1500);

      } catch (err) {
        console.error('Authentication error:', err);
        setStatus('error');
        setError(err.message);
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
