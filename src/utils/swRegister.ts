/**
 * Service Worker Registration
 * Registers the service worker for offline caching of static assets including logos and favicon
 */

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // ...removed console log for production...
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch((error) => {
          console.warn('Service Worker registration failed:', error);
        });
    });

    // Handle service worker updates
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // ...removed console log for production...
      // You can show a notification to users about the update
    });
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
  }
}
