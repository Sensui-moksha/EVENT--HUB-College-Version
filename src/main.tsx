import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './utils/swRegister.ts';
// Patch window.fetch to inject auth headers for API calls
import './utils/fetchInterceptor.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for offline support and static asset caching
registerServiceWorker();
