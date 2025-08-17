import React from 'react';
import './ESignetAuth.css';

const ESignetAuth = () => {
  return (
    <div className="esignet-auth-container">
      <SignInWithEsignet
        buttonConfig={{
          labelText: 'Sign in with e-Signet',
          shape: 'soft_edges',
          theme: 'filled_orange',
          type: 'standard'
        }}
        id="sign-in-with-esignet-standard"
        oidcConfig={{
          acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
          authorizeUri: 'https://esignet.dev.mosip.net/authorize',
          claims_locales: 'en',
          client_id: '88Vjt34c5Twz1oJ',
          display: 'page',
          max_age: 21,
          nonce: 'ere973eieljznge2311',
          prompt: 'consent',
          redirect_uri: 'https://healthservices.dev.mosip.net/userprofile',
          scope: 'openid profile',
          state: 'eree2311',
          ui_locales: 'en'
        }}
      />
    </div>
  );
};

// Declare the external component
const SignInWithEsignet = (props) => {
  return React.createElement('sign-in-with-esignet', {
    'button-config': JSON.stringify(props.buttonConfig),
    'id': props.id,
    'oidc-config': JSON.stringify(props.oidcConfig)
  });
};

export default ESignetAuth;
