# eSignet OIDC Integration Guide

This guide provides step-by-step instructions for properly registering an OIDC client with eSignet and implementing the OAuth 2.0 authorization code flow.

## Overview

Your current Postman collection shows two approaches:
1. **MOSIP**: Full production-ready integration
2. **Mock**: Development/testing environment

Based on your environment variables, you're using:
- `url`: `https://esignet.collab.mosip.net`
- `client_id`: `tKLqdNjYFyVstJyeKSuqudI1Mdngm3EVla9WSBdA9zc`
- `redirection_url`: `https://healthservices.collab.mosip.net/userprofile`

## Step 1: Environment Setup

### Required Environment Variables

```bash
# eSignet Base URL
ESIGNET_BASE_URL=https://esignet.collab.mosip.net

# Your application redirect URI
REDIRECT_URI=http://localhost:5000/callback

# OIDC Configuration
SCOPE=openid profile
ACR_VALUES=mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code
CLAIMS_LOCALES=en
UI_LOCALES=en

# These will be generated during client registration
CLIENT_ID=
CLIENT_SECRET=
PRIVATE_KEY_JWK=
PUBLIC_KEY_JWK=
```

## Step 2: OIDC Client Registration Process

### Option A: Using Mock Environment (Recommended for Development)

#### 1. Get CSRF Token
```http
GET https://esignet.collab.mosip.net/v1/esignet/csrf/token
```

This returns a CSRF token in the `XSRF-TOKEN` cookie.

#### 2. Generate RSA Key Pair

Your Postman collection includes JavaScript to generate RSA keys:

```javascript
// This code is already in your Postman pre-request script
eval(pm.environment.get('pmlib_code'))
kp = pmlib.rs.KEYUTIL.generateKeypair("RSA", 2048);
privateKey_jwk = pmlib.rs.KEYUTIL.getJWK(kp.prvKeyObj);
publicKey_jwk = pmlib.rs.KEYUTIL.getJWK(kp.pubKeyObj);

// Generate client_id from public key
const publicKeyPem = pmlib.rs.KEYUTIL.getPEM(kp.pubKeyObj, "PKCS8PUB");
const publicKeyBase64 = publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, '');
let updatedStr = publicKeyBase64.replace(/\//g, "_");
pm.environment.set("client_id", updatedStr.substring(2, 50));
```

#### 3. Create OIDC Client

```http
POST https://esignet.collab.mosip.net/v1/esignet/client-mgmt/client
Authorization: Bearer {{authtoken}}
X-XSRF-TOKEN: {{csrf_token}}
Content-Type: application/json

{
    "requestTime": "{{$isoTimestamp}}",
    "request": {
        "clientId": "{{client_id}}",
        "clientName": "Your App Name",
        "publicKey": {{client_public_key}},
        "relyingPartyId": "mock-relying-party-id",
        "userClaims": [
            "name",
            "email",
            "gender",
            "phone_number",
            "picture",
            "birthdate"
        ],
        "authContextRefs": [
            "mosip:idp:acr:generated-code",
            "mosip:idp:acr:password",
            "mosip:idp:acr:linked-wallet"
        ],
        "logoUri": "{{$randomImageUrl}}",
        "redirectUris": [
            "http://localhost:5000/callback",
            "http://localhost:3000/callback"
        ],
        "grantTypes": [
            "authorization_code"
        ],
        "clientAuthMethods": [
            "private_key_jwt"
        ],
        "additionalConfig": {
            "userinfo_response_type": "JWS",
            "purpose": {
                "type": "verify"
            },
            "signup_banner_required": true,
            "forgot_pwd_link_required": true,
            "consent_expire_in_mins": 20
        }
    }
}
```

### Option B: Using MOSIP Production Environment

This requires more complex authentication with Partner Management System (PMS).

#### 1. Get PMS Authentication Token

```http
POST {{iam_url}}/auth/realms/mosip/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

client_secret={{mosip_pms_client_secret}}
&client_id=mosip-pms-client
&grant_type=client_credentials
```

#### 2. Create OIDC Client in MOSIP

