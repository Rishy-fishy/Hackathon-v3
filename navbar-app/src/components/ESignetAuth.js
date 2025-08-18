import React, { useEffect, useRef } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const esignetContainerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const initializeESignetButton = async () => {
      // Prevent duplicate initialization
      if (initializedRef.current) return;
      
      try {
        // Wait for eSignet plugin to be available
        let attempts = 0;
        while (attempts < 50 && (!window.SignInWithEsignetButton?.init)) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!window.SignInWithEsignetButton?.init) {
          console.error('eSignet plugin not loaded');
          return;
        }

        // Mark as initialized early to prevent race conditions
        initializedRef.current = true;

        const container = esignetContainerRef.current;
        if (!container) return;

        // Generate state and nonce for OIDC security
        const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');

        // Store for validation
        sessionStorage.setItem('esignet_state', state);
        sessionStorage.setItem('esignet_nonce', nonce);

        // eSignet OIDC configuration for your Docker services
        const oidcConfig = {
          authorizeUri: 'http://localhost:3000/authorize',
          client_id: 'IBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArla+u7',
          redirect_uri: 'http://localhost:5000/callback',
          scope: 'openid profile',
          acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
          claims_locales: 'en',
          ui_locales: 'en',
          display: 'page',
          prompt: 'consent',
          max_age: 21,
          state: state,
          nonce: nonce,
          claims: {
            userinfo: {
              given_name: { essential: true },
              phone_number: { essential: false },
              email: { essential: true },
              picture: { essential: false },
              gender: { essential: false },
              birthdate: { essential: false },
              address: { essential: false }
            },
            id_token: {}
          }
        };

        // Button configuration
        const buttonConfig = {
          type: 'standard',
          theme: 'filled_orange',
          labelText: 'Sign in with e-Signet',
          shape: 'soft_edges',
          width: '400px'
        };

        // Initialize the eSignet button with your Docker services
        await window.SignInWithEsignetButton.init({
          oidcConfig,
          buttonConfig,
          signInElement: container
        });

        console.log('✅ eSignet plugin initialized successfully with Docker services');

      } catch (error) {
        console.error('❌ eSignet initialization failed:', error);
        initializedRef.current = false; // Reset on error to allow retry
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initializeESignetButton, 200);

    return () => {
      clearTimeout(timer);
      // Don't reset initializedRef here to prevent re-initialization
    };
  }, []); // Empty dependency array - initialize only once

  return (
    <div className="esignet-auth-container">
      <div className="auth-header">
        <h2>Sign in to MyApp</h2>
        <p>Use your official eSignet digital identity to securely sign in</p>
      </div>

      <div className="auth-content">
        <div className="esignet-button-wrapper">
          {/* Container for eSignet plugin button - let plugin handle everything */}
          <div 
            ref={esignetContainerRef}
            className="esignet-plugin-container"
            style={{ 
              minHeight: '60px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            <div className="loading-placeholder">
              <div className="loading-spinner"></div>
              <p>Loading e-Signet authentication...</p>
            </div>
          </div>
        </div>

        <div className="auth-info">
          <p className="info-text">
            <strong>About Official eSignet:</strong> This uses the official MOSIP eSignet 
            authentication system running in your Docker containers. eSignet provides secure 
            digital identity verification using various authentication methods including UIN 
            verification, biometrics, and generated codes.
          </p>
          <p className="info-text">
            <strong>Docker Setup:</strong> Using mosipid/esignet-with-plugins:1.6.1 
            running on localhost:8088 with UI on localhost:3000.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ESignetAuth;
