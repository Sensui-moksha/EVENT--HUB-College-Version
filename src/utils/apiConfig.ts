// Dynamic API configuration that works automatically on any domain
// Supports localhost, LAN, and production deployment (worldwide web)
const getApiBaseUrl = (): string => {
  // 1. First priority: Environment variable (for custom backend URL)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Production: Use the same origin (domain) as the website
  // This works automatically when frontend and backend are on same domain
  if (import.meta.env.PROD) {
    // If backend is on same domain, use origin
    // If backend is on different domain, set VITE_API_URL in .env.production
    return window.location.origin;
  }
  
  // 3. Development: Use current hostname with backend port
  const hostname = window.location.hostname;
  const port = import.meta.env.VITE_BACKEND_PORT || '5001'; // Backend port from env or default
  const protocol = window.location.protocol;
  
  return `${protocol}//${hostname}:${port}`;
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const getApiUrl = (path: string): string => {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_BASE_URL}/${cleanPath}`;
};

// Helper to get WebSocket URL (for Socket.io)
export const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // In production, use same origin
  if (import.meta.env.PROD) {
    return window.location.origin;
  }
  
  // In development, use backend URL
  return API_BASE_URL;
};
