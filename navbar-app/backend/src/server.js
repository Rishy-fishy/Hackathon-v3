import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/*
 Simple backend facade for e-Signet auth code -> token exchange & userinfo fetch.
 Environment variables expected:
   OIDC_ISSUER        e.g. https://auth.example.com
   OIDC_CLIENT_ID
   OIDC_CLIENT_SECRET (if using basic / client_secret_post) OR configure private_key_jwt separately
   REDIRECT_URI       must match registered redirect
*/

const {
  OIDC_ISSUER,
  OIDC_CLIENT_ID,
  OIDC_CLIENT_SECRET,
  REDIRECT_URI
} = process.env;

if (!OIDC_ISSUER || !OIDC_CLIENT_ID || !REDIRECT_URI) {
  console.warn('[startup] Missing required OIDC env vars; token exchange will fail until set');
}

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use(express.json());

// Health
app.get('/health', (_req,res)=> res.json({ status:'ok', time: Date.now() }));

// Exchange authorization code for tokens
app.post('/exchange-token', async (req,res)=> {
  try {
    const { code, state } = req.body || {};
    if (!code) return res.status(400).json({ error:'missing_code' });

    const tokenEndpoint = await discover('token_endpoint');
    const params = new URLSearchParams();
    params.set('grant_type','authorization_code');
    params.set('code', code);
    params.set('redirect_uri', REDIRECT_URI);
    params.set('client_id', OIDC_CLIENT_ID);
    if (OIDC_CLIENT_SECRET) params.set('client_secret', OIDC_CLIENT_SECRET);

    const tokenResp = await fetch(tokenEndpoint, {
      method:'POST',
      headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const tokenJson = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('Token error', tokenJson);
      return res.status(tokenResp.status).json(tokenJson);
    }

    const { access_token, id_token } = tokenJson;
    let userInfo = null;
    if (access_token) {
      const userinfoEndpoint = await discover('userinfo_endpoint');
      const uiResp = await fetch(userinfoEndpoint, { headers:{ Authorization: `Bearer ${access_token}` }});
      if (uiResp.ok) userInfo = await uiResp.json();
    }

    // (Optional) verify id_token
    let idTokenClaims = null;
    if (id_token) {
      try {
        const jwksUri = await discover('jwks_uri');
        const JWKS = createRemoteJWKSet(new URL(jwksUri));
        const { payload } = await jwtVerify(id_token, JWKS, { issuer: OIDC_ISSUER, audience: OIDC_CLIENT_ID });
        idTokenClaims = payload;
      } catch (e) {
        console.warn('ID token verify failed', e.message);
      }
    }

    return res.json({
      access_token,
      id_token,
      id_token_claims: idTokenClaims,
      userInfo,
      state
    });
  } catch (e) {
    console.error('Exchange failed', e);
    return res.status(500).json({ error:'exchange_failed', message: e.message });
  }
});

// Minimal discovery cache
let _discoveryCache = null;
async function discover(field) {
  if (!_discoveryCache) {
    const resp = await fetch(`${OIDC_ISSUER}/.well-known/openid-configuration`);
    if (!resp.ok) throw new Error('discovery_failed');
    _discoveryCache = await resp.json();
  }
  return field ? _discoveryCache[field] : _discoveryCache;
}

const port = process.env.PORT || 5000;
app.listen(port, ()=> console.log(`[backend] listening on :${port}`));
