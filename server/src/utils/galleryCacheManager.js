/**
 * Gallery Media Cache Manager
 * 
 * Provides in-memory caching for frequently accessed gallery media files
 * Improves performance by avoiding repeated Base64 decoding from MongoDB
 */

class GalleryCacheManager {
  constructor(maxSize = 100 * 1024 * 1024) {
    // Max 100MB of cached data
    this.cache = new Map();
    this.maxSize = maxSize;
    this.currentSize = 0;
    this.hitCount = new Map();
    this.lastAccessed = new Map();
  }

  /**
   * Get cached media
   */
  get(mediaId) {
    if (!this.cache.has(mediaId)) {
      return null;
    }

    // Update access tracking
    this.hitCount.set(mediaId, (this.hitCount.get(mediaId) || 0) + 1);
    this.lastAccessed.set(mediaId, Date.now());

    return this.cache.get(mediaId);
  }

  /**
   * Store media in cache
   */
  set(mediaId, fileBuffer, metadata = {}) {
    const size = fileBuffer.length;

    // Check if we need to clear space
    if (this.currentSize + size > this.maxSize) {
      this.evict(size);
    }

    // Store cache entry
    this.cache.set(mediaId, fileBuffer);
    this.currentSize += size;
    this.hitCount.set(mediaId, 0);
    this.lastAccessed.set(mediaId, Date.now());

    return true;
  }

  /**
   * Evict least recently used items
   */
  evict(requiredSize) {
    let freedSize = 0;
    const entries = Array.from(this.cache.entries())
      .map(([id, buffer]) => ({
        id,
        size: buffer.length,
        lastAccessed: this.lastAccessed.get(id) || 0,
        hits: this.hitCount.get(id) || 0
      }))
      // Sort by: last accessed (older first), then by hits (fewer hits = remove first)
      .sort((a, b) => {
        const timeDiff = a.lastAccessed - b.lastAccessed;
        return timeDiff !== 0 ? timeDiff : a.hits - b.hits;
      });

    // Remove oldest/least-used entries until we have enough space
    for (const entry of entries) {
      if (freedSize >= requiredSize) break;

      this.cache.delete(entry.id);
      this.currentSize -= entry.size;
      this.hitCount.delete(entry.id);
      this.lastAccessed.delete(entry.id);
      freedSize += entry.size;
    }
  }

  /**
   * Clear specific media from cache
   */
  delete(mediaId) {
    if (this.cache.has(mediaId)) {
      const size = this.cache.get(mediaId).length;
      this.cache.delete(mediaId);
      this.currentSize -= size;
      this.hitCount.delete(mediaId);
      this.lastAccessed.delete(mediaId);
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.cache.clear();
    this.hitCount.clear();
    this.lastAccessed.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hits = Array.from(this.hitCount.values()).reduce((a, b) => a + b, 0);
    const totalRequests = hits + (this.cache.size * 0.5); // Rough estimate

    return {
      itemsInCache: this.cache.size,
      cacheSizeBytes: this.currentSize,
      cacheSizeMB: (this.currentSize / 1024 / 1024).toFixed(2),
      maxSizeMB: (this.maxSize / 1024 / 1024).toFixed(2),
      hitCount: hits,
      hitRate: totalRequests > 0 ? ((hits / totalRequests) * 100).toFixed(2) : '0',
      percentageUsed: ((this.currentSize / this.maxSize) * 100).toFixed(2)
    };
  }

  /**
   * Get top cached items
   */
  getTopItems(limit = 10) {
    return Array.from(this.cache.entries())
      .map(([id, buffer]) => ({
        mediaId: id,
        sizeBytes: buffer.length,
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
        hits: this.hitCount.get(id) || 0,
        lastAccessed: new Date(this.lastAccessed.get(id) || 0)
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  /**
   * Warm cache with specific media IDs
   */
  async warmCache(mediaIds, fetchFn) {
    for (const mediaId of mediaIds) {
      if (!this.cache.has(mediaId)) {
        try {
          const fileBuffer = await fetchFn(mediaId);
          if (fileBuffer) {
            this.set(mediaId, fileBuffer);
          }
        } catch (error) {
          console.error(`Error warming cache for ${mediaId}:`, error);
        }
      }
    }
  }
}

export default GalleryCacheManager;
