const crypto = require('crypto');

// Generate RSA key pair
console.log('🔑 Generating RSA key pair...');
const keyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

// Build proper JWK (no truncation) using Node's crypto export
function publicKeyToJwk(publicKeyPem) {
  try {
    const keyObj = crypto.createPublicKey(publicKeyPem);
    const jwk = keyObj.export({ format: 'jwk' }); // { kty, n, e }
    return {
      kty: jwk.kty,
      use: 'sig',
      alg: 'RS256',
      n: jwk.n, // full modulus (base64url)
      e: jwk.e
    };
  } catch (e) {
    console.error('Failed to convert public key to JWK:', e.message);
    process.exit(1);
  }
}

// Generate client ID from public key
// Derive deterministic (but shortened) clientId from SHA-256 of public key
const pubDerB64 = keyPair.publicKey
  .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '');
const clientId = crypto.createHash('sha256').update(pubDerB64).digest('base64url').substring(0, 48);
const publicKeyJWK = publicKeyToJwk(keyPair.publicKey);

console.log('📝 Generated Client ID:', clientId);
console.log('🔧 Public Key JWK:', JSON.stringify(publicKeyJWK, null, 2));

// Create OIDC client registration request
const CLOUD_CALLBACK_BASE = process.env.CLOUD_CALLBACK_BASE || null;
const redirectUris = [ 'http://localhost:5000/callback' ];
if (CLOUD_CALLBACK_BASE) redirectUris.push(`${CLOUD_CALLBACK_BASE.replace(/\/$/, '')}/callback`);
// de-duplicate
const uniqueRedirects = Array.from(new Set(redirectUris));
const registrationRequest = {
  requestTime: new Date().toISOString(),
  request: {
    clientId: clientId,
    clientName: 'React eSignet Demo App',
    publicKey: publicKeyJWK,
    relyingPartyId: 'mock-relying-party-id',
    userClaims: [
      'name',
      'email',
      'gender',
      'phone_number',
      'picture',
      'birthdate'
    ],
    authContextRefs: [
      'mosip:idp:acr:generated-code',
      'mosip:idp:acr:password',
      'mosip:idp:acr:linked-wallet'
    ],
  logoUri: 'https://via.placeholder.com/150',
  redirectUris: uniqueRedirects,
    grantTypes: ['authorization_code'],
    clientAuthMethods: ['private_key_jwt'],
    additionalConfig: {
      userinfo_response_type: 'JWS',
      purpose: {
        type: 'verify'
      },
      signup_banner_required: true,
      forgot_pwd_link_required: true,
      consent_expire_in_mins: 20
    }
  }
};

// Save the key pair and client info
const config = {
  clientId: clientId,
  privateKey: keyPair.privateKey,
  publicKey: keyPair.publicKey,
  publicKeyJWK: publicKeyJWK,
  registrationRequest: registrationRequest
};

require('fs').writeFileSync('./client-config.json', JSON.stringify(config, null, 2));

console.log('✅ Client configuration saved to client-config.json');
console.log('\n🚀 Next steps:');
console.log('1. Register this client with eSignet using the mock auth server');
console.log('2. Update your callback server to use this client ID and private key');
console.log('3. Update your React app to use this client ID');

console.log('\n📋 Use this client ID in your apps:');
console.log(clientId);
