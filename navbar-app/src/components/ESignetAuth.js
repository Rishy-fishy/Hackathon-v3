import React, { useState, useEffect, useRef } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPluginReady, setIsPluginReady] = useState(false);
  const buttonContainerRef = useRef(null);

  // OIDC Configuration matching your requirements
  const oidcConfig = {
    acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
    authorizeUri: 'https://esignet.dev.mosip.net/authorize',
    claims_locales: 'en',
    client_id: '88Vjt34c5Twz1oJ',
    display: 'page',
    max_age: 21,
    nonce: 'ere973eieljznge2311',
    prompt: 'consent',
    redirect_uri: 'http://localhost:3001/callback', // Updated for local development
    scope: 'openid profile',
    state: 'eree2311',
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
      const maxAttempts = 60; // 30 seconds total
      
      const checkPlugin = () => {
        attempts++;
        
        if (window.SignInWithEsignetButton && window.SignInWithEsignetButton.init) {
          console.log('✅ SignInWithEsignetButton plugin loaded successfully');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ SignInWithEsignetButton plugin failed to load after 30 seconds');
          reject(new Error('eSignet plugin failed to load'));
        } else {
          console.log(`⏳ Waiting for eSignet plugin... attempt ${attempts}/${maxAttempts}`);
          setTimeout(checkPlugin, 500);
        }
      };
      
      checkPlugin();
    });
  };

  // Initialize the eSignet button
  const initializeESignetButton = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Wait for the plugin to be available
      await waitForESignetPlugin();
      
      if (!buttonContainerRef.current) {
        throw new Error('Button container not found');
      }

      // Clear any existing content
      buttonContainerRef.current.innerHTML = '';

      console.log('🚀 Initializing eSignet button with config:', {
        oidcConfig,
        buttonConfig
      });

      // Initialize the eSignet button using the plugin
      await window.SignInWithEsignetButton.init({
        oidcConfig: oidcConfig,
        buttonConfig: buttonConfig,
        signInElement: buttonContainerRef.current
      });

      setIsPluginReady(true);
      setIsLoading(false);
      console.log('✅ eSignet button initialized successfully');

    } catch (err) {
      console.error('❌ Failed to initialize eSignet button:', err);
      setError(err.message);
      setIsLoading(false);
      
      // Show fallback button
      showFallbackButton();
    }
  };

  // Show fallback button if plugin fails
  const showFallbackButton = () => {
    if (!buttonContainerRef.current) return;

    const fallbackButton = document.createElement('button');
    fallbackButton.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Sign in with e-Signet
      </div>
    `;
    
    fallbackButton.style.cssText = `
      background: linear-gradient(135deg, #FF6B35, #f7931e);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
      font-family: system-ui, -apple-system, sans-serif;
    `;

    fallbackButton.addEventListener('mouseenter', () => {
      fallbackButton.style.transform = 'translateY(-2px)';
      fallbackButton.style.boxShadow = '0 6px 16px rgba(255, 107, 53, 0.4)';
    });

    fallbackButton.addEventListener('mouseleave', () => {
      fallbackButton.style.transform = 'translateY(0)';
      fallbackButton.style.boxShadow = '0 4px 12px rgba(255, 107, 53, 0.3)';
    });

    fallbackButton.addEventListener('click', () => {
      // Generate secure random values
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);

      // Store for validation
      sessionStorage.setItem('esignet_state', state);
      sessionStorage.setItem('esignet_nonce', nonce);

      // Build authorization URL
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: oidcConfig.client_id,
        redirect_uri: oidcConfig.redirect_uri,
        scope: oidcConfig.scope,
        state: state,
        nonce: nonce,
        acr_values: oidcConfig.acr_values,
        claims_locales: oidcConfig.claims_locales,
        ui_locales: oidcConfig.ui_locales,
        display: oidcConfig.display,
        prompt: oidcConfig.prompt,
        max_age: oidcConfig.max_age.toString()
      });

      const authUrl = `${oidcConfig.authorizeUri}?${authParams.toString()}`;
      console.log('🚀 Redirecting to eSignet:', authUrl);
      
      window.location.href = authUrl;
    });

    buttonContainerRef.current.appendChild(fallbackButton);
  };

  // Generate random string for state/nonce
  const generateRandomString = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Initialize on component mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeESignetButton();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Retry initialization if it failed
  const handleRetry = () => {
    initializeESignetButton();
  };

  return (
    <div className="esignet-auth-container">
      <div className="auth-header">
        <h2>Sign in to MyApp</h2>
        <p>Use your e-Signet digital identity to securely sign in</p>
      </div>

      <div className="auth-content">
        <div className="esignet-button-container" ref={buttonContainerRef}>
          {isLoading && (
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>Loading e-Signet authentication...</p>
            </div>
          )}
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