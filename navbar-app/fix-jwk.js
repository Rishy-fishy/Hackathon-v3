const fs = require('fs');
const crypto = require('crypto');

/*
 * Rebuild a proper RSA publicKeyJWK (no truncated modulus) from the PEM in client-config.json.
 * Run: node fix-jwk.js, then re-run register-client.js to update registration.
 */
function publicKeyToJwk(publicKeyPem) {
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const jwk = keyObj.export({ format: 'jwk' }); // { kty, n, e }
  return { kty: 'RSA', use: 'sig', alg: 'RS256', n: jwk.n, e: jwk.e };
}

function run() {
  const path = './client-config.json';
  if (!fs.existsSync(path)) {
    console.error('client-config.json not found');
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!cfg.publicKey) {
    console.error('No publicKey PEM present in config');
    process.exit(1);
  }
  const oldJwk = cfg.publicKeyJWK;
  const newJwk = publicKeyToJwk(cfg.publicKey);
  const changed = !oldJwk || oldJwk.n !== newJwk.n;
  cfg.publicKeyJWK = newJwk;
  if (cfg.registrationRequest && cfg.registrationRequest.request) {
    cfg.registrationRequest.request.publicKey = newJwk;
  }
  fs.writeFileSync(path, JSON.stringify(cfg, null, 2));
  console.log('✅ Updated publicKeyJWK in client-config.json');
  console.log('🔢 New modulus length:', newJwk.n.length);
  if (oldJwk) console.log('🔢 Old modulus length:', oldJwk.n.length);
  console.log(changed ? '♻️  Modulus updated – re-register this client.' : 'ℹ️ Modulus unchanged.');
}

if (require.main === module) run();
