const jose = require('node-jose');
const { default: fetch } = require('node-fetch');
const fs = require('fs');
const path = require('path');

class TokenExchanger {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'client-config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      throw new Error('Could not load client configuration. Please run create-oidc-client.js first');
    }
  }

  async createClientAssertion() {
    try {
      const privateKey = await jose.JWK.asKey(this.config.privateKey);
      
      const payload = {
        iss: this.config.clientId,
        sub: this.config.clientId,
        aud: `${this.config.baseURL}/v1/esignet/oauth/v2/token`,
        jti: require('crypto').randomUUID(),
        exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
        iat: Math.floor(Date.now() / 1000)
      };

      const jwt = await jose.JWS.createSign({ format: 'compact' }, privateKey)
        .update(JSON.stringify(payload))
        .final();

      return jwt;
    } catch (error) {
      console.error('Error creating client assertion:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(authCode, redirectUri) {
    try {
      console.log('🔄 Exchanging authorization code for tokens...');
      
      const clientAssertion = await this.createClientAssertion();
      
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: clientAssertion
      });

      const response = await fetch(`${this.config.baseURL}/v1/esignet/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const tokens = await response.json();
      console.log('✅ Tokens received successfully');
      
      return tokens;
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    try {
      console.log('🔄 Fetching user information...');
      
      const response = await fetch(`${this.config.baseURL}/v1/esignet/oidc/userinfo`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`UserInfo request failed: ${response.status} - ${errorText}`);
      }

      const userInfo = await response.json();
      console.log('✅ User information received successfully');
      
      return userInfo;
    } catch (error) {
      console.error('❌ UserInfo request failed:', error);
      throw error;
    }
  }
}

// Export for use in React components
if (typeof window !== 'undefined') {
  window.TokenExchanger = TokenExchanger;
}

module.exports = TokenExchanger;
