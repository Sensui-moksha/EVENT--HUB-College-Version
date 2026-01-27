// Service Worker for offline caching of static assets and media
// High Performance Edition with Video Streaming Support
const CACHE_NAME = 'eventhub-v3';
const MEDIA_CACHE_NAME = 'eventhub-media-v2';
const VIDEO_CACHE_NAME = 'eventhub-video-v1';
const API_CACHE_NAME = 'eventhub-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/logo-small.png',
  '/logo-mic.png',
  '/favicon.svg',
];

// Max cache sizes
const MAX_MEDIA_CACHE_SIZE = 500 * 1024 * 1024; // 500MB for images
const MAX_VIDEO_CACHE_SIZE = 1024 * 1024 * 1024; // 1GB for videos
const MAX_API_CACHE_SIZE = 50 * 1024 * 1024; // 50MB for API responses

// Cache invalidation timestamps
let cacheInvalidationTimes = {
  events: 0,
  registrations: 0,
  gallery: 0,
  media: 0,
  user: 0,
  teams: 0,
  waitlist: 0
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('Some assets failed to cache:', err);
          return Promise.resolve();
        });
      }),
      // Pre-create other caches
      caches.open(VIDEO_CACHE_NAME),
      caches.open(API_CACHE_NAME)
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const allowedCaches = [CACHE_NAME, MEDIA_CACHE_NAME, VIDEO_CACHE_NAME, API_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!allowedCaches.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Helper to check if request is for gallery media (images/videos)
const isGalleryMedia = (url) => {
  return url.pathname.includes('/api/gallery/media/');
};

// Helper to check if it's a video request
const isVideoRequest = (url, contentType) => {
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'];
  return url.pathname.includes('/api/gallery/media/') && 
    (contentType?.includes('video') || 
     videoExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)));
};

// Helper to check if it's an image request
const isImageRequest = (url) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  return imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) ||
    url.pathname.includes('/thumbnail/');
};

// Helper to check if it's an API request
const isApiRequest = (url) => {
  return url.pathname.startsWith('/api/') && !isGalleryMedia(url);
};

// Get appropriate cache for request type
const getCacheForRequest = (url) => {
  if (isVideoRequest(url)) return VIDEO_CACHE_NAME;
  if (isGalleryMedia(url) || isImageRequest(url)) return MEDIA_CACHE_NAME;
  if (isApiRequest(url)) return API_CACHE_NAME;
  return CACHE_NAME;
};

// Trim media cache if it gets too large
const trimMediaCache = async () => {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const keys = await cache.keys();
  let totalSize = 0;
  const entries = [];
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.clone().blob();
      entries.push({ request, size: blob.size, date: response.headers.get('date') || Date.now() });
      totalSize += blob.size;
    }
  }
  
  // If over limit, remove oldest entries until under 80% of limit
  if (totalSize > MAX_MEDIA_CACHE_SIZE) {
    entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    const targetSize = MAX_MEDIA_CACHE_SIZE * 0.8;
    
    while (totalSize > targetSize && entries.length > 0) {
      const oldest = entries.shift();
      await cache.delete(oldest.request);
      totalSize -= oldest.size;
    }
  }
};

// Trim video cache with LRU eviction
const trimVideoCache = async () => {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const keys = await cache.keys();
  let totalSize = 0;
  const entries = [];
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.clone().blob();
      const accessTime = parseInt(response.headers.get('x-last-access') || '0') || Date.now();
      entries.push({ request, size: blob.size, accessTime });
      totalSize += blob.size;
    }
  }
  
  if (totalSize > MAX_VIDEO_CACHE_SIZE) {
    // Sort by last access time (LRU)
    entries.sort((a, b) => a.accessTime - b.accessTime);
    const targetSize = MAX_VIDEO_CACHE_SIZE * 0.7;
    
    while (totalSize > targetSize && entries.length > 0) {
      const oldest = entries.shift();
      await cache.delete(oldest.request);
      totalSize -= oldest.size;
    }
  }
};

