import React, { useState, useEffect, useRef } from 'react';
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
  // We standardize on http://localhost:5000/callback (node callback-server.js) then it
  // forwards the browser back to the React app at /?authenticated=true after storing tokens.
  const oidcConfig = {
    acr_values: 'mosip:idp:acr:generated-code',
    authorizeUri: 'http://localhost:3000/authorize',
    claims_locales: 'en',
    client_id: 'jgU6lnO_8ifzFSHtgbFjmxjJf3HYmHLgfvXrBtOtc80',
    display: 'page',
    max_age: 600,
    prompt: 'consent',
    redirect_uri: 'http://localhost:5000/callback',
    scope: 'openid profile',
    ui_locales: 'en'
  };

  const buttonConfig = {
    labelText: 'Sign in with e-Signet',
    shape: 'soft_edges',
    theme: 'filled_orange',
    type: 'standard'
  };

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
  const initializeESignetButton = async () => {
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

      // Wrap the anchor click to inject state + nonce BEFORE redirect if plugin does not manage them.
      const anchor = container.querySelector('a[href]');
      if (anchor) {
        anchor.addEventListener('click', (e) => {
          try {
            // Generate state & nonce and persist *before* navigating away.
            const state = generateRandomString(16);
            const nonce = generateRandomString(16);
            sessionStorage.setItem('esignet_state', state);
            sessionStorage.setItem('esignet_nonce', nonce);

            const original = anchor.getAttribute('href');
            if (original) {
              const url = new URL(original);
              // Only add if absent (avoid double appending on retries)
              if (!url.searchParams.get('state')) url.searchParams.set('state', state);
              if (!url.searchParams.get('nonce')) url.searchParams.set('nonce', nonce);
              // If dynamic client_id differs from existing param (e.g., placeholder), replace it
              // Ensure correct client_id present
              if (url.searchParams.get('client_id') !== oidcConfig.client_id) {
                url.searchParams.set('client_id', oidcConfig.client_id);
              }
              anchor.setAttribute('href', url.toString());
            }
          } catch (wrapErr) {
            console.warn('Failed to augment authorize URL with state/nonce:', wrapErr);
          }
        }, { once: true });
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
  };

  // Generate random string for state/nonce
  const generateRandomString = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Initialize on component mount
  useEffect(() => {
    const t = setTimeout(() => initializeESignetButton(), 50);
    return () => clearTimeout(t);
  }, []);

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