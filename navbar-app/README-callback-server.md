Callback server (cloud deploy)

Environment variables:
- PORT: Port to listen on (default 5000)
- HOST: Host to bind (default 0.0.0.0)
- SPA_BASE_URL: Where the React app is served (e.g., http://34.58.198.143:3001)
- CALLBACK_BASE_URL: Public URL of this server (e.g., http://34.58.198.143:5000)
- AUTHORIZE_URI: eSignet UI authorize endpoint (e.g., http://34.58.198.143:3000/authorize)
- MONGO_URI, MONGO_DB: Mongo connection

Start (dev):
- node callback-server.js

Start persistently (PM2 on Ubuntu):
1) npm install -g pm2
2) pm2 start callback-server.js --name callback --env production \
   --update-env -- \
   && pm2 set env:PORT 5000 && pm2 set env:HOST 0.0.0.0
3) pm2 save && pm2 startup

Ensure firewall allows TCP 5000.