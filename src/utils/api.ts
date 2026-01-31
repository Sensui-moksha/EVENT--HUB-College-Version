/**
 * API Configuration Module - Single Source of Truth
 * High Performance Edition with Write-Through Caching
 * 
 * ⚠️ CORE PRINCIPLE:
 * Automatically detects the correct API URL based on how you access the site.
 * - If accessing via localhost, API uses localhost
 * - If accessing via LAN IP (192.168.x.x), API uses that same IP
 * - In production, uses VITE_API_BASE_URL or same origin
 * 
 * Environment Variable (Optional):
 * - VITE_API_BASE_URL: Override with custom backend URL
 * 
 * Features:
 * - Intelligent caching with TTL support
 * - Write-through caching for immediate updates
 * - Optimistic updates for instant UI feedback
 * - Stale-while-revalidate pattern for fast rendering
 * - Request deduplication to prevent duplicate fetches
 */

import { cacheManager, CACHE_TTL, invalidateCache } from './cacheManager';

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Get the API base URL dynamically based on current access method
 * This allows the same build to work on localhost AND LAN without changes
 * 
 * @returns Backend base URL without trailing slash
 */
export const getApiBaseUrl = (): string => {
  // 1. First priority: Explicit environment variable override
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  
  // Only use env variable if it's NOT localhost and we're accessing via IP
  // This allows LAN access to work even if .env has localhost
  const currentHostname = window.location.hostname;
  const isAccessingViaIP = currentHostname !== 'localhost' && currentHostname !== '127.0.0.1';
  const envIsLocalhost = envApiUrl && (envApiUrl.includes('localhost') || envApiUrl.includes('127.0.0.1'));
  
  // If accessing via IP but env has localhost, use dynamic URL instead
  if (isAccessingViaIP && envIsLocalhost) {
    const port = import.meta.env.VITE_BACKEND_PORT || '5001';
    const protocol = window.location.protocol;
    return `${protocol}//${currentHostname}:${port}`;
  }
  
  // Use env variable if it's set and not the localhost override case
  if (envApiUrl) {
    return envApiUrl.replace(/\/$/, '');
  }
  
  // 2. Production: Use same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  
  // 3. Development fallback: Use current hostname with backend port
  const port = import.meta.env.VITE_BACKEND_PORT || '5001';
  const protocol = window.location.protocol;
  return `${protocol}//${currentHostname}:${port}`;
};

// Cache API base URL (evaluated once at startup)
export const API_BASE_URL = getApiBaseUrl();

// Log the API URL for debugging
// ...removed console log for production...

/**
 * Helper function to build full API URLs
 * Ensures consistent path construction across the app
 * 
 * @param path - API endpoint path (should start with / or /api/)
 * @returns Full API URL
 * 
 * @example
 * getApiUrl('/api/events') -> 'https://events.mictech.dpdns.org/api/events'
 * getApiUrl('/events') -> 'https://events.mictech.dpdns.org/events'
 */
export const getApiUrl = (path: string): string => {
  // Don't strip leading slash - paths should include full path like /api/events
  return `${API_BASE_URL}${path}`;
};

/**
 * Get WebSocket URL for Socket.io connections
 * Socket.io server runs on same backend as REST API
 * 
 * @returns Socket.io server URL (same as API_BASE_URL)
 */
export const getSocketUrl = (): string => {
  // Socket.io and REST API share the same backend server
  // So they use the same VITE_API_BASE_URL environment variable
  return API_BASE_URL;
};

/**
 * Centralized API request wrapper with error handling
 * Use this for all fetch calls to ensure consistent:
 * - Headers (Content-Type, Authorization)
 * - Error handling and logging
 * - Response parsing
 * - CORS handling
 * 
 * @param endpoint - API endpoint path or full URL
 * @param options - Fetch options
 * @returns Parsed JSON response
 * 
 * @example
 * const data = await apiRequest('/api/events');
 * const user = await apiRequest('/api/login', {
 *   method: 'POST',
 *   body: JSON.stringify({ email, password })
 * });
 */
export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  try {
    // Build full URL if relative path is provided
    const url = endpoint.startsWith('http') ? endpoint : getApiUrl(endpoint);

    // Default headers
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Use session cookies for authentication
    });

    // Parse response
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      const error = data?.error || `HTTP ${response.status}: ${response.statusText}`;
      console.error(`API Error (${url}):`, error);
      throw new Error(error);
    }

    return data;
  } catch (error) {
    console.error(`API Request failed (${endpoint}):`, error);
    throw error;
  }
};

/**
 * Cached API request options
 */
interface CachedRequestOptions extends RequestInit {
  cacheKey?: string;
  ttl?: number;
  forceRefresh?: boolean;
  staleWhileRevalidate?: boolean;
  deduplicate?: boolean; // Prevent duplicate in-flight requests
}

/**
 * Cached API request wrapper with request deduplication
 * Uses caching for GET requests to improve performance
 * 
 * @param endpoint - API endpoint
 * @param options - Request options including cache settings
 * @returns Cached or fresh data
 */
