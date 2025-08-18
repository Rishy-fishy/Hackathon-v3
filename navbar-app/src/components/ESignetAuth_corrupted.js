import React, { useState, useEffect, useRef } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const buttonContainerRef = useRef(null);
  const initializationRef = useRef(false);

  // OIDC Configuration for eSignet plugin
  const oidcConfig = {
    // Use mock eSignet for development (localhost:8088) or real eSignet
    authorizeUri: 'http://localhost:8088/v1/esignet/oauth/v2/authorize',
    client_id: '3yz7-j3xRzU3SODdoNgSGvO_cD8UijH3AIWRDAg1x-M',
    redirect_uri: `${window.location.protocol}//${window.location.host}/callback`,
    scope: 'openid profile',
    acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
    claims_locales: 'en',
    ui_locales: 'en',
    display: 'page',
    prompt: 'consent',
    max_age: 21,
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

  // Button configuration for eSignet plugin
  const buttonConfig = {
    type: 'standard',
    theme: 'filled_orange',
    labelText: 'Sign in with e-Signet',
    shape: 'soft_edges',
    width: '400px'
  };

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pluginReady, setPluginReady] = useState(false);
  const buttonContainerRef = useRef(null);
  const initializationRef = useRef(false);

  // OIDC Configuration for eSignet plugin
  const oidcConfig = {
    // Use mock eSignet for development (localhost:8088) or real eSignet
    authorizeUri: 'http://localhost:8088/v1/esignet/oauth/v2/authorize',
    client_id: '3yz7-j3xRzU3SODdoNgSGvO_cD8UijH3AIWRDAg1x-M',
    redirect_uri: `${window.location.protocol}//${window.location.host}/callback`,
    scope: 'openid profile',
    acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
    claims_locales: 'en',
    ui_locales: 'en',
    display: 'page',
    prompt: 'consent',
    max_age: 21,
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

  // Button configuration for eSignet plugin
  const buttonConfig = {
    type: 'standard',
    theme: 'filled_orange',
    labelText: 'Sign in with e-Signet',
    shape: 'soft_edges',
    width: '400px'
  };

  // Generate random string for state/nonce
  const generateRandomString = (length = 32) => {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  // Initialize the eSignet plugin button with useCallback to fix dependency warning
  const initializeESignetPlugin = useCallback(async () => {
    // Prevent multiple initializations
    if (initializationRef.current) {
      return;
    }
    initializationRef.current = true;

    try {
      setIsLoading(true);
      setError(null);
      setPluginReady(false);

      // Check if container is available
      if (!buttonContainerRef.current) {
        throw new Error('Button container not found');
      }

      // Wait for eSignet plugin to be available
      if (!window.SignInWithEsignetButton || !window.SignInWithEsignetButton.init) {
        console.log('⏳ Waiting for eSignet plugin to load...');
        
        // Wait up to 10 seconds for the plugin
        let attempts = 0;
        const maxAttempts = 20;
        
        while (attempts < maxAttempts && (!window.SignInWithEsignetButton || !window.SignInWithEsignetButton.init)) {
          await new Promise(resolve => setTimeout(resolve, 500));
          attempts++;
        }
        
        if (!window.SignInWithEsignetButton || !window.SignInWithEsignetButton.init) {
          throw new Error('eSignet plugin failed to load');
        }
      }

      console.log('✅ eSignet plugin is available');

      // Generate secure random values for state and nonce
      const state = generateRandomString(32);
      const nonce = generateRandomString(32);

      // Store for validation
      sessionStorage.setItem('esignet_state', state);
      sessionStorage.setItem('esignet_nonce', nonce);

      // Add state and nonce to OIDC config
      const configWithStateNonce = {
        ...oidcConfig,
        state: state,
        nonce: nonce
      };

      // Clear the container safely before plugin initialization
      const container = buttonContainerRef.current;
      if (container) {
        // Use React-safe DOM clearing
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
      }

      // Initialize the eSignet button using the plugin
      await window.SignInWithEsignetButton.init({
        oidcConfig: configWithStateNonce,
        buttonConfig: buttonConfig,
        signInElement: container
      });

      console.log('✅ eSignet plugin button initialized successfully');
      setIsLoading(false);
      setPluginReady(true);

    } catch (err) {
      console.error('❌ Failed to initialize eSignet plugin:', err);
      setError(err.message);
      setIsLoading(false);
      setPluginReady(false);
    }
  }, [oidcConfig, buttonConfig]); // Dependencies added to useCallback

  // Initialize on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeESignetPlugin();
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
    setIsLoading(true);
    initializeESignetPlugin();
  };

  return (
    <div className="esignet-auth-container">
      <div className="auth-header">
        <h2>Sign in to MyApp</h2>
        <p>Use your e-Signet digital identity to securely sign in</p>
      </div>

      <div className="auth-content">
        <div className="esignet-button-wrapper">
          <div className="esignet-button-container" ref={buttonContainerRef}>
            {isLoading && (
              <div className="loading-placeholder">
                <div className="loading-spinner"></div>
                <p>Loading e-Signet authentication...</p>
              </div>
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
