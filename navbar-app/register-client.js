const fetch = require('node-fetch');
const fs = require('fs');

async function registerClient() {
  try {
    console.log('🔄 Registering new OIDC client with eSignet mock server...');
    
    // Load client configuration
    const clientConfig = JSON.parse(fs.readFileSync('./client-config.json', 'utf8'));
    console.log('📋 Client ID:', clientConfig.clientId);
    
    // First, get CSRF token
    console.log('🔐 Getting CSRF token...');
    const csrfResponse = await fetch('http://localhost:8088/v1/esignet/csrf/token');
    const csrfCookies = csrfResponse.headers.get('set-cookie');
    const csrfToken = csrfCookies ? csrfCookies.match(/XSRF-TOKEN=([^;]+)/)?.[1] : null;
    
    if (!csrfToken) {
      throw new Error('Failed to get CSRF token');
    }
    console.log('✅ CSRF token obtained');
    
    // Register the client
    console.log('📝 Registering client...');
    const registrationResponse = await fetch('http://localhost:8088/v1/esignet/client-mgmt/client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': csrfToken,
        'Cookie': `XSRF-TOKEN=${csrfToken}`
      },
      body: JSON.stringify(clientConfig.registrationRequest)
    });
    
    const responseText = await registrationResponse.text();
    console.log('📄 Registration response status:', registrationResponse.status);
    console.log('📄 Registration response:', responseText);
    
    if (registrationResponse.ok) {
      const responseData = JSON.parse(responseText);
      console.log('✅ Client registered successfully!');
      console.log('🎉 You can now use this client for authentication');
      
      // Save registration response
      const updatedConfig = {
        ...clientConfig,
        registrationResponse: responseData
      };
      fs.writeFileSync('./client-config.json', JSON.stringify(updatedConfig, null, 2));
      console.log('💾 Updated client configuration saved');
      
    } else {
      console.error('❌ Registration failed:', responseText);
      
      // If client already exists, that's okay
      if (responseText.includes('Client already exists') || responseText.includes('already registered')) {
        console.log('ℹ️ Client already exists - you can proceed with authentication');
        return true;
      }
      
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error registering client:', error.message);
    console.log('💡 Make sure eSignet mock server is running on http://localhost:8088');
    return false;
  }
}

// Run registration
registerClient().then(success => {
  if (success) {
    console.log('\n🚀 Next steps:');
    console.log('1. ✅ Client is registered with eSignet');
    console.log('2. ✅ Callback server is configured');
    console.log('3. 🔄 Update React app to use new client ID');
    console.log('4. 🎯 Test the authentication flow!');
  } else {
    console.log('\n❌ Registration failed. Check the error messages above.');
  }
  
  process.exit(success ? 0 : 1);
});
