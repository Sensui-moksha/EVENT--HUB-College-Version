/**
 * Cache Middleware
 * 
 * Express middleware for automatic response caching.
 * Supports conditional requests (If-None-Match) for bandwidth optimization.
 */

import serverCache, { CACHE_TTL, cacheKeys } from '../services/cacheService.js';

/**
 * Create a caching middleware for specific routes
 * @param {Object} options - Cache options
 * @param {string} options.key - Cache key generator function or string
 * @param {number} options.ttl - Time to live in seconds
 * @param {boolean} options.condition - Function to determine if request should be cached
 */
export const cacheMiddleware = (options = {}) => {
  const { ttl = CACHE_TTL.STATIC, keyFn = null, condition = null } = options;

  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Check condition if provided
    if (condition && !condition(req)) {
      return next();
    }

    // Generate cache key
    const cacheKey = keyFn ? keyFn(req) : `route:${req.originalUrl}`;

    // Check cache
    const cachedData = serverCache.get(cacheKey);
    
    if (cachedData) {
      // Check If-None-Match header for conditional requests
      const clientETag = req.headers['if-none-match'];
      if (clientETag && clientETag === cachedData.etag) {
        return res.status(304).end();
      }

      // Set cache headers
      res.set({
        'X-Cache': 'HIT',
        'ETag': cachedData.etag,
        'Cache-Control': `public, max-age=${ttl}`,
      });

      return res.json(cachedData.data);
    }

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to cache response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const etag = serverCache.generateETag(data);
        serverCache.set(cacheKey, { data, etag }, ttl);

        res.set({
          'X-Cache': 'MISS',
          'ETag': etag,
          'Cache-Control': `public, max-age=${ttl}`,
        });
      }

      return originalJson(data);
    };

    next();
  };
};

/**
 * Helper function to invalidate cache by key or pattern
 * @param {string|RegExp} keyOrPattern - Cache key or pattern to invalidate
 */
export const invalidateCache = (keyOrPattern) => {
  if (typeof keyOrPattern === 'string') {
    // If it looks like a pattern (contains * or regex chars), use pattern matching
    if (keyOrPattern.includes('*') || keyOrPattern.includes('^') || keyOrPattern.includes('$')) {
      const regexPattern = keyOrPattern.replace(/\*/g, '.*');
      return serverCache.invalidatePattern(new RegExp(regexPattern));
    }
    // Otherwise delete exact key
    return serverCache.del(keyOrPattern);
  }
  // If RegExp, use pattern matching
  return serverCache.invalidatePattern(keyOrPattern);
};

/**
 * Pre-configured cache middlewares for common routes
 */
export const routeCache = {
  // Events list (moderate caching)
  events: cacheMiddleware({
    ttl: CACHE_TTL.EVENTS_LIST,
    keyFn: (req) => {
      const query = JSON.stringify(req.query || {});
      return `events:list:${query}`;
    },
  }),

  // Single event (moderate caching)
  eventDetail: cacheMiddleware({
    ttl: CACHE_TTL.EVENT_DETAIL,
    keyFn: (req) => cacheKeys.events.detail(req.params.id || req.params.eventId),
  }),

  // Sub-events (moderate caching)
  subEvents: cacheMiddleware({
    ttl: CACHE_TTL.SUB_EVENTS,
    keyFn: (req) => cacheKeys.events.subEvents(req.params.eventId),
  }),

  // Galleries list (longer caching)
  galleries: cacheMiddleware({
    ttl: CACHE_TTL.GALLERIES_LIST,
    keyFn: (req) => {
      const query = JSON.stringify(req.query || {});
      return `galleries:list:${query}`;
    },
  }),

  // Gallery detail (moderate caching)
  galleryDetail: cacheMiddleware({
    ttl: CACHE_TTL.GALLERY_DETAIL,
    keyFn: (req) => cacheKeys.galleries.detail(req.params.eventId),
  }),

  // Gallery media (longer caching)
  galleryMedia: cacheMiddleware({
    ttl: CACHE_TTL.GALLERY_MEDIA,
    keyFn: (req) => cacheKeys.galleries.media(req.params.eventId),
  }),

  // Public galleries (longer caching)
  publicGalleries: cacheMiddleware({
    ttl: CACHE_TTL.GALLERIES_LIST,
    keyFn: () => cacheKeys.galleries.public(),
  }),

  // Analytics (shorter caching as data changes)
  analytics: cacheMiddleware({
    ttl: CACHE_TTL.ANALYTICS,
    keyFn: (req) => cacheKeys.events.analytics(req.params.eventId),
  }),

  // User list (admin only, moderate caching)
  users: cacheMiddleware({
    ttl: CACHE_TTL.USERS_LIST,
    keyFn: (req) => {
      const query = JSON.stringify(req.query || {});
      return `users:list:${query}`;
    },
  }),
};

/**
 * Cache invalidation middleware
 * Call after mutations to clear relevant caches
 */
export const invalidateCacheMiddleware = (invalidateFn) => {
  return (req, res, next) => {
    // Store original methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    // Override to invalidate cache on successful response
    const invalidateOnSuccess = (data) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          invalidateFn(serverCache, req);
        } catch (err) {
          console.error('[Cache] Invalidation error:', err);
        }
      }
    };

    res.json = (data) => {
      invalidateOnSuccess(data);
      return originalJson(data);
    };

    res.send = (data) => {
      invalidateOnSuccess(data);
      return originalSend(data);
    };

    next();
  };
};

export { serverCache, CACHE_TTL, cacheKeys };
