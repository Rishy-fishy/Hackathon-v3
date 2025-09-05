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

