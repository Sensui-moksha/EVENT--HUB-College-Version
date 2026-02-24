/**
 * Global Fetch Interceptor
 * 
 * Patches window.fetch to automatically:
 * 1. Inject the `x-user-id` header on every `/api/` request
 * 2. Ensure `credentials: 'include'` is set so session cookies are sent
 *
 * This ensures the server-side `requireAuth` middleware can identify the user
 * even when session cookies are lost behind reverse proxies / CDNs
 * (Cloudflare, Coolify, etc.).
 *
 * Import this module once in main.tsx — side-effect only.
 */

import { getAuthHeaders } from './api';

const originalFetch = window.fetch;

window.fetch = function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Determine the URL string
  let url: string;
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else if (input instanceof Request) {
    url = input.url;
  } else {
    url = String(input);
  }

  // Only inject auth headers for our own API calls
  const isApiCall = url.includes('/api/');

  if (isApiCall) {
    // Ensure credentials are always sent for API calls (session cookies)
    if (!init) init = {};
    if (!init.credentials) {
      init.credentials = 'include';
    }

    const authHeaders = getAuthHeaders();
    if (Object.keys(authHeaders).length > 0) {
      const existingHeaders = new Headers(init.headers);
      // Don't overwrite if already set (e.g. by apiRequest or manual calls)
      for (const [key, value] of Object.entries(authHeaders)) {
        if (!existingHeaders.has(key)) {
          existingHeaders.set(key, value);
        }
      }

      init = {
        ...init,
        headers: existingHeaders,
      };
    }
  }

  return originalFetch.call(window, input, init);
};
