#!/usr/bin/env node
// Orchestrates client creation (keys + client-config.json) then registration with eSignet.
// Usage (PowerShell example): node create-and-register.js
// Optionally set env vars:
//   CALLBACK_BASE_URL, ESIGNET_BASE_URL, KEYCLOAK_BASE_URL, KEYCLOAK_MGMT_CLIENT_SECRET

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(script) {
	console.log(`▶️ Running: ${script}`);
	const result = spawnSync('node', [script], { stdio: 'inherit' });
	if (result.status !== 0) {
		console.error(`❌ Script failed: ${script}`);
		process.exit(result.status);
	}
}

// Step 1: Create / regenerate client (overwrites client-config.json)
run(path.join(__dirname, 'create-client.js'));

// Step 2: Register (idempotent / duplicate safe)
run(path.join(__dirname, 'register-client.js'));

// Summary
const cfgPath = path.join(__dirname, 'client-config.json');
if (fs.existsSync(cfgPath)) {
	const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
	console.log('\n✅ Completed client creation & registration');
	console.log('Client ID:', cfg.clientId);
	console.log('Redirect URI:', cfg.redirectUri);
	console.log('\nNext: restart callback server so it loads new client-config.json');
}
