#!/usr/bin/env node
/**
 * Manually (re)register an existing clientId (e.g., one produced elsewhere) with the eSignet/Keycloak server.
 * Use when you already have a key pair + client-config.json but need to ensure redirect URIs (cloud + localhost) are stored.
 *
 * Env vars (override defaults):
 *   MANUAL_CLIENT_ID=DoSr...        (required if different from client-config.json)
 *   KEYCLOAK_BASE_URL=http://34.58.198.143:8088
 *   KEYCLOAK_REALM=mosip
 *   KEYCLOAK_MGMT_CLIENT_ID=mosip-pms-client
 *   KEYCLOAK_MGMT_CLIENT_SECRET=*** (REQUIRED to actually register)
 *   REDIRECT_URIS="http://34.58.198.143:5000/callback,http://localhost:5000/callback"
 */
const fs = require('fs');
const fetch = require('node-fetch');

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://34.58.198.143:8088';
const REALM = process.env.KEYCLOAK_REALM || 'mosip';
const MGMT_CLIENT_ID = process.env.KEYCLOAK_MGMT_CLIENT_ID || 'mosip-pms-client';
const MGMT_SECRET = process.env.KEYCLOAK_MGMT_CLIENT_SECRET;
const MANUAL_CLIENT_ID = process.env.MANUAL_CLIENT_ID || null;
const REDIRECT_URIS = (process.env.REDIRECT_URIS || 'http://34.58.198.143:5000/callback,http://localhost:5000/callback')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

async function getMgmtToken() {
  if (!MGMT_SECRET) throw new Error('KEYCLOAK_MGMT_CLIENT_SECRET not set.');
  const url = `${KEYCLOAK_BASE_URL}/auth/realms/${REALM}/protocol/openid-connect/token`;
  const form = new URLSearchParams();
  form.append('client_id', MGMT_CLIENT_ID);
  form.append('client_secret', MGMT_SECRET);
  form.append('grant_type', 'client_credentials');
  form.append('scope', 'add_oidc_client');
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
  if (!r.ok) throw new Error(`Mgmt token failed ${r.status}`);
  const j = await r.json();
  if (!j.access_token) throw new Error('No access_token in mgmt token response');
  return j.access_token;
}

async function main() {
  console.log('=== Manual Existing Client Registration ===');
  if (!fs.existsSync('./client-config.json')) {
    console.error('client-config.json missing. Place your key pair + config first.');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync('./client-config.json', 'utf8'));
  if (MANUAL_CLIENT_ID) {
    console.log('Overriding clientId with MANUAL_CLIENT_ID');
    cfg.clientId = MANUAL_CLIENT_ID;
  }
  if (!cfg.clientId) {
    console.error('No clientId available.');
    process.exit(1);
  }
  const publicKey = cfg.publicKeyJWK || cfg.publicKeyJwk || cfg.publicKey;
  if (!publicKey) {
    console.error('No public key/JWK in client-config.json (required).');
    process.exit(1);
  }
  console.log('ClientId:', cfg.clientId);
  console.log('Redirect URIs:', REDIRECT_URIS.join(', '));

  // Build registration payload
  const registrationRequest = {
    requestTime: new Date().toISOString(),
    request: {
      clientId: cfg.clientId,
      clientName: 'React eSignet Demo App (Manual)',
      publicKey: publicKey.kty ? publicKey : cfg.publicKeyJWK, // prefer JWK form
      relyingPartyId: cfg.clientId,
      userClaims: ['name','email','gender','phone_number','picture','birthdate'],
      authContextRefs: ['mosip:idp:acr:generated-code','mosip:idp:acr:password'],
      logoUri: 'https://via.placeholder.com/150',
      redirectUris: REDIRECT_URIS,
      grantTypes: ['authorization_code'],
      clientAuthMethods: ['private_key_jwt'],
      additionalConfig: {
        userinfo_response_type: 'JWS',
        purpose: { type: 'verify' },
        signup_banner_required: true,
        forgot_pwd_link_required: true,
        consent_expire_in_mins: 20
      }
    }
  };

  let token;
  try { token = await getMgmtToken(); } catch (e) {
    console.error('Management token error:', e.message);
    process.exit(1);
  }

  console.log('Submitting registration...');
  const endpoint = `${KEYCLOAK_BASE_URL}/v1/esignet/client-mgmt/client`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(registrationRequest)
  });
  const text = await resp.text();
  console.log('HTTP', resp.status);
  console.log('Body:', text);
  if (resp.ok) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.response && parsed.response.clientId) {
        console.log('✅ Registration successful/active.');
        cfg.registrationRequest = registrationRequest;
        cfg.registrationResponse = parsed;
        fs.writeFileSync('./client-config.json', JSON.stringify(cfg, null, 2));
        console.log('Updated client-config.json saved.');
        console.log('\nCanonical authorize URL:');
        const authUrl = `http://34.58.198.143:3000/authorize?client_id=${encodeURIComponent(cfg.clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URIS[0])}&response_type=code&scope=openid%20profile`;
        console.log(authUrl);
      }
    } catch {/* ignore */}
  } else {
    console.error('❌ Registration failed');
  }
}

if (require.main === module) {
  main().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
