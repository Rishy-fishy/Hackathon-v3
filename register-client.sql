INSERT INTO client_detail (
    id, 
    name, 
    rp_id, 
    logo_uri, 
    redirect_uris, 
    claims, 
    acr_values, 
    public_key,
    grant_types, 
    auth_methods, 
    status, 
    cr_dtimes
) VALUES (
    '08d8YsjGpeo6kOfoVZYJsMpHGZy1vVOai1Njz8AzZk8',
    'React eSignet Demo App',
    'default-rp', 
    'https://localhost:3000/logo.png',
    '["http://34.58.198.143:5000/callback"]',
    '["name", "email", "gender", "birthdate", "phone_number", "picture"]',
    '["mosip:idp:acr:generated-code", "mosip:idp:acr:biometrics"]',
    '{"kty": "RSA", "use": "sig", "alg": "RS256", "n": "nerhfB7ZRVvjkhqPb0TKLhrFK5c7MZO5lLS8ZwjeLFwRZ9U4g_emtmySQpiunJ5ZXcKwDKKU-KqVZ-xKf5o2rAxccWCKG3wN3ECKC5tnC4tpAZ9xWEmcknkMihBRJ-oDvmc_MYVQ9DCo2b0kyITIFZisR2iiT5YFBLVlyrFXmOsxAGCsFOPNcWpy0O5s7u5BEiOl-umaKozohzHGjyHuRMf5ZAaq9esfqksJz1-61LtiTKA6cKZRxFcdAJrecfXyyNx_vZWujDAs1DXDs10-3HUdGw_NRKBUBFWX0oqNOZAc5GljnycZEjZsynHHq1UhuNspKwfyA0Vvm4nU87h0gQ", "e": "AQAB"}',
    '["authorization_code"]',
    '["private_key_jwt"]',
    'ACTIVE',
    NOW()
);