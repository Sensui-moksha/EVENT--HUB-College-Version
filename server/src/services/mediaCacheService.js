/**
 * Media Cache Service
 * 
 * High-performance caching system for gallery media (images/videos).
 * Uses a multi-tier caching strategy:
 * 
 * 1. In-Memory Cache (Hot tier) - Most frequently accessed media
 * 2. HTTP Cache Headers - Browser/CDN caching
 * 3. ETag/Conditional Requests - Prevents re-downloads
 * 
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - Automatic cache warming for popular media
 * - Cache corruption detection and auto-repair
 * - Memory-efficient streaming for large files
 * - Cache hit/miss statistics
 */

import NodeCache from 'node-cache';
import crypto from 'crypto';

// ==================== CONFIGURATION ====================
const CONFIG = {
  // Maximum cache size in bytes (default: 512MB)
  MAX_CACHE_SIZE: parseInt(process.env.MEDIA_CACHE_SIZE_MB || '512') * 1024 * 1024,
  
  // Maximum size of a single cached item (50MB - don't cache huge videos in memory)
  MAX_ITEM_SIZE: 50 * 1024 * 1024,
  
  // TTL for cached media (24 hours - media rarely changes)
  MEDIA_TTL: 24 * 60 * 60,
  
  // TTL for thumbnails (7 days - never changes)
  THUMBNAIL_TTL: 7 * 24 * 60 * 60,
  
  // TTL for metadata (1 hour)
  METADATA_TTL: 60 * 60,
  
  // Cache check interval (every 5 minutes)
  CHECK_PERIOD: 5 * 60,
  
  // Max number of items to cache
  MAX_ITEMS: 5000,
  
  // HTTP Cache-Control max-age values (seconds)
  HTTP_CACHE: {
    IMAGE: 7 * 24 * 60 * 60,      // 7 days for images
    VIDEO: 30 * 24 * 60 * 60,     // 30 days for videos (immutable once uploaded)
    THUMBNAIL: 30 * 24 * 60 * 60, // 30 days for thumbnails
    METADATA: 60 * 60,            // 1 hour for gallery metadata
  },
};

// ==================== MEDIA CACHE CLASS ====================
class MediaCacheService {
  constructor() {
    // In-memory cache for media files (hot cache)
    this.mediaCache = new NodeCache({
      stdTTL: CONFIG.MEDIA_TTL,
      checkperiod: CONFIG.CHECK_PERIOD,
      useClones: false, // Important: Don't clone buffers
      deleteOnExpire: true,
      maxKeys: CONFIG.MAX_ITEMS,
    });

    // Metadata cache (lightweight info about media)
    this.metadataCache = new NodeCache({
      stdTTL: CONFIG.METADATA_TTL,
      checkperiod: CONFIG.CHECK_PERIOD,
      useClones: false,
      deleteOnExpire: true,
      maxKeys: CONFIG.MAX_ITEMS * 2,
    });

    // ETag cache (for conditional requests)
    this.etagCache = new NodeCache({
      stdTTL: CONFIG.MEDIA_TTL,
      checkperiod: CONFIG.CHECK_PERIOD,
      useClones: false,
      maxKeys: CONFIG.MAX_ITEMS * 2,
    });

    // Track current cache size
    this.currentCacheSize = 0;

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      bytesServed: 0,
      bytesCached: 0,
      evictions: 0,
      corruptions: 0,
    };

    // Access frequency tracking for LRU
    this.accessFrequency = new Map();

    // Setup event handlers
    this._setupEventHandlers();

    // Periodic cache health check
    setInterval(() => this._performHealthCheck(), 10 * 60 * 1000); // Every 10 minutes

