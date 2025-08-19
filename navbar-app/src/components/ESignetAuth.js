import React, { useState, useEffect, useRef } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const buttonContainerRef = useRef(null);
  const initializationRef = useRef(false);

  // OIDC Configuration using the newly created client
  const oidcConfig = {
    acr_values: 'mosip:idp:acr:generated-code',
    authorizeUri: 'http://localhost:3000/authorize', // Fixed: Using UI port 3000
    claims_locales: 'en',
    client_id: 'IIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwAObq', // Using the new generated client ID
    display: 'page',
    max_age: 21,
    prompt: 'consent',
    redirect_uri: 'http://localhost:3001/callback',
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

      console.log('🚀 Initializing eSignet button with config:', {
        oidcConfig,
        buttonConfig
      });

      // Create a container for the plugin
      const container = buttonContainerRef.current;

      // Initialize the eSignet button using the plugin
      await window.SignInWithEsignetButton.init({
        oidcConfig: oidcConfig,
        buttonConfig: buttonConfig,
        signInElement: container
      });

      setIsPluginReady(true);
      setIsLoading(false);
      console.log('✅ eSignet button initialized successfully');

      // Adjust malformed authorize URL if plugin renders '/authorize&...'
      try {
        const anchor = container.querySelector('a[href]');
        if (anchor) {
          const href = anchor.getAttribute('href') || '';
          if (href.includes('/authorize&')) {
            const fixed = href.replace('/authorize&', '/authorize?');
            anchor.setAttribute('href', fixed);
          }
          anchor.addEventListener('click', (e) => {
            const h = anchor.getAttribute('href') || '';
            if (h.includes('/authorize&')) {
              e.preventDefault();
              const fixed = h.replace('/authorize&', '/authorize?');
              window.location.href = fixed;
            }
          });
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
    const timer = setTimeout(() => {
      initializeESignetButton();
    }, 100);

    return () => {
      clearTimeout(timer);
      initializationRef.current = false;
    };
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