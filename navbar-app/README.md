# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

---

## Backend Runtime Configuration (Custom Additions)

The frontend can dynamically point to a deployed Cloud Run backend without rebuilding:

1. Copy `public/runtime-config.example.js` to `public/runtime-config.js`.
2. Set `window.__API_BASE` to your backend base URL (no trailing slash), e.g.
	```js
	window.__API_BASE = 'https://navbar-backend-direct-xxxxxxxxxx-uc.a.run.app';
	```
3. Deploy / serve the static site. The `AdminPage` component will resolve the backend URL in this order:
	- `window.__API_BASE`
	- `REACT_APP_API_BASE` build-time variable
	- `http://localhost:3002` (when running frontend dev server locally)
	- Relative (same origin)

## Health Endpoints

Backend exposes:

* `/health` – basic liveness.
* `/health/db` – attempts Mongo connection and reports whether the seeded Admin user exists.

If `/health` succeeds but `/health/db` returns `mongo_unavailable`:
1. Ensure Cloud Run service has `MONGO_URI` (env var or secret) set.
2. Service account has `roles/secretmanager.secretAccessor` on the secret (if using Secret Manager).
3. MongoDB Atlas cluster allows access (network rules / IP access list). For public (no IP restriction) clusters this usually "just works".
4. Check Cloud Run logs for `[backend] Mongo connection failed` messages.

## Admin Credentials

Default admin user is seeded with username `Admin` and password `Admin@123` (hash only stored). Change the password by updating the `admin_users` collection directly (replace `passwordHash` with a new bcrypt hash).

---

## Callback Server (OIDC Flow) – Start / Restart on VM

Helper script added at `scripts/start-callback.sh` to reliably start the callback server on port 5000.

Steps (on your GCP VM):

```bash
gcloud compute ssh hackathon-v3-vm --zone us-central1-a
# Once logged in:
cd ~/Hackathon-v3/navbar-app
bash scripts/start-callback.sh
```

It will:
1. Kill existing `callback-server.js` processes.
2. Export (or use existing) env vars: `SPA_BASE_URL`, `CALLBACK_BASE_URL`, `AUTHORIZE_URI`, `HOST`, `PORT`.
3. Start the server with `nohup`, write logs to `server.out`.
4. Show last log lines, port listening status, `/health` and `/client-meta` probe results.

Override defaults (example):

```bash
SPA_BASE_URL=http://34.58.198.143:3001 CALLBACK_BASE_URL=http://34.58.198.143:5000 bash scripts/start-callback.sh
```

Quick external checks (from your workstation):

```bash
curl -m 3 http://34.58.198.143:5000/health
curl -m 3 http://34.58.198.143:5000/client-meta
```

If `PORT_NOT_LISTENING` appears, inspect `server.out`:

```bash
tail -50 server.out
```

Common causes of failure:
* Wrong Node version / missing deps – run `npm install` in `navbar-app`.
* Port already occupied – find with `ss -ltnp | grep :5000`.
* Crashed during startup – look for stack trace in `server.out`.

### Firewall / Networking

If the service responds locally (`curl 127.0.0.1:5000/health` on the VM) but times out externally:

1. Add a network tag to the VM (one‑time):
```bash
gcloud compute instances add-tags hackathon-v3-vm --zone us-central1-a --tags=callback-server
```
2. Create (or verify) a firewall rule allowing TCP:5000 inbound:
```bash
gcloud compute firewall-rules create allow-callback-5000 \
	--allow=tcp:5000 \
	--target-tags=callback-server \
	--direction=INGRESS \
	--priority=1000
```
3. Re-test externally:
```bash
curl -m 4 http://34.58.198.143:5000/health
```

To list existing rules covering port 5000:
```bash
gcloud compute firewall-rules list --filter="allowed.protocol=tcp AND allowed.ports=5000"
```

### PowerShell Helpers (Local Convenience)

Run a minimal port diagnostic (starts `mini5000.js` remotely):
```powershell
pwsh scripts/diagnose-port.ps1
```

Restart full callback server (disables Mongo via NO_MONGO=1):
```powershell
pwsh scripts/restart-callback.ps1
```

### One-Step Provision (Create + Register + Start)

Linux VM (SSH):
```bash
cd ~/Hackathon-v3/navbar-app
bash scripts/provision-client-and-start.sh
```

PowerShell remote (from your workstation):
```powershell
pwsh .\navbar-app\scripts\provision-and-start.ps1
```

The provisioning scripts will abort starting the server if registration exits non‑zero, ensuring the callback server always runs with a valid, freshly registered client-config.

If `PORT_NOT_LISTENING` appears in either script's output, open `server.out` / `mini.out` on the VM for errors.

