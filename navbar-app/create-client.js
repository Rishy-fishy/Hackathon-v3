const crypto = require('crypto');
const fetch = require('node-fetch');

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

// Extract modulus and exponent from public key for JWK
function pemToJWK(publicKeyPem) {
  // Simple conversion - in production use a proper library
  const keyData = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '')
    .replace(/\//g, '_');
  
  return {
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    n: keyData.substring(0, 200), // truncated for demo
    e: 'AQAB'
  };
}

// Generate client ID from public key
const publicKeyBase64 = keyPair.publicKey
  .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '')
  .replace(/\//g, '_');

const clientId = publicKeyBase64.substring(2, 50);
const publicKeyJWK = pemToJWK(keyPair.publicKey);

console.log('📝 Generated Client ID:', clientId);
console.log('🔧 Public Key JWK:', JSON.stringify(publicKeyJWK, null, 2));

// Create OIDC client registration request
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
    redirectUris: [
      'http://localhost:5000/callback',
  'http://localhost:5000/callback'
    ],
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
