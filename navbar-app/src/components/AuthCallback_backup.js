import React, { useEffect, useState } from 'react';
import './AuthCallback.css';

const AuthCallback = () => {
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const [userInfo, setUserInfo] = useState(null);

  // Load client configuration
  const getClientConfig = () => {
    // For now, we'll use the configuration directly
    // In a real app, this would be loaded from environment variables or a secure endpoint
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
        // In a real implementation, you would exchange the code for tokens here
        console.log('🔄 Processing authorization with config:', config);
        
        // Simulate token exchange process
        setStatus('success');
        
        // Mock user data (in real implementation, this would come from userinfo endpoint)
        const mockUserData = {
          sub: 'user123',
          name: 'John Doe',
          email: 'john.doe@example.com',
          picture: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John'
        };
        
        setUserInfo(mockUserData);
        
        // Store user info in session
        sessionStorage.setItem('esignet_user', JSON.stringify(mockUserData));
        sessionStorage.setItem('esignet_authenticated', 'true');
        
        // Redirect to main app after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);

      } catch (err) {
        console.error('❌ Callback processing failed:', err);
        setStatus('error');
        setError(err.message);
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      }
    };

    handleCallback();
  }, []);
          redirect_uri: 'http://localhost:3001/callback'
        });
        if (clientAssertion) {
          form.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
          form.set('client_assertion', clientAssertion);
        }
        const tokenResponse = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: form
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error('Failed to exchange authorization code: ' + errText);
        }

        const tokens = await tokenResponse.json();

        // Fetch user info from original mock eSignet
        const userInfoResponse = await fetch('http://localhost:8088/v1/esignet/oidc/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`
          }
        });

        if (!userInfoResponse.ok) {
          const errText = await userInfoResponse.text();
          throw new Error('Failed to fetch user info: ' + errText);
        }

        const userInfo = await userInfoResponse.json();

        // Clean up stored state
        sessionStorage.removeItem('esignet_state');
        sessionStorage.removeItem('esignet_nonce');

        // Store user info and tokens in localStorage
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        localStorage.setItem('access_token', tokens.access_token);
        localStorage.setItem('id_token', tokens.id_token || '');
        localStorage.setItem('is_authenticated', 'true');
        localStorage.setItem('auth_timestamp', Date.now().toString());
        localStorage.setItem('auth_method', 'esignet');

        setStatus('success');
        console.log('✅ eSignet authentication successful');
        console.log('👤 User authenticated:', userInfo.name);

        // Redirect to home page after a short delay
        setTimeout(() => {
          window.location.href = '/?authenticated=true';
        }, 800);

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
