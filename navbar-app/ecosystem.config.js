module.exports = {
  apps: [
    {
      name: 'callback-server',
      script: './callback-server.js',
      env: {
        PORT: 5000,
        HOST: '0.0.0.0',
        SPA_BASE_URL: 'http://34.58.198.143:3001',
        CALLBACK_BASE_URL: 'http://34.58.198.143:5000',
        AUTHORIZE_URI: 'http://34.58.198.143:3000/authorize'
      }
    }
  ]
};