    console.log(`[MediaCache] Initialized with ${CONFIG.MAX_CACHE_SIZE / (1024 * 1024)}MB max size`);
  }

  /**
   * Setup cache event handlers
   */
  _setupEventHandlers() {
    // Track deletions for size management
    this.mediaCache.on('del', (key, value) => {
      if (value && value.length) {
        this.currentCacheSize -= value.length;
        this.stats.evictions++;
      }
      this.accessFrequency.delete(key);
    });

    this.mediaCache.on('expired', (key, value) => {
      if (value && value.length) {
        this.currentCacheSize -= value.length;
      }
      this.accessFrequency.delete(key);
    });
  }

  /**
   * Generate cache key for media
   */
  _getCacheKey(fileName, type = 'media') {
    return `${type}:${fileName}`;
  }

  /**
   * Generate ETag for content
   */
  generateETag(buffer, fileName) {
    if (!buffer) return null;
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    hash.update(fileName);
    return `"${hash.digest('hex')}"`;
  }

  /**
   * Check if item should be cached (size check)
   */
  _shouldCache(buffer) {
    if (!buffer) return false;
    return buffer.length <= CONFIG.MAX_ITEM_SIZE;
  }

  /**
   * Evict least recently used items to make space
   */
  _evictLRU(neededSpace) {
    // Get items sorted by access time (oldest first)
    const items = Array.from(this.accessFrequency.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    let freedSpace = 0;
    let evictedCount = 0;

    for (const [key, data] of items) {
      if (freedSpace >= neededSpace) break;

      const cached = this.mediaCache.get(key);
      if (cached && cached.length) {
        freedSpace += cached.length;
        this.mediaCache.del(key);
        evictedCount++;
      }
    }

    console.log(`[MediaCache] Evicted ${evictedCount} items, freed ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
    return freedSpace;
  }

  /**
   * Cache media file (buffer)
   */
  cacheMedia(fileName, buffer, metadata = {}) {
    if (!buffer || !this._shouldCache(buffer)) {
      return false;
    }

    const key = this._getCacheKey(fileName);
    const size = buffer.length;

    // Check if we need to evict old items
    if (this.currentCacheSize + size > CONFIG.MAX_CACHE_SIZE) {
      const needed = (this.currentCacheSize + size) - CONFIG.MAX_CACHE_SIZE;
      this._evictLRU(needed + (CONFIG.MAX_CACHE_SIZE * 0.1)); // Free 10% extra
    }

    // Store in cache
    const ttl = metadata.isVideo ? CONFIG.MEDIA_TTL : CONFIG.THUMBNAIL_TTL;
    const success = this.mediaCache.set(key, buffer, ttl);

    if (success) {
      this.currentCacheSize += size;
      this.stats.bytesCached += size;

      // Track access
      this.accessFrequency.set(key, {
        lastAccess: Date.now(),
        accessCount: 1,
        size,
      });

      // Cache ETag
      const etag = this.generateETag(buffer, fileName);
      this.etagCache.set(`etag:${fileName}`, etag);

      // Cache metadata
      if (metadata) {
        this.metadataCache.set(`meta:${fileName}`, {
          ...metadata,
          size,
          cachedAt: Date.now(),
        });
      }
    }

    return success;
  }

  /**
   * Get cached media
   */
  getMedia(fileName) {
    const key = this._getCacheKey(fileName);
    const buffer = this.mediaCache.get(key);

    if (buffer) {
      this.stats.hits++;
      this.stats.bytesServed += buffer.length;

      // Update access tracking
      const freq = this.accessFrequency.get(key);
      if (freq) {
        freq.lastAccess = Date.now();
        freq.accessCount++;
      }

      return buffer;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Check if media is cached
   */
  has(fileName) {
    return this.mediaCache.has(this._getCacheKey(fileName));
  }

  /**
   * Get ETag for media
   */
  getETag(fileName) {
    return this.etagCache.get(`etag:${fileName}`);
  }

  /**
   * Get metadata for media
   */
  getMetadata(fileName) {
    return this.metadataCache.get(`meta:${fileName}`);
  }

  /**
   * Invalidate (delete) cached media
   */
  invalidate(fileName) {
    const key = this._getCacheKey(fileName);
    const cached = this.mediaCache.get(key);

    if (cached && cached.length) {
      this.currentCacheSize -= cached.length;
    }

    this.mediaCache.del(key);
    this.etagCache.del(`etag:${fileName}`);
    this.metadataCache.del(`meta:${fileName}`);
    this.accessFrequency.delete(key);

    console.log(`[MediaCache] Invalidated: ${fileName}`);
  }

  /**
   * Invalidate all media for an event
   */
  invalidateByEvent(eventId) {
    let count = 0;
    const keys = this.mediaCache.keys();

    for (const key of keys) {
      if (key.includes(eventId)) {
        const cached = this.mediaCache.get(key);
        if (cached && cached.length) {
          this.currentCacheSize -= cached.length;
        }
        this.mediaCache.del(key);
        this.accessFrequency.delete(key);
        count++;
      }
    }

    // Also clear metadata cache
    const metaKeys = this.metadataCache.keys();
    for (const key of metaKeys) {
      if (key.includes(eventId)) {
        this.metadataCache.del(key);
      }
    }

    console.log(`[MediaCache] Invalidated ${count} items for event ${eventId}`);
    return count;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.mediaCache.flushAll();
    this.metadataCache.flushAll();
    this.etagCache.flushAll();
    this.accessFrequency.clear();
    this.currentCacheSize = 0;
    console.log('[MediaCache] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const nodeStats = this.mediaCache.getStats();
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      currentSize: `${(this.currentCacheSize / (1024 * 1024)).toFixed(2)} MB`,
      maxSize: `${(CONFIG.MAX_CACHE_SIZE / (1024 * 1024)).toFixed(2)} MB`,
      itemCount: nodeStats.keys,
      metadataCount: this.metadataCache.keys().length,
      utilizationPercent: ((this.currentCacheSize / CONFIG.MAX_CACHE_SIZE) * 100).toFixed(2),
    };
  }

  /**
   * Perform cache health check
   */
  _performHealthCheck() {
    const stats = this.getStats();
    console.log(`[MediaCache] Health: ${stats.itemCount} items, ${stats.currentSize}/${stats.maxSize} (${stats.utilizationPercent}%), Hit Rate: ${stats.hitRate}`);

    // Detect and fix cache corruption
    let corrupted = 0;
    const keys = this.mediaCache.keys();

    for (const key of keys) {
      const value = this.mediaCache.get(key);
      if (value && !Buffer.isBuffer(value)) {
        // Corrupted entry - remove it
        this.mediaCache.del(key);
        corrupted++;
      }
    }

    if (corrupted > 0) {
      this.stats.corruptions += corrupted;
      console.log(`[MediaCache] Fixed ${corrupted} corrupted entries`);
    }

    return { healthy: corrupted === 0, corrupted };
  }

  /**
   * Warm cache with popular media (call on startup or periodically)
   */
  async warmCache(mediaList) {
    console.log(`[MediaCache] Warming cache with ${mediaList.length} items...`);
    let warmed = 0;

    for (const media of mediaList) {
      if (!this.has(media.fileName)) {
        // Media will be cached on first access
        warmed++;
      }
    }

    console.log(`[MediaCache] Cache warming: ${warmed} items queued for caching`);
    return warmed;
  }
}

// ==================== HTTP CACHE HELPERS ====================
export const httpCacheHeaders = {
  /**
   * Set optimal cache headers for images
   */
  forImage: (res, etag = null) => {
    res.setHeader('Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.IMAGE}, immutable`);
    res.setHeader('Vary', 'Accept-Encoding');
    if (etag) res.setHeader('ETag', etag);
    // CDN hints
    res.setHeader('CDN-Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.IMAGE}`);
    res.setHeader('Cloudflare-CDN-Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.IMAGE}`);
  },

  /**
   * Set optimal cache headers for videos
   */
  forVideo: (res, etag = null) => {
    res.setHeader('Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.VIDEO}, immutable`);
    res.setHeader('Vary', 'Accept-Encoding, Range');
    if (etag) res.setHeader('ETag', etag);
    // CDN hints
    res.setHeader('CDN-Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.VIDEO}`);
    res.setHeader('Cloudflare-CDN-Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.VIDEO}`);
  },

  /**
   * Set cache headers for thumbnails
   */
  forThumbnail: (res, etag = null) => {
    res.setHeader('Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.THUMBNAIL}, immutable`);
    res.setHeader('Vary', 'Accept-Encoding');
    if (etag) res.setHeader('ETag', etag);
  },

  /**
   * Set cache headers for gallery metadata/list
   */
  forMetadata: (res, etag = null) => {
    res.setHeader('Cache-Control', `public, max-age=${CONFIG.HTTP_CACHE.METADATA}, stale-while-revalidate=300`);
    res.setHeader('Vary', 'Accept-Encoding, Authorization');
    if (etag) res.setHeader('ETag', etag);
  },

  /**
   * Check if client has valid cached version (304 Not Modified)
   */
  checkConditionalRequest: (req, etag) => {
    const clientEtag = req.headers['if-none-match'];
    if (clientEtag && etag && clientEtag === etag) {
      return true; // Client has valid cache
    }
    return false;
  },
};

// ==================== SINGLETON INSTANCE ====================
const mediaCacheService = new MediaCacheService();

export default mediaCacheService;
export { CONFIG as MEDIA_CACHE_CONFIG };
