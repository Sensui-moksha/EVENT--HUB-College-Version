/**
 * Server-side Cache Service
 * 
 * Provides centralized caching for API responses to handle high traffic (1000+ users).
 * Uses node-cache for in-memory caching with TTL support.
 * 
 * Features:
 * - In-memory caching with configurable TTL
 * - Cache invalidation by key or pattern
 * - ETag support for conditional requests
 * - Statistics tracking
 * - Automatic cleanup of expired entries
 */

import NodeCache from 'node-cache';

// TTL values in seconds
export const CACHE_TTL = {
  EVENTS_LIST: 30,        // 30 seconds - events list
  EVENT_DETAIL: 60,       // 1 minute - single event
  SUB_EVENTS: 60,         // 1 minute - sub-events
  REGISTRATIONS: 15,      // 15 seconds - registrations (changes frequently)
  GALLERIES_LIST: 120,    // 2 minutes - galleries list
  GALLERY_DETAIL: 60,     // 1 minute - single gallery
  GALLERY_MEDIA: 300,     // 5 minutes - media rarely changes
  USERS_LIST: 60,         // 1 minute - user list
  ANALYTICS: 30,          // 30 seconds - analytics data
  STATIC: 600,            // 10 minutes - static content
};

class ServerCacheService {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 60, // Default TTL: 1 minute
      checkperiod: 120, // Check for expired keys every 2 minutes
      useClones: false, // Don't clone data for performance
      deleteOnExpire: true,
      maxKeys: 10000, // Max 10k cached items
    });

    // Track cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
    };

    // Log cache stats periodically in development
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        const cacheStats = this.cache.getStats();
        console.log('Cache Stats:', {
          ...this.stats,
          keys: cacheStats.keys,
          hits: cacheStats.hits,
          misses: cacheStats.misses,
          ksize: cacheStats.ksize,
          vsize: cacheStats.vsize,
        });
      }, 60000); // Log every minute
    }
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Set cached value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional)
   */
  set(key, value, ttl) {
    this.stats.sets++;
    if (ttl) {
      return this.cache.set(key, value, ttl);
    }
    return this.cache.set(key, value);
  }

  /**
   * Delete specific cache key
   * @param {string} key - Cache key
   */
  del(key) {
    this.stats.invalidations++;
    return this.cache.del(key);
  }

  /**
   * Delete all keys matching a pattern
   * @param {string|RegExp} pattern - Pattern to match
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const keys = this.cache.keys();
    let count = 0;
    
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.del(key);
        count++;
      }
    }
    
    this.stats.invalidations += count;
    return count;
  }

  /**
   * Clear all cache
   */
  flush() {
    this.stats.invalidations++;
    this.cache.flushAll();
  }

  /**
   * Generate ETag for value
   * @param {any} value - Value to hash
   * @returns {string} ETag hash
   */
  generateETag(value) {
    const str = JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(16)}"`;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const nodeStats = this.cache.getStats();
    return {
      ...this.stats,
      keys: nodeStats.keys,
      hitRate: this.stats.hits + this.stats.misses > 0
        ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) + '%'
        : '0%',
    };
  }
}

// Cache key generators
export const cacheKeys = {
  events: {
    list: () => 'events:list',
    detail: (id) => `events:detail:${id}`,
    subEvents: (id) => `events:${id}:subevents`,
    analytics: (id) => `events:${id}:analytics`,
  },
  registrations: {
    list: () => 'registrations:list',
    byEvent: (eventId) => `registrations:event:${eventId}`,
    byUser: (userId) => `registrations:user:${userId}`,
  },
  galleries: {
    list: () => 'galleries:list',
    detail: (eventId) => `galleries:detail:${eventId}`,
    media: (eventId) => `galleries:${eventId}:media`,
    public: () => 'galleries:public',
  },
  users: {
    list: () => 'users:list',
    detail: (id) => `users:detail:${id}`,
  },
};

// Cache invalidation helpers
export const invalidateCache = {
  // Invalidate event-related caches
  onEventChange: (cache, eventId) => {
    cache.del(cacheKeys.events.list());
    if (eventId) {
      cache.del(cacheKeys.events.detail(eventId));
      cache.del(cacheKeys.events.subEvents(eventId));
      cache.del(cacheKeys.events.analytics(eventId));
    }
  },

  // Invalidate registration-related caches
  onRegistrationChange: (cache, eventId, userId) => {
    cache.del(cacheKeys.registrations.list());
    if (eventId) {
      cache.del(cacheKeys.registrations.byEvent(eventId));
      cache.del(cacheKeys.events.detail(eventId)); // Participant count changed
    }
    if (userId) {
      cache.del(cacheKeys.registrations.byUser(userId));
    }
  },

  // Invalidate gallery-related caches
  onGalleryChange: (cache, eventId) => {
    cache.del(cacheKeys.galleries.list());
    cache.del(cacheKeys.galleries.public());
    if (eventId) {
      cache.del(cacheKeys.galleries.detail(eventId));
      cache.del(cacheKeys.galleries.media(eventId));
    }
  },

  // Invalidate user-related caches
  onUserChange: (cache, userId) => {
    cache.del(cacheKeys.users.list());
    if (userId) {
      cache.del(cacheKeys.users.detail(userId));
    }
  },

  // Clear all caches
  all: (cache) => {
    cache.flush();
  },
};

// Singleton instance
const serverCache = new ServerCacheService();

export default serverCache;
