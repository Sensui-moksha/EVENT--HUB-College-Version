/**
 * Caching Strategy Service
 * 
 * Provides a unified caching interface that supports:
 * 1. Redis - Distributed caching (recommended for production)
 * 2. Node-Cache - Local in-memory caching (fallback)
 * 
 * Features:
 * - Automatic fallback from Redis to node-cache
 * - Transparent connection handling
 * - Statistics tracking
 * - TTL support for all backends
 * - Pattern-based invalidation
 * - Health monitoring
 */

import NodeCache from 'node-cache';
import redis from 'redis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('CachingStrategy');

class CachingStrategy {
  constructor() {
    this.redisClient = null;
    this.nodeCache = new NodeCache({
      stdTTL: 60,
      checkperiod: 120,
      useClones: false,
      deleteOnExpire: true,
      maxKeys: 10000,
    });

    this.isRedisAvailable = false;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      invalidations: 0,
      redisErrors: 0,
      fallbacks: 0,
    };

    this._initializeRedis();
    this._setupStatsReporting();
  }

  /**
   * Initialize Redis client with fallback handling
   * @private
   */
  _initializeRedis() {
    try {
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
      
      if (!redisUrl) {
        logger.info('Redis URL not configured. Using local node-cache.');
        return;
      }

      this.redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.warn('Max Redis reconnection attempts reached. Falling back to node-cache.');
              return new Error('Max retries exceeded');
            }
            return retries * 100;
          },
        },
      });

      // Handle Redis errors gracefully
      this.redisClient.on('error', (err) => {
        logger.error('Redis Connection Error:', err);
        this.stats.redisErrors++;
        this.isRedisAvailable = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
        this.isRedisAvailable = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Redis disconnected. Falling back to node-cache.');
        this.isRedisAvailable = false;
      });

      // Connect to Redis
      this.redisClient.connect().catch((err) => {
        logger.error('Failed to connect to Redis:', err.message);
        this.isRedisAvailable = false;
      });
    } catch (error) {
      logger.warn('Redis initialization failed:', error.message);
      this.isRedisAvailable = false;
    }
  }

  /**
   * Setup periodic statistics reporting
   * @private
   */
  _setupStatsReporting() {
    if (process.env.NODE_ENV !== 'production') {
      setInterval(() => {
        logger.info('Caching Statistics:', {
          ...this.stats,
          backend: this.isRedisAvailable ? 'Redis' : 'NodeCache',
          hitRate:
            this.stats.hits + this.stats.misses > 0
              ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
              : '0%',
        });
      }, 60000);
    }
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} Cached value or undefined
   */
  async get(key) {
    try {
      if (this.isRedisAvailable && this.redisClient) {
        try {
          const value = await this.redisClient.get(key);
          if (value !== null) {
            this.stats.hits++;
            // Parse JSON if it's stored as JSON
            try {
              return JSON.parse(value);
            } catch {
              return value;
            }
          }
        } catch (redisErr) {
          logger.warn(`Redis get error for key ${key}:`, redisErr.message);
          this.stats.fallbacks++;
          // Fall through to node-cache
        }
      }

      // Use node-cache as fallback or primary
      const value = this.nodeCache.get(key);
      if (value !== undefined) {
        this.stats.hits++;
        return value;
      }

      this.stats.misses++;
      return undefined;
    } catch (error) {
      logger.error('Cache get error:', error);
      this.stats.misses++;
      return undefined;
    }
  }

  /**
   * Set a value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - TTL in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async set(key, value, ttl = 60) {
    try {
      this.stats.sets++;

      // Always set in node-cache as primary/fallback
      this.nodeCache.set(key, value, ttl);

      // Try to set in Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          const serialized =
            typeof value === 'string' ? value : JSON.stringify(value);
          if (ttl) {
            await this.redisClient.setEx(key, ttl, serialized);
          } else {
            await this.redisClient.set(key, serialized);
          }
        } catch (redisErr) {
          logger.warn(`Redis set error for key ${key}:`, redisErr.message);
          this.stats.fallbacks++;
          // Still succeeded with node-cache
        }
      }

      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete a specific cache key
   * @param {string} key - Cache key
   * @returns {Promise<boolean>} Success status
   */
  async del(key) {
    try {
      this.stats.invalidations++;

      // Delete from node-cache
      this.nodeCache.del(key);

      // Delete from Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          await this.redisClient.del(key);
        } catch (redisErr) {
          logger.warn(`Redis delete error for key ${key}:`, redisErr.message);
          this.stats.fallbacks++;
        }
      }

      return true;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   * @param {string|RegExp} pattern - Pattern to match
   * @returns {Promise<number>} Number of keys deleted
   */
  async invalidatePattern(pattern) {
    try {
      let count = 0;
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

      // Invalidate in node-cache
      const nodeKeys = this.nodeCache.keys();
      for (const key of nodeKeys) {
        if (regex.test(key)) {
          this.nodeCache.del(key);
          count++;
        }
      }

      // Invalidate in Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          const keys = await this.redisClient.keys('*');
          const matchingKeys = keys.filter((key) => regex.test(key));
          if (matchingKeys.length > 0) {
            await this.redisClient.del(matchingKeys);
            count += matchingKeys.length;
          }
        } catch (redisErr) {
          logger.warn('Redis pattern invalidation error:', redisErr.message);
          this.stats.fallbacks++;
        }
      }

      this.stats.invalidations += count;
      return count;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    try {
      this.stats.invalidations++;

      // Flush node-cache
      this.nodeCache.flushAll();

      // Flush Redis if available
      if (this.isRedisAvailable && this.redisClient) {
        try {
          await this.redisClient.flushDb();
        } catch (redisErr) {
          logger.warn('Redis flush error:', redisErr.message);
          this.stats.fallbacks++;
        }
      }

      return true;
    } catch (error) {
      logger.error('Cache flush error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    const nodeStats = this.nodeCache.getStats();
    return {
      backend: this.isRedisAvailable ? 'Redis + NodeCache' : 'NodeCache',
      redisAvailable: this.isRedisAvailable,
      ...this.stats,
      nodeKeys: nodeStats.keys,
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2) + '%'
          : '0%',
    };
  }

  /**
   * Check Redis health
   * @returns {Promise<boolean>} Health status
   */
  async healthCheck() {
    if (!this.isRedisAvailable || !this.redisClient) {
      return { redis: false, nodeCache: true };
    }

    try {
      await this.redisClient.ping();
      return { redis: true, nodeCache: true };
    } catch (error) {
      logger.warn('Redis health check failed:', error.message);
      return { redis: false, nodeCache: true };
    }
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
   * Close Redis connection gracefully
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.redisClient) {
      try {
        await this.redisClient.quit();
        logger.info('Redis disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting from Redis:', error);
      }
    }
  }
}

// Singleton instance
const cachingStrategy = new CachingStrategy();

export default cachingStrategy;
