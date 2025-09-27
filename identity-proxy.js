// Simple local proxy to avoid CORS issues during development
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 8080;
const REMOTE_BACKEND = 'http://35.194.34.36:8080';

app.use(cors());
app.use(express.json());

// Proxy all requests to the remote identity backend
app.all('/api/*', async (req, res) => {
  try {
    const url = `${REMOTE_BACKEND}${req.path}`;
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.text();
    res.status(response.status);
    
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    try {
      res.json(JSON.parse(data));
    } catch {
      res.send(data);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Proxy error: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Identity proxy running on http://localhost:${PORT}`);
  console.log(`Proxying requests to: ${REMOTE_BACKEND}`);
});