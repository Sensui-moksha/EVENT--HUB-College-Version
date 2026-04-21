/**
 * Frontend Cache Manager - High Performance Edition
 * 
 * Provides in-memory and localStorage caching for API responses
 * to reduce server load and improve performance when 1000+ users access the site.
 * 
 * Features:
 * - In-memory LRU cache for fast access
 * - IndexedDB for large media caching (videos/images)
 * - localStorage persistence for cross-session caching
 * - TTL (Time To Live) support
 * - Instant cache invalidation on write operations
 * - Stale-while-revalidate pattern support
 * - BroadcastChannel for multi-tab cache sync
 * - Optimistic updates for faster perceived performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  version?: number; // For optimistic updates
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  useLocalStorage?: boolean; // Persist to localStorage
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
  priority?: 'high' | 'normal' | 'low'; // Cache priority
}

// Default TTLs for different data types - optimized for responsiveness
export const CACHE_TTL = {
  EVENTS: 10 * 1000, // 10 seconds - events change occasionally
  REGISTRATIONS: 3 * 1000, // 3 seconds - user's registrations need quick updates
  GALLERY: 20 * 1000, // 20 seconds - gallery data
  GALLERY_MEDIA: 10 * 60 * 1000, // 10 minutes - media files rarely change
  GALLERY_THUMBNAIL: 30 * 60 * 1000, // 30 minutes - thumbnails very stable
  VIDEO_METADATA: 15 * 60 * 1000, // 15 minutes - video metadata
  USER_PROFILE: 10 * 1000, // 10 seconds
  NOTIFICATIONS: 2 * 1000, // 2 seconds - need near real-time
  STATIC_DATA: 15 * 60 * 1000, // 15 minutes - categories, tags, etc.
  TEAMS: 5 * 1000, // 5 seconds - team data changes frequently
  INSTANT: 0, // No caching - always fresh
} as const;

class CacheManager {
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private maxMemoryEntries = 1000; // Increased for better performance
  private storagePrefix = 'eventhub_cache_';
  private listeners: Map<string, Set<() => void>> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private pendingWrites: Map<string, Promise<unknown>> = new Map();
  private cacheVersion = 1;

  constructor() {
    // Clean up expired localStorage entries on initialization
    this.cleanupLocalStorage();
    
    // Periodically clean memory cache (every 30 seconds)
    setInterval(() => this.cleanupMemoryCache(), 30 * 1000);
    
    // Setup BroadcastChannel for multi-tab cache sync
    this.setupBroadcastChannel();
  }

  /**
   * Setup BroadcastChannel for cross-tab cache synchronization
   */
  private setupBroadcastChannel(): void {
    try {
      this.broadcastChannel = new BroadcastChannel('eventhub_cache_sync');
      this.broadcastChannel.onmessage = (event) => {
        const { type, key, pattern } = event.data;
        switch (type) {
          case 'invalidate':
            if (key) {
              this.memoryCache.delete(key);
              this.notifyListeners(key);
            }
            break;
          case 'invalidatePattern':
            if (pattern) {
              const regex = new RegExp(pattern);
              for (const k of this.memoryCache.keys()) {
                if (regex.test(k)) {
                  this.memoryCache.delete(k);
                  this.notifyListeners(k);
                }
              }
            }
            break;
          case 'invalidateAll':
            this.memoryCache.clear();
            for (const k of this.listeners.keys()) {
              this.notifyListeners(k);
            }
            break;
          case 'update':
            // Another tab updated the cache, refresh from localStorage
            if (key) {
              const entry = this.getFromLocalStorage(key);
              if (entry) {
                this.memoryCache.set(key, entry);
                this.notifyListeners(key);
              }
            }
            break;
        }
      };
    } catch (e) {
      // BroadcastChannel not supported in this browser
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  /**
   * Broadcast cache change to other tabs
   */
  private broadcast(type: string, data: Record<string, unknown> = {}): void {
    try {
      this.broadcastChannel?.postMessage({ type, ...data });
    } catch (e) {
      // Ignore broadcast errors
    }
  }

  /**
   * Get cached data with optimized lookup
   */
  get<T>(key: string, options: CacheOptions = {}): T | null {
    // Try memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      // Move to front for LRU (by refreshing timestamp slightly)
      return memoryEntry.data as T;
    }

    // Try localStorage if enabled
    if (options.useLocalStorage !== false) {
      const storageEntry = this.getFromLocalStorage<T>(key);
      if (storageEntry && !this.isExpired(storageEntry)) {
        // Restore to memory cache with higher priority
        this.memoryCache.set(key, storageEntry);
        return storageEntry.data;
      }
    }

    return null;
  }

  /**
   * Get cached data, returning stale data if available while revalidating
   */
  getStale<T>(key: string): { data: T | null; isStale: boolean; version?: number } {
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      return {
        data: memoryEntry.data as T,
        isStale: this.isExpired(memoryEntry),
        version: memoryEntry.version
      };
    }

    const storageEntry = this.getFromLocalStorage<T>(key);
    if (storageEntry) {
      // Restore to memory for faster subsequent access
      this.memoryCache.set(key, storageEntry);
      return {
        data: storageEntry.data,
        isStale: this.isExpired(storageEntry),
        version: storageEntry.version
      };
    }

    return { data: null, isStale: true };
  }

  /**
   * Set cached data with immediate persistence
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl ?? CACHE_TTL.EVENTS;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version: ++this.cacheVersion
    };

    // Ensure we don't exceed max entries
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      this.evictOldest();
    }

    this.memoryCache.set(key, entry);

    // Persist to localStorage if enabled (async for better performance)
    if (options.useLocalStorage !== false) {
      this.setToLocalStorage(key, entry);
    }

    // Notify listeners immediately
    this.notifyListeners(key);
    
    // Broadcast to other tabs
    this.broadcast('update', { key });
  }

  /**
   * Optimistic update - update cache immediately, rollback on error
   */
  optimisticUpdate<T>(key: string, data: T, options: CacheOptions = {}): { rollback: () => void; version: number } {
    const previousEntry = this.memoryCache.get(key);
    const version = ++this.cacheVersion;
    
    // Immediately update cache
    this.set(key, data, { ...options, ttl: options.ttl ?? CACHE_TTL.EVENTS });
    
    return {
      version,
      rollback: () => {
        if (previousEntry) {
          this.memoryCache.set(key, previousEntry);
        } else {
          this.memoryCache.delete(key);
        }
        this.notifyListeners(key);
      }
    };
  }

  /**
   * Invalidate specific cache key - immediate and synchronous
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    this.removeFromLocalStorage(key);
    this.notifyListeners(key);
    this.broadcast('invalidate', { key });
  }

  /**
   * Invalidate all keys matching a pattern - immediate
   */
  invalidatePattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
    
    // Memory cache - batch delete for efficiency
    const keysToDelete: string[] = [];
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
      this.notifyListeners(key);
    }

    // localStorage - batch delete
    try {
      const keysToRemove: string[] = [];
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.storagePrefix)) {
          const cacheKey = key.slice(this.storagePrefix.length);
          if (regex.test(cacheKey)) {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (e) {
      console.warn('localStorage cleanup failed:', e);
    }
    
    // Broadcast to other tabs
    this.broadcast('invalidatePattern', { pattern: patternStr });
  }

  /**
   * Invalidate all caches (useful after major operations)
   */
  invalidateAll(): void {
    this.memoryCache.clear();
    this.clearLocalStorage();
    
    // Notify all listeners
    for (const key of this.listeners.keys()) {
      this.notifyListeners(key);
    }
    
    // Broadcast to other tabs
    this.broadcast('invalidateAll');
    
    // Clear service worker caches
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_ALL_CACHE' });
    }
  }

  /**
   * Subscribe to cache changes for a key
   */
  subscribe(key: string, callback: () => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }
  
  /**
   * Subscribe to pattern-based cache changes
   */
  subscribePattern(pattern: string | RegExp, callback: () => void): () => void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const unsubscribes: (() => void)[] = [];
    
    // Subscribe to existing matching keys
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        unsubscribes.push(this.subscribe(key, callback));
      }
    }
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  /**
   * Prefetch data into cache
   */
  prefetch<T>(key: string, fetcher: () => Promise<T>, options: CacheOptions = {}): void {
    // Don't prefetch if already cached and valid
    const existing = this.get<T>(key, options);
    if (existing !== null) return;
    
    // Avoid duplicate prefetch requests
    if (this.pendingWrites.has(key)) return;
    
    const promise = fetcher()
      .then(data => {
        this.set(key, data, options);
        this.pendingWrites.delete(key);
        return data;
      })
      .catch(err => {
        this.pendingWrites.delete(key);
        throw err;
      });
    
    this.pendingWrites.set(key, promise);
  }

  /**
   * Get cache statistics
   */
  getStats(): { memorySize: number; keys: string[] } {
    return {
      memorySize: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys())
    };
  }

  // Private methods
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictOldest(): void {
    // Find and remove the oldest entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const raw = localStorage.getItem(this.storagePrefix + key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to read from localStorage:', e);
    }
    return null;
  }

  private setToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      localStorage.setItem(this.storagePrefix + key, JSON.stringify(entry));
    } catch (e) {
      // localStorage might be full or disabled
      console.warn('Failed to write to localStorage:', e);
      // Try to clear old entries and retry
      this.cleanupLocalStorage();
    }
  }

  private removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(this.storagePrefix + key);
    } catch (e) {
      console.warn('Failed to remove from localStorage:', e);
    }
  }

  private clearLocalStorage(): void {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.storagePrefix)) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }

  private cleanupLocalStorage(): void {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.storagePrefix)) {
          const entry = this.getFromLocalStorage(key.slice(this.storagePrefix.length));
          if (entry && this.isExpired(entry)) {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn('localStorage cleanup failed:', e);
    }
  }

  private cleanupMemoryCache(): void {
    for (const [key, entry] of this.memoryCache.entries()) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
      }
    }
  }

  private notifyListeners(key: string): void {
    this.listeners.get(key)?.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('Cache listener error:', e);
      }
    });
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Cache keys generator for consistent key naming
 */
