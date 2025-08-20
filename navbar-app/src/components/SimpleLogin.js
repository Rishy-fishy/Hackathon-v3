import React, { useEffect } from 'react';

// Minimal example matching workshop style (no dynamic fetch, direct plugin init)
export default function SimpleLogin() {
  useEffect(() => {
    const render = () => {
      if (!window.SignInWithEsignetButton?.init) {
        setTimeout(render, 200);
        return;
      }
      const state = crypto.randomUUID().replace(/-/g,'').slice(0,16);
      const nonce = crypto.randomUUID().replace(/-/g,'').slice(0,16);
      sessionStorage.setItem('esignet_state', state);
      sessionStorage.setItem('esignet_nonce', nonce);
      window.SignInWithEsignetButton.init({
        oidcConfig: {
          acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:static-code',
          authorizeUri: 'http://localhost:3000/authorize',
          claims_locales: 'en',
          client_id: '3yz7-j3xRzU3SODdoNgSGvO_cD8UijH3AIWRDAg1x-M',
          display: 'page',
          prompt: 'consent',
          redirect_uri: 'http://localhost:5000/callback',
          scope: 'openid profile',
          state,
          nonce,
          ui_locales: 'en'
        },
        buttonConfig: {
          labelText: 'Sign in with eSignet',
          shape: 'soft_edges',
          theme: 'filled_orange',
          type: 'standard'
        },
        signInElement: document.getElementById('simple-esignet-login')
      });
    };
    render();
  }, []);

  return <div id="simple-esignet-login" style={{width:'100%'}} />;
}
