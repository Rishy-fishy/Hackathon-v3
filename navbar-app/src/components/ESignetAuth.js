import React, { useEffect, useRef } from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      console.log('Container mounted');
      console.log('Checking for e-Signet script...');
      
      let retryCount = 0;
      const maxRetries = 20; // 10 seconds total
      
      const checkAndCreateElement = () => {
        retryCount++;
        console.log(`Attempt ${retryCount}/${maxRetries}: Checking for e-Signet custom element...`);
        
        // Check if custom element is defined
        if (window.customElements && window.customElements.get('sign-in-with-esignet')) {
          console.log('✅ e-Signet custom element found!');
          createESignetButton();
        } else if (retryCount >= maxRetries) {
          console.error('❌ e-Signet script failed to load after 10 seconds.');
          // Show error message in the container
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p style="color: red; text-align: center;">e-Signet script failed to load. Check console for details.</p>';
          }
        } else {
          console.log('⏳ e-Signet custom element not found, retrying in 500ms...');
          setTimeout(checkAndCreateElement, 500);
        }
      };
      
      const createESignetButton = () => {
        // Clear container first
        containerRef.current.innerHTML = '';
        
        // Create the element directly
        const esignetElement = document.createElement('sign-in-with-esignet');
        esignetElement.setAttribute('button-config', JSON.stringify({
          labelText: 'Sign in with e-Signet',
          shape: 'soft_edges',
          theme: 'filled_orange',
          type: 'standard'
        }));
        esignetElement.setAttribute('id', 'sign-in-with-esignet-standard');
        esignetElement.setAttribute('oidc-config', JSON.stringify({
          acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
          authorizeUri: 'http://localhost:3002/authorize',
          claims_locales: 'en',
          client_id: 'mock-client-id',
          display: 'page',
          max_age: 21,
          nonce: 'ere973eieljznge2311',
          prompt: 'consent',
          redirect_uri: 'http://localhost:3001/callback',
          scope: 'openid profile email phone address',
          state: 'eree2311',
          ui_locales: 'en'
        }));
      
        containerRef.current.appendChild(esignetElement);
        console.log('e-Signet element added');
      };
      
      // Start checking for the script
      checkAndCreateElement();
    }
  }, []);

  return (
    <div className="esignet-auth-container">
      <div ref={containerRef} style={{ minHeight: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {/* e-Signet button will be inserted here */}
      </div>
    </div>
  );
};

export default ESignetAuth;
