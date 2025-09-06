const fs = require('fs');

const redirect = process.argv[2];
if (!redirect) {
  console.error('Usage: node scripts/add-redirect-uri.js <redirect_uri>');
  process.exit(1);
}

const p = './client-config.json';
if (!fs.existsSync(p)) {
  console.error('client-config.json not found');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(p,'utf8'));
if (!cfg.registrationRequest) cfg.registrationRequest = { requestTime: new Date().toISOString(), request: {} };
if (!cfg.registrationRequest.request) cfg.registrationRequest.request = {};
const req = cfg.registrationRequest.request;
if (!Array.isArray(req.redirectUris)) req.redirectUris = [];
if (!req.redirectUris.includes(redirect)) req.redirectUris.push(redirect);

// Also update top-level redirectUri used by some scripts
cfg.redirectUri = redirect;

fs.writeFileSync(p, JSON.stringify(cfg,null,2));
console.log('Updated redirectUris:', req.redirectUris);
