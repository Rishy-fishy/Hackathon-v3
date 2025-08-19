const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Your JWK private key
const jwk = {
  "kty": "RSA",
  "n": "z2sxOaXP46_PxuRgwKkZ5R3jKo0J8hoq5RPlsbEppj8NBCh6iQBax2yk4XqZPlU-IfEFqHSngHrpoW9eJroFXE3AjwyY5vh1vlkpVk88Y20VAkGTEAx2KvzzQRSY9ZfJLDU4u3Z6Jk1fxz72EODGWp4ZsW-McOX9yEDfMeIMpe7dgIoeBECOi6lNBGJXukt9JG6YMJBn2wh7uEwACsoLE6sgFBgIoR0oJIfYPZrrIaNwG3JcTSbJ4tv69ZojVsZajUq7dAoBF2vrw44oUyOZnUFwHYVs6-XP3EvX1QubAv-1JzoGTQLR4RMPVa4sGkUAM16WxUqpgTpPFD_vpOWr3w",
  "e": "AQAB",
  "d": "JvG4Z1uDoftzpqNgqyvU6djnuyiKEoPpQ-Otf-SErmsuNXaoMyr24HS8rH1JYpO8u8C2UD--53esgBwZ8GmC8ibDHdi-qLdD3D5_bW4pJ33msOrBAwVj9oRR5AlLAunB4uQHR-Nh4ekrL4zZxKd_dqoypscL9nKoaL4Nah9IQqs1EUpwygOATTH4gogA8lKGwmtYeKx2K3tFBbEPohp_tRbyrfUWr5868aqPdWtnw7_kHYluQAQox691zDa9bfjD4c67tfEY_pdKRg9ldwEpdUH4J2SWi4I8tBPVu8aHm7gCOOv5yK75gHX5vId7cNrcWiY07SBrspRc8SUM99bTwQ",
  "p": "8zEYljXbmBRoSAPYtopUTIHrTq9RSd7O1p8zgO1rZFhRm2HHhqfnkrMxX9OaPA40b9wbpyes_SDi3ZVejHRv83PlHEPLW2jgQNWROwoYEE6cwiQ3RpxejNey5FXfR42lMoT2qYngRIGBZJo0he-h9mrYwl3WpZEBqJgcEwpef_8",
  "q": "2lfGiUYeWHYqnoIo-4jlK-nOz1cTvi51gorfwXpSXBf6jOU_tH4xmSs8m5L9jzM66MALi5HRPt-39zTSwz7Umy6QLVpLcX1bkgTxOUv8fCu5bxhPNkQHKevO3BQ2I0UYT7n_O8tLnddqAmRnUiaYMdpHOixMcuOXd3TBLvNI1CE",
  "dp": "wKPhgAuFucBgors5Tc_h2wEHLrs9vzBZ1DUkDTsE2OYFLvqTnR0gGVsM_4WVJYFzFDDdTtnk9Fa6nyAVV1lc3RKvKGajjfNTwMfsVUI3saM0Fa2ug6aWVyb-NFW5muqfM5eT9NSc7GdR4iks9fPO7m3Q6pZ-04Q8NhrYElUiam0",
  "dq": "dTZVwG_B7p9Q9dLOCWpODKrxeOE4Ggp6zt-aixUNjZ7ZxDV1Y4GzQpSxbpsUP4GzCCvAhuZ6vBQBgFX9Jw9dtwjiIVat1XkEZXj9vlKKcmZOn9MfAvS2G80ZOZAoF_sJuBMTb5gNOejgYfRgevt5DJovTo1lZO_E6j3lTz0PRcE",
  "qi": "Tl5lGJkSlJdta3pQyF22Ljroho7BRJDlhNx_BAQTBrPC65hjk5nf0qB19vxRIylUfO5yw8TnwupSvCCiW06xiICIN38chHda9OkG-oDnZqKW5afkLS8EvjqdkVg5EB5hkTQJkkMPyRekKDush3sAZcA6VUmMOAdZkfTg3WUxP4g"
};

// Convert JWK to PEM format
function jwkToPem(jwk) {
  const n = Buffer.from(jwk.n, 'base64url');
  const e = Buffer.from(jwk.e, 'base64url');
  const d = Buffer.from(jwk.d, 'base64url');
  const p = Buffer.from(jwk.p, 'base64url');
  const q = Buffer.from(jwk.q, 'base64url');
  const dp = Buffer.from(jwk.dp, 'base64url');
  const dq = Buffer.from(jwk.dq, 'base64url');
  const qi = Buffer.from(jwk.qi, 'base64url');

  const key = crypto.createPrivateKey({
    key: {
      kty: jwk.kty,
      n: n,
      e: e,
      d: d,
      p: p,
      q: q,
      dp: dp,
      dq: dq,
      qi: qi
    },
    format: 'jwk'
  });

  return key.export({ format: 'pem', type: 'pkcs8' });
}

const privateKeyPem = jwkToPem(jwk);

// Create JWT client assertion for token request
const now = Math.floor(Date.now() / 1000);
const clientId = 'IIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwAObq';

const payload = {
  iss: clientId,
  sub: clientId,
  aud: 'http://localhost:8088/v1/esignet/oauth/v2/token',
  jti: crypto.randomUUID(),
  exp: now + 300,
  iat: now
};

const clientAssertion = jwt.sign(payload, privateKeyPem, {
  algorithm: 'RS256',
  header: {
    alg: 'RS256',
    typ: 'JWT'
  }
});

console.log('Client Assertion JWT:');
console.log(clientAssertion);
console.log('\nNow use this to get access token...');
