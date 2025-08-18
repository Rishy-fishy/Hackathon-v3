import React, { useState, useEffect } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // OIDC Configuration - Using real eSignet based on Postman collection
  const oidcConfig = {
    // Use mock eSignet for development (localhost:8088) or real eSignet
    baseUrl: 'http://localhost:8088', // Change to 'https://esignet.collab.mosip.net' for production
    client_id: '3yz7-j3xRzU3SODdoNgSGvO_cD8UijH3AIWRDAg1x-M', // From mock environment
    relying_party_id: 'mpartner-default-esignet',
    acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
    claims_locales: 'en',
    display: 'page',
    max_age: 21,
    prompt: 'consent',
    redirect_uri: `${window.location.protocol}//${window.location.host}/callback`,
    scope: 'openid profile',
    ui_locales: 'en',
    claims: {
      "userinfo": {
        "given_name": {"essential": true},
        "phone_number": {"essential": false},
        "email": {"essential": true},
        "picture": {"essential": false},
        "gender": {"essential": false},
        "birthdate": {"essential": false},
        "address": {"essential": false}
      },
      "id_token": {}
    }
  };

  // Initialize the eSignet authentication
  const initializeESignetAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use React state-based approach instead of DOM manipulation
      console.log('🚀 Initializing eSignet authentication...');
      
      // Simulate initialization check
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setIsReady(true);
      setIsLoading(false);

    } catch (err) {
      console.error('❌ Failed to initialize eSignet:', err);
      setError(err.message);
      setIsLoading(false);
      setIsReady(true); // Still show button for fallback
    }
  };

  // Handle authentication with eSignet OAuth-details flow
  const handleAuthentication = async () => {
    try {
      console.log('� Starting eSignet authentication flow...');
      
      // Step 1: Get CSRF token
      const csrfResponse = await fetch(`${oidcConfig.baseUrl}/v1/esignet/csrf/token`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error(`Failed to get CSRF token: ${csrfResponse.status}`);
      }

      // Extract CSRF token from cookie
      const csrfCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

      if (!csrfCookie) {
        throw new Error('CSRF token not found in cookies');
      }

      console.log('✅ CSRF token obtained');

      // Step 2: Generate secure random values
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);

      // Store for validation
      sessionStorage.setItem('esignet_state', state);
      sessionStorage.setItem('esignet_nonce', nonce);

      // Step 3: Prepare OAuth details request
      const oauthDetailsPayload = {
        requestTime: new Date().toISOString(),
        request: {
          clientId: oidcConfig.client_id,
          scope: oidcConfig.scope,
          responseType: 'code',
          redirectUri: oidcConfig.redirect_uri,
          display: oidcConfig.display,
          prompt: oidcConfig.prompt,
          maxAge: oidcConfig.max_age,
          uiLocales: oidcConfig.ui_locales,
          claimsLocales: oidcConfig.claims_locales,
          acrValues: oidcConfig.acr_values,
          claims: JSON.stringify(oidcConfig.claims),
          state: state,
          nonce: nonce
        }
      };

      console.log('📝 OAuth details payload:', oauthDetailsPayload);

      // Step 4: Call OAuth details endpoint
      const oauthDetailsResponse = await fetch(`${oidcConfig.baseUrl}/v1/esignet/authorization/v3/oauth-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': csrfCookie
        },
        credentials: 'include',
        body: JSON.stringify(oauthDetailsPayload)
      });

      if (!oauthDetailsResponse.ok) {
        const errorText = await oauthDetailsResponse.text();
        throw new Error(`OAuth details request failed: ${oauthDetailsResponse.status} - ${errorText}`);
      }

      const oauthDetailsResult = await oauthDetailsResponse.json();
      console.log('✅ OAuth details response:', oauthDetailsResult);

      if (!oauthDetailsResult.response || !oauthDetailsResult.response.transactionId) {
        throw new Error('Invalid OAuth details response: missing transactionId');
      }

      // Step 5: Store transaction details and redirect to authentication page
      const transactionId = oauthDetailsResult.response.transactionId;
      sessionStorage.setItem('esignet_transaction_id', transactionId);

      // Create authorization URL for browser redirect
      const authUrl = `${oidcConfig.baseUrl}/authorize?` + new URLSearchParams({
        client_id: oidcConfig.client_id,
        response_type: 'code',
        scope: oidcConfig.scope,
        redirect_uri: oidcConfig.redirect_uri,
        state: state,
        nonce: nonce,
        acr_values: oidcConfig.acr_values,
        claims: JSON.stringify(oidcConfig.claims),
        display: oidcConfig.display,
        prompt: oidcConfig.prompt,
        max_age: oidcConfig.max_age.toString(),
        ui_locales: oidcConfig.ui_locales,
        claims_locales: oidcConfig.claims_locales
      }).toString();

      console.log('🚀 Redirecting to eSignet authorization:', authUrl);
      window.location.href = authUrl;

    } catch (error) {
      console.error('❌ eSignet authentication failed:', error);
      setError(`Authentication failed: ${error.message}. Please ensure eSignet service is running on ${oidcConfig.baseUrl}`);
    }
  };

  // Generate random string for state/nonce
  const generateRandomString = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Initialize on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeESignetAuth();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Retry initialization if it failed
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setIsReady(false);
    initializeESignetAuth();
  };

  // React-based eSignet button component
  const ESignetButton = () => (
    <button 
      className="esignet-fallback-btn"
      onClick={handleAuthentication}
      disabled={isLoading}
    >
      <div className="esignet-btn-content">
        <div className="esignet-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
        <span>Sign in with e-Signet</span>
      </div>
    </button>
  );

  return (
    <div className="esignet-auth-container">
      <div className="auth-header">
        <h2>Sign in to MyApp</h2>
        <p>Use your e-Signet digital identity to securely sign in</p>
      </div>

      <div className="auth-content">
        <div className="esignet-button-wrapper">
          <div className="esignet-button-container">
            {isLoading && (
              <div className="loading-placeholder">
                <div className="loading-spinner"></div>
                <p>Loading e-Signet authentication...</p>
              </div>
            )}
            
            {!isLoading && isReady && (
              <ESignetButton />
            )}
          </div>
        </div>

        {error && (
          <div className="error-container">
            <div className="error-message">
              <p><strong>Authentication Error:</strong> {error}</p>
              <button onClick={handleRetry} className="retry-button">
                Try Again
              </button>
            </div>
          </div>
        )}

        <div className="auth-info">
          <p className="info-text">
            <strong>About e-Signet:</strong> e-Signet is a secure digital identity platform 
            that allows you to authenticate using various methods including biometrics, 
            generated codes, and static codes. Your privacy and security are our top priorities.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ESignetAuth;