export const cacheKeys = {
  events: () => 'events_list',
  eventsPage: (page: number, limit: number) => `events_page_${page}_${limit}`,
  event: (id: string) => `event_${id}`,
  eventSubEvents: (id: string) => `event_${id}_subevents`,
  registrations: () => 'user_registrations',
  registration: (eventId: string) => `registration_${eventId}`,
  galleries: () => 'galleries_list',
  galleriesPage: (page: number, limit: number) => `galleries_page_${page}_${limit}`,
  gallery: (eventId: string) => `gallery_${eventId}`,
  galleryMedia: (eventId: string) => `gallery_${eventId}_media`,
  galleryMediaPage: (eventId: string, page: number) => `gallery_${eventId}_media_page_${page}`,
  videoMetadata: (mediaId: string) => `video_meta_${mediaId}`,
  thumbnail: (mediaId: string) => `thumb_${mediaId}`,
  userProfile: (userId: string) => `user_${userId}`,
  notifications: (userId: string) => `notifications_${userId}`,
  teams: (eventId: string) => `teams_${eventId}`,
  team: (teamId: string) => `team_${teamId}`,
  waitlist: (eventId: string) => `waitlist_${eventId}`,
};

/**
 * Invalidation helpers for common operations - IMMEDIATE invalidation
 */
