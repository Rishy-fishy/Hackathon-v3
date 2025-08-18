#!/usr/bin/env node

/**
 * Production-ready eSignet OIDC Client
 * 
 * This implementation uses proper JWT libraries for production use
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const jose = require('node-jose');
require('dotenv').config();

class ESignetClient {
  constructor(options = {}) {
    this.config = {
      baseUrl: options.baseUrl || process.env.ESIGNET_BASE_URL || 'https://esignet.collab.mosip.net',
      redirectUri: options.redirectUri || process.env.ESIGNET_REDIRECT_URI || 'http://localhost:3001/callback',
      appName: options.appName || 'React eSignet Demo App',
      clientId: options.clientId || process.env.ESIGNET_CLIENT_ID,
      privateKeyPem: options.privateKeyPem || process.env.ESIGNET_PRIVATE_KEY_PEM,
      publicKeyPem: options.publicKeyPem || process.env.ESIGNET_PUBLIC_KEY_PEM,
      scope: options.scope || 'openid profile',
      acrValues: options.acrValues || 'mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code'
    };
  }

  /**
   * Generate RSA key pair with proper JWK conversion
   */
  async generateKeyPair() {
    console.log('🔑 Generating RSA key pair...');
    
    const keystore = jose.JWK.createKeyStore();
    const key = await keystore.generate('RSA', 2048, { alg: 'RS256', use: 'sig' });
    
    const publicKeyJWK = key.toJSON();
    const privateKeyJWK = key.toJSON(true);
    
    // Generate PEM formats
    const publicKeyPem = key.toPEM();
    const privateKeyPem = key.toPEM(true);
    
    // Generate client_id (similar to Postman approach)
    const publicKeyBase64 = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '')
      .replace(/\//g, '_');
    
    const clientId = publicKeyBase64.substring(2, 50);
    
    this.config.clientId = clientId;
    this.config.privateKeyPem = privateKeyPem;
    this.config.publicKeyPem = publicKeyPem;
    this.config.publicKeyJWK = publicKeyJWK;
    this.config.privateKeyJWK = privateKeyJWK;

    console.log('✅ Key pair generated successfully');
    console.log('📝 Client ID:', clientId);
    
    return {
      clientId,
      publicKeyJWK,
      privateKeyJWK,
      publicKeyPem,
      privateKeyPem
    };
  }

  /**
   * Get CSRF token from eSignet
   */
  async getCsrfToken() {
    console.log('🔐 Getting CSRF token...');
    
    try {
      const response = await axios.get(`${this.config.baseUrl}/v1/esignet/csrf/token`, {
        withCredentials: true
      });
      
      const cookies = response.headers['set-cookie'];
      const csrfCookie = cookies?.find(cookie => cookie.startsWith('XSRF-TOKEN='));
      
      if (csrfCookie) {
        const token = csrfCookie.split('=')[1].split(';')[0];
        console.log('✅ CSRF token obtained');
        return token;
      } else {
        throw new Error('CSRF token not found in response');
      }
    } catch (error) {
      console.error('❌ Failed to get CSRF token:', error.message);
      throw error;
    }
  }

  /**
   * Register OIDC client with eSignet
   */
  async registerClient() {
    console.log('📝 Registering OIDC client...');
    
    if (!this.config.clientId || !this.config.publicKeyJWK) {
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
            'mosip:idp:acr:linked-wallet',
            'mosip:idp:acr:biometrics',
            'mosip:idp:acr:static-code'
          ],
          logoUri: 'https://via.placeholder.com/150x75/007acc/ffffff?text=eSignet+App',
          redirectUris: [
            this.config.redirectUri,
            'http://localhost:3000/callback',
            'http://localhost:3001/callback'
          ],
          grantTypes: ['authorization_code'],
          clientAuthMethods: ['private_key_jwt'],
          additionalConfig: {
            userinfo_response_type: 'JWS',
            purpose: {
              type: 'verify',
              title: {
                '@none': 'Identity Verification'
              },
              subTitle: {
                '@none': 'Verify your identity using eSignet'
              }
            },
            signup_banner_required: true,
            forgot_pwd_link_required: true,
            consent_expire_in_mins: 20
          }
        }
      };

      const response = await axios.post(
        `${this.config.baseUrl}/v1/esignet/client-mgmt/client`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': csrfToken
          },
          withCredentials: true
        }
      );

      console.log('✅ Client registered successfully');
      console.log('📄 Response:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('❌ Client registration failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Generate authorization URL
   */
  generateAuthorizationUrl(options = {}) {
    const state = options.state || this.generateRandomString(32);
    const nonce = options.nonce || this.generateRandomString(32);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope,
      state: state,
      nonce: nonce,
      acr_values: this.config.acrValues,
      claims_locales: 'en',
      ui_locales: 'en',
      display: 'page',
      prompt: 'consent',
      max_age: '21'
    });

    const authUrl = `${this.config.baseUrl}/authorize?${params.toString()}`;
    
    console.log('🌐 Authorization URL:');
    console.log(authUrl);
    console.log('\n📋 State (save this):', state);
    console.log('📋 Nonce (save this):', nonce);
    
    return { authUrl, state, nonce };
  }

  /**
   * Create properly signed client assertion JWT
   */
  async createClientAssertion() {
    if (!this.config.privateKeyPem) {
      throw new Error('Private key not available');
    }

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

    // Sign JWT with private key
    const token = jwt.sign(payload, this.config.privateKeyPem, {
      algorithm: 'RS256',
      header: {
        typ: 'JWT',
        alg: 'RS256'
      }
    });

    return token;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, state = null) {
    console.log('🔄 Exchanging authorization code for tokens...');
    
    if (!this.config.privateKeyPem) {
      throw new Error('Private key not available. Generate keys first.');
    }

    try {
      const clientAssertion = await this.createClientAssertion();
      
      const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      });

      const response = await axios.post(
        `${this.config.baseUrl}/v1/esignet/oauth/v2/token`,
        requestBody.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      console.log('✅ Tokens obtained successfully');
      console.log('🎯 Access Token:', response.data.access_token?.substring(0, 50) + '...');
      console.log('🆔 ID Token:', response.data.id_token?.substring(0, 50) + '...');
      
      // Decode ID token (without verification for demo)
      if (response.data.id_token) {
        const decoded = jwt.decode(response.data.id_token);
        console.log('👤 User Info from ID Token:', JSON.stringify(decoded, null, 2));
      }
      
      return response.data;
    } catch (error) {
      console.error('❌ Token exchange failed:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get user information using access token
   */
  async getUserInfo(accessToken) {
    console.log('👤 Getting user information...');
    
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/v1/esignet/oidc/userinfo`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      console.log('✅ User info retrieved');
      console.log('📄 User Data:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to get user info:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Save configuration to environment file
   */
  saveConfig() {
    const configPath = path.join(__dirname, '..', '.env.esignet');
    const envContent = `
# eSignet Configuration - Generated ${new Date().toISOString()}
ESIGNET_BASE_URL=${this.config.baseUrl}
ESIGNET_CLIENT_ID=${this.config.clientId}
ESIGNET_REDIRECT_URI=${this.config.redirectUri}
ESIGNET_SCOPE=${this.config.scope}
ESIGNET_ACR_VALUES=${this.config.acrValues}

# RSA Keys (Keep these secure!)
ESIGNET_PRIVATE_KEY_PEM="${this.config.privateKeyPem?.replace(/\n/g, '\\n')}"
ESIGNET_PUBLIC_KEY_PEM="${this.config.publicKeyPem?.replace(/\n/g, '\\n')}"

# JWK Keys
ESIGNET_PRIVATE_KEY_JWK='${JSON.stringify(this.config.privateKeyJWK)}'
ESIGNET_PUBLIC_KEY_JWK='${JSON.stringify(this.config.publicKeyJWK)}'
`;

    fs.writeFileSync(configPath, envContent.trim());
    console.log('💾 Configuration saved to:', configPath);
    console.log('⚠️ Keep the .env.esignet file secure - it contains your private keys!');
  }

  /**
   * Load configuration from environment file
   */
  loadConfig() {
    const configPath = path.join(__dirname, '..', '.env.esignet');
    
    if (fs.existsSync(configPath)) {
      const envContent = fs.readFileSync(configPath, 'utf8');
      const lines = envContent.split('\n');
      
      lines.forEach(line => {
        if (line.startsWith('ESIGNET_')) {
          const [key, ...valueParts] = line.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          
          switch (key) {
            case 'ESIGNET_CLIENT_ID':
              this.config.clientId = value;
              break;
            case 'ESIGNET_PRIVATE_KEY_PEM':
              this.config.privateKeyPem = value.replace(/\\n/g, '\n');
              break;
            case 'ESIGNET_PUBLIC_KEY_PEM':
              this.config.publicKeyPem = value.replace(/\\n/g, '\n');
              break;
            case 'ESIGNET_PRIVATE_KEY_JWK':
              this.config.privateKeyJWK = JSON.parse(value);
              break;
            case 'ESIGNET_PUBLIC_KEY_JWK':
              this.config.publicKeyJWK = JSON.parse(value);
              break;
          }
        }
      });
      
      console.log('📁 Configuration loaded from file');
    }
  }

  /**
   * Generate random string
   */
  generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Full registration and test flow
   */
  async setupAndTest() {
    console.log('🚀 Starting complete eSignet setup...\n');
    
    try {
      // Step 1: Generate keys
      await this.generateKeyPair();
      
      // Step 2: Register client
      await this.registerClient();
      
      // Step 3: Save configuration
      this.saveConfig();
      
      // Step 4: Generate auth URL
      const { authUrl, state, nonce } = this.generateAuthorizationUrl();
      
      console.log('\n🎯 Setup complete! Next steps:');
      console.log('1. Visit the authorization URL above');
      console.log('2. Complete the authentication process');
      console.log('3. Copy the "code" parameter from the callback URL');
      console.log('4. Run: node esignet-client.js exchange-token <code>');
      console.log('\n💡 The state and nonce values have been displayed above for validation');
      
      return {
        clientId: this.config.clientId,
        authUrl,
        state,
        nonce
      };
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      throw error;
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const client = new ESignetClient();

  try {
    switch (command) {
      case 'setup':
        await client.setupAndTest();
        break;
        
      case 'generate-keys':
        await client.generateKeyPair();
        client.saveConfig();
        break;
        
      case 'register-client':
        client.loadConfig();
        if (!client.config.clientId) {
          await client.generateKeyPair();
        }
        await client.registerClient();
        client.saveConfig();
        break;
        
      case 'auth-url':
        client.loadConfig();
        if (!client.config.clientId) {
          console.error('❌ No client ID found. Run "setup" or "register-client" first.');
          process.exit(1);
        }
        client.generateAuthorizationUrl();
        break;
        
      case 'exchange-token':
        const code = args[1];
        if (!code) {
          console.error('❌ Authorization code required');
          console.log('Usage: node esignet-client.js exchange-token <authorization_code>');
          process.exit(1);
        }
        
        client.loadConfig();
        const tokens = await client.exchangeCodeForTokens(code);
        
        // Optionally get user info
        if (tokens.access_token) {
          await client.getUserInfo(tokens.access_token);
        }
        break;
        
      case 'userinfo':
        const accessToken = args[1];
        if (!accessToken) {
          console.error('❌ Access token required');
          process.exit(1);
        }
        
        await client.getUserInfo(accessToken);
        break;
        
      default:
        console.log(`
🚀 eSignet OIDC Client - Production Ready

Usage:
  node esignet-client.js <command> [args]

Commands:
  setup                 Complete setup: generate keys + register client + auth URL
  generate-keys         Generate RSA key pair and client ID only
  register-client       Register OIDC client with eSignet
  auth-url              Generate authorization URL (requires existing client)
  exchange-token <code> Exchange authorization code for tokens
  userinfo <token>      Get user information using access token

Quick Start:
  npm install
  node esignet-client.js setup

This will:
1. Generate RSA keys
2. Register your app with eSignet
3. Save config to .env.esignet
4. Show you the authorization URL to test

Dependencies:
  npm install jsonwebtoken node-jose axios dotenv
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

module.exports = ESignetClient;
