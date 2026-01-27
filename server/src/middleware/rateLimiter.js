/**
 * Rate Limiting Middleware
 * 
 * Provides protection against API abuse and DDoS attacks.
 * Features:
 * - IP-based rate limiting
 * - User-based rate limiting
 * - Endpoint-specific limits
 * - Sliding window algorithm
 * - Burst protection
 */

import logger from '../utils/logger.js';

// In-memory storage for rate limiting
// In production, use Redis for distributed rate limiting
const rateLimitStore = new Map();

// Default rate limit configurations
const DEFAULT_LIMITS = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200,    // 200 requests per minute (increased from 100)
};

// Endpoint-specific limits
const ENDPOINT_LIMITS = {
  // Authentication endpoints - stricter limits
  '/api/register': { windowMs: 60 * 60 * 1000, maxRequests: 5 },      // 5 per hour
  '/api/login': { windowMs: 15 * 60 * 1000, maxRequests: 10 },         // 10 per 15 min
  '/api/otp/send': { windowMs: 60 * 1000, maxRequests: 3 },            // 3 per minute
  '/api/otp/verify': { windowMs: 60 * 1000, maxRequests: 5 },          // 5 per minute
  '/api/forgot-password': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 per hour
  
  // Registration endpoints - moderate limits
  '/api/events/*/register': { windowMs: 60 * 1000, maxRequests: 10 },  // 10 per minute
  '/api/sub-events/*/register': { windowMs: 60 * 1000, maxRequests: 10 },
  
  // Read-only sub-events endpoint - relaxed limits
  '/api/events/*/sub-events': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
  '/api/events/*/comments': { windowMs: 60 * 1000, maxRequests: 60 },   // 60 per minute
  '/api/events/*/teams': { windowMs: 60 * 1000, maxRequests: 60 },      // 60 per minute
  '/api/events/*/registrations/pending': { windowMs: 60 * 1000, maxRequests: 60 }, // 60 per minute
  
  // Upload endpoints - stricter limits
  '/api/upload': { windowMs: 60 * 1000, maxRequests: 20 },             // 20 per minute
  '/api/gallery/*/upload': { windowMs: 60 * 1000, maxRequests: 10 },
  
  // Admin endpoints - relaxed limits
  '/api/admin/*': { windowMs: 60 * 1000, maxRequests: 200 },
};

/**
 * Get rate limit key based on request
 */
const getRateLimitKey = (req) => {
  // Use user ID if authenticated, otherwise use IP
  const userId = req.user?._id || req.session?.userId;
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  
  const identifier = userId ? `user:${userId}` : `ip:${ip}`;
  const endpoint = req.path;
  
  return `${identifier}:${endpoint}`;
};

/**
 * Get limit config for endpoint
 */
const getLimitConfig = (path) => {
  // Check for exact match first
  if (ENDPOINT_LIMITS[path]) {
    return ENDPOINT_LIMITS[path];
  }
  
  // Check for pattern match
  for (const [pattern, config] of Object.entries(ENDPOINT_LIMITS)) {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
      if (regex.test(path)) {
        return config;
      }
    }
  }
  
  return DEFAULT_LIMITS;
};

/**
 * Check if request is rate limited
 */
const isRateLimited = (key, config) => {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = {
      requests: [],
      blocked: false,
      blockedUntil: 0,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Check if currently blocked
  if (entry.blocked && entry.blockedUntil > now) {
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }
  
  // Clear block if expired
  if (entry.blocked && entry.blockedUntil <= now) {
    entry.blocked = false;
    entry.blockedUntil = 0;
  }
  
  // Filter requests within window
  entry.requests = entry.requests.filter(time => time > windowStart);
  
  // Check if limit exceeded
  if (entry.requests.length >= config.maxRequests) {
    // Block for the remaining window time
    entry.blocked = true;
    entry.blockedUntil = now + config.windowMs;
    
    return {
      limited: true,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter: Math.ceil(config.windowMs / 1000),
    };
  }
  
  // Add current request
  entry.requests.push(now);
  
  return {
    limited: false,
    remaining: config.maxRequests - entry.requests.length,
    resetAt: windowStart + config.windowMs,
  };
};

/**
 * Rate limit middleware
 */
export const rateLimiter = (customConfig = null) => {
  return (req, res, next) => {
    // Skip rate limiting for health checks
    if (req.path === '/api/health' || req.path === '/api/health/status') {
      return next();
    }
    
    const key = getRateLimitKey(req);
    const config = customConfig || getLimitConfig(req.path);
    const result = isRateLimited(key, config);
    
    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': config.maxRequests,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
    });
    
    if (result.limited) {
      res.set('Retry-After', result.retryAfter);
      
      console.warn(`[RateLimit] Blocked ${key} - ${req.method} ${req.path}`);
      
      return res.status(429).json({
        error: true,
        message: 'Too many requests. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
        resetAt: new Date(result.resetAt).toISOString(),
      });
    }
    
    next();
  };
};

/**
 * Strict rate limiter for sensitive endpoints
 */
export const strictRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
});

/**
 * Burst protection - prevent sudden spikes
 */
export const burstProtection = (maxBurst = 10, windowMs = 1000) => {
  const burstStore = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let entry = burstStore.get(ip);
    
    if (!entry) {
      entry = { requests: [] };
      burstStore.set(ip, entry);
    }
    
    // Filter requests within window
    entry.requests = entry.requests.filter(time => time > windowStart);
    
    if (entry.requests.length >= maxBurst) {
      console.warn(`[BurstProtection] Blocked ${ip} - ${entry.requests.length} requests in ${windowMs}ms`);
      
      return res.status(429).json({
        error: true,
        message: 'Request rate too high. Please slow down.',
        code: 'BURST_LIMIT_EXCEEDED',
      });
    }
    
    entry.requests.push(now);
    next();
  };
};

/**
 * Clean up old entries (run periodically)
 */
const cleanupRateLimitStore = () => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries with no recent requests and not blocked
    const hasRecentRequests = entry.requests.some(time => time > now - maxAge);
    const isBlocked = entry.blocked && entry.blockedUntil > now;
    
    if (!hasRecentRequests && !isBlocked) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.debug(`[RateLimit] Cleaned up ${cleaned} expired entries`);
  }
};

// Run cleanup every 10 minutes
setInterval(cleanupRateLimitStore, 10 * 60 * 1000);

/**
 * Get rate limit statistics
 */
export const getRateLimitStats = () => {
  let totalEntries = rateLimitStore.size;
  let blockedEntries = 0;
  let totalRequests = 0;
  
  for (const entry of rateLimitStore.values()) {
    if (entry.blocked) blockedEntries++;
    totalRequests += entry.requests.length;
  }
  
  return {
    totalEntries,
    blockedEntries,
    totalRequests,
    timestamp: new Date().toISOString(),
  };
};

export default {
  rateLimiter,
  strictRateLimiter,
  burstProtection,
  getRateLimitStats,
};