```http
POST {{internal_url}}/v1/partnermanager/oidc/client
Authorization: {{authtoken}}
Content-Type: application/json

{
  "id": "string",
  "version": "string",
  "requesttime": "{{$isoTimestamp}}",
  "metadata": {},
  "request": {
    "name": "{{$randomCompanyName}}",
    "policyId": "93482",
    "publicKey": {{client_public_key}},
    "authPartnerId": "{{relying_party_id}}",
    "logoUri": "{{$randomImageUrl}}",
    "redirectUris": [
      "{{redirection_url}}"
    ],
    "grantTypes": [
      "authorization_code"
    ],
    "clientAuthMethods": [
      "private_key_jwt"
    ]
  }
}
```

## Step 3: OAuth 2.0 Authorization Code Flow

### 1. Authorization Request

Redirect users to:
```
https://esignet.collab.mosip.net/authorize?
  response_type=code
  &client_id={{your_client_id}}
  &redirect_uri={{your_redirect_uri}}
  &scope=openid profile
  &state={{random_state}}
  &nonce={{random_nonce}}
  &acr_values=mosip:idp:acr:generated-code mosip:idp:acr:biometrics mosip:idp:acr:static-code
  &claims_locales=en
  &ui_locales=en
  &display=page
  &prompt=consent
  &max_age=21
```

### 2. Handle Authorization Response

After user authentication, eSignet redirects to your `redirect_uri` with:
```
http://localhost:5000/callback?
  code={{authorization_code}}
  &state={{state}}
```

### 3. Exchange Authorization Code for Tokens

This requires creating a signed JWT for client authentication:

```http
POST https://esignet.collab.mosip.net/v1/esignet/oauth/v2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={{authorization_code}}
&redirect_uri={{redirect_uri}}
&client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
&client_assertion={{signed_jwt}}
```

The `client_assertion` must be a JWT signed with your private key:

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT"
  },
  "payload": {
    "iss": "{{client_id}}",
    "sub": "{{client_id}}",
    "aud": "https://esignet.collab.mosip.net/v1/esignet/oauth/v2/token",
    "jti": "{{unique_id}}",
    "exp": {{expiration_timestamp}},
    "iat": {{issued_at_timestamp}}
  }
}
```

### 4. Token Response

Successful response:
```json
{
  "access_token": "...",
  "id_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Step 4: Verify ID Token

The ID token is a JWT that contains user information. Verify it by:

1. Checking the signature using eSignet's public key
2. Validating the issuer, audience, and expiration
3. Extracting user claims

## Step 5: Get User Information

Use the access token to get additional user information:

```http
GET https://esignet.collab.mosip.net/v1/esignet/oidc/userinfo
Authorization: Bearer {{access_token}}
```

## Security Considerations

1. **Private Key Storage**: Store your private JWK securely, never in client-side code
2. **State Parameter**: Always use and validate the state parameter to prevent CSRF attacks
3. **Nonce**: Use nonce in the authorization request and validate it in the ID token
4. **Token Storage**: Store tokens securely (e.g., secure HTTP-only cookies)
5. **HTTPS**: Always use HTTPS in production
6. **Token Validation**: Properly validate all received tokens

## Common Issues and Solutions

### "Invalid Client Identifier" Error
- Ensure your client_id is properly registered
- Check that the client_id matches exactly what was returned during registration

### Redirect URI Mismatch
- Ensure the redirect_uri in your authorization request matches exactly what was registered
- Include all possible redirect URIs during client registration

### Token Exchange Errors
- Verify your client_assertion JWT is properly signed
- Check that the audience in the JWT matches the token endpoint
- Ensure the JWT hasn't expired

## Testing with Your Current Setup

Based on your environment variables, you can test with:
- Client ID: `tKLqdNjYFyVstJyeKSuqudI1Mdngm3EVla9WSBdA9zc`
- Base URL: `https://esignet.collab.mosip.net`

However, you'll need the corresponding private key for this client_id to create proper client assertions.

## Next Steps

1. Choose Mock or MOSIP environment
2. Register a new OIDC client following the appropriate process
3. Store the generated keys and client_id securely
4. Implement the token exchange flow in your React app
5. Add proper error handling and token validation
