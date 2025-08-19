const { default: fetch } = require('node-fetch');
const crypto = require('crypto');
const jose = require('node-jose');

class ESignetOIDCClientSetup {
  constructor() {
    this.baseURL = 'http://localhost:8088';
    this.redirectURI = 'http://localhost:3001/callback';
    this.clientName = 'Hackathon Navbar App';
    this.csrfToken = null;
    this.clientKeys = null;
    this.clientId = null;
  }

  async generateRSAKeyPair() {
    try {
      const keystore = jose.JWK.createKeyStore();
      const key = await keystore.generate('RSA', 2048, { alg: 'RS256', use: 'sig' });
      
      // Get the public key in JWK format
      const publicKey = key.toJSON();
      const privateKey = key.toJSON(true);
      
      // Generate client_id from public key (similar to Postman collection)
      const publicKeyPem = key.toPEM();
      const publicKeyBase64 = publicKeyPem
        .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '')
        .replace(/\//g, '_');
      
      const clientId = publicKeyBase64.substring(2, 50);
      
      return {
        publicKey,
        privateKey,
        clientId
      };
    } catch (error) {
      console.error('Error generating RSA key pair:', error);
      throw error;
    }
  }

  async getCSRFToken() {
    try {
      const response = await fetch(`${this.baseURL}/v1/esignet/csrf/token`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Extract CSRF token from Set-Cookie header
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        const csrfMatch = setCookieHeader.match(/XSRF-TOKEN=([^;]+)/);
        if (csrfMatch) {
          this.csrfToken = csrfMatch[1];
          console.log('✅ CSRF Token obtained:', this.csrfToken);
          return this.csrfToken;
        }
      }
      
      throw new Error('CSRF token not found in response');
    } catch (error) {
      console.error('❌ Error getting CSRF token:', error);
      throw error;
    }
  }

  async createOIDCClient() {
    try {
      // Generate keys first
      console.log('🔑 Generating RSA key pair...');
      this.clientKeys = await this.generateRSAKeyPair();
      this.clientId = this.clientKeys.clientId;
      
      console.log('📝 Creating OIDC client with ID:', this.clientId);

      const clientData = {
        requestTime: new Date().toISOString(),
        request: {
          clientId: this.clientId,
          clientName: this.clientName,
          publicKey: this.clientKeys.publicKey,
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
            this.redirectURI,
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

      const response = await fetch(`${this.baseURL}/v1/esignet/client-mgmt/client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': this.csrfToken,
          'Cookie': `XSRF-TOKEN=${this.csrfToken}`
        },
        body: JSON.stringify(clientData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ OIDC Client created successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error creating OIDC client:', error);
      throw error;
    }
  }

  async setup() {
    try {
      console.log('🚀 Starting eSignet OIDC Client Setup...');
      
      // Step 1: Get CSRF token
      await this.getCSRFToken();
      
      // Step 2: Create OIDC client
      const result = await this.createOIDCClient();
      
      // Step 3: Save configuration
      const config = {
        clientId: this.clientId,
        privateKey: this.clientKeys.privateKey,
        publicKey: this.clientKeys.publicKey,
        redirectUri: this.redirectURI,
        baseURL: this.baseURL,
        authorizeUrl: 'http://localhost:3000/authorize', // UI port
        createdAt: new Date().toISOString(),
        clientResponse: result
      };

      // Write config to file
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '..', 'client-config.json');
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      console.log('✅ Configuration saved to:', configPath);
      console.log('\n📋 Client Configuration:');
      console.log('Client ID:', this.clientId);
      console.log('Redirect URI:', this.redirectURI);
      console.log('Authorize URL:', config.authorizeUrl);
      
      return config;
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  }
}

// Run the setup
if (require.main === module) {
  const setup = new ESignetOIDCClientSetup();
  setup.setup()
    .then(() => {
      console.log('\n🎉 Setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = ESignetOIDCClientSetup;
