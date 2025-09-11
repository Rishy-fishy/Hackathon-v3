// Utility to resolve the callback server base URL in various environments.
// Priority:
// 1. window.__CALLBACK_BASE injected at runtime via public/runtime-config.js
// 2. REACT_APP_CALLBACK_BASE env variable at build time
// 3. If current origin port is 3001 (React dev) assume callback on same host:5000
// 4. Fallback to hardcoded public IP (update if your VM IP changes)
const PUBLIC_FALLBACK = 'http://34.58.198.143:5000';

export function resolveCallbackBase() {
  if (typeof window !== 'undefined') {
    if (window.__CALLBACK_BASE) return window.__CALLBACK_BASE.replace(/\/$/, '');
    const envBase = process.env.REACT_APP_CALLBACK_BASE;
    if (envBase) return envBase.replace(/\/$/, '');
    try {
      const url = new URL(window.location.href);
      if (url.port === '3001' || url.port === '3000') {
        return `${url.protocol}//${url.hostname}:5000`;
      }
    } catch {/* ignore */}
  }
  return PUBLIC_FALLBACK;
}

export default resolveCallbackBase;
