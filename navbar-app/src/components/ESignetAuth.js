import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Plugin readiness no longer separately tracked; removing unused state.
  const buttonContainerRef = useRef(null);
  const initializationRef = useRef(false);

  // OIDC Configuration using the newly created client
  // IMPORTANT: redirect_uri must match what is registered for the client AND
  // what the backend callback server listens on for performing the code -> token exchange.
  // We standardize on the CLOUD callback http://34.58.198.143:5000/callback (node callback-server.js) then it
  // forwards the browser back to the React app at /?authenticated=true after storing tokens.
  // Build OIDC config dynamically using backend metadata for client_id
  // Updated client ID from successful registration
  const clientId = '08d8YsjGpeo6kOfoVZYJsMpHGZy1vVOai1Njz8AzZk8';
  const authorizeUri = 'http://34.58.198.143:3000/authorize';
  const oidcConfig = useMemo(() => ({
    authorizeUri,
    claims_locales: 'en',
    client_id: clientId || '',
    display: 'page',
    max_age: 600,
    prompt: 'consent',
    // MUST match the registered redirect in the Authorization Server
    redirect_uri: 'http://34.58.198.143:5000/callback',
    scope: 'openid profile',
    ui_locales: 'en'
  }), [authorizeUri, clientId]);

  const buttonConfig = useMemo(() => ({
    labelText: 'Sign in with e-Signet',
    shape: 'soft_edges',
    theme: 'filled_orange',
    type: 'standard'
  }), []);

  // Wait for the eSignet plugin to load
  const waitForESignetPlugin = () => {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 40; // 20 seconds total
      
      const checkPlugin = () => {
        attempts++;
        
        if (window.SignInWithEsignetButton && window.SignInWithEsignetButton.init) {
          console.log('✅ SignInWithEsignetButton found!');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ SignInWithEsignetButton not found after 20 seconds');
          reject(new Error('eSignet plugin failed to load'));
        } else {
          console.log(`⏳ Waiting for SignInWithEsignetButton... attempt ${attempts}/${maxAttempts}`);
          setTimeout(checkPlugin, 500);
        }
      };
      
      checkPlugin();
    });
  };

  // Initialize the eSignet button
  const initializeESignetButton = useCallback(async () => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      // Wait for the plugin to be available
      await waitForESignetPlugin();
      
      if (!buttonContainerRef.current) {
        throw new Error('Button container not found');
      }

  console.log('🚀 Initializing eSignet button with config:', { oidcConfig, buttonConfig });

      // Create a container for the plugin
      const container = buttonContainerRef.current;

      // Initialize the eSignet button using the plugin
      await window.SignInWithEsignetButton.init({
        oidcConfig: oidcConfig,
        buttonConfig: buttonConfig,
        signInElement: container
      });

      // Let the plugin handle the flow completely - don't override the click handler
      const anchor = container.querySelector('a[href]');
      if (anchor) {
        console.log('✅ eSignet plugin button ready, will use plugin default flow');
        console.log('Plugin generated URL:', anchor.getAttribute('href'));
      }

      setIsLoading(false);
      console.log('✅ eSignet button initialized successfully');

      // Adjust malformed authorize URL if plugin renders '/authorize&...'
      try {
        const anchor2 = container.querySelector('a[href]');
        if (anchor2) {
          const href = anchor2.getAttribute('href') || '';
          if (href.includes('/authorize&')) {
            const fixed = href.replace('/authorize&', '/authorize?');
            anchor2.setAttribute('href', fixed);
          }
        }
      } catch (adjErr) {
        console.warn('URL adjustment skipped:', adjErr);
      }

    } catch (err) {
      console.error('❌ Failed to initialize eSignet button:', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, [oidcConfig, buttonConfig]);



  // Initialize on component mount - use hardcoded clientId
  useEffect(() => {
    // Immediately initialize with hardcoded clientId
    const t = setTimeout(() => initializeESignetButton(), 50);
    return () => clearTimeout(t);
  }, [initializeESignetButton]);

  // Retry initialization if it failed
  const handleRetry = () => {
    initializationRef.current = false;
    setError(null);
    initializeESignetButton();
  };

  return (
    <div className="esignet-auth-container">
      <div className="auth-header">
        <h2>Sign in to MyApp</h2>
        <p>Use your e-Signet digital identity to securely sign in</p>
      </div>

      <div className="auth-content">
        <div className="esignet-button-wrapper">
          {/* Render the plugin container with hardcoded clientId */}
          <div className="esignet-button-container" ref={buttonContainerRef}></div>
        </div>

        {isLoading && (
          <div className="loading-placeholder">
            <div className="loading-spinner"></div>
            <p>Loading e-Signet authentication...</p>
          </div>
        )}

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

        {/* Fallback removed per request; using official eSignet plugin only */}

        {/* OR separator + Admin Sign-in */}
        <div className="auth-alt-separator" role="separator" aria-label="or sign in as admin">
          <span className="line" aria-hidden="true"></span>
          <span className="or-text"> ---------- OR ----------</span>
          <span className="line" aria-hidden="true"></span>
        </div>
        <div className="admin-login-alt">
          <button
            type="button"
            className="admin-sign-btn"
            onClick={()=>{ window.location.href='/admin'; }}
            aria-label="Sign in as Admin"
          >
            Sign As Admin
          </button>
        </div>
        {/* Info box removed */}
      </div>
    </div>
  );
};

export default ESignetAuth;