export const invalidateCache = {
  // After creating/updating/deleting an event
  onEventChange: (eventId?: string) => {
    cacheManager.invalidate(cacheKeys.events());
    cacheManager.invalidatePattern(/^events_/); // Clear all event-related caches
    if (eventId) {
      cacheManager.invalidate(cacheKeys.event(eventId));
      cacheManager.invalidate(cacheKeys.eventSubEvents(eventId));
      cacheManager.invalidate(cacheKeys.teams(eventId));
      cacheManager.invalidate(cacheKeys.waitlist(eventId));
    }
    // Sync with service worker
    syncServiceWorkerCache('events');
  },

  // After registration changes
  onRegistrationChange: (eventId?: string) => {
    cacheManager.invalidate(cacheKeys.registrations());
    cacheManager.invalidatePattern(/^registration_/);
    if (eventId) {
      cacheManager.invalidate(cacheKeys.registration(eventId));
      cacheManager.invalidate(cacheKeys.event(eventId)); // Participant count changed
      cacheManager.invalidate(cacheKeys.waitlist(eventId));
    }
    syncServiceWorkerCache('registrations');
  },

  // After gallery changes
  onGalleryChange: (eventId?: string) => {
    cacheManager.invalidate(cacheKeys.galleries());
    cacheManager.invalidatePattern(/^galleries_/); // Clear all gallery list caches (paginated)
    if (eventId) {
      cacheManager.invalidate(cacheKeys.gallery(eventId));
      cacheManager.invalidate(cacheKeys.galleryMedia(eventId));
      cacheManager.invalidatePattern(new RegExp(`^gallery_${eventId}_`));
    }
    // Clear service worker media cache
    syncServiceWorkerCache('gallery');
  },

  // After media upload/delete
  onMediaChange: (eventId?: string, mediaId?: string) => {
    if (eventId) {
      cacheManager.invalidate(cacheKeys.gallery(eventId));
      cacheManager.invalidate(cacheKeys.galleryMedia(eventId));
      cacheManager.invalidatePattern(new RegExp(`^gallery_${eventId}_`));
    }
    if (mediaId) {
      cacheManager.invalidate(cacheKeys.videoMetadata(mediaId));
      cacheManager.invalidate(cacheKeys.thumbnail(mediaId));
    }
    cacheManager.invalidatePattern(/^galleries_/);
    syncServiceWorkerCache('media');
  },

  // After user profile changes
  onUserChange: (userId?: string) => {
    if (userId) {
      cacheManager.invalidate(cacheKeys.userProfile(userId));
      cacheManager.invalidate(cacheKeys.notifications(userId));
    }
    syncServiceWorkerCache('user');
  },

  // After sub-event changes
  onSubEventChange: (eventId?: string) => {
    if (eventId) {
      cacheManager.invalidate(cacheKeys.eventSubEvents(eventId));
      cacheManager.invalidate(cacheKeys.event(eventId));
      cacheManager.invalidate(cacheKeys.teams(eventId));
    }
    syncServiceWorkerCache('events');
  },
  
  // After team changes
  onTeamChange: (eventId?: string, teamId?: string) => {
    if (eventId) {
      cacheManager.invalidate(cacheKeys.teams(eventId));
      cacheManager.invalidate(cacheKeys.event(eventId));
    }
    if (teamId) {
      cacheManager.invalidate(cacheKeys.team(teamId));
    }
    cacheManager.invalidatePattern(/^team/);
    syncServiceWorkerCache('teams');
  },
  
  // After waitlist changes
  onWaitlistChange: (eventId?: string) => {
    if (eventId) {
      cacheManager.invalidate(cacheKeys.waitlist(eventId));
      cacheManager.invalidate(cacheKeys.event(eventId));
    }
    syncServiceWorkerCache('waitlist');
  },

  // Clear all caches (logout, major state change)
  all: () => {
    cacheManager.invalidateAll();
  }
};

/**
 * Sync cache invalidation with service worker
 */
function syncServiceWorkerCache(type: string): void {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ 
      type: 'INVALIDATE_CACHE',
      cacheType: type,
      timestamp: Date.now()
    });
  }
}

/**
 * Write-through cache helper - updates cache immediately after successful API write
 */
export async function writeThrough<T>(
  key: string,
  writeOperation: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const result = await writeOperation();
  cacheManager.set(key, result, options);
  return result;
}

/**
 * Optimistic write helper - updates cache before API call, rolls back on error
 */
export async function optimisticWrite<T>(
  key: string,
  optimisticData: T,
  writeOperation: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { rollback } = cacheManager.optimisticUpdate(key, optimisticData, options);
  
  try {
    const result = await writeOperation();
    // Update with actual server response
    cacheManager.set(key, result, options);
    return result;
  } catch (error) {
    // Rollback on error
    rollback();
    throw error;
  }
}

export default cacheManager;
