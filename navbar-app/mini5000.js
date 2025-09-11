// Minimal diagnostic server to prove port 5000 can bind.
// Run with: NO_MONGO=1 PORT=5000 node mini5000.js

const http = require('http');
const port = process.env.PORT || 5000;
const host = process.env.HOST || '0.0.0.0';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'mini-ok', ts: Date.now() }));
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('mini5000 alive\n');
});

server.listen(port, host, () => {
  console.log(`mini5000 listening on ${host}:${port}`);
});
