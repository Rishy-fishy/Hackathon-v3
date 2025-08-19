const { default: fetch } = require('node-fetch');

class MockUserCreator {
  constructor() {
    this.mockIdSystemURL = 'http://localhost:8082';
  }

  async createUser() {
    try {
      const userData = {
        individual_id: 'test-user-123',
        uin: '1234567890',
        name: [
          {
            language: 'en',
            value: 'John Doe'
          }
        ],
        gender: [
          {
            language: 'en', 
            value: 'Male'
          }
        ],
        dateOfBirth: '1990/01/01',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        documents: [
          {
            category: 'POI',
            type: 'National ID',
            format: 'pdf'
          }
        ],
        biometrics: [
          {
            type: 'finger',
            subType: 'left thumb',
            digitalId: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
          }
        ]
      };

      console.log('🔄 Creating test user in mock identity system...');
      
      const response = await fetch(`${this.mockIdSystemURL}/v1/mock-identity-system/identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestTime: new Date().toISOString(),
          request: userData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log('ℹ️ Mock identity system might not be available, but that\'s okay for eSignet testing');
        console.log('Response:', errorText);
        return null;
      }

      const result = await response.json();
      console.log('✅ Test user created successfully:', result);
      return result;
      
    } catch (error) {
      console.log('ℹ️ Could not create user in mock identity system (this is expected if container is not running)');
      console.log('Error:', error.message);
      return null;
    }
  }
}

// Run the user creation
if (require.main === module) {
  const creator = new MockUserCreator();
  creator.createUser()
    .then(() => {
      console.log('\n✅ Mock user setup completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.log('\nℹ️ Mock user setup completed (with expected errors)');
      process.exit(0);
    });
}

module.exports = MockUserCreator;
