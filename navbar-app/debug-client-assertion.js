// Debug helper: generate a client assertion and dump header/payload/signature + verify with public key.
const fs = require('fs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getPrivateKeyPem(key) {
  if (typeof key === 'string') return key;
  if (typeof key === 'object' && key.kty === 'RSA') {
    return crypto.createPrivateKey({ key, format: 'jwk' }).export({ format: 'pem', type: 'pkcs8' });
  }
  throw new Error('Unsupported private key format');
}

function main() {
  const cfg = JSON.parse(fs.readFileSync('./client-config.json','utf8'));
  const clientId = cfg.clientId;
  const aud = (cfg.baseURL || 'http://localhost:8088') + '/v1/esignet/oauth/v2/token';
  const now = Math.floor(Date.now()/1000);
  const payload = { iss: clientId, sub: clientId, aud, jti: crypto.randomBytes(16).toString('hex'), iat: now, exp: now+300 };
  const pk = getPrivateKeyPem(cfg.privateKey);
  const assertion = jwt.sign(payload, pk, { algorithm: 'RS256', header: { alg:'RS256', typ:'JWT' } });
  const [h,p,s] = assertion.split('.');
  const decode = b64 => JSON.parse(Buffer.from(b64.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString());
  console.log('🔐 Assertion:', assertion);
  console.log('🧾 Header:', decode(h));
  console.log('📋 Payload:', decode(p));
  console.log('🔏 Signature (base64url length):', s.length);
  // Local verification using public key PEM (fallback converting JWK if needed)
  let pubPem = cfg.publicKey;
  if (!pubPem && cfg.publicKeyJWK) {
    pubPem = crypto.createPublicKey({ key: cfg.publicKeyJWK, format: 'jwk' }).export({ format: 'pem', type: 'spki' });
  }
  try {
    const verified = jwt.verify(assertion, pubPem, { algorithms: ['RS256'], audience: aud, issuer: clientId, subject: clientId });
    console.log('✅ Local verify success. exp in', verified.exp - now, 'seconds');
  } catch (e) {
    console.error('❌ Local verify failed:', e.message);
  }
}

if (require.main === module) main();