export const cachedApiRequest = async <T = any>(
  endpoint: string,
  options: CachedRequestOptions = {}
): Promise<T> => {
  const { 
    cacheKey, 
    ttl = CACHE_TTL.EVENTS, 
    forceRefresh = false, 
    staleWhileRevalidate = true, 
    deduplicate = true,
    ...fetchOptions 
  } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  
  // Only cache GET requests
  if (method !== 'GET') {
    return apiRequest(endpoint, fetchOptions);
  }
  
  const key = cacheKey || `api_${endpoint}`;
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const { data, isStale } = cacheManager.getStale<T>(key);
    
    if (data !== null) {
      if (!isStale) {
        // Fresh data - return immediately
        return data;
      }
      
      if (staleWhileRevalidate) {
        // Return stale data immediately, refresh in background
        // Check if there's already a pending request
        if (!pendingRequests.has(key)) {
          const refreshPromise = apiRequest(endpoint, fetchOptions)
            .then((freshData) => {
              cacheManager.set(key, freshData, { ttl });
              pendingRequests.delete(key);
              return freshData;
            })
            .catch((err) => {
              console.warn('Background refresh failed:', err);
              pendingRequests.delete(key);
              throw err;
            });
          pendingRequests.set(key, refreshPromise);
        }
        return data;
      }
    }
  }
  
  // Request deduplication - return existing pending request
  if (deduplicate && pendingRequests.has(key)) {
    return pendingRequests.get(key) as Promise<T>;
  }
  
  // Fetch fresh data
  const fetchPromise = apiRequest(endpoint, fetchOptions)
    .then((freshData) => {
      cacheManager.set(key, freshData, { ttl });
      pendingRequests.delete(key);
      return freshData;
    })
    .catch((err) => {
      pendingRequests.delete(key);
      throw err;
    });
  
  if (deduplicate) {
    pendingRequests.set(key, fetchPromise);
  }
  
  return fetchPromise;
};

/**
 * Batch request helper - fetches multiple endpoints in parallel with caching
 */
export const batchCachedRequests = async <T extends Record<string, any>>(
  requests: { [K in keyof T]: { endpoint: string; options?: CachedRequestOptions } }
): Promise<T> => {
  const entries = Object.entries(requests) as [keyof T, { endpoint: string; options?: CachedRequestOptions }][];
  const results = await Promise.all(
    entries.map(([_, req]) => cachedApiRequest(req.endpoint, req.options))
  );
  
  return Object.fromEntries(
    entries.map(([key], index) => [key, results[index]])
  ) as T;
};

/**
 * Mutation API request - for POST, PUT, DELETE operations
 * Automatically invalidates relevant caches after mutation
 */
export const mutationApiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {},
  cacheInvalidation?: () => void
): Promise<T> => {
  const result = await apiRequest(endpoint, options);
  
  // Invalidate caches immediately after successful mutation
  if (cacheInvalidation) {
    cacheInvalidation();
  }
  
  return result;
};

/**
 * Optimistic mutation API request - updates UI immediately, rolls back on error
 */
export const optimisticMutationRequest = async <T = any>(
  endpoint: string,
  options: RequestInit,
  optimisticConfig: {
    cacheKey: string;
    optimisticData: T;
    cacheInvalidation?: () => void;
  }
): Promise<T> => {
  const { cacheKey, optimisticData, cacheInvalidation } = optimisticConfig;
  const { rollback } = cacheManager.optimisticUpdate(cacheKey, optimisticData);
  
  try {
    const result = await apiRequest(endpoint, options);
    // Update cache with actual server response
    cacheManager.set(cacheKey, result);
    if (cacheInvalidation) {
      cacheInvalidation();
    }
    return result;
  } catch (error) {
    // Rollback on error
    rollback();
    throw error;
  }
};

/**
 * Prefetch helper - loads data into cache before it's needed
 */
export const prefetchApiRequest = <T = any>(
  endpoint: string,
  options: CachedRequestOptions = {}
): void => {
  const { cacheKey, ttl = CACHE_TTL.EVENTS, ...fetchOptions } = options;
  const key = cacheKey || `api_${endpoint}`;
  
  // Don't prefetch if already cached
  const existing = cacheManager.get(key);
  if (existing !== null) return;
  
  // Don't prefetch if already pending
  if (pendingRequests.has(key)) return;
  
  // Fetch in background
  const fetchPromise = apiRequest(endpoint, fetchOptions)
    .then((data) => {
      cacheManager.set(key, data, { ttl });
      pendingRequests.delete(key);
      return data;
    })
    .catch((err) => {
      pendingRequests.delete(key);
      console.warn('Prefetch failed:', err);
    });
  
  pendingRequests.set(key, fetchPromise);
};

/**
 * Video prefetch helper - tells service worker to prefetch video
 */
export const prefetchVideo = (videoUrl: string): void => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'PREFETCH_VIDEO',
      url: videoUrl
    });
  }
};

