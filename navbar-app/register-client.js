const fetch = require('node-fetch');
const fs = require('fs');

// Environment-driven configuration (override defaults when provided)
const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8088';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'mosip';
// Management client that has add_oidc_client scope assigned
const MGMT_CLIENT_ID = process.env.KEYCLOAK_MGMT_CLIENT_ID || 'mosip-pms-client';
const MGMT_CLIENT_SECRET = process.env.KEYCLOAK_MGMT_CLIENT_SECRET; // <-- set this in your env

async function getManagementAccessToken() {
  if (!MGMT_CLIENT_SECRET) {
    console.warn('⚠️  No KEYCLOAK_MGMT_CLIENT_SECRET provided - skipping Authorization header (registration will likely FAIL with 401).');
    return null;
  }
  const tokenUrl = `${KEYCLOAK_BASE_URL}/auth/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const form = new URLSearchParams();
  form.append('client_id', MGMT_CLIENT_ID);
  form.append('client_secret', MGMT_CLIENT_SECRET);
  form.append('grant_type', 'client_credentials');
  // ask explicitly for scope though Keycloak may auto include
  form.append('scope', 'add_oidc_client');
  console.log('🔐 Fetching management access token...');
  const resp = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Failed to obtain management token (${resp.status}): ${t}`);
  }
  const data = await resp.json();
  if (!data.access_token) throw new Error('No access_token in token response');
  console.log('✅ Management token acquired');
  return data.access_token;
}

function buildRegistrationRequest(clientConfig) {
  // If a valid request already present, reuse
  if (clientConfig.registrationRequest && clientConfig.registrationRequest.request && clientConfig.registrationRequest.request.clientId) {
    return clientConfig.registrationRequest;
  }
  // Derive fields from existing config
  const clientId = clientConfig.clientId;
  const publicKey = clientConfig.publicKeyJWK || clientConfig.publicKey || clientConfig.publicKeyJwk;
  if (!publicKey) throw new Error('No public key/JWK found in client-config.json');
  return {
    requestTime: new Date().toISOString(),
    request: {
      clientId,
      clientName: 'React eSignet Demo App',
      publicKey,
      relyingPartyId: clientId, // simplest: use clientId as relyingPartyId
      userClaims: ['name','email','gender','phone_number','picture','birthdate'],
      authContextRefs: [ 'mosip:idp:acr:generated-code','mosip:idp:acr:password' ],
      logoUri: 'https://via.placeholder.com/120',
      redirectUris: [ clientConfig.redirectUri || 'http://localhost:5000/callback' ],
      grantTypes: ['authorization_code'],
      clientAuthMethods: ['private_key_jwt'],
      clientNameLangMap: { eng: 'React eSignet Demo App' },
      additionalConfig: {
        userinfo_response_type: 'JWS',
        purpose: { type: 'verify' },
        signup_banner_required: true,
        forgot_pwd_link_required: true,
        consent_expire_in_mins: 20
      }
    }
  };
}

async function registerClient() {
  try {
    console.log('🔄 Registering / ensuring OIDC client in eSignet...');

    // Load client configuration
    const clientConfig = JSON.parse(fs.readFileSync('./client-config.json', 'utf8'));
    console.log('📋 Client ID:', clientConfig.clientId);

    // Rebuild registration request if missing / empty
    const registrationRequest = buildRegistrationRequest(clientConfig);

    // Persist rebuilt request (so future runs reuse)
    clientConfig.registrationRequest = registrationRequest;
    fs.writeFileSync('./client-config.json', JSON.stringify(clientConfig, null, 2));

    // Obtain CSRF token (although /client-mgmt/** is configured to ignore CSRF, keeping for completeness)
    console.log('�  Getting CSRF token...');
    const csrfResponse = await fetch(`${KEYCLOAK_BASE_URL}/v1/esignet/csrf/token`);
    const csrfCookies = csrfResponse.headers.get('set-cookie');
    const csrfToken = csrfCookies ? csrfCookies.match(/XSRF-TOKEN=([^;]+)/)?.[1] : null;
    if (!csrfToken) console.warn('⚠️  Could not extract CSRF token (may be ignored by server)'); else console.log('✅ CSRF token obtained');

    // Get management access token (required for add_oidc_client scope)
    let accessToken = await getManagementAccessToken();

    console.log('📝 Sending client registration request...');
    const endpoint = `${KEYCLOAK_BASE_URL}/v1/esignet/client-mgmt/client`;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (csrfToken) {
      headers['X-XSRF-TOKEN'] = csrfToken;
      headers['Cookie'] = `XSRF-TOKEN=${csrfToken}`;
    }
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const registrationResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(registrationRequest)
    });

    const responseText = await registrationResponse.text();
    console.log('📄 Status:', registrationResponse.status);
    console.log('📄 Raw response:', responseText);

    let parsed;
    try { parsed = JSON.parse(responseText); } catch { /* ignore */ }

    if (registrationResponse.ok && parsed && parsed.response && parsed.response.clientId) {
      console.log('✅ Client registered or already active.');
      clientConfig.registrationResponse = parsed;
      fs.writeFileSync('./client-config.json', JSON.stringify(clientConfig, null, 2));
      console.log('💾 Saved updated client-config.json');
      return true;
    }

    // Treat duplicate as success (error list contains duplicate error code)
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.some(e => /duplicate/i.test(e.errorCode || e.error || ''))) {
      console.log('ℹ️ Client already exists (duplicate). Proceeding.');
      return true;
    }

    console.error('❌ Registration failed (see above).');
    if (!accessToken) {
      console.error('➡️ Likely missing Authorization: set KEYCLOAK_MGMT_CLIENT_SECRET and re-run.');
    }
    return false;
  } catch (err) {
    console.error('❌ Error:', err.message);
    return false;
  }
}

// Execute when invoked directly
if (require.main === module) {
  registerClient().then(success => {
    if (success) {
      console.log('\n🚀 Next steps:');
      console.log('1. Start / restart React app & callback server');
      console.log('2. Initiate login with the registered client');
      console.log('3. Verify no more "Client ID is invalid" message.');
    } else {
      console.log('\n❌ Registration did not complete successfully. Fix issues and retry.');
    }
    process.exit(success ? 0 : 1);
  });
}

module.exports = { registerClient };