// Handle video range requests for smooth streaming
const handleVideoRangeRequest = async (request) => {
  const cache = await caches.open(VIDEO_CACHE_NAME);
  const cachedResponse = await cache.match(request, { ignoreSearch: true });
  
  // Get range header
  const range = request.headers.get('range');
  
  if (cachedResponse && range) {
    const blob = await cachedResponse.blob();
    const size = blob.size;
    
    // Parse range header (e.g., "bytes=0-1023")
    const [start, end] = range.replace(/bytes=/, '').split('-').map(Number);
    const chunkEnd = end || Math.min(start + 1024 * 1024, size - 1); // 1MB chunks
    const chunk = blob.slice(start, chunkEnd + 1);
    
    return new Response(chunk, {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': cachedResponse.headers.get('Content-Type') || 'video/mp4',
        'Content-Range': `bytes ${start}-${chunkEnd}/${size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk.size,
        'Cache-Control': 'public, max-age=31536000',
      }
    });
  }
  
  // Not in cache or no range request, fetch from network
  try {
    const response = await fetch(request);
    
    // Clone and cache the full video for future range requests
    if (response.ok && response.headers.get('content-type')?.includes('video')) {
      const cloned = response.clone();
      // Add last access time header
      const headers = new Headers(cloned.headers);
      headers.set('x-last-access', Date.now().toString());
      
      const newResponse = new Response(await cloned.blob(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers
      });
      
      cache.put(request, newResponse).then(() => trimVideoCache());
    }
    
    return response;
  } catch (err) {
    // If network fails and we have cached version, return it
    if (cachedResponse) {
      return cachedResponse;
    }
    throw err;
  }
};

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle video requests with range support
  if (isVideoRequest(url)) {
    event.respondWith(handleVideoRangeRequest(request));
    return;
  }

  // Handle gallery media (images and videos) - Cache with stale-while-revalidate
  if (isGalleryMedia(url)) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        
        // Fetch from network in background
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // Clone and cache the response
            cache.put(request, networkResponse.clone());
            // Trim cache periodically
            trimMediaCache();
          }
          return networkResponse;
        }).catch(() => null);
        
        // Return cached response immediately if available
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Otherwise wait for network
        return fetchPromise;
      })
    );
    return;
  }

  // Skip other API requests - let them go to network
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // For images and static assets, try cache first, then network
  if (request.destination === 'image' || 
      url.pathname.startsWith('/logo') || 
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.jpeg')) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            // If network fails and no cache, return offline placeholder
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-family="sans-serif" font-size="12" fill="#999">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            return caches.match('/index.html');
          });
      })
    );
    return;
  }

  // For HTML documents, try network first, fallback to cache
  if (request.destination === 'document' || request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((response) => {
            return response || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For other requests, try cache first
  event.respondWith(
    caches.match(request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(request).catch(() => {
        return caches.match('/index.html');
      });
    })
  );
});

// Listen for messages to clear/invalidate caches
self.addEventListener('message', (event) => {
  const { data } = event;
  if (!data) return;

  switch (data.type) {
    case 'CLEAR_MEDIA_CACHE':
      caches.delete(MEDIA_CACHE_NAME).then(() => {
        console.log('[SW] Media cache cleared');
      });
      break;

    case 'CLEAR_VIDEO_CACHE':
      caches.delete(VIDEO_CACHE_NAME).then(() => {
        console.log('[SW] Video cache cleared');
      });
      break;

    case 'CLEAR_API_CACHE':
      caches.delete(API_CACHE_NAME).then(() => {
        console.log('[SW] API cache cleared');
      });
      break;

    case 'CLEAR_ALL_CACHE':
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          console.log('[SW] All caches cleared');
          // Re-initialize static cache
          caches.open(CACHE_NAME).then((cache) => {
            cache.addAll(STATIC_ASSETS);
          });
        });
      });
      break;

    case 'INVALIDATE_CACHE':
      // Immediate cache invalidation based on type
      const { cacheType, timestamp } = data;
      cacheInvalidationTimes[cacheType] = timestamp;
      
      switch (cacheType) {
        case 'gallery':
        case 'media':
          // Clear specific media caches
          caches.open(MEDIA_CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
              keys.forEach((request) => {
                cache.delete(request);
              });
            });
          });
          break;
        case 'events':
        case 'registrations':
        case 'teams':
        case 'waitlist':
          // Clear API cache for these types
          caches.open(API_CACHE_NAME).then((cache) => {
            cache.keys().then((keys) => {
              keys.forEach((request) => {
                if (request.url.includes(`/api/${cacheType}`)) {
                  cache.delete(request);
                }
              });
            });
          });
          break;
      }
      console.log(`[SW] Cache invalidated for: ${cacheType}`);
      break;

    case 'PREFETCH_VIDEO':
      // Prefetch video into cache for smooth playback
      if (data.url) {
        caches.open(VIDEO_CACHE_NAME).then((cache) => {
          fetch(data.url).then((response) => {
            if (response.ok) {
              cache.put(data.url, response);
              console.log('[SW] Video prefetched:', data.url);
            }
          }).catch(() => {
            console.warn('[SW] Failed to prefetch video:', data.url);
          });
        });
      }
      break;

    case 'GET_CACHE_STATUS':
      // Report cache status back to client
      Promise.all([
        caches.open(CACHE_NAME).then(c => c.keys()).then(k => k.length),
        caches.open(MEDIA_CACHE_NAME).then(c => c.keys()).then(k => k.length),
        caches.open(VIDEO_CACHE_NAME).then(c => c.keys()).then(k => k.length),
        caches.open(API_CACHE_NAME).then(c => c.keys()).then(k => k.length)
      ]).then(([static_, media, video, api]) => {
        event.source?.postMessage({
          type: 'CACHE_STATUS',
          counts: { static: static_, media, video, api },
          invalidationTimes: cacheInvalidationTimes
        });
      });
      break;
  }
});

// Periodic cache cleanup
setInterval(() => {
  trimMediaCache();
  trimVideoCache();
}, 5 * 60 * 1000); // Every 5 minutes
