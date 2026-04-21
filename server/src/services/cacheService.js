/**
 * Server-side Cache Service
 * 
 * Provides centralized caching for API responses to handle high traffic (1000+ users).
 * Supports both Redis (distributed) and node-cache (local) with automatic fallback.
 * 
 * Features:
 * - Redis support with automatic fallback to node-cache
 * - In-memory caching with configurable TTL
 * - Cache invalidation by key or pattern
 * - ETag support for conditional requests
 * - Statistics tracking
 * - Automatic cleanup of expired entries
 * 
 * Configuration:
 * - Set REDIS_URL or REDIS_CONNECTION_STRING env var to use Redis
 * - Falls back to node-cache if Redis is unavailable
 */

import cachingStrategy from './cachingStrategy.js';

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
    this.strategy = cachingStrategy;
  }

  /**
   * Get cached value (sync wrapper for node-cache)
   * @param {string} key - Cache key
   * @returns {any} Cached value or undefined
   */
  get(key) {
    // Synchronous wrapper - returns from node-cache immediately
    // For Redis + async usage, use getAsync()
    if (this.strategy.nodeCache) {
      return this.strategy.nodeCache.get(key);
    }
    return undefined;
  }

  /**
   * Get cached value (async version with Redis support)
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or undefined
   */
  async getAsync(key) {
    return await this.strategy.get(key);
  }

  /**
   * Set cached value (sync wrapper for node-cache)
   * Also queues Redis set asynchronously
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional)
   */
  set(key, value, ttl) {
    // Synchronous set to node-cache
    if (this.strategy.nodeCache) {
      if (ttl) {
        this.strategy.nodeCache.set(key, value, ttl);
      } else {
        this.strategy.nodeCache.set(key, value);
      }
    }
    // Async set to Redis (fire and forget)
    this.strategy.set(key, value, ttl).catch(err => {
      console.error(`Error setting cache key ${key}:`, err.message);
    });
  }

  /**
   * Set cached value (async version with full Redis support)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional)
   * @returns {Promise<boolean>}
   */
  async setAsync(key, value, ttl) {
    return await this.strategy.set(key, value, ttl);
  }

  /**
   * Delete specific cache key
   * @param {string} key - Cache key
   */
  del(key) {
    // Async delete (fire and forget)
    this.strategy.del(key).catch(err => {
      console.error(`Error deleting cache key ${key}:`, err.message);
    });
  }

  /**
   * Delete specific cache key (async version)
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async delAsync(key) {
    return await this.strategy.del(key);
  }

  /**
   * Delete all keys matching a pattern
   * @param {string|RegExp} pattern - Pattern to match
   */
  invalidatePattern(pattern) {
    // Async invalidation (fire and forget)
    this.strategy.invalidatePattern(pattern).catch(err => {
      console.error('Error invalidating pattern:', err.message);
    });
  }

  /**
   * Delete all keys matching a pattern (async version)
   * @param {string|RegExp} pattern - Pattern to match
   * @returns {Promise<number>}
   */
  async invalidatePatternAsync(pattern) {
    return await this.strategy.invalidatePattern(pattern);
  }

  /**
   * Clear all cache
   */
  flush() {
    // Async flush (fire and forget)
    this.strategy.flush().catch(err => {
      console.error('Error flushing cache:', err.message);
    });
  }

  /**
   * Clear all cache (async version)
   * @returns {Promise<boolean>}
   */
  async flushAsync() {
    return await this.strategy.flush();
  }

  /**
   * Generate ETag for value
   * @param {any} value - Value to hash
   * @returns {string} ETag hash
   */
  generateETag(value) {
    return this.strategy.generateETag(value);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.strategy.stats;
  }

  /**
   * Get cache statistics (async version with Redis info)
   * @returns {Promise<Object>}
   */
  async getStatsAsync() {
    return await this.strategy.getStats();
  }

  /**
   * Check cache health
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return await this.strategy.healthCheck();
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
