#!/usr/bin/env node

/**
 * eSignet OIDC Client Setup Utility
 * 
 * This script helps you:
 * 1. Register a new OIDC client with eSignet
 * 2. Generate and store necessary keys
 * 3. Test the authorization flow
 * 4. Exchange authorization codes for tokens
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

// Configuration
const ESIGNET_BASE_URL = 'https://esignet.collab.mosip.net';
const APP_BASE_URL = 'http://localhost:3001';
const REDIRECT_URI = `${APP_BASE_URL}/callback`;

class ESignetSetup {
  constructor() {
    this.config = {
      baseUrl: ESIGNET_BASE_URL,
      redirectUri: REDIRECT_URI,
      appName: 'React eSignet Demo App',
      clientId: null,
      privateKey: null,
      publicKey: null,
      privateKeyJWK: null,
      publicKeyJWK: null
    };
  }

  /**
   * Generate RSA key pair for client authentication
   */
  generateKeyPair() {
    console.log('🔑 Generating RSA key pair...');
    
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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

    this.config.publicKey = publicKey;
    this.config.privateKey = privateKey;

    // Convert to JWK format for eSignet
    const publicKeyJWK = this.pemToJWK(publicKey, 'public');
    const privateKeyJWK = this.pemToJWK(privateKey, 'private');
    
    this.config.publicKeyJWK = publicKeyJWK;
    this.config.privateKeyJWK = privateKeyJWK;

    // Generate client_id from public key (similar to Postman script)
    const publicKeyBase64 = publicKey
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '')
      .replace(/\//g, '_');
    
    this.config.clientId = publicKeyBase64.substring(2, 50);

    console.log('✅ Key pair generated successfully');
    console.log('📝 Client ID:', this.config.clientId);
    
    return {
      clientId: this.config.clientId,
      publicKeyJWK,
      privateKeyJWK
    };
  }

  /**
   * Convert PEM to JWK format (simplified implementation)
   * Note: In production, use a proper crypto library like node-jose
   */
  pemToJWK(pem, keyType) {
    // This is a simplified conversion
    // For production, use libraries like node-jose or jsonwebtoken
    const keyData = pem
      .replace(/-----BEGIN (PUBLIC|PRIVATE) KEY-----|-----END (PUBLIC|PRIVATE) KEY-----/g, '')
      .replace(/\n/g, '');

    if (keyType === 'public') {
      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        // Note: In a real implementation, you'd properly parse the PEM
        // and extract the modulus (n) and exponent (e)
        key_id: this.generateKeyId(),
        // Simplified - you need proper n and e values
        n: keyData.substring(0, 100), // placeholder
        e: 'AQAB' // standard RSA exponent
      };
    } else {
      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        key_id: this.generateKeyId(),
        // For private keys, you'd also need d, p, q, dp, dq, qi
        // This is a placeholder implementation
      };
    }
  }

  /**
   * Generate a unique key ID
   */
  generateKeyId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get CSRF token from eSignet
   */
  async getCsrfToken() {
    console.log('🔐 Getting CSRF token...');
    
    return new Promise((resolve, reject) => {
      const url = `${this.config.baseUrl}/v1/esignet/csrf/token`;
      
      https.get(url, (res) => {
        const cookies = res.headers['set-cookie'];
        const csrfCookie = cookies?.find(cookie => cookie.startsWith('XSRF-TOKEN='));
        
        if (csrfCookie) {
          const token = csrfCookie.split('=')[1].split(';')[0];
          console.log('✅ CSRF token obtained');
          resolve(token);
        } else {
          reject(new Error('CSRF token not found'));
        }
      }).on('error', reject);
    });
  }

  /**
   * Register OIDC client with eSignet (Mock environment)
   */
  async registerClient() {
    console.log('📝 Registering OIDC client...');
    
    if (!this.config.clientId) {
      throw new Error('Keys not generated. Call generateKeyPair() first.');
    }

    try {
      const csrfToken = await this.getCsrfToken();
      
      const requestBody = {
        requestTime: new Date().toISOString(),
        request: {
          clientId: this.config.clientId,
          clientName: this.config.appName,
          publicKey: this.config.publicKeyJWK,
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
            this.config.redirectUri,
            'http://localhost:3000/callback'
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

      const response = await this.makeHttpRequest(
        `${this.config.baseUrl}/v1/esignet/client-mgmt/client`,
        'POST',
        requestBody,
        {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': csrfToken
        }
      );

      console.log('✅ Client registered successfully');
      console.log('📄 Response:', JSON.stringify(response, null, 2));
      
      return response;
    } catch (error) {
      console.error('❌ Client registration failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate authorization URL for user to visit
   */
  generateAuthorizationUrl(state = null, nonce = null) {
    if (!state) state = this.generateRandomString(32);
    if (!nonce) nonce = this.generateRandomString(32);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'openid profile',
      state: state,
      nonce: nonce,
      acr_values: 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code',
      claims_locales: 'en',
      ui_locales: 'en',
      display: 'page',
      prompt: 'consent',
      max_age: '21'
    });

    const authUrl = `${this.config.baseUrl}/authorize?${params.toString()}`;
    
    console.log('🌐 Authorization URL generated:');
    console.log(authUrl);
    console.log('\n📋 State:', state);
    console.log('📋 Nonce:', nonce);
    
    return { authUrl, state, nonce };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, redirectUri = null) {
    console.log('🔄 Exchanging authorization code for tokens...');
    
    if (!redirectUri) redirectUri = this.config.redirectUri;
    
    try {
      // Create client assertion JWT
      const clientAssertion = await this.createClientAssertion();
      
      const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      }).toString();

      const response = await this.makeHttpRequest(
        `${this.config.baseUrl}/v1/esignet/oauth/v2/token`,
        'POST',
        requestBody,
        {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      );

      console.log('✅ Tokens obtained successfully');
      return response;
    } catch (error) {
      console.error('❌ Token exchange failed:', error.message);
      throw error;
    }
  }

  /**
   * Create client assertion JWT for token exchange
   */
  async createClientAssertion() {
    const now = Math.floor(Date.now() / 1000);
    const jti = this.generateRandomString(16);
    
    const payload = {
      iss: this.config.clientId,
      sub: this.config.clientId,
      aud: `${this.config.baseUrl}/v1/esignet/oauth/v2/token`,
      jti: jti,
      exp: now + 300, // 5 minutes
      iat: now
    };

    // Note: In production, use a proper JWT library like jsonwebtoken
    console.log('⚠️ Creating client assertion (simplified implementation)');
    console.log('🔧 For production, use a proper JWT library to sign with your private key');
    
    // This is a placeholder - you need to properly sign the JWT
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = 'placeholder-signature'; // Should be RSA signature
    
    return `${header}.${payloadB64}.${signature}`;
  }

  /**
   * Save configuration to file
   */
  saveConfig() {
    const configPath = path.join(__dirname, '..', '.env.esignet');
    const envContent = `
# eSignet Configuration
ESIGNET_BASE_URL=${this.config.baseUrl}
ESIGNET_CLIENT_ID=${this.config.clientId}
ESIGNET_REDIRECT_URI=${this.config.redirectUri}

# Keys (Keep these secure!)
ESIGNET_PRIVATE_KEY_JWK='${JSON.stringify(this.config.privateKeyJWK)}'
ESIGNET_PUBLIC_KEY_JWK='${JSON.stringify(this.config.publicKeyJWK)}'

# OIDC Configuration
ESIGNET_SCOPE=openid profile
ESIGNET_ACR_VALUES=mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code
`;

    fs.writeFileSync(configPath, envContent.trim());
    console.log('💾 Configuration saved to:', configPath);
  }

  /**
   * Helper method to make HTTP requests
   */
  makeHttpRequest(url, method, data, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'User-Agent': 'eSignet-Setup/1.0',
          ...headers
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(jsonData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${jsonData.message || responseData}`));
            }
          } catch (error) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(responseData);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          }
        });
      });

      req.on('error', reject);

      if (data && method !== 'GET') {
        req.write(typeof data === 'string' ? data : JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Generate random string
   */
  generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const setup = new ESignetSetup();

  try {
    switch (command) {
      case 'generate-keys':
        setup.generateKeyPair();
        setup.saveConfig();
        break;
        
      case 'register-client':
        setup.generateKeyPair();
        await setup.registerClient();
        setup.saveConfig();
        break;
        
      case 'auth-url':
        // Load existing config if available
        if (args[1]) {
          setup.config.clientId = args[1];
        }
        setup.generateAuthorizationUrl();
        break;
        
      case 'exchange-token':
        const code = args[1];
        if (!code) {
          console.error('❌ Authorization code required');
          process.exit(1);
        }
        // Load existing config
        await setup.exchangeCodeForTokens(code);
        break;
        
      default:
        console.log(`
🚀 eSignet OIDC Setup Utility

Usage:
  node esignet-setup.js <command> [args]

Commands:
  generate-keys     Generate RSA key pair and client ID
  register-client   Register new OIDC client with eSignet
  auth-url [id]     Generate authorization URL
  exchange-token <code>  Exchange authorization code for tokens

Examples:
  node esignet-setup.js register-client
  node esignet-setup.js auth-url
  node esignet-setup.js exchange-token ABC123...

After registration:
1. Use 'auth-url' to get the authorization URL
2. Visit the URL and complete authentication
3. Copy the 'code' parameter from the callback URL
4. Use 'exchange-token' to get access/ID tokens
        `);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main();
}

module.exports = ESignetSetup;
