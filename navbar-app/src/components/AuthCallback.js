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
        // Exchange authorization code for tokens
        const tokenResponse = await fetch('http://localhost:3002/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: 'mock-client-id',
            redirect_uri: 'http://localhost:3001/callback'
          })
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to exchange authorization code');
        }

        const tokens = await tokenResponse.json();

        // Get user info using access token
        const userResponse = await fetch('http://localhost:3002/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        });

        if (!userResponse.ok) {
          throw new Error('Failed to fetch user info');
        }

        const userInfo = await userResponse.json();

        // Store user info and tokens in localStorage
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('id_token', tokens.id_token);
        localStorage.setItem('is_authenticated', 'true');

        setStatus('success');

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
