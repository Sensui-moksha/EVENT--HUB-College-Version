// ...existing code...

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import qrImage from 'qr-image';
import { createCanvas, loadImage } from 'canvas';
import crypto from 'crypto';
import http from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
// Removed direct GridFsStorage usage due to runtime crash (f._id undefined in multer-gridfs-storage with Node 25)
// We'll implement manual GridFS streaming with multer.memoryStorage instead.
import { MongoClient } from 'mongodb';

// Mail system imports
import { initializeMailSystem, shutdownMailSystem } from './src/config/mail.init.js';
import {
  sendWelcomeEmail,
  sendEventRegistrationEmail,
  sendOTPEmail,
  notifyAdmin,
  sendAccountApprovalEmail,
  sendAccountRejectionEmail,
  sendNotificationEmail,
} from './src/services/mail.service.js';
import {
  sendOTP,
  verifyOTP,
  resendOTP,
  otpStore,
} from './src/services/otp.service.js';
import { setUserModel } from './src/utils/adminEmailService.js';

// Route imports
import { otpRoutes, mailRoutes } from './src/routes/index.js';
import galleryRoutes from './src/routes/galleryRoutes.js';
import * as galleryController from './src/controllers/galleryController.js';

// Health monitoring and maintenance imports
import {
  performHealthCheck,
  getHealthStatus,
  getMetrics,
  recordRequest,
  getCpuUsage,
  getMemoryUsage,
  getDatabaseStats,
} from './src/services/healthMonitor.js';
import {
  runFullMaintenance,
  analyzeAllIndexes,
  getMaintenanceLogs,
  getIndexStats,
  validateCollectionIndexes,
  findUnusedIndexes,
} from './src/services/indexMaintenance.js';
import {
  setSocketIO as setAlertSocketIO,
  sendAlert,
  sendHealthAlert,
  getAlertHistory,
  getAlertStats,
  clearAlertHistory,
} from './src/services/alertService.js';

// Cache imports for high-traffic optimization
import serverCache, { CACHE_TTL, cacheKeys, invalidateCache } from './src/services/cacheService.js';
import { routeCache, cacheMiddleware, invalidateCacheMiddleware } from './src/middleware/cacheMiddleware.js';

// Production-safe logger
import logger from './src/utils/logger.js';

// Setup __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);

// Check if running in production
const isProduction = process.env.NODE_ENV === 'production';

// Dynamic CORS configuration for production deployment
const getCorsOriginValidator = () => {
  // In production, restrict origins if ALLOWED_ORIGINS is set
  let allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  
  // If running in production and no explicit ALLOWED_ORIGINS were provided,
  // try to automatically use FRONTEND_URL or WEBSITE_URL as the allowed origin.
  if (isProduction && (!allowedOrigins || allowedOrigins.length === 0)) {
    const autoOrigin = process.env.FRONTEND_URL || process.env.WEBSITE_URL;
    if (autoOrigin) {
      allowedOrigins = [autoOrigin];
      logger.production('🌐 CORS: No ALLOWED_ORIGINS provided — using FRONTEND_URL/WEBSITE_URL as allowed origin:', allowedOrigins);
    } else {
      logger.production('🌐 CORS: No ALLOWED_ORIGINS or FRONTEND_URL/WEBSITE_URL provided — allowing ALL origins (WARNING: not recommended in production)');
    }
  }

  if (isProduction && allowedOrigins && allowedOrigins.length > 0) {
    logger.production('🌐 CORS: Restricted to allowed origins:', allowedOrigins);
    
    // Compile wildcard patterns to regex for efficient matching
    const wildcardPatterns = allowedOrigins
      .filter(origin => origin.includes('*'))
      .map(origin => {
        // Convert wildcard pattern (e.g., *.mictech.dpdns.org) to regex
        // Escape special regex chars except *, then replace * with .*
        const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
        return new RegExp(`^${escaped}$`);
      });
    
    // Exact match origins (non-wildcard)
    const exactOrigins = allowedOrigins.filter(origin => !origin.includes('*'));
    
    return (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check exact matches
      if (exactOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check wildcard patterns
      if (wildcardPatterns.some(pattern => pattern.test(origin))) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    };
  }
  
  // Development: Allow ALL origins
  logger.production('🌐 CORS: Allowing ALL origins (development mode)');
  return (origin, callback) => {
    callback(null, true);
  };
};

const corsOriginValidator = getCorsOriginValidator();

const corsOptions = {
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

const io = new Server(server, {
  cors: corsOptions,
});

// Attach io to app context to be accessible in routes
app.set('io', io);

// Set Socket.IO for alert service
setAlertSocketIO(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.production('A user connected with socket id:', socket.id);

  // Join a room based on userId
  socket.on('join', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      logger.production(`Socket ${socket.id} joined room for user ${userId}`);
    }
  });

  // Join system monitors room for health alerts (opt-in only, not all admins)
  socket.on('joinSystemMonitors', () => {
    socket.join('system_monitors');
    logger.production(`Socket ${socket.id} joined system_monitors room for health alerts`);
  });

  // Legacy: Keep admin room for other admin features (not health alerts)
  socket.on('joinAdminRoom', (isAdmin) => {
    if (isAdmin) {
      socket.join('admins');
      logger.production(`Socket ${socket.id} joined admin room`);
    }
  });

  socket.on('disconnect', () => {
    logger.production('User disconnected with socket id:', socket.id);
  });
});

// CORS middleware - Allow all origins in development
app.use(cors(corsOptions));

// Explicit OPTIONS handler for preflight requests
app.options('*', cors(corsOptions));

// Trust proxy (important for production behind reverse proxy like Nginx)
// Allow overriding via TRUST_PROXY env. If not provided, default to 1.
// Example values: 'true' | 'false' | '1' | '2' | 'loopback'
const trustProxyEnv = process.env.TRUST_PROXY;
let trustProxyVal = 1;
if (typeof trustProxyEnv !== 'undefined') {
  if (trustProxyEnv === 'true') trustProxyVal = true;
  else if (trustProxyEnv === 'false') trustProxyVal = false;
  else if (!isNaN(parseInt(trustProxyEnv))) trustProxyVal = parseInt(trustProxyEnv);
  else trustProxyVal = trustProxyEnv;
}
app.set('trust proxy', trustProxyVal);
logger.production('[Proxy] trust proxy set to:', trustProxyVal);

// Request metrics middleware for health monitoring
app.use((req, res, next) => {
  const startTime = Date.now();
  
  // Capture response finish event
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    // Record metrics (skip static files and health checks)
    if (!req.path.startsWith('/uploads') && req.path !== '/api/health/status') {
      recordRequest(success, duration, success ? null : `${res.statusCode} ${req.path}`);
    }
  });
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware: remove problematic integrity attributes for Cloudflare Insights
// Some CDNs or proxies may alter the script but leave an outdated SRI hash,
// which causes the browser to block the resource. This middleware strips
// integrity and crossorigin attributes for the known Cloudflare Insights URL
// from HTML responses to avoid that failure.
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function (body) {
    try {
      const contentType = res.getHeader('Content-Type') || '';
      if (contentType.includes('text/html') && typeof body === 'string') {
        // Remove integrity attributes that reference static.cloudflareinsights.com
        body = body.replace(/integrity\s*=\s*"[^"]*static\.cloudflareinsights\.com[^"]*"/ig, '');
        // Also remove crossorigin attributes used with SRI for that script
        body = body.replace(/crossorigin\s*=\s*"[^"]*"/ig, '');
      }
    } catch (e) {
      logger.production('[SRI] Error while sanitizing HTML response:', e && e.message);
    }
    return originalSend.call(this, body);
  };
  next();
});

// Import rate limiter and error handler
import { rateLimiter, burstProtection, getRateLimitStats } from './src/middleware/rateLimiter.js';
import { errorHandler, notFoundHandler, getErrorStats } from './src/middleware/errorHandler.js';

// Database connection check middleware - return 503 if DB is not connected
const requireDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database temporarily unavailable',
      message: 'The server is reconnecting to the database. Please try again in a few seconds.',
      retryAfter: 5
    });
  }
  next();
};

// Apply burst protection globally (prevent sudden spikes)
app.use(burstProtection(50, 1000)); // Max 50 requests per second per IP (increased for dev)

// Apply rate limiting to API routes
app.use('/api', rateLimiter());

// Apply database connection check to all API routes except health endpoints
app.use('/api', (req, res, next) => {
  // Skip DB check for health endpoints - they should always work
  if (req.path === '/health' || req.path === '/health/status') {
    return next();
  }
  return requireDbConnection(req, res, next);
});

// Session middleware for authentication with MongoDB store for persistence
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 24 hours
    autoRemove: 'native'
  }),
  cookie: (function() {
    // Allow overriding via env for tricky CDNs or subdomain setups
    const cookieDomain = process.env.SESSION_COOKIE_DOMAIN || undefined; // e.g. .mictech.dpdns.org
    const sameSiteEnv = process.env.SESSION_SAME_SITE; // 'lax'|'strict'|'none'
    const isProd = process.env.NODE_ENV === 'production';

    const cookieOpts = {
      // Allow explicit override for environments where NODE_ENV=production
      // but the app is served over HTTP (e.g. preview instances).
      // If SESSION_COOKIE_SECURE is set to 'true' or 'false' it will be used;
      // otherwise we default to the conventional isProd value.
      secure: (typeof process.env.SESSION_COOKIE_SECURE !== 'undefined')
        ? (process.env.SESSION_COOKIE_SECURE === 'true')
        : isProd,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    };

    // Prefer explicit env, otherwise default to 'none' in production to work behind proxies/CDNs,
    // and 'lax' in development for easier local testing.
    cookieOpts.sameSite = sameSiteEnv || (isProd ? 'none' : 'lax');

    if (cookieDomain) cookieOpts.domain = cookieDomain;

    // Log effective cookie options at startup (sparse output)
    logger.production('[Session] cookie options:', {
      domain: cookieOpts.domain || null,
      secure: cookieOpts.secure,
      sameSite: cookieOpts.sameSite,
      httpOnly: cookieOpts.httpOnly
    });

    return cookieOpts;
  })()
}));

// Session debugging middleware - log when session is created/accessed
app.use((req, res, next) => {
  if (req.path.startsWith('/api/gallery')) {
    logger.production('[Session] Path:', req.path, '| SessionID:', req.sessionID, '| Has user:', !!req.session?.user, '| Origin:', req.headers.origin || 'none', '| Cookie:', req.headers.cookie || 'none');
  }
  next();
});

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Register modular routes
app.use('/api/otp', otpRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/gallery', galleryRoutes);

// Manual GridFS configuration using memoryStorage + GridFSBucket writes
const mongoUri = process.env.MONGODB_URI;
let gridFsBucket; // initialized after mongoose connection
const uploadMiddleware = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } }); // 1GB soft cap

// Health check endpoint with cache stats
app.get('/api/health', async (req, res) => {
  try {
    const healthData = await performHealthCheck();
    const cacheStats = serverCache.getStats();
    
    res.json({ 
      ...healthData,
      message: 'EventHub server is running',
      version: '1.0.0',
      cache: {
        enabled: true,
        ...cacheStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Quick health status (lightweight) - always responds even when DB is down
app.get('/api/health/status', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.json({
    ...getHealthStatus(),
    database: {
      status: dbStateMap[dbState] || 'unknown',
      connected: dbState === 1
    },
    session: {
      sessionID: req.sessionID,
      hasSession: !!req.session,
      hasUser: !!req.session?.user,
      userEmail: req.session?.user?.email || null
    }
  });
});

// Temporary debug endpoint to inspect session headers/state.
// Enabled when DEBUG_SESSION=true OR when request provides a matching DEBUG_SESSION_TOKEN.
app.get('/api/debug/session', (req, res) => {
  const debugEnabled = process.env.DEBUG_SESSION === 'true';
  const token = req.headers['x-debug-token'] || req.query.token;
  const allowedToken = process.env.DEBUG_SESSION_TOKEN;

  if (!debugEnabled && (!allowedToken || token !== allowedToken)) {
    return res.status(403).json({ error: 'Debug endpoint disabled' });
  }

  // Return limited session info and request cookies/headers for debugging only
  res.json({
    sessionID: req.sessionID,
    hasSession: !!req.session,
    hasUser: !!req.session?.user,
    user: req.session?.user ? { id: req.session.user._id || req.session.user.id, email: req.session.user.email, role: req.session.user.role } : null,
    requestCookieHeader: req.headers.cookie || null,
    origin: req.headers.origin || null,
    timestamp: new Date().toISOString()
  });
});

// Detailed metrics endpoint (admin only)
app.get('/api/health/metrics', async (req, res) => {
  try {
    const metrics = getMetrics();
    const dbStats = await getDatabaseStats();
    
    res.json({
      timestamp: new Date().toISOString(),
      cpu: getCpuUsage(),
      memory: getMemoryUsage(),
      database: dbStats,
      api: metrics,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Index maintenance endpoints (admin only)
app.get('/api/admin/indexes', async (req, res) => {
  try {
    const analysis = await analyzeAllIndexes();
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/indexes/:collection', async (req, res) => {
  try {
    const stats = await getIndexStats(req.params.collection);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/indexes/validate/:collection', async (req, res) => {
  try {
    const result = await validateCollectionIndexes(req.params.collection);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/indexes/unused', async (req, res) => {
  try {
    const result = await findUnusedIndexes(req.query.threshold ? parseInt(req.query.threshold) : 10);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/maintenance/run', async (req, res) => {
  try {
    const result = await runFullMaintenance();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/maintenance/logs', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 100;
  res.json(getMaintenanceLogs(limit));
});

// Alert endpoints (admin only)
app.get('/api/admin/alerts', (req, res) => {
  res.json(getAlertHistory({
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    severity: req.query.severity,
    type: req.query.type,
    since: req.query.since,
  }));
});

app.get('/api/admin/alerts/stats', (req, res) => {
  res.json(getAlertStats());
});

app.delete('/api/admin/alerts', (req, res) => {
  res.json(clearAlertHistory());
});

app.post('/api/admin/alerts/test', async (req, res) => {
  try {
    const result = await sendAlert({
      type: 'test_alert',
      severity: req.body.severity || 'info',
      message: req.body.message || 'This is a test alert from EventHub',
      details: { source: 'manual_test', timestamp: new Date().toISOString() },
      suggestedAction: 'No action required. This is a test.',
      skipCooldown: true,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cache statistics endpoint (admin only)
app.get('/api/cache/stats', (req, res) => {
  // In production, this should be admin-only
  const stats = serverCache.getStats();
  res.json({ success: true, stats });
});

// Clear cache endpoint (admin only)
app.post('/api/cache/clear', (req, res) => {
  // In production, this should be admin-only with proper auth
  serverCache.flush();
  res.json({ success: true, message: 'Cache cleared' });
});

// Image proxy endpoint to bypass CORS for external images
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Validate URL
    const imageUrl = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    // Use dynamic import for https/http modules
    const httpModule = imageUrl.protocol === 'https:' 
      ? await import('https') 
      : await import('http');

    // Create a promise to fetch the image
    const fetchImage = () => new Promise((resolve, reject) => {
      const request = httpModule.default.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
        },
      }, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Follow redirect
          httpModule.default.get(response.headers.location, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/*,*/*;q=0.8',
            },
          }, (redirectResponse) => {
            resolve(redirectResponse);
          }).on('error', reject);
        } else {
          resolve(response);
        }
      });

      request.on('error', reject);
      request.setTimeout(15000, () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });

    const response = await fetchImage();

    if (response.statusCode !== 200) {
      return res.status(response.statusCode).json({ error: 'Failed to fetch image' });
    }

    // Get content type
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Set response headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    });

    // Pipe the image stream directly to response
    response.pipe(res);
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to fetch image', details: error.message });
  }
});

// QR Code Secret for signing
const QR_SECRET = process.env.QR_CODE_SECRET || 'your_secure_qr_secret_key_change_in_production';

// Utility functions for QR code generation and validation
const generateQRSignature = (payload) => {
  const data = `${payload.registration_id}:${payload.student_id}:${payload.event_id}:${payload.issued_at}`;
  return crypto.createHmac('sha256', QR_SECRET).update(data).digest('hex');
};

const validateQRSignature = (payload) => {
  try {
    const expectedSignature = generateQRSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(payload.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.log('Signature validation error:', error.message);
    return false;
  }
};

const generateUniqueRegistrationId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Generate QR content URL that works on both Android and iPhone
// iPhone's camera only opens URLs, not plain text
// Can accept optional request object to use the request's origin for dynamic URLs
const generateQRContentUrl = (registrationId, eventId, req = null) => {
  // Priority order:
  // 1. WEBSITE_URL env variable (for production deployment)
  // 2. Request origin (if request is passed and has origin/referer)
  // 3. FRONTEND_URL env variable (for development)
  // 4. Default fallback
  
  let baseUrl = process.env.WEBSITE_URL;
  
  if (!baseUrl && req) {
    // Try to get the origin from the request headers
    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
      // Extract base URL from origin/referer (remove trailing paths)
      try {
        const url = new URL(origin);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch (e) {
        // Invalid URL, continue to next fallback
      }
    }
  }
  
  if (!baseUrl) {
    baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }
  
  // Create a URL that points to a registration verification page
  // The frontend will display the registration details when this URL is opened
  const url = `${baseUrl}/verify-registration/${registrationId}?event=${eventId}`;
  return url;
};

// Generate readable text content for QR (supports single event or multiple events + sub-events)
const generateQRTextContent = (data) => {
  const lines = [];
  lines.push('EVENT REGISTRATION DETAILS');
  lines.push('═══════════════════════════════════');
  lines.push(`📋 Registration ID: ${data.registrationId}`);
  lines.push(`👤 Name: ${data.name}`);
  lines.push(`📧 Email: ${data.email}`);
  if (data.college) lines.push(`🏫 College: ${data.college}`);
  if (data.department) lines.push(`🏫 Department: ${data.department}`);
  if (data.team) lines.push(`👥 Team: ${data.team}`);
  if (data.seating) lines.push(`💺 Seating: ${data.seating}`);
  if (data.ticketType) lines.push(`🎟️ Ticket: ${data.ticketType}`);
  if (data.section) lines.push(`📚 Section: ${data.section || 'A'}`);
  if (data.year !== undefined) lines.push(`📅 Year: ${data.year}`);
  if (data.regId) lines.push(`🆔 Reg ID: ${data.regId}`);

  // If events array is provided, list them with possible sub-events
  if (Array.isArray(data.events) && data.events.length > 0) {
    data.events.forEach((ev, idx) => {
      lines.push(idx === 0 ? `🎯 Event: ${ev.title}` : `- ${ev.title}`);
      if (ev.venue) lines.push(`📍 Venue: ${ev.venue}`);
      if (ev.date) lines.push(`📅 Event Date: ${ev.date}`);
      if (ev.time) lines.push(`⏰ Time: ${ev.time}`);
      if (ev.team) lines.push(`  👥 Team: ${ev.team}`);
      if (ev.seating) lines.push(`  💺 Seating: ${ev.seating}`);
      if (ev.ticketType) lines.push(`  🎟️ Ticket: ${ev.ticketType}`);
      if (Array.isArray(ev.subEvents) && ev.subEvents.length > 0) {
        lines.push('  ▶ Sub-events:');
        ev.subEvents.forEach((sub) => {
          lines.push(`   - ${sub}`);
        });
      }
    });
  } else {
    if (data.eventTitle) lines.push(`🎯 Event: ${data.eventTitle}`);
    if (data.venue) lines.push(`📍 Venue: ${data.venue}`);
    if (data.eventDate) lines.push(`📅 Event Date: ${data.eventDate}`);
    if (data.eventTime) lines.push(`⏰ Time: ${data.eventTime}`);
  }

  if (data.registeredAt) lines.push(`✅ Registered At: ${data.registeredAt}`);
  lines.push('═══════════════════════════════════');
  lines.push('EventHub - College Event Management');

  return lines.join('\n');
};

// Custom QR Code generator with event name overlay
const generateQRCodeWithEventName = async (qrData, eventName, options = {}) => {
  const {
    size = 300,
    fontSize = 14,
    fontFamily = 'Arial',
    fontWeight = 'bold',
    maxChars = 40,
    position = 'below',
    backgroundColor = '#FFFFFF',
    textColor = '#000000',
    qrColor = '#000000'
  } = options;

  try {
    // Truncate event name if too long
    let displayName = eventName.length > maxChars 
      ? eventName.substring(0, maxChars - 3) + '...' 
      : eventName;

    // Generate QR code as PNG buffer
    const qrBuffer = qrImage.imageSync(qrData, { 
      type: 'png', 
      size: size / 4, // qr-image uses different sizing
      margin: 1,
      'parse-url': false
    });

    // Create canvas for combining QR with text
    const padding = 20;
    const textHeight = fontSize + 10;
    const canvasHeight = position === 'below' ? size + textHeight + (padding * 2) : size + (padding * 2);
    const canvasWidth = size + (padding * 2);

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Load and draw QR code
    const qrImg = await loadImage(qrBuffer);
    const qrX = padding;
    const qrY = position === 'below' ? padding : padding + textHeight;
    ctx.drawImage(qrImg, qrX, qrY, size, size);

    // Draw event name text
    ctx.fillStyle = textColor;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textX = canvasWidth / 2;
    const textY = position === 'below' 
      ? size + padding + (textHeight / 2)
      : textHeight / 2;

    // Add text background for better readability
    const textMetrics = ctx.measureText(displayName);
    const textWidth = textMetrics.width;
    const textPadding = 8;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(
      textX - (textWidth / 2) - textPadding,
      textY - (fontSize / 2) - 4,
      textWidth + (textPadding * 2),
      fontSize + 8
    );

    // Draw the text
    ctx.fillStyle = textColor;
    ctx.fillText(displayName, textX, textY);

    // Convert to data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('QR Code generation error:', error);
    // Fallback to basic QR code without overlay
    return await QRCode.toDataURL(qrData, {
      width: size,
      margin: 2,
      color: { dark: qrColor, light: backgroundColor }
    });
  }
};

// Connect to MongoDB Atlas with automatic retry and exponential backoff
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 2000; // 2 seconds
let connectionRetryAttempts = 0;
let isConnecting = false;

const connectToAtlas = async (retryCount = 0) => {
  const atlasUri = process.env.MONGODB_URI;

  if (!atlasUri) {
    console.error('FATAL: MONGODB_URI is not set. The server is configured to use MongoDB Atlas only.');
    process.exit(1);
  }

  // Prevent concurrent connection attempts
  if (isConnecting) {
    console.log('Connection attempt already in progress, skipping...');
    return;
  }

  isConnecting = true;

  try {
    // Enhanced mongoose connection options for better resilience
    const connectionOptions = {
      connectTimeoutMS: 15000,        // 15 second connection timeout
      serverSelectionTimeoutMS: 15000, // 15 second server selection timeout
      socketTimeoutMS: 45000,          // 45 second socket timeout
      heartbeatFrequencyMS: 10000,     // Check server health every 10 seconds
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10,                 // Connection pool size
      minPoolSize: 2,                  // Minimum connections to maintain
      maxIdleTimeMS: 30000,            // Close idle connections after 30 seconds
      family: 4,                       // Force IPv4 (can help with some DNS issues)
    };

    await mongoose.connect(atlasUri, connectionOptions);
    console.log(`✓ MongoDB connected to Atlas.`);
    connectionRetryAttempts = 0; // Reset retry counter on success
    isConnecting = false;
  } catch (err) {
    isConnecting = false;
    connectionRetryAttempts++;
    
    console.error(`✗ MongoDB Atlas connection error (attempt ${connectionRetryAttempts}/${MAX_RETRY_ATTEMPTS}):`, err.message || err);
    
    // Check if we should retry
    if (connectionRetryAttempts < MAX_RETRY_ATTEMPTS) {
      const delay = INITIAL_RETRY_DELAY * Math.pow(2, connectionRetryAttempts - 1); // Exponential backoff
      console.log(`⏳ Retrying connection in ${delay / 1000} seconds...`);
      
      setTimeout(() => connectToAtlas(connectionRetryAttempts), delay);
      return;
    }
    
    // Max retries reached - show troubleshooting tips
    console.error('\n❌ Max connection retries reached. Troubleshooting suggestions:');
    console.error('- Verify the `MONGODB_URI` in your environment (.env) is correct and contains the right username, password, and cluster host.');
    console.error('- If you see DNS/SRV lookup errors (e.g., "querySrv ESERVFAIL" or "ETIMEOUT"), your environment may not support SRV DNS lookups.');
    console.error('  * Try replacing the `mongodb+srv://` URI with the standard connection string (mongodb://host1,host2,.../?replicaSet=...) provided by Atlas.');
    console.error('  * Check local DNS, VPN, or firewall settings that might block SRV or DNS lookups.');
    console.error('- Ensure your IP/network is allowed in the Atlas Network Access whitelist or use 0.0.0.0/0 for testing (not recommended for production).');
    console.error('- Confirm the database user credentials in the URI are valid and have proper privileges.');
    console.error('- Check your internet connection and try again.');
    console.error('\nThe server will exit because it is configured to use Atlas only.');
    process.exit(1);
  }
};

// Handle disconnection with automatic reconnection
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB connection lost. Attempting to reconnect...');
  // Only attempt reconnection if not already connecting and under retry limit
  if (!isConnecting && connectionRetryAttempts < MAX_RETRY_ATTEMPTS) {
    setTimeout(() => connectToAtlas(), INITIAL_RETRY_DELAY);
  }
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
  // Don't exit on connection errors - let mongoose handle reconnection
});

connectToAtlas();

// After connection, initialize GridFS bucket
mongoose.connection.on('connected', async () => {
  try {
    gridFsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'eventImages' });
    console.log('GridFS bucket initialized.');
    
    // Initialize mail system after DB connection
    await initializeMailSystem();
  } catch (err) {
    console.error('Failed to init GridFS bucket:', err.message);
  }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  shutdownMailSystem();
  server.close(() => {
    console.log('Server closed.');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });
});

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student', required: true },
  accountStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' }, // Account approval status
  accountStatusUpdatedAt: { type: Date },
  accountStatusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isDisabled: { type: Boolean, default: false }, // Account disabled status (set to true when rejected)
  disabledAt: { type: Date }, // When the account was disabled
  disabledReason: { type: String }, // Reason for disabling the account
  college: { type: String, required: true }, // Institution / College name
  department: { type: String, required: true },
  branch: { type: String, required: true },
  mobile: { type: String, required: true },
  year: { type: Number, required: function () { return this.role === 'student'; } }, // Only required for students
  admissionMonth: { type: Number }, // Month of admission (1-12) for automatic year calculation
  admissionYear: { type: Number }, // Year of admission for automatic year calculation
  graduationYear: { type: Number }, // Expected graduation year
  lateralEntry: { type: Boolean, default: false }, // Whether student joined via lateral entry (2nd/3rd year)
  regId: { type: String }, // Add regId field for students
  section: { type: String }, // Student section
  roomNo: { type: String }, // Faculty room number
  avatar: { type: String }, // Add avatar field for profile pictures
  avatarGridFsId: { type: mongoose.Schema.Types.ObjectId },
  privacySettings: {
    showEmail: { type: Boolean, default: true },
    showMobile: { type: Boolean, default: true },
    showSection: { type: Boolean, default: true },
    showYear: { type: Boolean, default: true },
    showRegId: { type: Boolean, default: true },
    showDepartment: { type: Boolean, default: true },
    showAdmissionYear: { type: Boolean, default: true },
    showRoomNo: { type: Boolean, default: true },
    showStatistics: { type: Boolean, default: true }
  },
  emailPreferences: {
    registrations: { type: Boolean, default: true }, // New registrations for organizer's events
    waitlist: { type: Boolean, default: true }, // Waitlist updates
    eventUpdates: { type: Boolean, default: true }, // Event changes and announcements
    teamNotifications: { type: Boolean, default: true } // Team-related notifications
  },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for User schema - optimize common queries
userSchema.index({ email: 1 }, { unique: true }); // Already unique, add explicit index
userSchema.index({ role: 1 }); // For filtering by role
userSchema.index({ college: 1 }); // For college-specific queries
userSchema.index({ role: 1, college: 1 }); // Compound index for role + college queries
userSchema.index({ accountStatus: 1 }); // For admin approval queries
userSchema.index({ createdAt: -1 }); // For sorting by creation date

const User = mongoose.model('User', userSchema);

// Connect User model to admin email service for dynamic admin notifications
setUserModel(User);

// System Settings Schema - for global application settings
const systemSettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
});
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);

// Helper function to get system setting
async function getSystemSetting(key, defaultValue = null) {
  const setting = await SystemSettings.findOne({ key });
  return setting ? setting.value : defaultValue;
}

// Helper function to set system setting
async function setSystemSetting(key, value, userId = null) {
  await SystemSettings.findOneAndUpdate(
    { key },
    { value, updatedBy: userId, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}

// Helper function to calculate current year of study based on admission date
// B.Tech is 4 years, academic year starts in July/August
function calculateCurrentYear(admissionMonth, admissionYear) {
  if (!admissionMonth || !admissionYear) return 1; // Default to 1st year if no admission data
  
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
  const currentYear = now.getFullYear();
  
  // Calculate the number of academic years completed
  // Academic year runs from July to June
  let academicYearsCompleted = currentYear - admissionYear;
  
  // If we're currently before July (Jan-Jun), we're still in the previous academic year
  if (currentMonth < 7) {
    academicYearsCompleted -= 1;
  }
  
  // If student was admitted before July, they started in that academic year
  // If student was admitted in July or after, they started in the next academic year
  if (admissionMonth < 7) {
    // Student admitted mid-year (Jan-Jun), so they were in previous academic year
    academicYearsCompleted += 1;
  }
  
  // Current year of study = academic years completed + 1
  const calculatedYear = academicYearsCompleted + 1;
  
  // Ensure year is between 1 and 4
  if (calculatedYear < 1) return 1;
  if (calculatedYear > 4) return 4;
  
  return calculatedYear;
}

// Event Schema (extended for uploaded image metadata & GridFS - backward compatible)
const eventSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: String,
  date: Date,
  time: String,
  endTime: String,
  venue: String,
  maxParticipants: Number,
  currentParticipants: { type: Number, default: 0 },
  organizerId: String,
  image: String,
  imageType: { type: String, enum: ['url', 'upload', 'gridfs'], default: 'url' },
  imageGridFsId: { type: mongoose.Schema.Types.ObjectId },
  imageWidth: { type: Number },
  imageHeight: { type: Number },
  imageOriginalName: { type: String },
  requirements: [String],
  prizes: [String],
  status: { type: String, default: 'upcoming', enum: ['upcoming', 'ongoing', 'completed', 'cancelled'] },
  registrationDeadline: Date,
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  accessControl: {
    type: { type: String, enum: ['everyone', 'students_only', 'faculty_only', 'custom'], default: 'everyone' },
    allowedDepartments: [String],
    allowedYears: [Number],
    allowedRoles: [String]
  },
  autoApproval: { type: Boolean, default: true },
  // College-specific settings
  allowOtherColleges: { type: Boolean, default: false }, // OFF = only college students can register (default), ON = anyone can register
  notifyAllUsers: { type: Boolean, default: false }, // OFF = notify only college students (default), ON = notify all users
  visibleToOthers: { type: Boolean, default: false }, // OFF = event hidden from other colleges (default), ON = visible to all
  silentRelease: { type: Boolean, default: false }, // OFF = send notifications (default), ON = no notifications when event is created
  collegeName: { type: String, default: 'DVR & Dr. HS MIC College of Technology' },
  // Team event settings
  isTeamEvent: { type: Boolean, default: false },
  minTeamSize: { type: Number, default: 2 },
  maxTeamSize: { type: Number, default: 4 },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for Event schema - optimize common queries
eventSchema.index({ date: 1 }); // For date-based queries
eventSchema.index({ status: 1 }); // For filtering by status
eventSchema.index({ organizerId: 1 }); // For organizer's events
eventSchema.index({ category: 1 }); // For category filters
eventSchema.index({ date: 1, status: 1 }); // Compound index for upcoming events
eventSchema.index({ createdAt: -1 }); // For sorting by creation date
eventSchema.index({ collegeName: 1 }); // For college-specific events
eventSchema.index({ 'accessControl.type': 1 }); // For access control queries

const Event = mongoose.model('Event', eventSchema);

// Spot Registration Schema - for participants added during winner selection
const spotRegistrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  participantName: { type: String, required: true },
  identifier: String,
  notes: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
spotRegistrationSchema.index({ eventId: 1 });
const SpotRegistration = mongoose.model('SpotRegistration', spotRegistrationSchema);

// Winner Schema - for storing event winners
const winnerSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  position: { type: Number, required: true },
  prize: String,
  participantType: { type: String, enum: ['registered', 'spot'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  spotRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SpotRegistration' },
  participantName: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
winnerSchema.index({ eventId: 1, position: 1 }, { unique: true });
const Winner = mongoose.model('Winner', winnerSchema);

// Sub-Event Schema - Events within main events
const subEventSchema = new mongoose.Schema({
  parentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  title: { type: String, required: true },
  description: String,
  date: Date,
  time: String,
  venue: String,
  maxParticipants: Number,
  currentParticipants: { type: Number, default: 0 },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: String,
  requirements: [String],
  prizes: [String],
  status: { type: String, default: 'upcoming', enum: ['upcoming', 'ongoing', 'completed', 'cancelled'] },
  
  // Access Control
  accessControl: {
    type: { type: String, enum: ['everyone', 'students_only', 'faculty_only', 'custom'], default: 'everyone' },
    allowedDepartments: [String], // Empty array = all departments
    allowedYears: [Number], // Empty array = all years (for students)
    allowedRoles: [{ type: String, enum: ['student', 'faculty', 'organizer', 'admin'] }] // Empty array = all roles
  },
  
  // Team event settings
  isTeamEvent: { type: Boolean, default: false },
  minTeamSize: { type: Number, default: 2 },
  maxTeamSize: { type: Number, default: 4 },
  
  registrationDeadline: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for SubEvent schema - optimize common queries
subEventSchema.index({ parentEventId: 1 }); // For fetching sub-events of an event
subEventSchema.index({ parentEventId: 1, status: 1 }); // Compound for filtering by status
subEventSchema.index({ organizerId: 1 }); // For organizer's sub-events
subEventSchema.index({ date: 1 }); // For date-based queries
subEventSchema.index({ createdAt: -1 }); // For sorting by creation date

const SubEvent = mongoose.model('SubEvent', subEventSchema);

// Sub-Event Spot Registration Schema - for participants added during winner selection
const subEventSpotRegistrationSchema = new mongoose.Schema({
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  participantName: { type: String, required: true },
  identifier: String,
  notes: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
subEventSpotRegistrationSchema.index({ subEventId: 1 });
const SubEventSpotRegistration = mongoose.model('SubEventSpotRegistration', subEventSpotRegistrationSchema);

// Sub-Event Winner Schema - for storing sub-event winners
const subEventWinnerSchema = new mongoose.Schema({
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  position: { type: Number, required: true },
  prize: String,
  participantType: { type: String, enum: ['registered', 'spot'], required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  spotRegistrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventSpotRegistration' },
  participantName: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});
subEventWinnerSchema.index({ subEventId: 1, position: 1 }, { unique: true });
const SubEventWinner = mongoose.model('SubEventWinner', subEventWinnerSchema);

// Sub-Event Registration Schema
const subEventRegistrationSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  parentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  parentRegistrationId: { type: String }, // Link to parent event registration
  registeredAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['registered', 'attended', 'absent', 'cancelled'], default: 'registered' },
  source: { type: String, enum: ['direct', 'waitlist'], default: 'direct' },
  qrCode: { type: String },
  qrPayload: {
    registration_id: String,
    student_id: String,
    sub_event_id: String,
    parent_event_id: String,
    issued_at: String,
    expires_at: String,
    signature: String,
    event_title: String,
    student_name: String
  },
  scanLogs: [{
    scannedAt: { type: Date, default: Date.now },
    scannedBy: String,
    location: String,
    status: { type: String, enum: ['valid', 'invalid', 'expired', 'duplicate'], required: true },
    notes: String
  }]
});

subEventRegistrationSchema.index({ userId: 1, subEventId: 1 }, { unique: true });
// Additional indexes for SubEventRegistration
subEventRegistrationSchema.index({ subEventId: 1 }); // For sub-event attendees
subEventRegistrationSchema.index({ subEventId: 1, status: 1 }); // For status filtering
subEventRegistrationSchema.index({ parentEventId: 1 }); // For parent event queries
subEventRegistrationSchema.index({ userId: 1 }); // For user's registrations
subEventRegistrationSchema.index({ registrationId: 1 }); // For QR lookups
subEventRegistrationSchema.index({ registeredAt: -1 }); // For sorting

const SubEventRegistration = mongoose.model('SubEventRegistration', subEventRegistrationSchema);

// Sub-Event Waitlist Schema
const subEventWaitlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  parentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  joinedAt: { type: Date, default: Date.now },
  position: { type: Number }, // Position in waitlist
  status: { type: String, enum: ['waiting', 'promoted', 'expired', 'cancelled'], default: 'waiting' },
  notificationSent: { type: Boolean, default: false }
});

subEventWaitlistSchema.index({ userId: 1, subEventId: 1 }, { unique: true });
subEventWaitlistSchema.index({ subEventId: 1, status: 1, joinedAt: 1 }); // For efficient waitlist queries
const SubEventWaitlist = mongoose.model('SubEventWaitlist', subEventWaitlistSchema);

// Sub-Event Comment Schema
const subEventCommentSchema = new mongoose.Schema({
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventComment' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for SubEventComment schema
subEventCommentSchema.index({ subEventId: 1 }); // For fetching comments of a sub-event
subEventCommentSchema.index({ subEventId: 1, createdAt: -1 }); // For sorted comment listing
subEventCommentSchema.index({ parentId: 1 }); // For fetching replies

const SubEventComment = mongoose.model('SubEventComment', subEventCommentSchema);

// Sub-Event Team Schema - Teams for sub-events
const subEventTeamSchema = new mongoose.Schema({
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  parentEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['leader', 'member'], default: 'member' }
  }],
  maxMembers: { type: Number, default: 5 },
  status: { type: String, enum: ['forming', 'complete', 'registered', 'disqualified'], default: 'forming' },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventRegistration' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

subEventTeamSchema.index({ subEventId: 1, name: 1 }, { unique: true });
subEventTeamSchema.index({ subEventId: 1, leaderId: 1 }, { unique: true });
const SubEventTeam = mongoose.model('SubEventTeam', subEventTeamSchema);

// Sub-Event Team Join Request Schema
const subEventTeamJoinRequestSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventTeam', required: true },
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'], default: 'pending' },
  message: String,
  respondedAt: Date,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

subEventTeamJoinRequestSchema.index({ teamId: 1, toUserId: 1, status: 1 });
subEventTeamJoinRequestSchema.index({ subEventId: 1, toUserId: 1 });
const SubEventTeamJoinRequest = mongoose.model('SubEventTeamJoinRequest', subEventTeamJoinRequestSchema);

// Sub-Event Team Invitation Schema (for registered users)
const subEventTeamInvitationSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventTeam', required: true },
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'], default: 'pending' },
  message: String,
  inviteToEvent: { type: Boolean, default: false }, // If true, this is an invite to register + join team
  respondedAt: Date,
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

subEventTeamInvitationSchema.index({ teamId: 1, toUserId: 1, status: 1 });
subEventTeamInvitationSchema.index({ subEventId: 1, toUserId: 1 });
const SubEventTeamInvitation = mongoose.model('SubEventTeamInvitation', subEventTeamInvitationSchema);

// Sub-Event Team Invitation Token Schema (for non-platform users)
const subEventTeamInvitationTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEventTeam', required: true },
  subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitedEmail: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'expired', 'cancelled'], default: 'pending' },
  message: { type: String },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }
});

subEventTeamInvitationTokenSchema.index({ token: 1 });
subEventTeamInvitationTokenSchema.index({ teamId: 1, invitedEmail: 1 });
subEventTeamInvitationTokenSchema.index({ subEventId: 1, status: 1 });
const SubEventTeamInvitationToken = mongoose.model('SubEventTeamInvitationToken', subEventTeamInvitationTokenSchema);

// Registration Schema - Enhanced for per-event QR codes
const registrationSchema = new mongoose.Schema({
  registrationId: { type: String, unique: true, required: true }, // Unique per registration
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  registeredAt: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'registered', 'attended', 'absent', 'cancelled'], 
    default: 'registered' 
  },
  approvalStatus: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'approved' 
  }, // Separate approval tracking
  approvalType: {
    type: String,
    enum: ['autoApproved', 'manualApproved', 'waitingListApproval'],
    default: undefined
  }, // Explicit classification for UI
  fromWaitlist: { type: Boolean, default: false }, // Track if user was approved from waitlist
  approvedAt: { type: Date }, // When the registration was approved
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who approved it
  rejectedAt: { type: Date }, // When the registration was rejected
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who rejected it
  rejectionReason: { type: String }, // Reason for rejection
  qrCode: { type: String }, // Base64 QR code image - only generated when approved
  qrPayload: {
    registration_id: String,
    student_id: String,
    event_id: String,
    issued_at: String,
    expires_at: String,
    signature: String,
    event_title: String,
    student_name: String
  },
  scanLogs: [{
    scannedAt: { type: Date, default: Date.now },
    scannedBy: String,
    location: String,
    status: { type: String, enum: ['valid', 'invalid', 'expired', 'duplicate'], required: true },
    notes: String
  }]
});

// Ensure unique registration per student per event
registrationSchema.index({ userId: 1, eventId: 1 }, { unique: true });
// Additional indexes for Registration - optimize common queries
registrationSchema.index({ eventId: 1 }); // For event attendees list
registrationSchema.index({ eventId: 1, status: 1 }); // For filtering by status
registrationSchema.index({ userId: 1 }); // For user's registrations
registrationSchema.index({ registrationId: 1 }); // For QR code lookups
registrationSchema.index({ registeredAt: -1 }); // For sorting by date
registrationSchema.index({ approvalStatus: 1 }); // For pending approvals
// NEW: Compound indexes for faster waiting list and approval queries
registrationSchema.index({ eventId: 1, approvalStatus: 1, registeredAt: 1 }); // Waiting list sorted by registration time
registrationSchema.index({ userId: 1, approvalStatus: 1 }); // User's pending registrations
registrationSchema.index({ eventId: 1, status: 1, approvalStatus: 1 }); // Complex status queries

const Registration = mongoose.model('Registration', registrationSchema);

// Scan Log Schema for detailed tracking
const scanLogSchema = new mongoose.Schema({
  registrationId: { type: String, required: true },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: String,
  location: String,
  status: { type: String, enum: ['valid', 'invalid', 'expired', 'duplicate'], required: true },
  notes: String,
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const ScanLog = mongoose.model('ScanLog', scanLogSchema);

// Waitlist Schema
const waitlistSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  position: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for Waitlist schema
waitlistSchema.index({ eventId: 1, position: 1 }); // For waitlist ordering
waitlistSchema.index({ userId: 1, eventId: 1 }, { unique: true }); // Unique per user per event
waitlistSchema.index({ eventId: 1, createdAt: 1 }); // For time-based queries

const Waitlist = mongoose.model('Waitlist', waitlistSchema);

// Comment Schema
const commentSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }, // For replies
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add indexes for Comment schema
commentSchema.index({ eventId: 1 }); // For fetching comments of an event
commentSchema.index({ eventId: 1, createdAt: -1 }); // For sorted comment listing
commentSchema.index({ parentId: 1 }); // For fetching replies
commentSchema.index({ userId: 1 }); // For user's comments

const Comment = mongoose.model('Comment', commentSchema);

// Notification Preferences Schema
const notificationPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  emailNotifications: { type: Boolean, default: true },
  preferences: {
    eventCreated: { type: Boolean, default: true },
    eventUpdated: { type: Boolean, default: true },
    eventCancelled: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true },
    capacityAlerts: { type: Boolean, default: true },
    waitlistUpdates: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    friendActivity: { type: Boolean, default: true },
    announcements: { type: Boolean, default: true }
  }
});
const NotificationPreferences = mongoose.model('NotificationPreferences', notificationPreferencesSchema);

// Friend Schema
const friendSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'blocked'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const Friend = mongoose.model('Friend', friendSchema);

// Team Schema - For event team registrations
const teamSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  name: { type: String, required: true },
  leaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Team creator/leader
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['leader', 'member'], default: 'member' }
  }],
  maxMembers: { type: Number, default: 5 }, // Maximum team size
  status: { type: String, enum: ['forming', 'complete', 'registered', 'disqualified'], default: 'forming' },
  registrationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration' }, // Link to event registration when complete
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Ensure unique team name per event
teamSchema.index({ eventId: 1, name: 1 }, { unique: true });
// Ensure leader can only lead one team per event
teamSchema.index({ eventId: 1, leaderId: 1 }, { unique: true });

const Team = mongoose.model('Team', teamSchema);

// Team Join Request Schema - For managing team invitations
const teamJoinRequestSchema = new mongoose.Schema({
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who sent the request (team leader)
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Who receives the request
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'expired', 'cancelled'], default: 'pending' },
  message: { type: String }, // Optional message from leader
  respondedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date } // Request expiration (e.g., registration deadline)
});

// Ensure one pending request per user per team
teamJoinRequestSchema.index({ teamId: 1, toUserId: 1, status: 1 });
// Ensure user can only have one pending request per event
teamJoinRequestSchema.index({ eventId: 1, toUserId: 1 });

const TeamJoinRequest = mongoose.model('TeamJoinRequest', teamJoinRequestSchema);

// Team Invitation Token Schema - For inviting non-platform users
const teamInvitationTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  invitedEmail: { type: String, required: true }, // Email of the person being invited
  inviteType: { type: String, enum: ['platform_user', 'non_platform'], required: true }, // Type of invitation
  status: { type: String, enum: ['pending', 'accepted', 'expired', 'cancelled'], default: 'pending' },
  message: { type: String }, // Optional message from leader
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // User who accepted (after registration)
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true } // Token expiration (usually registration deadline)
});

teamInvitationTokenSchema.index({ token: 1 });
teamInvitationTokenSchema.index({ teamId: 1, invitedEmail: 1 });
teamInvitationTokenSchema.index({ eventId: 1, status: 1 });

const TeamInvitationToken = mongoose.model('TeamInvitationToken', teamInvitationTokenSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // User who receives the notification
  type: { 
    type: String, 
    enum: [
      'event_created', 'event_deleted', 'event_updated', 'registered', 'unregistered', 
      'registration_deleted', 'reminder_24h', 'reminder_1h', 'capacity_alert', 
      'waitlist_added', 'waitlist_promoted', 'comment_added', 'comment_reply',
      'event_cancelled', 'event_postponed', 'venue_changed', 'friend_registered',
      'trending_event', 'spot_available', 'announcement', 'custom_announcement',
      'sub_event_created', 'sub_event_updated', 'sub_event_deleted',
      'registration_approved', 'registration_rejected', 'registration_pending',
      'waiting_list', 'new_waitlist_entry',
      // Team-related notification types
      'team_invite', 'team_invite_accepted', 'team_invite_rejected',
      'team_member_removed', 'team_member_left', 'team_disbanded',
      'team_renamed', 'team_complete'
    ], 
    required: true 
  },
  title: { type: String }, // Optional title for announcements
  message: { type: String, required: true },
  data: { 
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
    eventTitle: String,
    eventImage: String,
    subEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubEvent' },
    subEventTitle: String,
    relatedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    commentId: { type: mongoose.Schema.Types.ObjectId },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    teamName: String,
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamJoinRequest' },
    // Enhanced event details for email notifications
    eventDate: Date,
    eventTime: String,
    eventVenue: String,
    registrationId: { type: mongoose.Schema.Types.ObjectId },
    position: Number, // Waitlist position
    reason: String, // For rejections
    changes: Object, // For tracking specific changes
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    sender: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      role: String
    },
    timestamp: Date
  },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent', 'critical'], default: 'normal' },
  read: { type: Boolean, default: false },
  clicked: { type: Boolean, default: false }, // For analytics
  createdAt: { type: Date, default: Date.now }
});

// Add indexes for Notification schema - optimize notification queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 }); // For unread notifications
notificationSchema.index({ user: 1, createdAt: -1 }); // For user's notifications list
notificationSchema.index({ 'data.eventId': 1 }); // For event-related notifications
notificationSchema.index({ type: 1 }); // For filtering by notification type
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL index: auto-delete after 30 days

const Notification = mongoose.model('Notification', notificationSchema);

// Helper function to build notification data with event details
const buildNotificationData = (event, extraData = {}) => {
  const data = { ...extraData };
  if (event) {
    data.eventId = event._id;
    data.eventTitle = event.title;
    data.eventImage = event.image;
    data.eventDate = event.date;
    data.eventTime = event.time;
    data.eventVenue = event.venue;
  }
  return data;
};

// --- Utility function to create and emit notifications ---
const notifyUser = async (req, userId, type, message, data = {}, priority = 'normal') => {
  try {
    // Check user notification preferences
    const prefs = await NotificationPreferences.findOne({ userId });
    let shouldSendEmail = true; // Default to sending email
    
    // Get user to check new emailPreferences (for organizers)
    const user = await User.findById(userId).select('email name role emailPreferences');
    
    if (prefs) {
      // Check if email notifications are enabled
      shouldSendEmail = prefs.emailNotifications !== false;
      
      // Map notification types to preference keys
      const prefMap = {
        'event_created': 'eventCreated',
        'event_updated': 'eventUpdated',
        'event_cancelled': 'eventCancelled',
        'event_postponed': 'eventCancelled',
        'venue_changed': 'eventUpdated',
        'reminder_24h': 'reminders',
        'reminder_1h': 'reminders',
        'capacity_alert': 'capacityAlerts',
        'spot_available': 'capacityAlerts',
        'comment_added': 'comments',
        'comment_reply': 'comments',
        'friend_registered': 'friendActivity',
        'custom_announcement': 'announcements',
        'registration_approved': 'eventUpdated', // Map to general event updates
        'registration_rejected': 'eventUpdated', // Map to general event updates
        'registration_pending': 'eventUpdated', // Map to general event updates
        'waiting_list': 'waitlistUpdates', // When user is put on waiting list
        'waitlist_promoted': 'waitlistUpdates', // When user is promoted from waitlist
        'waitlist_added': 'waitlistUpdates', // When user is added to waitlist
        'new_waitlist_entry': 'eventUpdated' // When organizer gets notified of new waitlist user
      };
      
      const prefKey = prefMap[type];
      if (prefKey && !prefs.preferences[prefKey]) {
        console.log(`User ${userId} has disabled notifications for ${prefKey}, skipping ${type}`);
        return null; // User has disabled this notification type
      }
    }
    
    // Check new email preferences for organizers/admins (registrations, waitlist, eventUpdates, teamNotifications)
    if (user && (user.role === 'organizer' || user.role === 'admin') && user.emailPreferences) {
      const emailPrefMap = {
        'new_waitlist_entry': 'waitlist', // Organizer/Admin receives waitlist notification
        'waitlist_promotion': 'waitlist', // When someone is promoted from waitlist
        'registration_approved': 'registrations', // Registration-related
        'registration_rejected': 'registrations',
        'registration_pending': 'registrations',
        'registered': 'registrations',
        'event_updated': 'eventUpdates', // Event updates for organizer/admin
        'event_cancelled': 'eventUpdates',
        'event_postponed': 'eventUpdates',
        'venue_changed': 'eventUpdates',
        'team_invitation': 'teamNotifications', // Team-related
        'team_removed': 'teamNotifications',
        'team_updated': 'teamNotifications'
      };
      
      const emailPrefKey = emailPrefMap[type];
      if (emailPrefKey && user.emailPreferences[emailPrefKey] === false) {
        console.log(`${user.role === 'admin' ? 'Admin' : 'Organizer'} ${user.email} has disabled '${emailPrefKey}' notifications, skipping email for: ${type}`);
        shouldSendEmail = false; // Skip email if preference is disabled
      }
    }
    
    console.log(`Creating notification for user ${userId}: ${type} - ${message}`);
    
    const notification = await Notification.create({
      user: userId,
      type,
      message,
      data,
      priority,
    });
    const populatedNotification = await Notification.findById(notification._id).populate('user');
    
    console.log(`Notification created: ${notification._id}`);
    
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notification', populatedNotification);
      console.log(`Emitted notification to user_${userId}`);
    } else {
      console.log('Socket.io instance not found');
    }
    
    // Skip email for notification types that have dedicated email templates sent separately
    // This prevents duplicate emails - only skip when a SEPARATE dedicated email is sent
    const skipEmailTypes = [
      'registered',           // Has dedicated sendEventRegistrationEmail sent separately
      'friend_registered'     // Don't spam friends with emails - in-app only
    ];
    
    if (skipEmailTypes.includes(type)) {
      console.log(`📧 Skipping duplicate email for '${type}' - dedicated email sent separately`);
      return populatedNotification;
    }
    
    // Send email notification if enabled
    if (shouldSendEmail) {
      try {
        // Get user details for email (already loaded above, just use it)
        if (user && user.email) {
          await sendNotificationEmail(user.email, user.name, {
            type,
            message,
            title: data.title || null,
            data,
            priority,
          });
          console.log(`📧 Email notification sent to ${user.email} for: ${type}`);
        }
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError.message);
        // Don't fail the notification if email fails
      }
    }
    
    return populatedNotification;
  } catch (error) {
    console.error('Failed to create or emit notification:', error);
  }
};

// --- Notification API Endpoints ---

// Get all notifications for a user
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Could not fetch notifications' });
  }
});

// Mark notification as read
app.patch('/api/notifications/:notificationId/read', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { clicked } = req.body; // Track if notification was clicked
    
    const updateData = { read: true };
    if (clicked) {
      updateData.clicked = true;
    }
    
    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      updateData,
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.status(200).json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Could not mark notification as read' });
  }
});

// Delete all notifications for a user
app.delete('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await Notification.deleteMany({ user: userId });
    res.status(200).json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ error: 'Could not clear notifications' });
  }
});

// Get notification analytics for organizer
app.get('/api/notifications/analytics/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const notifications = await Notification.find({ 'data.eventId': eventId });
    const total = notifications.length;
    const read = notifications.filter(n => n.read).length;
    const clicked = notifications.filter(n => n.clicked).length;
    
    res.json({
      total,
      read,
      clicked,
      readRate: total > 0 ? ((read / total) * 100).toFixed(2) : 0,
      clickRate: total > 0 ? ((clicked / total) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

// Broadcast announcement to all users
app.post('/api/announcements/broadcast', async (req, res) => {
  try {
    const { userId, title, message, priority = 'normal' } = req.body;

    // Verify the sender is admin or organizer
    const sender = await User.findById(userId);
    if (!sender || (sender.role !== 'admin' && sender.role !== 'organizer')) {
      return res.status(403).json({ error: 'Only admins and organizers can send announcements' });
    }

    // Get all users with their notification preferences
    const allUsers = await User.find({});
    
    // Create notifications for all users
    const notifications = [];
    const io = req.app.get('io');
    let emailsSent = 0;

    for (const user of allUsers) {
      try {
        // Check user notification preferences
        const prefs = await NotificationPreferences.findOne({ userId: user._id });
        
        // Check if user has disabled announcements
        if (prefs && prefs.preferences && prefs.preferences.announcements === false) {
          console.log(`User ${user._id} has disabled announcements, skipping`);
          continue;
        }
        
        const notification = await Notification.create({
          user: user._id,
          type: 'announcement',
          title: title,
          message: `${title}: ${message}`,
          data: {
            title,
            message,
            sender: sender.name,
            senderRole: sender.role
          },
          priority
        });

        const populatedNotification = await Notification.findById(notification._id).populate('user');
        notifications.push(populatedNotification);

        // Emit to individual user
        if (io) {
          io.to(`user_${user._id}`).emit('notification', populatedNotification);
        }
        
        // Send email notification if enabled
        const shouldSendEmail = !prefs || prefs.emailNotifications !== false;
        if (shouldSendEmail && user.email) {
          try {
            await sendNotificationEmail(user.email, user.name, {
              type: 'announcement',
              message: `${title}: ${message}`,
              title: title,
              data: {
                title,
                message,
                sender: { name: sender.name, role: sender.role }
              },
              priority
            });
            emailsSent++;
            console.log(`📧 Announcement email sent to ${user.email}`);
          } catch (emailError) {
            console.error(`Failed to send announcement email to ${user.email}:`, emailError.message);
          }
        }
      } catch (error) {
        console.error(`Failed to create notification for user ${user._id}:`, error);
      }
    }

    res.status(200).json({ 
      message: 'Announcement sent successfully',
      notificationCount: notifications.length,
      emailsSent
    });
  } catch (error) {
    console.error('Error broadcasting announcement:', error);
    res.status(500).json({ error: 'Failed to broadcast announcement' });
  }
});

// Notification Preferences endpoints
app.get('/api/notification-preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    let prefs = await NotificationPreferences.findOne({ userId });
    
    if (!prefs) {
      // Create default preferences
      prefs = await NotificationPreferences.create({ userId });
    }
    
    // For organizers/admins, also include their emailPreferences from User
    const user = await User.findById(userId).select('role emailPreferences');
    if (user && (user.role === 'organizer' || user.role === 'admin')) {
      prefs = prefs.toObject ? prefs.toObject() : prefs;
      prefs.emailPreferences = user.emailPreferences || {
        registrations: true,
        waitlist: true,
        eventUpdates: true,
        teamNotifications: true
      };
    }
    
    res.json(prefs);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Could not fetch preferences' });
  }
});

app.patch('/api/notification-preferences/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    const { emailPreferences } = updates;
    
    // Separate emailPreferences from regular preferences
    const prefUpdates = { ...updates };
    delete prefUpdates.emailPreferences;
    
    // Update notification preferences
    let prefs = await NotificationPreferences.findOneAndUpdate(
      { userId },
      prefUpdates,
      { new: true, upsert: true }
    );
    
    // Update emailPreferences for organizers/admins if provided
    if (emailPreferences) {
      const user = await User.findById(userId);
      if (user && (user.role === 'organizer' || user.role === 'admin')) {
        user.emailPreferences = {
          ...user.emailPreferences,
          ...emailPreferences
        };
        await user.save();
      }
    }
    
    res.json(prefs);
  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Could not update preferences' });
  }
});

// Waitlist endpoints
app.post('/api/events/:eventId/waitlist', async (req, res) => {
  try {
    const { userId } = req.body;
    const { eventId } = req.params;
    
    // Check if already in waitlist
    const existing = await Waitlist.findOne({ userId, eventId });
    if (existing) {
      return res.status(400).json({ error: 'Already in waitlist' });
    }
    
    // Get position
    const count = await Waitlist.countDocuments({ eventId });
    const waitlistEntry = await Waitlist.create({
      userId,
      eventId,
      position: count + 1
    });
    
    const event = await Event.findById(eventId);
    await notifyUser(
      req,
      userId,
      'waitlist_added',
      `You have been added to the waitlist for '${event.title}' (Position: ${count + 1})`,
      buildNotificationData(event, { position: count + 1 })
    );
    
    res.json(waitlistEntry);
  } catch (error) {
    console.error('Error adding to waitlist:', error);
    res.status(500).json({ error: 'Could not add to waitlist' });
  }
});

// Alias for frontend: Join waitlist
app.post('/api/events/:eventId/waitlist/join', async (req, res) => {
  // Reuse the same handler as /waitlist
  req.url = req.url.replace('/waitlist/join', '/waitlist');
  return app._router.handle(req, res);
});

app.get('/api/events/:eventId/waitlist', async (req, res) => {
  try {
    const { eventId } = req.params;
    const waitlist = await Waitlist.find({ eventId })
      .populate('userId', 'name email regId department year section')
      .sort({ position: 1 });
    
    // Format response to match frontend expectations
    const formattedWaitlist = waitlist.map(entry => ({
      _id: entry._id,
      user: {
        _id: entry.userId._id,
        name: entry.userId.name,
        email: entry.userId.email,
        regId: entry.userId.regId,
        department: entry.userId.department,
        year: entry.userId.year,
        section: entry.userId.section
      },
      position: entry.position,
      joinedAt: entry.createdAt
    }));
    
    res.json({ waitlist: formattedWaitlist });
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Could not fetch waitlist' });
  }
});

// Get current user's waitlist status for an event
app.get('/api/events/:eventId/waitlist/status', async (req, res) => {
  try {
    const { eventId } = req.params;
    // Try authenticated user first, else accept ?userId
    const userId = (req.user && req.user.userId) || req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const entry = await Waitlist.findOne({ eventId, userId });
    if (!entry) {
      return res.json({ onWaitlist: false, position: null });
    }
    return res.json({ onWaitlist: true, position: entry.position });
  } catch (error) {
    console.error('Error fetching waitlist status:', error);
    res.status(500).json({ error: 'Could not fetch waitlist status' });
  }
});

// Approve user from waitlist (admin/organizer only)
app.post('/api/events/:eventId/waitlist/:waitlistId/approve', async (req, res) => {
  try {
    const { eventId, waitlistId } = req.params;
    const userId = req.user.userId;
    
    // Check if user is admin or organizer
    const user = await User.findById(userId);
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (user.role !== 'admin' && event.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get waitlist entry
    const waitlistEntry = await Waitlist.findById(waitlistId).populate('userId');
    if (!waitlistEntry) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }
    
    const waitlistUserId = waitlistEntry.userId._id;
    
    // Check if user is already registered
    const existingReg = await Registration.findOne({ userId: waitlistUserId, eventId });
    if (existingReg) {
      return res.status(400).json({ error: 'User is already registered' });
    }
    
    // Create registration (allow even if at capacity)
    const registration = await Registration.create({
      userId: waitlistUserId,
      eventId,
      fromWaitlist: true,  // Mark as approved from waitlist
      approvalStatus: 'approved',
      status: 'registered',
      approvedAt: new Date(),
      approvedBy: userId,
      approvalType: 'waitingListApproval'
    });
    
    // Update event participant count
    event.currentParticipants += 1;
    await event.save();
    
    // Remove from waitlist
    await Waitlist.findByIdAndDelete(waitlistId);
    
    // Update positions for remaining waitlist users
    const remainingWaitlist = await Waitlist.find({ eventId }).sort({ position: 1 });
    for (let i = 0; i < remainingWaitlist.length; i++) {
      remainingWaitlist[i].position = i + 1;
      await remainingWaitlist[i].save();
    }
    
    // Notify the user with enhanced event details
    await notifyUser(
      req,
      waitlistUserId,
      'waitlist_promoted',
      `🎉 Great news! You've been approved for '${event.title}'! You are now registered.`,
      buildNotificationData(event, { registrationId: registration._id }),
      'critical'
    );
    
    res.json({ 
      success: true, 
      message: 'User approved and registered',
      registration 
    });
  } catch (error) {
    console.error('Error approving waitlist user:', error);
    res.status(500).json({ error: 'Could not approve user' });
  }
});

// Remove user from waitlist (admin/organizer only)
app.delete('/api/events/:eventId/waitlist/:waitlistId', async (req, res) => {
  try {
    const { eventId, waitlistId } = req.params;
    const userId = req.user.userId;
    
    // Check if user is admin or organizer
    const user = await User.findById(userId);
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (user.role !== 'admin' && event.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Remove from waitlist
    const deleted = await Waitlist.findByIdAndDelete(waitlistId);
    if (!deleted) {
      return res.status(404).json({ error: 'Waitlist entry not found' });
    }
    
    // Update positions for remaining waitlist users
    const remainingWaitlist = await Waitlist.find({ eventId }).sort({ position: 1 });
    for (let i = 0; i < remainingWaitlist.length; i++) {
      remainingWaitlist[i].position = i + 1;
      await remainingWaitlist[i].save();
    }
    
    res.json({ success: true, message: 'User removed from waitlist' });
  } catch (error) {
    console.error('Error removing from waitlist:', error);
    res.status(500).json({ error: 'Could not remove user' });
  }
});

// Alias for frontend: Leave waitlist (self-removal by user)
app.delete('/api/events/:eventId/waitlist/leave', async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = (req.user && req.user.userId) || req.query.userId || req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    const entry = await Waitlist.findOne({ eventId, userId });
    if (!entry) {
      return res.status(404).json({ error: 'Not on waitlist' });
    }
    await Waitlist.findByIdAndDelete(entry._id);
    // Recalculate positions
    const remaining = await Waitlist.find({ eventId }).sort({ position: 1 });
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].position = i + 1;
      await remaining[i].save();
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error leaving waitlist:', error);
    return res.status(500).json({ error: 'Could not leave waitlist' });
  }
});

// Comment endpoints
app.post('/api/events/:eventId/comments', async (req, res) => {
  try {
    const { userId, content, parentId } = req.body;
    const { eventId } = req.params;
    
    const comment = await Comment.create({
      eventId,
      userId,
      content,
      parentId: parentId || null
    });
    
    const populatedComment = await Comment.findById(comment._id).populate('userId', 'name role');
    const event = await Event.findById(eventId);
    
    // Notify event organizer
    if (event.organizerId && event.organizerId.toString() !== userId) {
      await notifyUser(
        req,
        event.organizerId,
        'comment_added',
        `New comment on your event '${event.title}'`,
        { eventId, eventTitle: event.title, eventImage: event.image, commentId: comment._id }
      );
    }
    
    // If it's a reply, notify the parent comment author
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.userId.toString() !== userId) {
        await notifyUser(
          req,
          parentComment.userId,
          'comment_reply',
          `Someone replied to your comment on '${event.title}'`,
          { eventId, eventTitle: event.title, eventImage: event.image, commentId: comment._id }
        );
      }
    }
    
    res.json(populatedComment);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Could not add comment' });
  }
});

app.get('/api/events/:eventId/comments', async (req, res) => {
  try {
    const { eventId } = req.params;
    const comments = await Comment.find({ eventId })
      .populate('userId', 'name role')
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Could not fetch comments' });
  }
});

// Friend endpoints
app.post('/api/friends/request', async (req, res) => {
  try {
    const { userId, friendId } = req.body;
    
    // Check if already friends or pending
    const existing = await Friend.findOne({
      $or: [
        { userId, friendId },
        { userId: friendId, friendId: userId }
      ]
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    
    const friendRequest = await Friend.create({ userId, friendId, status: 'pending' });
    res.json(friendRequest);
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ error: 'Could not send friend request' });
  }
});

app.patch('/api/friends/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const friendRequest = await Friend.findByIdAndUpdate(
      requestId,
      { status: 'accepted' },
      { new: true }
    );
    res.json(friendRequest);
  } catch (error) {
    console.error('Error accepting friend request:', error);
    res.status(500).json({ error: 'Could not accept friend request' });
  }
});

app.get('/api/friends/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const friends = await Friend.find({
      $or: [{ userId }, { friendId: userId }],
      status: 'accepted'
    }).populate('userId friendId', 'name email');
    res.json(friends);
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ error: 'Could not fetch friends' });
  }
});

// Custom announcement endpoint for admins
app.post('/api/events/:eventId/announce', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { message, priority = 'normal', senderId } = req.body;
    
    // Verify sender is admin or organizer
    const event = await Event.findById(eventId);
    const sender = await User.findById(senderId);
    
    if (sender.role !== 'admin' && event.organizerId.toString() !== senderId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get all registered users
    const registrations = await Registration.find({ eventId });
    const notifications = [];
    
    for (const reg of registrations) {
      const notification = await notifyUser(
        req,
        reg.userId,
        'custom_announcement',
        message,
        { eventId, eventTitle: event.title, eventImage: event.image },
        priority
      );
      if (notification) notifications.push(notification);
    }
    
    res.json({ sent: notifications.length, message: 'Announcements sent' });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ error: 'Could not send announcement' });
  }
});

// Multi-Event Registration Endpoint
app.post('/api/events/register-multiple', async (req, res) => {
  try {
    const { userId, eventIds } = req.body;
    
    if (!userId || !eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'Invalid request data' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const results = {
      totalEvents: eventIds.length,
      successfulRegistrations: 0,
      failedRegistrations: [],
      registrations: []
    };

    // Process each event registration
    for (const eventId of eventIds) {
      try {
        // Check if already registered
        const existingRegistration = await Registration.findOne({ userId, eventId });
        if (existingRegistration) {
          results.failedRegistrations.push({
            eventId,
            reason: 'Already registered for this event'
          });
          continue;
        }

        // Get event details
        const event = await Event.findById(eventId);
        if (!event) {
          results.failedRegistrations.push({
            eventId,
            reason: 'Event not found'
          });
          continue;
        }

        // Check if event is full
        if (event.currentParticipants >= event.maxParticipants) {
          results.failedRegistrations.push({
            eventId,
            reason: 'Event is full'
          });
          continue;
        }

        // Check if registration deadline has passed
        if (new Date() > new Date(event.registrationDeadline)) {
          results.failedRegistrations.push({
            eventId,
            reason: 'Registration deadline has passed'
          });
          continue;
        }

        // Generate unique registration ID
        const registrationId = generateUniqueRegistrationId();
        const issuedAt = new Date().toISOString();
        const expiresAt = new Date(event.date).toISOString(); // QR expires when event ends

        // Create JSON payload for backend and plain-text QR content (mobile scanners show readable details)
        const qrPayload = {
          registrationId: registrationId,
          userId: userId,
          eventIds: [eventId],
          timestamp: Date.now(),
          name: user.name,
          email: user.email,
          college: user.college,
          department: user.department,
          section: user.section || 'A',
          year: user.year,
          regId: user.regId || registrationId.substring(0, 8).toUpperCase(),
          registeredAt: issuedAt,
          // Helpful aliases for older code/consumers
          event_title: event.title,
          student_name: user.name,
          event_venue: event.venue,
          event_date: new Date(event.date).toLocaleDateString(),
          event_time: event.time,
          events: [{
            title: event.title,
            venue: event.venue,
            date: new Date(event.date).toLocaleDateString(),
            time: event.time,
            subEvents: event.subEvents || []
          }]
        };

        const qrContent = generateQRTextContent(qrPayload);

        // Generate QR code image with readable text content
        const qrCodeString = await generateQRCodeWithEventName(
          qrContent,
          event.title,
          {
            size: 400, // Larger size for better readability
            fontSize: 14,
            fontFamily: 'Arial',
            fontWeight: 'bold',
            maxChars: 40,
            position: 'below',
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            qrColor: '#000000'
          }
        );

        // Create registration record
        const registration = new Registration({
          registrationId,
          userId,
          eventId,
          status: 'registered',
          approvalStatus: 'approved',
          approvalType: 'autoApproved',
          approvedAt: new Date(),
          qrCode: qrCodeString,
          qrPayload,
          scanLogs: [],
          registeredAt: issuedAt
        });

        await registration.save();

        // Update event participant count
        event.currentParticipants += 1;
        const capacityPercentage = (event.currentParticipants / event.maxParticipants) * 100;
        await event.save();

        // Check capacity and send alerts
        if (capacityPercentage === 100) {
          // Event is full - notify all registered users
          const allRegistrations = await Registration.find({ eventId });
          for (const reg of allRegistrations) {
            if (reg.userId.toString() !== userId) {
              await notifyUser(
                req,
                reg.userId,
                'capacity_alert',
                `The event '${event.title}' is now full!`,
                buildNotificationData(event)
              );
            }
          }
        } else if (capacityPercentage >= 80 && event.currentParticipants - 1 < event.maxParticipants * 0.8) {
          // Just crossed 80% threshold - notify registered users
          const allRegistrations = await Registration.find({ eventId });
          for (const reg of allRegistrations) {
            if (reg.userId.toString() !== userId) {
              await notifyUser(
                req,
                reg.userId,
                'capacity_alert',
                `The event '${event.title}' is filling up fast! Only ${event.maxParticipants - event.currentParticipants} spots left.`,
                buildNotificationData(event)
              );
            }
          }
        }

        // Populate for response
        const populatedRegistration = await Registration.findById(registration._id)
          .populate('userId')
          .populate('eventId');

        const regObj = populatedRegistration.toObject();
        regObj.user = regObj.userId;
        regObj.event = regObj.eventId;
        regObj.userId = regObj.userId._id;
        regObj.eventId = regObj.eventId._id;
        regObj.id = regObj._id;

        results.registrations.push(regObj);
        results.successfulRegistrations++;

        // --- NOTIFICATION ---
        // Notify the user who registered (with enhanced event details)
        await notifyUser(
          req,
          user._id,
          'registered',
          `You have successfully registered for the event: '${event.title}'.`,
          buildNotificationData(event, { registrationId: registration._id })
        );
        
        // Notify friends about registration
        const friends = await Friend.find({
          $or: [
            { userId: user._id, status: 'accepted' },
            { friendId: user._id, status: 'accepted' }
          ]
        });
        
        for (const friendship of friends) {
          const friendId = friendship.userId.toString() === user._id.toString() 
            ? friendship.friendId 
            : friendship.userId;
          
          await notifyUser(
            req,
            friendId,
            'friend_registered',
            `Your friend ${user.name} registered for '${event.title}'`,
            buildNotificationData(event, { relatedUser: user._id })
          );
        }

      } catch (error) {
        console.error(`Registration error for event ${eventId}:`, error);
        results.failedRegistrations.push({
          eventId,
          reason: 'Registration processing failed'
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error('Multi-event registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Single Event Registration (backwards compatibility)
app.post('/api/events/:eventId/register', async (req, res) => {
  try {
    const { userId } = req.body;
    const eventId = req.params.eventId;

    // OPTIMIZATION: Fetch user, event, and existing registration in parallel
    const [user, event, existingRegistration] = await Promise.all([
      User.findById(userId),
      Event.findById(eventId),
      Registration.findOne({ userId, eventId })
    ]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Handle existing registration
    let registration = existingRegistration;
    if (registration) {
      // Return appropriate message based on approval status
      if (registration.approvalStatus === 'pending') {
        return res.status(409).json({ 
          error: 'Registration pending approval',
          status: 'pending',
          message: 'Your registration is waiting for admin approval'
        });
      } else if (registration.approvalStatus === 'rejected') {
        // Allow user to reapply - delete the old rejected registration
        console.log(`User ${userId} reapplying after rejection for event ${eventId}`);
        await Registration.findByIdAndDelete(registration._id);
        // Clear the variable so the code continues as if no registration existed
        registration = null;
      } else {
        return res.status(409).json({ error: 'Already registered for this event' });
      }
    }
    
    // If we still have an existingRegistration (not rejected), return error
    if (registration) {
      return res.status(409).json({ error: 'Already registered for this event' });
    }

    // Check capacity only for auto-approved events
    if (event.autoApproval && event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ error: 'Event is full' });
    }

    // Check registration deadline (after deadline allow manual approval registration if capacity not exceeded)
    const now = new Date();
    const deadlinePassed = now > new Date(event.registrationDeadline);
    // If deadline has passed, we will still accept a registration but it will require organizer approval.

    // Check access control
    if (event.accessControl && event.accessControl.type) {
      const { accessControl } = event;
      let hasAccess = true;
      
      if (accessControl.type === 'students_only' && user.role !== 'student') {
        hasAccess = false;
      } else if (accessControl.type === 'faculty_only' && user.role !== 'faculty') {
        hasAccess = false;
      } else if (accessControl.type === 'custom') {
        if (accessControl.allowedRoles?.length > 0 && !accessControl.allowedRoles.includes(user.role)) {
          hasAccess = false;
        }
        if (accessControl.allowedDepartments?.length > 0 && !accessControl.allowedDepartments.includes(user.department)) {
          hasAccess = false;
        }
        if (user.role === 'student' && accessControl.allowedYears?.length > 0 && !accessControl.allowedYears.includes(user.year)) {
          hasAccess = false;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to register for this event' });
      }
    }

    // Determine approval status based on autoApproval setting
  // Determine auto approval: if deadline passed force manual approval even if event.autoApproval is true
  const isAutoApproved = event.autoApproval === true && !deadlinePassed;
    const approvalStatus = isAutoApproved ? 'approved' : 'pending';
    const registrationStatus = isAutoApproved ? 'registered' : 'pending';

    const registrationId = generateUniqueRegistrationId();
    const issuedAt = new Date().toISOString();
    
    // Only generate QR code if auto-approved
    let qrCodeUrl = null;
    let qrPayload = null;

    if (isAutoApproved) {
      // Build JSON payload for backend and for embedding in QR as readable text
      qrPayload = {
        registrationId,
        userId,
        eventIds: [eventId],
        timestamp: Date.now(),
        name: user.name,
        email: user.email,
        college: user.college,
        department: user.department,
        section: user.section || 'A',
        year: user.year,
        regId: user.regId || registrationId.substring(0, 8).toUpperCase(),
        registeredAt: issuedAt,
        events: [{
          title: event.title,
          venue: event.venue,
          date: new Date(event.date).toLocaleDateString(),
          time: event.time,
          subEvents: event.subEvents || []
        }]
      };

      // Generate signature for QR payload security
      const signature = generateQRSignature({
        registration_id: registrationId,
        student_id: userId,
        event_id: eventId,
        issued_at: issuedAt
      });

      // Create plain-text QR content so phone scanners display the details directly
      const qrContent = generateQRTextContent(qrPayload);

      // Generate QR code image with readable content
      qrCodeUrl = await generateQRCodeWithEventName(
        qrContent,
        event.title,
        {
          size: 400,
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          maxChars: 40,
          position: 'below',
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
          qrColor: '#000000'
        }
      );

      qrPayload.signature = signature;
    }

    // Create new registration
    const newRegistration = new Registration({
      registrationId,
      userId,
      eventId: eventId,
      status: registrationStatus,
      approvalStatus: approvalStatus,
      approvedAt: isAutoApproved ? new Date() : null,
      fromWaitlist: false, // Only true when promoted from waitlist endpoint
      approvalType: isAutoApproved ? 'autoApproved' : 'manualApproved',
      qrCode: qrCodeUrl,
      qrPayload: qrPayload,
      registeredAt: new Date()
    });

    // Save registration and update participant count in parallel if auto-approved
    if (isAutoApproved) {
      event.currentParticipants += 1;
      await Promise.all([newRegistration.save(), event.save()]);
    } else {
      await newRegistration.save();
    }

    // FAST RESPONSE: Return immediately after saving - don't wait for notifications
    res.json({
      success: true,
      message: isAutoApproved 
        ? 'Successfully registered for the event'
        : (deadlinePassed
            ? 'Registration deadline passed. Your request is pending organizer approval.'
            : 'Registration submitted and pending approval'),
      approvalStatus: approvalStatus,
      requiresApproval: !isAutoApproved,
      deadlinePassed,
      registration: {
        id: newRegistration._id,
        registrationId: registrationId,
        status: registrationStatus,
        approvalStatus: approvalStatus,
        event: event,
        qrCode: qrCodeUrl,
        registeredAt: newRegistration.registeredAt,
        fromWaitlist: !isAutoApproved,
        deadlinePassed
      }
    });
    
    // ========== NON-BLOCKING BACKGROUND TASKS (after response sent) ==========
    // All notifications, emails, and friend updates run in background
    
    // Background: Process pending team invitations for this user (non-blocking)
    // This auto-joins users to teams they were invited to via email before registering
    (async () => {
      try {
        const pendingInvites = await TeamInvitationToken.find({
          eventId: eventId,
          invitedEmail: user.email.toLowerCase(),
          status: 'pending',
          expiresAt: { $gt: new Date() }
        });
        
        for (const invite of pendingInvites) {
          const team = await Team.findById(invite.teamId);
          if (!team) continue;
          
          // Check if team has space
          if (team.members.length >= team.maxSize) {
            invite.status = 'expired';
            await invite.save();
            continue;
          }
          
          // Check if user is already in team
          const alreadyMember = team.members.some(m => 
            m.userId && m.userId.toString() === user._id.toString()
          );
          if (alreadyMember) {
            invite.status = 'accepted';
            invite.acceptedBy = user._id;
            await invite.save();
            continue;
          }
          
          // Add user to team
          team.members.push({
            userId: user._id,
            role: 'member',
            joinedAt: new Date()
          });
          await team.save();
          
          // Mark invite as accepted
          invite.status = 'accepted';
          invite.acceptedBy = user._id;
          await invite.save();
          
          // Remove any pending join request from this user
          await TeamJoinRequest.deleteMany({
            teamId: team._id,
            userId: user._id,
            status: 'pending'
          });
          
          // Notify team leader about new member
          notifyUser(
            req,
            team.leaderId,
            'team_member_joined',
            `${user.name} has joined your team "${team.name}" (auto-joined from invitation)`,
            { teamId: team._id, teamName: team.name, eventId: eventId }
          ).catch(err => console.error('Team join notification error:', err.message));
          
          console.log(`Auto-joined user ${user.email} to team ${team.name} via pending invitation`);
        }
      } catch (err) {
        console.error('Error processing pending team invitations:', err.message);
      }
    })();
    
    if (isAutoApproved) {
      // Background: Notify user about successful registration (non-blocking)
      notifyUser(
        req,
        user._id,
        'registered',
        `You have successfully registered for the event: '${event.title}'.`,
        { eventId: event._id, eventTitle: event.title, eventImage: event.image }
      ).catch(err => console.error('Background notification error:', err.message));
      
      // Background: Notify friends about registration (non-blocking)
      Friend.find({
        $or: [
          { userId: user._id, status: 'accepted' },
          { friendId: user._id, status: 'accepted' }
        ]
      }).then(friends => {
        friends.forEach(friendship => {
          const friendId = friendship.userId.toString() === user._id.toString() 
            ? friendship.friendId 
            : friendship.userId;
          
          notifyUser(
            req,
            friendId,
            'friend_registered',
            `Your friend ${user.name} registered for '${event.title}'`,
            { eventId: event._id, eventTitle: event.title, eventImage: event.image, relatedUser: user._id }
          ).catch(err => console.error('Friend notification error:', err.message));
        });
      }).catch(err => console.error('Friend fetch error:', err.message));
      
      // Background: Send email with event image (non-blocking)
      sendEventRegistrationEmail(user.email, user.name, {
        eventName: event.title,
        eventDate: event.date,
        eventTime: event.time,
        location: event.venue,
        eventId: event._id.toString(),
        registrationId: registrationId,
        eventImage: event.image,
        category: event.category,
        eventDescription: event.description,
      }).catch(err => console.error('Failed to send event registration email:', err.message));
    } else {
      // Background: Notify user they're on the waiting list (non-blocking)
      notifyUser(
        req,
        user._id,
        'waiting_list',
        `Your registration for '${event.title}' is pending approval by the organizer.`,
        { eventId: event._id, eventTitle: event.title, eventImage: event.image }
      ).catch(err => console.error('Waitlist notification error:', err.message));
      
      // Background: Notify event organizer about new waiting list entry (non-blocking)
      notifyUser(
        req,
        event.organizerId,
        'new_waitlist_entry',
        `${user.name} is waiting for approval to join '${event.title}'`,
        { 
          eventId: event._id, 
          eventTitle: event.title, 
          eventImage: event.image,
          relatedUser: user._id,
          registrationId: newRegistration._id
        }
      ).catch(err => console.error('Organizer notification error:', err.message));
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get waiting list (pending registrations) for an event
app.get('/api/events/:eventId/registrations/pending', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { userId } = req.query; // Requesting user ID for authorization

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if user is organizer or admin
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOrganizer = event.organizerId.toString() === userId;
    const isAdmin = user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only event organizers and admins can view pending registrations' });
    }

    // Get all pending registrations
    const pendingRegistrations = await Registration.find({
      eventId: eventId,
      approvalStatus: 'pending'
    })
    .populate('userId', '-password')
    .sort({ registeredAt: -1 });

    res.json({
      success: true,
      count: pendingRegistrations.length,
      registrations: pendingRegistrations
    });
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    res.status(500).json({ error: 'Failed to fetch pending registrations' });
  }
});

// Approve a pending registration
app.post('/api/events/:eventId/registrations/:registrationId/approve', async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { userId } = req.body; // Approving user ID

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOrganizer = event.organizerId.toString() === userId;
    const isAdmin = user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only event organizers and admins can approve registrations' });
    }

    // Find the registration
    const registration = await Registration.findById(registrationId).populate('userId', '-password');
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if registration belongs to this event
    if (registration.eventId.toString() !== eventId) {
      return res.status(400).json({ error: 'Registration does not belong to this event' });
    }

    // Check if already approved or rejected
    if (registration.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Registration already approved' });
    }

    if (registration.approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Cannot approve a rejected registration' });
    }

    // Check event capacity
    if (event.currentParticipants >= event.maxParticipants) {
      return res.status(400).json({ error: 'Event is full, cannot approve more registrations' });
    }

    // Generate QR code for the approved registration
    const registeredUser = registration.userId;
    const issuedAt = new Date().toISOString();
    
    // Build JSON payload and plain-text QR content (include optional team/seating/ticketType)
    const qrPayload = {
      registrationId: registration.registrationId,
      userId: registeredUser._id.toString(),
      eventIds: [eventId],
      timestamp: Date.now(),
      name: registeredUser.name,
      email: registeredUser.email,
      college: registeredUser.college,
      department: registeredUser.department,
      section: registeredUser.section || 'A',
      year: registeredUser.year,
      regId: registeredUser.regId || registration.registrationId.substring(0, 8).toUpperCase(),
      registeredAt: issuedAt,
      event_title: event.title,
      student_name: registeredUser.name,
      event_venue: event.venue,
      event_date: new Date(event.date).toLocaleDateString(),
      event_time: event.time,
      team: registration.team || registration.teamName || null,
      seating: registration.seating || null,
      ticketType: registration.ticketType || null,
      events: [{
        title: event.title,
        venue: event.venue,
        date: new Date(event.date).toLocaleDateString(),
        time: event.time,
        subEvents: event.subEvents || [],
        team: registration.team || registration.teamName || null,
        seating: registration.seating || null,
        ticketType: registration.ticketType || null
      }]
    };

    const qrContent = generateQRTextContent(qrPayload);
    
    // Generate signature
    const signature = generateQRSignature({
      registration_id: registration.registrationId,
      student_id: registeredUser._id.toString(),
      event_id: eventId,
      issued_at: issuedAt
    });
    
    // Generate QR code
    const qrCodeUrl = await generateQRCodeWithEventName(
      qrContent,
      event.title,
      {
        size: 400,
        fontSize: 14,
        fontFamily: 'Arial',
        fontWeight: 'bold',
        maxChars: 40,
        position: 'below',
        backgroundColor: '#FFFFFF',
        textColor: '#000000',
        qrColor: '#000000'
      }
    );

    qrPayload.signature = signature;

  // Update registration
  registration.approvalStatus = 'approved';
  registration.status = 'registered';
  registration.approvedAt = new Date();
  registration.approvedBy = userId;
  // Determine approval type
  registration.approvalType = registration.fromWaitlist ? 'waitingListApproval' : 'manualApproved';
  registration.qrCode = qrCodeUrl;
  registration.qrPayload = qrPayload;

    await registration.save();

    // Update event participant count
    event.currentParticipants += 1;
    await event.save();

    // Notify the registered user about approval with enhanced event details
    await notifyUser(
      req,
      registeredUser._id,
      'registration_approved',
      `🎉 Your registration for '${event.title}' has been approved! You can now view your QR code for check-in.`,
      buildNotificationData(event, { registrationId: registration._id })
    );

    res.json({
      success: true,
      message: 'Registration approved successfully',
      registration: registration
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject a pending registration
app.post('/api/events/:eventId/registrations/:registrationId/reject', async (req, res) => {
  try {
    const { eventId, registrationId } = req.params;
    const { userId, reason } = req.body; // Rejecting user ID and optional reason

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check authorization
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOrganizer = event.organizerId.toString() === userId;
    const isAdmin = user.role === 'admin';

    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only event organizers and admins can reject registrations' });
    }

    // Find the registration
    const registration = await Registration.findById(registrationId).populate('userId', '-password');
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Check if registration belongs to this event
    if (registration.eventId.toString() !== eventId) {
      return res.status(400).json({ error: 'Registration does not belong to this event' });
    }

    // Check if already approved or rejected
    if (registration.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'Cannot reject an approved registration' });
    }

    if (registration.approvalStatus === 'rejected') {
      return res.status(400).json({ error: 'Registration already rejected' });
    }

    // Update registration
    registration.approvalStatus = 'rejected';
    registration.status = 'cancelled';
    registration.rejectedAt = new Date();
    registration.rejectedBy = userId;
    registration.rejectionReason = reason || 'No reason provided';

    await registration.save();

    // Notify the registered user about rejection with enhanced details
    const registeredUser = registration.userId;
    await notifyUser(
      req,
      registeredUser._id,
      'registration_rejected',
      `Your registration for '${event.title}' has been rejected.`,
      buildNotificationData(event, { 
        registrationId: registration._id,
        reason: reason || 'No reason provided'
      })
    );

    res.json({
      success: true,
      message: 'Registration rejected',
      registration: registration
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Get all registrations for an event with status filter
app.get('/api/events/:eventId/registrations', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { status, approvalStatus } = req.query;

    const query = { eventId: eventId };
    
    if (status) {
      query.status = status;
    }
    
    if (approvalStatus) {
      query.approvalStatus = approvalStatus;
    }

    const registrations = await Registration.find(query)
      .populate('userId', '-password')
      .populate('approvedBy', 'name email')
      .populate('rejectedBy', 'name email')
      .populate('eventId', 'autoApproval')
      .sort({ registeredAt: -1 });

    // Backfill approvalType for legacy records
    for (const reg of registrations) {
      if (!reg.approvalType && reg.approvalStatus === 'approved') {
        let derivedType = 'manualApproved';
        if (reg.fromWaitlist) derivedType = 'waitingListApproval';
        else if (reg.eventId && reg.eventId.autoApproval) derivedType = 'autoApproved';
        reg.approvalType = derivedType;
        reg.save().catch(() => {});
      }
    }

    res.json({
      success: true,
      count: registrations.length,
      registrations: registrations
    });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Attendees (approved registrations only)
app.get('/api/events/:eventId/attendees', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const regs = await Registration.find({ eventId, approvalStatus: 'approved' })
      .populate('userId', '-password')
      .populate('eventId', 'autoApproval title')
      .populate('approvedBy', 'name email')
      .sort({ approvedAt: -1 });

    // Ensure approvalType is present
    const attendees = regs.map(reg => {
      const obj = reg.toObject();
      if (!obj.approvalType) {
        if (obj.fromWaitlist) obj.approvalType = 'waitingListApproval';
        else if (obj.eventId && obj.eventId.autoApproval) obj.approvalType = 'autoApproved';
        else obj.approvalType = 'manualApproved';
      }
      obj.user = obj.userId;
      obj.event = obj.eventId;
      obj.userId = obj.userId?._id || obj.userId;
      obj.eventId = obj.eventId?._id || obj.eventId;
      obj.id = obj._id;
      return obj;
    });

    res.json({ success: true, count: attendees.length, attendees });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// QR Code Validation Endpoint
app.post('/api/qr/validate', async (req, res) => {
  try {
    const { qrData, eventId, scannedBy, location } = req.body;

    console.log('QR Validation Request:');
    console.log('- QR Data received:', qrData);
    console.log('- QR Data length:', qrData?.length);
    console.log('- Event ID:', eventId);
    console.log('- Scanned by:', scannedBy);
    console.log('- Location:', location);
    
    let qrPayload;
    try {
      qrPayload = JSON.parse(qrData);
      console.log('- Parsed QR Payload:', qrPayload);
      console.log('- QR Payload fields:', Object.keys(qrPayload));
    } catch (error) {
      console.log('- QR Data parsing failed:', error.message);
      return res.json({
        valid: false,
        reason: 'Invalid QR code format'
      });
    }

    const requiredFields = ['registration_id', 'student_id', 'event_id', 'signature'];
    const missingFields = requiredFields.filter(field => !qrPayload[field]);
    
    if (missingFields.length > 0) {
      console.log('- Missing required fields:', missingFields);
      return res.json({
        valid: false,
        reason: `Missing required QR code fields: ${missingFields.join(', ')}`
      });
    }

    // Validate signature
    console.log('- Validating signature...');
    if (!validateQRSignature(qrPayload)) {
      console.log('- Signature validation failed');
      return res.json({
        valid: false,
        reason: 'Invalid QR code signature'
      });
    }
    console.log('- Signature validation passed');

    // Check if scanning for correct event
    if (eventId && qrPayload.event_id !== eventId) {
      console.log(`- Event ID mismatch: expected ${eventId}, got ${qrPayload.event_id}`);
      return res.json({
        valid: false,
        reason: 'QR code is for a different event'
      });
    }

    // Find the registration
    const registration = await Registration.findOne({
      registrationId: qrPayload.registration_id,
      userId: qrPayload.student_id,
      eventId: qrPayload.event_id
    }).populate('userId').populate('eventId');

    if (!registration) {
      return res.json({
        valid: false,
        reason: 'Registration not found'
      });
    }

    // Check if registration is active
    if (registration.status === 'cancelled') {
      return res.json({
        valid: false,
        reason: 'Registration has been cancelled'
      });
    }

    // Check if QR code has expired
    if (qrPayload.expires_at && new Date() > new Date(qrPayload.expires_at)) {
      return res.json({
        valid: false,
        reason: 'QR code has expired'
      });
    }

    // Check for duplicate scans (if already attended)
    if (registration.status === 'attended') {
      return res.json({
        valid: false,
        reason: 'Already marked as attended',
        registration: {
          ...registration.toObject(),
          user: registration.userId,
          event: registration.eventId,
          userId: registration.userId._id,
          eventId: registration.eventId._id,
          id: registration._id
        }
      });
    }

    // Create scan log
    const scanLog = {
      scannedAt: new Date(),
      scannedBy: scannedBy || 'system',
      location: location || 'unknown',
      status: 'valid',
      notes: 'Valid scan - marked as attended'
    };

    // Update registration status and add scan log
    registration.status = 'attended';
    registration.scanLogs.push(scanLog);
    await registration.save();

    // Also create a standalone scan log for admin tracking
    const standaloneScanLog = new ScanLog({
      registrationId: registration.registrationId,
      scannedAt: scanLog.scannedAt,
      scannedBy: scanLog.scannedBy,
      location: scanLog.location,
      status: scanLog.status,
      notes: scanLog.notes,
      eventId: registration.eventId,
      userId: registration.userId
    });
    await standaloneScanLog.save();

    res.json({
      valid: true,
      registration: {
        ...registration.toObject(),
        user: registration.userId,
        event: registration.eventId,
        userId: registration.userId._id,
        eventId: registration.eventId._id,
        id: registration._id
      },
      scanLog
    });

  } catch (err) {
    console.error('QR validation error:', err);
    res.status(500).json({ 
      valid: false, 
      reason: 'QR validation failed' 
    });
  }
});

// Get Scan Logs for Admin
app.get('/api/scan-logs', async (req, res) => {
  try {
    const { eventId, userId, status } = req.query;
    
    let filter = {};
    if (eventId) filter.eventId = eventId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const scanLogs = await ScanLog.find(filter)
      .populate('eventId')
      .populate('userId')
      .sort({ scannedAt: -1 });

    res.json({ scanLogs });
  } catch (err) {
    console.error('Error fetching scan logs:', err);
    res.status(500).json({ error: 'Failed to fetch scan logs' });
  }
});

// Get all registrations
app.get('/api/registrations', async (req, res) => {
  try {
    const registrations = await Registration.find()
      .populate('userId')
      .populate('eventId', 'autoApproval title');
    
    // Convert to expected frontend shape
    const formattedRegistrations = registrations
      .filter(reg => reg.userId && reg.eventId) // Filter out registrations with missing user or event
      .map(reg => {
        const regObj = reg.toObject();
        // Backfill approvalType if missing
        if (!regObj.approvalType && regObj.approvalStatus === 'approved') {
          if (regObj.fromWaitlist) regObj.approvalType = 'waitingListApproval';
          else if (regObj.eventId && regObj.eventId.autoApproval) regObj.approvalType = 'autoApproved';
          else regObj.approvalType = 'manualApproved';
        }
        regObj.user = regObj.userId;
        regObj.event = regObj.eventId;
        regObj.userId = regObj.userId._id;
        regObj.eventId = regObj.eventId._id;
        regObj.id = regObj._id;
        return regObj;
      });
    
    res.json({ registrations: formattedRegistrations });
  } catch (err) {
    console.error('Error fetching registrations:', err);
    res.status(500).json({ error: 'Failed to fetch registrations.' });
  }
});

// Unregister from Event
app.post('/api/events/:eventId/unregister', async (req, res) => {
  try {
    const { userId } = req.body;
    const eventId = req.params.eventId;

    // First, get the event to check if it's completed
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    // Check if event has already ended
    if (new Date() > new Date(event.endDate)) {
      return res.status(400).json({ error: 'Cannot unregister from a completed event.' });
    }

    const registration = await Registration.findOneAndDelete({ userId, eventId });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    // Update event participant count
    if (event.currentParticipants > 0) {
      event.currentParticipants -= 1;
      await event.save();
    }

    // Check if there's a waitlist and promote the first person
    const waitlistEntry = await Waitlist.findOne({ eventId }).sort({ position: 1 });
    if (waitlistEntry && event.currentParticipants < event.maxParticipants) {
      // Auto-register the first person from waitlist
      const waitlistUser = await User.findById(waitlistEntry.userId);
      
      // Generate registration for waitlist user
      const registrationId = generateUniqueRegistrationId();

      // Build payload using waitlistUser details and include optional team/seating/ticketType
      const qrPayload = {
        registrationId,
        userId: waitlistEntry.userId,
        eventIds: [eventId],
        timestamp: Date.now(),
        name: waitlistUser?.name,
        email: waitlistUser?.email,
        college: waitlistUser?.college,
        department: waitlistUser?.department,
        section: waitlistUser?.section || 'A',
        year: waitlistUser?.year,
        regId: waitlistUser?.regId || registrationId.substring(0,8).toUpperCase(),
        registeredAt: new Date().toISOString(),
        events: [{ title: event.title, venue: event.venue, date: new Date(event.date).toLocaleDateString(), time: event.time, subEvents: event.subEvents || [] }],
        team: waitlistEntry.team || waitlistUser?.team || null,
        seating: waitlistEntry.seating || null,
        ticketType: waitlistEntry.ticketType || null
      };

      const qrContent = generateQRTextContent(qrPayload);
      const qrCodeString = await generateQRCodeWithEventName(qrContent, event.title);
      
      const newRegistration = new Registration({
        registrationId,
        userId: waitlistEntry.userId,
        eventId,
        status: 'registered',
        approvalStatus: 'approved',
        approvalType: 'waitingListApproval',
        approvedAt: new Date(),
        fromWaitlist: true,
        qrCode: qrCodeString,
        qrPayload,
        scanLogs: [],
        registeredAt: new Date()
      });
      
      await newRegistration.save();
      event.currentParticipants += 1;
      await event.save();
      
      // Remove from waitlist
      await Waitlist.deleteOne({ _id: waitlistEntry._id });
      
      // Update positions for remaining waitlist
      await Waitlist.updateMany(
        { eventId, position: { $gt: waitlistEntry.position } },
        { $inc: { position: -1 } }
      );
      
      // Notify the promoted user
      await notifyUser(
        req,
        waitlistEntry.userId,
        'waitlist_promoted',
        `Great news! A spot opened up and you've been registered for '${event.title}'`,
        { eventId, eventTitle: event.title, eventImage: event.image },
        'urgent'
      );
    } else if (event.currentParticipants < event.maxParticipants) {
      // Notify other registered users that a spot is available
      const otherUsers = await Registration.find({ eventId }).limit(10);
      for (const reg of otherUsers) {
        if (reg.userId.toString() !== userId) {
          await notifyUser(
            req,
            reg.userId,
            'spot_available',
            `A spot just opened up for '${event.title}'! Only ${event.maxParticipants - event.currentParticipants} spots left.`,
            { eventId, eventTitle: event.title, eventImage: event.image }
          );
        }
      }
    }

    // --- NOTIFICATION ---
    // Notify the user who unregistered
    const user = await User.findById(userId);
    if (user) {
      await notifyUser(
        req,
        user._id,
        'unregistered',
        `You have unregistered from the event: '${event.title}'.`,
        { eventId: event._id, eventTitle: event.title, eventImage: event.image }
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Unregistration failed.' });
  }
});

// Admin/Organizer: Remove participant from event
app.post('/api/events/:eventId/remove-participant', async (req, res) => {
  try {
    const { userId, removedBy } = req.body;
    const eventId = req.params.eventId;

    // Find the user who is making the request (removedBy)
    const remover = await User.findById(removedBy);
    if (!remover) {
      return res.status(403).json({ error: 'Unauthorized: User not found.' });
    }

    // Check if user has admin or organizer permissions
    if (remover.role !== 'admin' && remover.role !== 'organizer') {
      return res.status(403).json({ error: 'Unauthorized: Only admins and organizers can remove participants.' });
    }

    // Find and remove the registration
    const registration = await Registration.findOneAndDelete({ userId, eventId });
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found.' });
    }

    // Update event participant count
    const event = await Event.findById(eventId);
    if (event && event.currentParticipants > 0) {
      event.currentParticipants -= 1;
      await event.save();
    }

    // Get user info for logging
    const removedUser = await User.findById(userId);
    console.log(`Admin/Organizer ${remover.name} (${remover.email}) removed participant ${removedUser?.name} (${removedUser?.email}) from event ${event?.title}`);

    res.json({ 
      success: true, 
      message: `Participant ${removedUser?.name} removed from event successfully.` 
    });
  } catch (err) {
    console.error('Error removing participant:', err);
    res.status(500).json({ error: 'Failed to remove participant.' });
  }
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  console.log('Register API received:', req.body);
  try {
    const { name, email, password, role, college, department, branch, mobile, year, regId, section, roomNo, admissionMonth, admissionYear, graduationYear } = req.body;
    // Basic validation
    if (!name || !email || !password || !role || !college || !department || !branch || !mobile) {
      return res.status(400).json({ error: 'Basic fields are required.' });
    }
    
    // For students, validate admission data or year
    if (role === 'student') {
      if (!admissionMonth || !admissionYear || !graduationYear) {
        // If no admission data, year must be provided
        if (!year) {
          return res.status(400).json({ error: 'Admission month, year, and graduation year are required for students.' });
        }
      }
      // Validate course duration (max 4 years, but allow 3 years for lateral entry handled client-side)
      if (graduationYear && admissionYear && (graduationYear - admissionYear) > 4) {
        return res.status(400).json({ error: 'Course duration cannot exceed 4 years.' });
      }
      if (graduationYear && admissionYear && graduationYear <= admissionYear) {
        return res.status(400).json({ error: 'Graduation year must be after admission year.' });
      }
      if (!section) {
        return res.status(400).json({ error: 'Section is required for students.' });
      }
    }
    
    if (role === 'faculty' && !roomNo) {
      return res.status(400).json({ error: 'Room number is required for faculty.' });
    }
    
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    
    // Check for duplicate name
    const existingName = await User.findOne({ name });
    if (existingName) {
      return res.status(409).json({ error: 'This name is already registered. Please use a unique name or add a suffix (e.g., "John Doe 2").' });
    }
    
    // Check for duplicate registration ID if provided
    if (regId) {
      const existingRegId = await User.findOne({ regId });
      if (existingRegId) {
        return res.status(409).json({ error: 'This Registration ID (Roll Number) is already in use.' });
      }
    }
    
    // Calculate year for students based on admission date
    let calculatedYear = year;
    if (role === 'student' && admissionMonth && admissionYear) {
      calculatedYear = calculateCurrentYear(admissionMonth, admissionYear);
    }
    
    // Check if manual registration approval is required
    const requireApproval = await getSystemSetting('requireRegistrationApproval', false);
    const accountStatus = requireApproval ? 'pending' : 'approved';
    
    // Hash password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role, 
      college,
      department, 
      branch, 
      mobile, 
      year: role === 'faculty' ? undefined : calculatedYear, 
      admissionMonth: role === 'student' ? admissionMonth : undefined,
      admissionYear: role === 'student' ? admissionYear : undefined,
      graduationYear: role === 'student' ? graduationYear : undefined,
      regId, 
      section, 
      roomNo,
      accountStatus
    });
    await user.save();
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;
    
    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name).catch(err => {
      console.error('Failed to send welcome email:', err.message);
    });
    
    // Return different response based on approval requirement
    if (requireApproval) {
      res.json({ 
        user: userObj, 
        pendingApproval: true,
        message: 'Registration submitted! Your account is pending admin approval.' 
      });
    } else {
      res.json({ user: userObj });
    }
  } catch (err) {
    console.error('Registration error details:', err);
    res.status(500).json({ error: 'Registration failed.', details: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    // Check if account is disabled
    if (user.isDisabled) {
      return res.status(403).json({ 
        error: 'Account disabled',
        message: user.disabledReason || 'Your account has been disabled. Please contact an administrator for more information.'
      });
    }
    
    // Check account status
    if (user.accountStatus === 'pending') {
      return res.status(403).json({ 
        error: 'Account pending approval',
        message: 'Your account is pending admin approval. Please wait for an administrator to approve your registration.'
      });
    }
    if (user.accountStatus === 'rejected') {
      return res.status(403).json({ 
        error: 'Account rejected',
        message: 'Your account registration was rejected. Please contact an administrator for more information.'
      });
    }
    
    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;
    
    // Save user to session
    req.session.user = userObj;

    // Do NOT force cookie.domain here — letting the session middleware
    // set the cookie based on the request avoids mismatches behind
    // CDNs/reverse proxies. Log the cookie flags for debugging instead.
    logger.production('[Login] session.cookie flags before save:', req.session.cookie);

    // Explicitly save the session to the store before responding
    req.session.save((err) => {
      if (err) {
        logger.error('[Login] Session save error:', err);
        return res.status(500).json({ error: 'Failed to create session' });
      }
      
      logger.production('[Login] Session saved successfully. SessionID:', req.sessionID, 'Email:', userObj.email);
      // Expose session ID in header for debugging (safe to remove later)
      res.setHeader('X-Session-ID', req.sessionID);
      // Ensure we explicitly set the session cookie on the response so we can
      // observe it in logs and so browsers receive it even if middleware timing
      // differs in this environment.
      try {
        // Do not manually set `connect.sid` here. Let `express-session`
        // generate and sign the cookie. We still log the effective cookie
        // flags so operators can verify them in the logs.
        logger.production('[Login] Relying on express-session to emit Set-Cookie header.');
      } catch (e) {
        logger.production('[Login] Cookie logging error:', e && e.message);
      }
      // Log the Set-Cookie header the server will send (helps confirm cookie emitted)
      try {
        const sc = res.getHeader('Set-Cookie');
        logger.production('[Login] Response Set-Cookie header:', sc);
      } catch (e) {
        logger.production('[Login] Unable to read Set-Cookie header:', e && e.message);
      }
      // Session-based authentication (no JWT tokens)
      res.json({ message: 'Login successful', user: userObj });
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ message: 'Logout successful' });
  });
});

// Forgot Password - Request OTP
// Basic in-memory rate limiting per email to prevent abuse
const passwordResetRequests = new Map();
function canRequestPasswordReset(email) {
  const now = Date.now();
  const entry = passwordResetRequests.get(email);
  const windowMs = 60 * 1000; // 1 minute window
  const maxPerWindow = 3;
  if (!entry || now - entry.windowStart > windowMs) {
    passwordResetRequests.set(email, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= maxPerWindow) return false;
  entry.count += 1;
  return true;
}

app.post('/api/password-reset/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, error: 'Invalid email format' });

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: 'No account found for this email' });

    // Rate limit
    if (!canRequestPasswordReset(email)) {
      return res.status(429).json({ success: false, error: 'Too many requests. Please wait a minute and try again.' });
    }

    const result = await sendOTP(email, user.name || '', 'reset_password');
    if (!result.success) return res.status(500).json({ success: false, error: result.error || 'Failed to send OTP' });
    return res.json({ success: true, message: 'OTP sent to your email', expiresAt: result.expiresAt, expiryMinutes: result.expiryMinutes });
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

// Forgot Password - Verify OTP
app.post('/api/password-reset/verify', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    const result = verifyOTP(email, otp, 'reset_password');
    if (result.success) return res.json({ success: true, message: 'OTP verified. You may reset your password.' });
    const statusCode = result.code === 'OTP_EXPIRED' || result.code === 'MAX_ATTEMPTS_EXCEEDED' ? 410 : 400;
    return res.status(statusCode).json({ success: false, error: result.error, code: result.code, remainingAttempts: result.remainingAttempts });
  } catch (err) {
    console.error('Password reset verify error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

// Forgot Password - Reset
app.post('/api/password-reset/reset', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and new password are required' });
    }
    // Enforce password strength
    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPwd.test(newPassword)) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters and include uppercase, lowercase, and a number' });
    }

    // Check if OTP was verified (don't call verifyOTP again as it will fail if already used)
    const key = `${email}:reset_password`;
    const otpData = otpStore.get(key);
    
    if (!otpData) {
      return res.status(400).json({ success: false, error: 'OTP not found or expired. Please request a new one.' });
    }
    
    if (!otpData.verified) {
      return res.status(400).json({ success: false, error: 'OTP has not been verified. Please verify it first.' });
    }

    // Update password
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, error: 'No account found for this email' });
    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    // Clean up OTP after successful password reset
    otpStore.delete(key);

    return res.json({ success: true, message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error('Password reset error:', err);
    return res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// Update user profile
app.put('/api/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, section, mobile, year, regId, avatar, roomNo, college, admissionMonth, admissionYear, graduationYear, lateralEntry } = req.body;

    // Check for duplicate name (excluding current user)
    if (name) {
      const existingName = await User.findOne({ name, _id: { $ne: id } });
      if (existingName) {
        return res.status(409).json({ error: 'This name is already in use by another user. Please use a unique name.' });
      }
    }
    
    // Check for duplicate email (excluding current user)
    if (email) {
      const existingEmail = await User.findOne({ email, _id: { $ne: id } });
      if (existingEmail) {
        return res.status(409).json({ error: 'This email is already in use by another user.' });
      }
    }
    
    // Check for duplicate registration ID (excluding current user)
    if (regId) {
      const existingRegId = await User.findOne({ regId, _id: { $ne: id } });
      if (existingRegId) {
        return res.status(409).json({ error: 'This Registration ID (Roll Number) is already in use by another user.' });
      }
    }

    // Build updates object conditionally to avoid overwriting with undefined
    const updates = { };
    if (typeof name !== 'undefined') updates.name = name;
    if (typeof email !== 'undefined') updates.email = email;
    if (typeof department !== 'undefined') updates.department = department;
    if (typeof section !== 'undefined') updates.section = section;
    if (typeof mobile !== 'undefined') updates.mobile = mobile;
    if (typeof year !== 'undefined') updates.year = year;
    if (typeof regId !== 'undefined') updates.regId = regId;
    if (typeof avatar !== 'undefined') updates.avatar = avatar;
    if (typeof roomNo !== 'undefined') updates.roomNo = roomNo;
    if (typeof college !== 'undefined') updates.college = college;
    if (typeof admissionMonth !== 'undefined') updates.admissionMonth = admissionMonth;
    if (typeof admissionYear !== 'undefined') updates.admissionYear = admissionYear;
    if (typeof graduationYear !== 'undefined') updates.graduationYear = graduationYear;
    if (typeof lateralEntry !== 'undefined') updates.lateralEntry = lateralEntry;
    // Keep backend "branch" aligned to department for compatibility
    if (typeof department !== 'undefined') updates.branch = department;
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;

    res.json({ user: userObj });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(400).json({ error: 'Failed to update profile.' });
  }
});

// Manual year update endpoint for students
app.put('/api/user/:id/year', async (req, res) => {
  try {
    const { id } = req.params;
    const { year } = req.body;
    
    if (!year || year < 1 || year > 4) {
      return res.status(400).json({ error: 'Year must be between 1 and 4.' });
    }
    
    // Find and update user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    if (user.role !== 'student') {
      return res.status(400).json({ error: 'Only students can update year of study.' });
    }
    
    user.year = year;
    await user.save();
    
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;
    
    console.log(`Student ${user.name} manually updated year to ${year}`);
    res.json({ user: userObj, message: 'Year updated successfully.' });
  } catch (err) {
    console.error('Year update error:', err);
    res.status(400).json({ error: 'Failed to update year.' });
  }
});

// Update user privacy settings
app.put('/api/user/:id/privacy', async (req, res) => {
  try {
    const { id } = req.params;
    const { privacySettings } = req.body;
    
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }
    
    if (!privacySettings) {
      return res.status(400).json({ error: 'Privacy settings are required.' });
    }
    
    // Find and update user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Update privacy settings - ensure all fields are properly set
    if (!user.privacySettings) {
      user.privacySettings = {};
    }
    
    user.privacySettings = {
      showEmail: privacySettings.showEmail ?? true,
      showMobile: privacySettings.showMobile ?? true,
      showSection: privacySettings.showSection ?? true,
      showYear: privacySettings.showYear ?? true,
      showRegId: privacySettings.showRegId ?? true,
      showDepartment: privacySettings.showDepartment ?? true,
      showAdmissionYear: privacySettings.showAdmissionYear ?? true,
      showRoomNo: privacySettings.showRoomNo ?? true,
      showStatistics: privacySettings.showStatistics ?? true
    };
    
    // Mark the nested object as modified so Mongoose saves it
    user.markModified('privacySettings');
    await user.save();
    
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;
    
    console.log(`User ${user.name} updated privacy settings:`, user.privacySettings);
    res.json({ user: userObj, message: 'Privacy settings updated successfully.' });
  } catch (err) {
    console.error('Privacy settings update error:', err);
    res.status(500).json({ error: 'Failed to update privacy settings.', details: err.message });
  }
});

// Get organizer email notification settings
app.get('/api/users/me/email-settings', async (req, res) => {
  try {
    // Extract user ID from session or query
    const userId = req.query.userId || (req.session && req.session.user && req.session.user._id);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. User ID required.' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Only organizers and admins can view/modify email preferences
    if (user.role !== 'organizer' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only organizers can access email settings.' });
    }
    
    // Initialize emailPreferences if not present
    if (!user.emailPreferences) {
      user.emailPreferences = {
        registrations: true,
        waitlist: true,
        eventUpdates: true,
        teamNotifications: true
      };
    }
    
    res.json({ emailPreferences: user.emailPreferences });
  } catch (err) {
    console.error('Error fetching email settings:', err);
    res.status(500).json({ error: 'Failed to fetch email settings.', details: err.message });
  }
});

// Update organizer email notification settings
app.put('/api/users/me/email-settings', async (req, res) => {
  try {
    const userId = req.query.userId || (req.user && req.user.userId) || req.body.userId;
    const { emailPreferences } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. User ID required.' });
    }
    
    if (!emailPreferences) {
      return res.status(400).json({ error: 'Email preferences are required.' });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Only organizers and admins can modify email preferences
    if (user.role !== 'organizer' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Only organizers can modify email settings.' });
    }
    
    // Validate email preferences structure
    const validPrefs = {
      registrations: emailPreferences.registrations ?? true,
      waitlist: emailPreferences.waitlist ?? true,
      eventUpdates: emailPreferences.eventUpdates ?? true,
      teamNotifications: emailPreferences.teamNotifications ?? true
    };
    
    user.emailPreferences = validPrefs;
    user.markModified('emailPreferences');
    await user.save();
    
    console.log(`User ${user.name} (${user.email}) updated email preferences:`, user.emailPreferences);
    
    // Don't send password back
    const userObj = user.toObject();
    delete userObj.password;
    
    res.json({ emailPreferences: user.emailPreferences, message: 'Email settings updated successfully.' });
  } catch (err) {
    console.error('Error updating email settings:', err);
    res.status(500).json({ error: 'Failed to update email settings.', details: err.message });
  }
});

// Change user password
app.put('/api/user/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    
    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedNewPassword;
    await user.save();
    
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Admin endpoints for user management
// Get all users (admin only)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude password field
    res.json({ users });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Get individual user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ user });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// Delete user by ID (admin only)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Update user by ID (admin only)
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, section, mobile, year, regId, avatar, role, roomNo, admissionMonth, admissionYear, graduationYear, lateralEntry } = req.body;
    
    // Build updates object to avoid overwriting with undefined
    const updates = {};
    if (typeof name !== 'undefined') updates.name = name;
    if (typeof email !== 'undefined') updates.email = email;
    if (typeof department !== 'undefined') updates.department = department;
    if (typeof section !== 'undefined') updates.section = section;
    if (typeof mobile !== 'undefined') updates.mobile = mobile;
    if (typeof year !== 'undefined') updates.year = year;
    if (typeof regId !== 'undefined') updates.regId = regId;
    if (typeof avatar !== 'undefined') updates.avatar = avatar;
    if (typeof role !== 'undefined') updates.role = role;
    if (typeof roomNo !== 'undefined') updates.roomNo = roomNo;
    if (typeof admissionMonth !== 'undefined') updates.admissionMonth = admissionMonth;
    if (typeof admissionYear !== 'undefined') updates.admissionYear = admissionYear;
    if (typeof graduationYear !== 'undefined') updates.graduationYear = graduationYear;
    if (typeof lateralEntry !== 'undefined') updates.lateralEntry = lateralEntry;
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ user });
  } catch (err) {
    console.error('User update error:', err);
    res.status(400).json({ error: 'Failed to update user.' });
  }
});

// Create new user (admin only)  
app.post('/api/users', async (req, res) => {
  try {
  const { name, email, password, role, department, section, mobile, year, regId, roomNo } = req.body;
    
    // Basic validation
    if (!name || !email || !password || !role || !department || !mobile) {
      return res.status(400).json({ error: 'Basic fields are required.' });
    }
    
    // Role-specific validation
    if (role === 'student' && !year) {
      return res.status(400).json({ error: 'Year is required for students.' });
    }
    if (role === 'student' && !section) {
      return res.status(400).json({ error: 'Section is required for students.' });
    }
    if (role === 'faculty' && !roomNo) {
      return res.status(400).json({ error: 'Room number is required for faculty.' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    
    // Check if regId is already taken (if provided)
    if (regId) {
      const existingRegId = await User.findOne({ regId });
      if (existingRegId) {
        return res.status(409).json({ error: 'Registration ID already exists.' });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department,
  section: section || '',
  roomNo: roomNo || '',
      mobile,
  year: role === 'faculty' ? undefined : year,
      regId: regId || `USER-${Date.now()}`,
      branch: department // Set branch same as department for compatibility
    });
    
    await user.save();
    
    // Return user without password
    const userObj = user.toObject();
    delete userObj.password;
    
    res.status(201).json({ 
      message: 'User created successfully.',
      user: userObj 
    });
  } catch (err) {
    console.error('User creation error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Admin: Create new user
app.post('/api/admin/users', async (req, res) => {
  try {
  const { name, email, password, role, department, section, mobile, year, regId, roomNo } = req.body;
    
    // Basic validation
    if (!name || !email || !password || !role || !department || !mobile) {
      return res.status(400).json({ error: 'Basic fields are required.' });
    }
    
    // Role-specific validation
    if (role === 'student' && !year) {
      return res.status(400).json({ error: 'Year is required for students.' });
    }
    if (role === 'student' && !section) {
      return res.status(400).json({ error: 'Section is required for students.' });
    }
    if (role === 'faculty' && !roomNo) {
      return res.status(400).json({ error: 'Room number is required for faculty.' });
    }
    
    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    
    // Check if regId is already taken (if provided)
    if (regId) {
      const existingRegId = await User.findOne({ regId });
      if (existingRegId) {
        return res.status(409).json({ error: 'Registration ID already exists.' });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department,
  section: section || '',
  roomNo: roomNo || '',
      mobile,
  year: role === 'faculty' ? undefined : year,
      regId: regId || `USER-${Date.now()}`,
      branch: department // Set branch same as department for compatibility
    });
    
    await user.save();
    
    // Return user without password
    const userObj = user.toObject();
    delete userObj.password;
    
    res.status(201).json({ 
      message: 'User created successfully.',
      user: userObj 
    });
  } catch (err) {
    console.error('Admin user creation error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Admin: Update any user's profile
app.put('/api/admin/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, department, section, mobile, year, regId, avatar, role } = req.body;
    
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { name, email, department, section, mobile, year, regId, avatar, role },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ user });
  } catch (err) {
    console.error('Admin user update error:', err);
    res.status(400).json({ error: 'Failed to update user.' });
  }
});

// Admin: Change any user's password
app.put('/api/admin/user/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required.' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    
    // Find user
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedNewPassword;
    await user.save();
    
    res.json({ success: true, message: 'Password updated successfully by admin.' });
  } catch (err) {
    console.error('Admin password change error:', err);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// Admin: Delete user
app.delete('/api/admin/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Also delete user's registrations
    await Registration.deleteMany({ userId: id });
    
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Admin user delete error:', err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// ========== SYSTEM SETTINGS & USER APPROVAL ==========

// Get system settings (admin only)
app.get('/api/admin/settings', async (req, res) => {
  try {
    const requireApproval = await getSystemSetting('requireRegistrationApproval', false);
    res.json({ 
      requireRegistrationApproval: requireApproval 
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

// Update system settings (admin only)
app.put('/api/admin/settings', async (req, res) => {
  try {
    const { userId, requireRegistrationApproval } = req.body;
    
    // Verify admin
    const admin = await User.findById(userId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    if (typeof requireRegistrationApproval !== 'undefined') {
      await setSystemSetting('requireRegistrationApproval', requireRegistrationApproval, userId);
    }
    
    res.json({ 
      success: true, 
      message: 'Settings updated successfully.',
      requireRegistrationApproval 
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
});

// Get pending users (admin only)
app.get('/api/admin/users/pending', async (req, res) => {
  try {
    const pendingUsers = await User.find({ accountStatus: 'pending' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json({ users: pendingUsers, count: pendingUsers.length });
  } catch (err) {
    console.error('Error fetching pending users:', err);
    res.status(500).json({ error: 'Failed to fetch pending users.' });
  }
});

// Approve user registration (admin only)
app.put('/api/admin/users/:id/approve', async (req, res) => {
  try {
    const { adminId } = req.body;
    const { id } = req.params;
    
    // Verify admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    const user = await User.findByIdAndUpdate(
      id,
      { 
        accountStatus: 'approved',
        accountStatusUpdatedAt: new Date(),
        accountStatusUpdatedBy: adminId
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Send email notification to user about approval
    try {
      await sendAccountApprovalEmail(user.email, user.name);
      console.log(`✅ Approval email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError.message);
      // Don't fail the approval if email fails
    }
    
    res.json({ 
      success: true, 
      message: `User ${user.name} has been approved. Notification email sent.`,
      user 
    });
  } catch (err) {
    console.error('Error approving user:', err);
    res.status(500).json({ error: 'Failed to approve user.' });
  }
});

// Reject user registration (admin only) - Deletes the account and sends rejection email
app.put('/api/admin/users/:id/reject', async (req, res) => {
  try {
    const { adminId, reason } = req.body;
    const { id } = req.params;
    
    // Verify admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    // Find the user first to get their details for the email
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    // Store user details before deletion
    const userEmail = user.email;
    const userName = user.name;
    
    // Delete the user from database
    await User.findByIdAndDelete(id);
    
    // Send rejection email to the user
    try {
      await sendAccountRejectionEmail(userEmail, userName, reason);
      console.log(`✅ Rejection email sent to ${userEmail}`);
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError.message);
      // Don't fail the rejection if email fails
    }
    
    res.json({ 
      success: true, 
      message: `User ${userName} has been rejected and removed from the system. Notification email sent to ${userEmail}.`,
      deletedUser: {
        name: userName,
        email: userEmail
      },
      reason 
    });
  } catch (err) {
    console.error('Error rejecting user:', err);
    res.status(500).json({ error: 'Failed to reject user.' });
  }
});

// Enable/Disable user account (admin only)
app.put('/api/admin/users/:id/toggle-disable', async (req, res) => {
  try {
    const { adminId, reason, disable } = req.body; // disable: true to disable, false to enable
    const { id } = req.params;
    
    // Verify admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    const updateData = {
      isDisabled: disable,
      accountStatusUpdatedAt: new Date(),
      accountStatusUpdatedBy: adminId
    };
    
    if (disable) {
      updateData.disabledAt = new Date();
      updateData.disabledReason = reason || 'Account disabled by administrator';
    } else {
      // When enabling, also set account status to approved if it was rejected
      updateData.disabledAt = null;
      updateData.disabledReason = null;
      updateData.accountStatus = 'approved';
    }
    
    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    
    res.json({ 
      success: true, 
      message: disable 
        ? `User ${user.name}'s account has been disabled.`
        : `User ${user.name}'s account has been enabled.`,
      user 
    });
  } catch (err) {
    console.error('Error toggling user disable status:', err);
    res.status(500).json({ error: 'Failed to update user account status.' });
  }
});

// Bulk approve users (admin only)
app.put('/api/admin/users/bulk-approve', async (req, res) => {
  try {
    const { adminId, userIds } = req.body;
    
    // Verify admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'No user IDs provided.' });
    }
    
    // Get users before updating to send emails
    const usersToApprove = await User.find({ 
      _id: { $in: userIds }, 
      accountStatus: 'pending' 
    }).select('email name');
    
    const result = await User.updateMany(
      { _id: { $in: userIds }, accountStatus: 'pending' },
      { 
        accountStatus: 'approved',
        accountStatusUpdatedAt: new Date(),
        accountStatusUpdatedBy: adminId
      }
    );
    
    // Send approval emails to all approved users
    let emailsSent = 0;
    for (const user of usersToApprove) {
      try {
        await sendAccountApprovalEmail(user.email, user.name);
        emailsSent++;
        console.log(`✅ Approval email sent to ${user.email}`);
      } catch (emailError) {
        console.error(`Failed to send approval email to ${user.email}:`, emailError.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `${result.modifiedCount} user(s) approved. ${emailsSent} notification email(s) sent.`,
      approvedCount: result.modifiedCount,
      emailsSent
    });
  } catch (err) {
    console.error('Error bulk approving users:', err);
    res.status(500).json({ error: 'Failed to approve users.' });
  }
});

// ========== END SYSTEM SETTINGS & USER APPROVAL ==========

// Event Routes - with caching for high traffic
app.get('/api/events', routeCache.events, async (req, res) => {
  try {
    const events = await Event.find()
      .populate('organizerId', 'name email role');
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get single event by ID - with caching
app.get('/api/events/:id', routeCache.eventDetail, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate('organizerId', 'name email role');
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Check event access for a user
app.get('/api/events/:eventId/check-access/:userId', async (req, res) => {
  try {
    const { eventId, userId } = req.params;
    
    const event = await Event.findById(eventId);
    const user = await User.findById(userId);
    
    if (!event || !user) {
      return res.status(404).json({ error: 'Event or user not found' });
    }
    
    let hasAccess = true;
    let denialReason = '';
    
    if (event.accessControl && event.accessControl.type) {
      const { accessControl } = event;
      
      if (accessControl.type === 'students_only' && user.role !== 'student') {
        hasAccess = false;
        denialReason = 'This event is only for students';
      } else if (accessControl.type === 'faculty_only' && user.role !== 'faculty') {
        hasAccess = false;
        denialReason = 'This event is only for faculty members';
      } else if (accessControl.type === 'custom') {
        if (accessControl.allowedRoles?.length > 0 && !accessControl.allowedRoles.includes(user.role)) {
          hasAccess = false;
          denialReason = `This event is only for ${accessControl.allowedRoles.join(', ')}`;
        }
        if (accessControl.allowedDepartments?.length > 0 && !accessControl.allowedDepartments.includes(user.department)) {
          hasAccess = false;
          denialReason = `This event is only for ${accessControl.allowedDepartments.join(', ')} department(s)`;
        }
        if (user.role === 'student' && accessControl.allowedYears?.length > 0 && !accessControl.allowedYears.includes(user.year)) {
          hasAccess = false;
          denialReason = `This event is only for year ${accessControl.allowedYears.join(', ')} students`;
        }
      }
    }
    
    res.json({ hasAccess, denialReason, accessControl: event.accessControl });
  } catch (error) {
    console.error('Error checking event access:', error);
    res.status(500).json({ error: 'Failed to check event access' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    // Log the incoming request body for debugging
    console.log('Event creation request body:', req.body);
    console.log('Event creation request body keys:', Object.keys(req.body));
    // Log each field and its type for debugging
    const requiredFields = ['title','description','category','date','time','venue','maxParticipants','organizerId','registrationDeadline'];
    requiredFields.forEach(field => {
      console.log(`${field}:`, req.body[field], 'type:', typeof req.body[field]);
    });
    const {
      title,
      description,
      category,
      date,
      time,
      venue,
      maxParticipants,
      organizerId,
      image,
      requirements,
      prizes,
      status,
      registrationDeadline,
      accessControl,
      autoApproval,
      allowOtherColleges,
      notifyAllUsers,
      visibleToOthers,
      silentRelease,
      collegeName,
      isTeamEvent,
      minTeamSize,
      maxTeamSize
    } = req.body;

    if (!title || !description || !category || !date || !time || !venue || !maxParticipants || !organizerId || !registrationDeadline) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const event = new Event({
      title,
      description,
      category,
      date,
      time,
      venue,
      maxParticipants,
      organizerId,
      image,
      requirements,
      prizes,
      status,
      registrationDeadline,
      accessControl: accessControl || { type: 'everyone' },
      autoApproval: autoApproval !== undefined ? autoApproval : true,
      allowOtherColleges: allowOtherColleges || false,
      notifyAllUsers: notifyAllUsers || false,
      visibleToOthers: visibleToOthers === true || visibleToOthers === 'true' || false,
      silentRelease: silentRelease === true || silentRelease === 'true' || false,
      collegeName: collegeName || 'DVR & Dr. HS MIC College of Technology',
      isTeamEvent: isTeamEvent === true || isTeamEvent === 'true' || false,
      minTeamSize: parseInt(minTeamSize) || 2,
      maxTeamSize: parseInt(maxTeamSize) || 4
    });
    await event.save();
    
    // Invalidate events cache after creation
    invalidateCache.onEventChange(serverCache);
    
    // ⚡ INSTANT RESPONSE - Return immediately, process notifications in background
    res.status(201).json({ event });
    
    // ========== BACKGROUND PROCESSING (after response sent) ==========
    // --- NOTIFICATION (runs in background) ---
    if (!event.silentRelease) {
      // Run notification in background - don't await
      (async () => {
        try {
          // Notify users about the new event based on notifyAllUsers setting
          let usersToNotify;
          if (event.notifyAllUsers) {
            usersToNotify = await User.find({}).select('_id name email').lean();
          } else {
            usersToNotify = await User.find({ college: event.collegeName }).select('_id name email').lean();
            if (usersToNotify.length === 0) {
              usersToNotify = await User.find({}).select('_id name email').lean();
            }
          }
          
          const totalUsers = usersToNotify.length;
          const eventDetails = `New event "${event.title}" - ${event.category} on ${new Date(event.date).toLocaleDateString()} at ${event.time}, ${event.venue}`;
          
          // Emit job started to organizer
          io.to(`user_${organizerId}`).emit('backgroundJobStarted', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            total: totalUsers,
            message: `Sending notifications to ${totalUsers} users...`
          });
          
          // Send notifications in batches with progress
          const batchSize = 50;
          let completed = 0;
          
          for (let i = 0; i < usersToNotify.length; i += batchSize) {
            const batch = usersToNotify.slice(i, i + batchSize);
            
            await Promise.allSettled(
              batch.map(user => 
                notifyUser(
                  req,
                  user._id,
                  'event_created',
                  eventDetails,
                  { eventId: event._id, eventTitle: event.title, eventImage: event.image }
                )
              )
            );
            
            completed += batch.length;
            
            // Emit progress to organizer
            io.to(`user_${organizerId}`).emit('backgroundJobProgress', {
              jobId: `notify_${event._id}`,
              type: 'event_notifications',
              progress: Math.round((completed / totalUsers) * 100),
              completed,
              total: totalUsers,
              message: `Notified ${completed}/${totalUsers} users`
            });
          }
          
          // Emit completion to organizer
          io.to(`user_${organizerId}`).emit('backgroundJobComplete', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            status: 'completed',
            completed: totalUsers,
            total: totalUsers,
            message: `Successfully notified ${totalUsers} users about "${event.title}"`
          });
          
          console.log(`✅ Background: Notified ${totalUsers} users about event "${event.title}"`);
        } catch (err) {
          console.error('Background notification error:', err.message);
          io.to(`user_${organizerId}`).emit('backgroundJobComplete', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            status: 'failed',
            message: 'Failed to send some notifications'
          });
        }
      })();
    } else {
      console.log(`🔇 Silent event release: "${event.title}" - No notifications sent`);
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- MULTIPART EVENT CREATION (upload support) ---
// Accepts multipart/form-data with optional image file field 'image'
// Keeps existing /api/events JSON route intact; clients may choose either.
app.post('/api/events/create', uploadMiddleware.single('image'), async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      date,
      time,
      venue,
      maxParticipants,
      organizerId,
      requirements,
      prizes,
      status,
      registrationDeadline,
      accessControl,
      autoApproval,
      allowOtherColleges,
      notifyAllUsers,
      visibleToOthers,
      silentRelease,
      collegeName,
      isTeamEvent,
      minTeamSize,
      maxTeamSize
    } = req.body;

    if (!title || !description || !category || !date || !time || !venue || !maxParticipants || !organizerId || !registrationDeadline) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    let image = req.body.image || '';
    let imageType = 'url';
    let imageWidth, imageHeight, imageOriginalName;
    let imageGridFsId;

    // ⚡ FAST PATH: If there's an image upload, handle it asynchronously
    if (req.file && gridFsBucket) {
      imageType = 'gridfs';
      imageOriginalName = req.file.originalname;
      // Use temporary placeholder, update in background
      image = `/api/images/pending`;
    }

    const event = new Event({
      title,
      description,
      category,
      date,
      time,
      venue,
      maxParticipants,
      organizerId,
      image,
      imageType,
      imageGridFsId,
      imageWidth,
      imageHeight,
      imageOriginalName,
      requirements,
      prizes,
      status,
      registrationDeadline,
      accessControl: accessControl || { type: 'everyone' },
      autoApproval: autoApproval !== undefined ? (autoApproval === 'true' || autoApproval === true) : true,
      allowOtherColleges: allowOtherColleges === 'true' || allowOtherColleges === true || false,
      notifyAllUsers: notifyAllUsers === 'true' || notifyAllUsers === true || false,
      visibleToOthers: visibleToOthers === 'true' || visibleToOthers === true || false,
      silentRelease: silentRelease === 'true' || silentRelease === true || false,
      collegeName: collegeName || 'DVR & Dr. HS MIC College of Technology',
      isTeamEvent: isTeamEvent === 'true' || isTeamEvent === true || false,
      minTeamSize: parseInt(minTeamSize) || 2,
      maxTeamSize: parseInt(maxTeamSize) || 4
    });
    await event.save();

    // ========== BACKGROUND PROCESSING ==========
    
    // --- IMAGE UPLOAD (runs in background) ---
    if (req.file && gridFsBucket) {
      (async () => {
        try {
          const filename = `${Date.now()}-${req.file.originalname}`;
          const writeStream = gridFsBucket.openUploadStream(filename, {
            contentType: req.file.mimetype,
            metadata: {
              uploadedBy: 'event-image',
              originalName: req.file.originalname,
              mimeType: req.file.mimetype,
              uploadDate: new Date().toISOString()
            }
          });
          writeStream.end(req.file.buffer);
          const savedFile = await new Promise((resolve, reject) => {
            writeStream.on('error', reject);
            writeStream.on('finish', resolve);
          });
          
          if (savedFile && savedFile._id) {
            // Get image dimensions
            try {
              const img = await loadImage(req.file.buffer);
              imageWidth = img.width;
              imageHeight = img.height;
            } catch (err) {
              console.warn('Dimension probe failed:', err.message);
            }
            
            // Update event with actual image URL
            await Event.findByIdAndUpdate(event._id, {
              image: `/api/images/${savedFile._id}`,
              imageGridFsId: savedFile._id,
              imageWidth,
              imageHeight
            });
            
            console.log(`✅ Background: Image uploaded for event "${event.title}"`);
          }
        } catch (err) {
          console.error('Background image upload error:', err.message);
        }
      })();
    }

    // --- GALLERY CREATION (runs in background) ---
    (async () => {
      try {
        await galleryController.createGalleryForEvent(event._id);
        console.log(`✅ Background: Gallery created for event "${event.title}"`);
      } catch (galleryError) {
        console.error('Background gallery creation error:', galleryError);
      }
    })();

    // Invalidate events cache after creation
    invalidateCache.onEventChange(serverCache);
    
    // ⚡ INSTANT RESPONSE - Return immediately, process notifications in background
    res.status(201).json({ event });

    // ========== BACKGROUND PROCESSING (after response sent) ==========
    // Only send notifications if silentRelease is OFF
    if (!event.silentRelease) {
      // Run notification in background - don't await
      (async () => {
        try {
          // Notify users based on notifyAllUsers setting
          let usersToNotify;
          if (event.notifyAllUsers) {
            usersToNotify = await User.find({}).select('_id name email').lean();
          } else {
            usersToNotify = await User.find({ college: event.collegeName }).select('_id name email').lean();
            if (usersToNotify.length === 0) {
              usersToNotify = await User.find({}).select('_id name email').lean();
            }
          }
          
          const totalUsers = usersToNotify.length;
          const eventDetails = `New event "${event.title}" - ${event.category} on ${new Date(event.date).toLocaleDateString()} at ${event.time}, ${event.venue}`;
          
          // Emit job started to organizer
          console.log(`🚀 Emitting backgroundJobStarted to user_${organizerId}`);
          io.to(`user_${organizerId}`).emit('backgroundJobStarted', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            total: totalUsers,
            message: `Sending notifications to ${totalUsers} users...`
          });
          
          // Send notifications in batches with progress
          const batchSize = 50;
          let completed = 0;
          
          for (let i = 0; i < usersToNotify.length; i += batchSize) {
            const batch = usersToNotify.slice(i, i + batchSize);
            
            await Promise.allSettled(
              batch.map(user => 
                notifyUser(
                  { app: req.app, get: () => null },
                  user._id,
                  'event_created',
                  eventDetails,
                  { eventId: event._id, eventTitle: event.title, eventImage: event.image }
                )
              )
            );
            
            completed += batch.length;
            
            // Emit progress to organizer
            console.log(`📊 Emitting backgroundJobProgress: ${completed}/${totalUsers} to user_${organizerId}`);
            io.to(`user_${organizerId}`).emit('backgroundJobProgress', {
              jobId: `notify_${event._id}`,
              type: 'event_notifications',
              progress: Math.round((completed / totalUsers) * 100),
              completed,
              total: totalUsers,
              message: `Notified ${completed}/${totalUsers} users`
            });
          }
          
          // Emit completion to organizer
          console.log(`✅ Emitting backgroundJobComplete to user_${organizerId}`);
          io.to(`user_${organizerId}`).emit('backgroundJobComplete', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            status: 'completed',
            completed: totalUsers,
            total: totalUsers,
            message: `Successfully notified ${totalUsers} users about "${event.title}"`
          });
          
          console.log(`✅ Background: Notified ${totalUsers} users about event "${event.title}"`);
        } catch (err) {
          console.error('Background notification error:', err.message);
          io.to(`user_${organizerId}`).emit('backgroundJobComplete', {
            jobId: `notify_${event._id}`,
            type: 'event_notifications',
            status: 'failed',
            message: 'Failed to send some notifications'
          });
        }
      })();
    } else {
      console.log(`🔇 Silent event release: "${event.title}" - No notifications sent`);
    }
    
    return; // Response already sent
  } catch (err) {
    console.error('Multipart event creation error:', err);
    return res.status(400).json({ error: err.message });
  }
});

// --- IMAGE REPLACEMENT FOR EXISTING EVENT ---
app.patch('/api/events/:id/image', uploadMiddleware.single('image'), async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let oldGridId = event.imageType === 'gridfs' ? event.imageGridFsId : null;

    if (req.file && gridFsBucket) {
      // Upload new file to GridFS
      const filename = `${Date.now()}-${req.file.originalname}`;
      const writeStream = gridFsBucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: 'event-image',
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadDate: new Date().toISOString()
        }
      });
      writeStream.end(req.file.buffer);
      const savedFile = await new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
      });
      if (savedFile && savedFile._id) {
        event.image = `/api/images/${savedFile._id}`;
        event.imageType = 'gridfs';
        event.imageGridFsId = savedFile._id;
        event.imageOriginalName = req.file.originalname;
        try {
          const img = await loadImage(req.file.buffer);
          event.imageWidth = img.width;
          event.imageHeight = img.height;
        } catch (err) {
          console.warn('New image dimension read failed:', err.message);
        }
      }
    } else if (req.body.image) {
      // Switch to URL-based image
      event.image = req.body.image;
      event.imageType = 'url';
      event.imageOriginalName = undefined;
      event.imageWidth = undefined;
      event.imageHeight = undefined;
      event.imageGridFsId = undefined;
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    await event.save();

    // Delete old GridFS file if replaced
    if (oldGridId && event.imageType === 'gridfs' && oldGridId.toString() !== String(event.imageGridFsId)) {
      try { gridFsBucket.delete(oldGridId); } catch (err) { console.warn('Failed to delete old GridFS file:', err.message); }
    }

    return res.json({ success: true, event });
  } catch (err) {
    console.error('Image replace error:', err);
    return res.status(400).json({ error: err.message });
  }
});

// --- IMAGE DELETE ---
app.delete('/api/events/:id/image', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const oldGridId = event.imageType === 'gridfs' ? event.imageGridFsId : null;

    event.image = '';
    event.imageType = 'url'; // reset to default
    event.imageOriginalName = undefined;
    event.imageWidth = undefined;
    event.imageHeight = undefined;
    await event.save();

    if (oldGridId) {
      try { gridFsBucket.delete(oldGridId); } catch (err) { console.warn('Failed to delete GridFS file:', err.message); }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Image delete error:', err);
    return res.status(400).json({ error: err.message });
  }
});

// Stream image content by GridFS ID (top-level route)
app.get('/api/images/:id', async (req, res) => {
  if (!gridFsBucket) return res.status(503).json({ error: 'Image storage not ready' });
  let fileId;
  try {
    fileId = new mongoose.mongo.ObjectId(req.params.id);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid image id' });
  }
  try {
    const files = await gridFsBucket.find({ _id: fileId }).toArray();
    if (!files || !files[0]) return res.status(404).json({ error: 'Image not found' });
    const file = files[0];
    if (file.contentType) res.set('Content-Type', file.contentType);
    else if (file.metadata?.mimeType) res.set('Content-Type', file.metadata.mimeType);
    else res.set('Content-Type', 'application/octet-stream');
    const stream = gridFsBucket.openDownloadStream(fileId);
    stream.on('error', (err) => {
      console.error('GridFS stream error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
    stream.pipe(res);
  } catch (err) {
    console.error('Image fetch error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// List all images in the database (for image browser)
app.get('/api/images', async (req, res) => {
  if (!gridFsBucket) return res.status(503).json({ error: 'Image storage not ready' });
  
  try {
    // Get all files from GridFS
    const files = await gridFsBucket.find({}).sort({ uploadDate: -1 }).toArray();
    
    // Also get images from events that use URL-based images
    const eventsWithImages = await Event.find({ 
      image: { $exists: true, $ne: '' },
      imageType: { $in: ['url', undefined] }
    }).select('image imageWidth imageHeight title').lean();
    
    // Format GridFS files
    const gridFsImages = files.map(file => ({
      id: file._id.toString(),
      type: 'gridfs',
      url: `/api/images/${file._id}`,
      filename: file.filename,
      contentType: file.contentType || file.metadata?.mimeType || 'image/jpeg',
      width: file.metadata?.width,
      height: file.metadata?.height,
      uploadDate: file.uploadDate,
      size: file.length,
    }));
    
    // Format URL-based images (deduplicate by URL)
    const urlImageMap = new Map();
    eventsWithImages.forEach(event => {
      if (event.image && !urlImageMap.has(event.image)) {
        urlImageMap.set(event.image, {
          id: event.image,
          type: 'url',
          url: event.image,
          width: event.imageWidth,
          height: event.imageHeight,
          title: event.title,
        });
      }
    });
    const urlImages = Array.from(urlImageMap.values());
    
    res.json({
      gridFsImages,
      urlImages,
      total: gridFsImages.length + urlImages.length
    });
  } catch (err) {
    console.error('Error listing images:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Upload image directly to database (GridFS) - for image browser
app.post('/api/images/upload', uploadMiddleware.single('image'), async (req, res) => {
  if (!gridFsBucket) return res.status(503).json({ error: 'Image storage not ready' });
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const filename = req.file.originalname || `image_${Date.now()}.jpg`;
    
    // Try to get image dimensions from buffer
    let width, height;
    try {
      // Simple PNG/JPEG dimension extraction
      const buffer = req.file.buffer;
      if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        // PNG: dimensions at bytes 16-24
        width = buffer.readUInt32BE(16);
        height = buffer.readUInt32BE(20);
      } else if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        // JPEG: need to parse segments
        let offset = 2;
        while (offset < buffer.length) {
          if (buffer[offset] !== 0xFF) break;
          const marker = buffer[offset + 1];
          if (marker === 0xC0 || marker === 0xC2) {
            height = buffer.readUInt16BE(offset + 5);
            width = buffer.readUInt16BE(offset + 7);
            break;
          }
          const len = buffer.readUInt16BE(offset + 2);
          offset += 2 + len;
        }
      }
    } catch (dimErr) {
      console.warn('Could not determine image dimensions:', dimErr);
    }
    
    const writeStream = gridFsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
      metadata: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        uploadDate: new Date().toISOString(),
        width,
        height,
        source: 'direct-upload'
      }
    });
    
    writeStream.end(req.file.buffer);
    
    writeStream.on('finish', () => {
      res.json({
        success: true,
        id: writeStream.id.toString(),
        imageUrl: `/api/images/${writeStream.id}`,
        filename,
        width,
        height
      });
    });
    
    writeStream.on('error', (err) => {
      console.error('GridFS write error:', err);
      res.status(500).json({ error: 'Failed to save image' });
    });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Delete image from database (GridFS)
app.delete('/api/images/:id', async (req, res) => {
  if (!gridFsBucket) return res.status(503).json({ error: 'Image storage not ready' });
  
  try {
    const imageIdStr = req.params.id;
    
    // Validate ObjectId format
    if (!imageIdStr || imageIdStr.length !== 24) {
      return res.status(400).json({ error: 'Invalid image ID format' });
    }
    
    // Use mongoose.mongo.ObjectId to match the GridFSBucket's native driver
    let imageId;
    try {
      imageId = new mongoose.mongo.ObjectId(imageIdStr);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid image ID' });
    }
    
    // Check if the image exists
    const files = await gridFsBucket.find({ _id: imageId }).toArray();
    if (files.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Delete the file from GridFS
    await gridFsBucket.delete(imageId);
    
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: 'Failed to delete image', details: err.message });
  }
});

// --- USER AVATAR UPLOAD (GridFS) ---
// Uploads avatar, stores in GridFS and updates user's avatar URL and avatarGridFsId
app.post('/api/user/:id/avatar', uploadMiddleware.single('avatar'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let oldGridId = user.avatarGridFsId || null;

    if (req.file && gridFsBucket) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const writeStream = gridFsBucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: {
          uploadedBy: `user-${user._id}`,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          uploadDate: new Date().toISOString()
        }
      });
      writeStream.end(req.file.buffer);
      const savedFile = await new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);
      });
      if (savedFile && savedFile._id) {
        user.avatar = `/api/images/${savedFile._id}`;
        user.avatarGridFsId = savedFile._id;
        try {
          const img = await loadImage(req.file.buffer);
          // optionally store dimensions if needed
        } catch (err) {
          console.warn('Avatar dimension read failed:', err.message);
        }
        await user.save();
      }
    } else {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old GridFS file if replaced
    if (oldGridId && user.avatarGridFsId && oldGridId.toString() !== user.avatarGridFsId.toString()) {
      try { gridFsBucket.delete(oldGridId); } catch (err) { console.warn('Failed to delete old avatar GridFS file:', err.message); }
    }

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ success: true, user: userObj });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(400).json({ error: err.message });
  }
});

// --- USER AVATAR DELETE ---
app.delete('/api/user/:id/avatar', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const oldGridId = user.avatarGridFsId || null;

    user.avatar = '';
    user.avatarGridFsId = undefined;
    await user.save();

    if (oldGridId) {
      try { gridFsBucket.delete(oldGridId); } catch (err) { console.warn('Failed to delete avatar GridFS file:', err.message); }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Avatar delete error:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

// UPDATE EVENT (PUT) - Update event with JSON body
app.put('/api/events/:id', async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      date,
      time,
      venue,
      maxParticipants,
      organizerId,
      registrationDeadline
    } = req.body;

    if (!title || !description || !category || !date || !time || !venue || !maxParticipants || !organizerId || !registrationDeadline) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const oldEvent = await Event.findById(req.params.id).lean();
    const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    // Invalidate events cache after update
    invalidateCache.onEventChange(serverCache, req.params.id);
    
    // STATUS SYNCHRONIZATION: Update all sub-events when main event status changes to completed or cancelled
    if (req.body.status && (req.body.status === 'completed' || req.body.status === 'cancelled')) {
      const updateResult = await SubEvent.updateMany(
        { parentEventId: req.params.id },
        { status: req.body.status }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`🔄 Status sync: Updated ${updateResult.modifiedCount} sub-events to "${req.body.status}" for event: ${event.title}`);
      }
    }
    
    // ⚡ INSTANT RESPONSE - Return immediately, process notifications in background
    res.json({ event });
    
    // ========== BACKGROUND PROCESSING (after response sent) ==========
    
    // --- NOTIFICATION (background) ---
    if (oldEvent && event) {
      (async () => {
        try {
          const registrations = await Registration.find({ eventId: req.params.id })
            .populate('userId', '_id name email')
            .lean();
          
          // Build a detailed message showing what changed
          let changes = [];
          let priority = 'normal';
          let notificationType = 'event_updated';
          
          // Check for critical changes
          if (req.body.status === 'cancelled') {
            changes.push(`Event has been CANCELLED`);
            priority = 'critical';
            notificationType = 'event_cancelled';
          } else if (req.body.status === 'postponed') {
            changes.push(`Event has been POSTPONED`);
            priority = 'urgent';
            notificationType = 'event_postponed';
          }
          
          if (oldEvent.title !== event.title) {
            changes.push(`Title updated to "${event.title}"`);
          }
          if (oldEvent.date?.toString() !== event.date?.toString()) {
            changes.push(`Date updated to ${new Date(event.date).toLocaleDateString()}`);
            priority = priority === 'normal' ? 'urgent' : priority;
          }
          if (oldEvent.time !== event.time) {
            changes.push(`Time updated to ${event.time}`);
            priority = priority === 'normal' ? 'urgent' : priority;
          }
          if (oldEvent.venue !== event.venue) {
            changes.push(`Venue changed to "${event.venue}"`);
            priority = 'urgent';
            notificationType = 'venue_changed';
          }
          if (oldEvent.description !== event.description) {
            changes.push(`Description updated`);
          }
          if (oldEvent.maxParticipants !== event.maxParticipants) {
            changes.push(`Max participants updated to ${event.maxParticipants}`);
          }
          
          const changeMessage = changes.length > 0 
            ? `📝 Event "${event.title}" has been updated!\n\n✨ Changes: ${changes.join(', ')}.`
            : `📝 Event "${event.title}" has been updated with new information.`;
          
          const totalUsers = registrations.length;
          
          if (totalUsers === 0) {
            console.log(`ℹ️ No registered users to notify for event update: "${event.title}"`);
            return;
          }
          
          // Emit job started to organizer
          io.to(`user_${organizerId}`).emit('backgroundJobStarted', {
            jobId: `update_notify_${event._id}`,
            type: 'event_update_notifications',
            total: totalUsers,
            message: `Notifying ${totalUsers} registered users about event update...`
          });
          
          // Send notifications in batches with progress
          const batchSize = 50;
          let completed = 0;
          
          for (let i = 0; i < registrations.length; i += batchSize) {
            const batch = registrations.slice(i, i + batchSize);
            
            await Promise.allSettled(
              batch.map(reg => {
                if (reg.userId && reg.userId._id) {
                  return notifyUser(
                    { app: req.app, get: () => null },
                    reg.userId._id,
                    notificationType,
                    changeMessage,
                    buildNotificationData(event, {
                      changes: { old: oldEvent, new: event.toObject() }
                    }),
                    priority
                  );
                }
                return Promise.resolve();
              })
            );
            
            completed += batch.length;
            
            // Emit progress to organizer
            io.to(`user_${organizerId}`).emit('backgroundJobProgress', {
              jobId: `update_notify_${event._id}`,
              type: 'event_update_notifications',
              progress: Math.round((completed / totalUsers) * 100),
              completed,
              total: totalUsers,
              message: `Notified ${completed}/${totalUsers} registered users`
            });
          }
          
          // Emit completion to organizer
          io.to(`user_${organizerId}`).emit('backgroundJobComplete', {
            jobId: `update_notify_${event._id}`,
            type: 'event_update_notifications',
            status: 'completed',
            completed: totalUsers,
            total: totalUsers,
            message: `Notified ${totalUsers} users about "${event.title}" update`
          });
          
          console.log(`✅ Background: Event "${event.title}" updated - Notified ${totalUsers} registered users`);
        } catch (err) {
          console.error('Background update notification error:', err.message);
        }
      })();
    }
    
    // AUTO-APPROVAL BACKGROUND: If autoApproval switched from false -> true, approve pending registrations
    if (oldEvent && !oldEvent.autoApproval && event.autoApproval) {
      (async () => {
        try {
          console.log(`🔔 Auto-approval enabled for event ${event._id}. Processing waiting list...`);
          const pendingRegs = await Registration.find({ eventId: req.params.id, approvalStatus: 'pending' })
            .populate('userId', '-password')
            .sort({ registeredAt: 1 });

          let autoApprovedCount = 0;
          const eventDoc = await Event.findById(event._id);

          for (const registration of pendingRegs) {
            try {
              if (eventDoc.currentParticipants >= eventDoc.maxParticipants) {
                console.log('Event full during auto-approval, stopping further approvals.');
                break;
              }

              const registeredUser = registration.userId;
              if (!registeredUser) continue;

              const issuedAt = new Date().toISOString();

              const qrPayload = {
                registrationId: registration.registrationId,
                userId: registeredUser._id.toString(),
                eventIds: [req.params.id],
                timestamp: Date.now(),
                name: registeredUser.name,
                email: registeredUser.email,
                college: registeredUser.college,
                department: registeredUser.department,
                section: registeredUser.section || 'A',
                year: registeredUser.year,
                regId: registeredUser.regId || registration.registrationId.substring(0, 8).toUpperCase(),
                registeredAt: issuedAt,
                event_title: eventDoc.title,
                student_name: registeredUser.name,
                event_venue: eventDoc.venue,
                event_date: new Date(eventDoc.date).toLocaleDateString(),
                event_time: eventDoc.time,
                team: registration.team || registration.teamName || null,
                seating: registration.seating || null,
                ticketType: registration.ticketType || null,
                events: [{ title: eventDoc.title, venue: eventDoc.venue, date: new Date(eventDoc.date).toLocaleDateString(), time: eventDoc.time, subEvents: eventDoc.subEvents || [], team: registration.team || registration.teamName || null, seating: registration.seating || null, ticketType: registration.ticketType || null }]
              };

              const qrContent = generateQRTextContent(qrPayload);

              const signature = generateQRSignature({
                registration_id: registration.registrationId,
                student_id: registeredUser._id.toString(),
                event_id: req.params.id,
                issued_at: issuedAt
              });

              const qrCodeUrl = await generateQRCodeWithEventName(
                qrContent,
                eventDoc.title,
                { size: 400, fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', maxChars: 40, position: 'below', backgroundColor: '#FFFFFF', textColor: '#000000', qrColor: '#000000' }
              );

              qrPayload.signature = signature;

              registration.approvalStatus = 'approved';
              registration.status = 'registered';
              registration.approvedAt = new Date();
              registration.approvedBy = eventDoc.organizerId || 'system';
              registration.approvalType = 'autoApproved';
              registration.qrCode = qrCodeUrl;
              registration.qrPayload = qrPayload;

              await registration.save();
              eventDoc.currentParticipants += 1;

              // Notify the user about auto-approval (fire and forget)
              notifyUser(
                { app: req.app, get: () => null },
                registeredUser._id,
                'registration_approved',
                `Your registration for '${eventDoc.title}' has been approved automatically.`,
                { eventId: eventDoc._id, eventTitle: eventDoc.title, eventImage: eventDoc.image, registrationId: registration._id }
              ).catch(() => {});

              autoApprovedCount += 1;
            } catch (innerErr) {
              console.error('Error auto-approving registration', registration._id, innerErr);
            }
          }

          await eventDoc.save();
          console.log(`✅ Background: Auto-approved ${autoApprovedCount} registrations for event ${event._id}`);
        } catch (autoErr) {
          console.error('Background auto-approval error:', autoErr);
        }
      })();
    }
    
    return; // Response already sent
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Manual event completion endpoint (for prize-based events)
app.post('/api/events/:id/complete', async (req, res) => {
  try {
    const { userId, endSubEvents = true } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = String(event.organizerId) === String(userId);
    const isAdmin = user.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only organizers or admins can complete events' });
    }
    
    if (event.status === 'completed') {
      return res.status(400).json({ error: 'Event is already completed' });
    }
    
    if (event.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot complete a cancelled event' });
    }
    
    event.status = 'completed';
    event.completedAt = new Date();
    event.completedBy = userId;
    await event.save();
    
    // Get count of sub-events that will be ended
    let subEventsEnded = 0;
    if (endSubEvents) {
      const result = await SubEvent.updateMany(
        { parentEventId: req.params.id, status: { $ne: 'cancelled' } },
        { status: 'completed', completedAt: new Date() }
      );
      subEventsEnded = result.modifiedCount || 0;
    }
    
    const registrations = await Registration.find({ eventId: req.params.id }).populate('userId');
    for (const reg of registrations) {
      if (reg.userId && reg.userId._id) {
        await notifyUser(
          req,
          reg.userId._id,
          'event_updated',
          `The event '${event.title}' has been marked as completed.`,
          { eventId: event._id, eventTitle: event.title, eventImage: event.image }
        );
      }
    }
    
    console.log(`✅ Event manually completed: "${event.title}" by user ${user.name}${subEventsEnded > 0 ? ` (${subEventsEnded} sub-events also completed)` : ''}`);
    
    res.json({ success: true, event, subEventsEnded });
  } catch (err) {
    console.error('Error completing event:', err);
    res.status(500).json({ error: 'Failed to complete event' });
  }
});

// Spot Registration endpoints
app.post('/api/events/:id/spot-registrations', async (req, res) => {
  try {
    const { userId, participantName, identifier, notes } = req.body;
    
    if (!userId || !participantName) {
      return res.status(400).json({ error: 'User ID and participant name required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = String(event.organizerId) === String(userId);
    const isAdmin = user.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only organizers or admins can add spot registrations' });
    }
    
    if (event.status !== 'completed') {
      return res.status(400).json({ error: 'Spot registrations can only be added after event completion' });
    }
    
    const spotReg = new SpotRegistration({
      eventId: req.params.id,
      participantName: participantName.trim(),
      identifier: identifier?.trim() || '',
      notes: notes?.trim() || '',
      addedBy: userId
    });
    
    await spotReg.save();
    
    res.status(201).json({ success: true, spotRegistration: spotReg });
  } catch (err) {
    console.error('Error adding spot registration:', err);
    res.status(500).json({ error: 'Failed to add spot registration' });
  }
});

app.get('/api/events/:id/spot-registrations', async (req, res) => {
  try {
    const spotRegs = await SpotRegistration.find({ eventId: req.params.id })
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ spotRegistrations: spotRegs });
  } catch (err) {
    console.error('Error fetching spot registrations:', err);
    res.status(500).json({ error: 'Failed to fetch spot registrations' });
  }
});

app.delete('/api/events/:id/spot-registrations/:spotId', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = String(event.organizerId) === String(userId);
    const isAdmin = user.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only organizers or admins can delete spot registrations' });
    }
    
    await SpotRegistration.findByIdAndDelete(req.params.spotId);
    await Winner.deleteMany({ spotRegistrationId: req.params.spotId });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting spot registration:', err);
    res.status(500).json({ error: 'Failed to delete spot registration' });
  }
});

// Results endpoint (alias for winners - used by frontend EventContext)
app.post('/api/events/:id/results', async (req, res) => {
  try {
    const { results, userId } = req.body;
    
    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Results array required' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Verify authorization if userId provided
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        const isOrganizer = String(event.organizerId) === String(userId);
        const isAdmin = user.role === 'admin';
        if (!isOrganizer && !isAdmin) {
          return res.status(403).json({ error: 'Only organizers or admins can add results' });
        }
      }
    }
    
    // Mark event as completed if not already
    if (event.status !== 'completed') {
      event.status = 'completed';
      await event.save();
    }
    
    // Add each result as a winner
    const savedResults = [];
    for (const result of results) {
      const winner = new Winner({
        eventId: req.params.id,
        position: result.position || savedResults.length + 1,
        prize: result.prize || '',
        participantType: result.participantType || 'registered',
        participantUserId: result.participantUserId || result.userId,
        participantName: result.participantName || result.name,
        spotRegistrationId: result.spotRegistrationId,
        teamId: result.teamId,
        addedBy: userId || event.organizerId
      });
      await winner.save();
      savedResults.push(winner);
    }
    
    res.status(201).json({ 
      success: true, 
      results: savedResults,
      message: `Added ${savedResults.length} results for event` 
    });
  } catch (err) {
    console.error('Error adding results:', err);
    res.status(500).json({ error: 'Failed to add results' });
  }
});

// Winner endpoints
app.post('/api/events/:id/winners', async (req, res) => {
  try {
    const { userId, position, prize, participantType, participantUserId, spotRegistrationId, participantName } = req.body;
    
    if (!userId || !position || !participantType) {
      return res.status(400).json({ error: 'User ID, position, and participant type required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = String(event.organizerId) === String(userId);
    const isAdmin = user.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only organizers or admins can add winners' });
    }
    
    if (event.status !== 'completed') {
      return res.status(400).json({ error: 'Winners can only be added to completed events' });
    }
    
    if (participantType === 'registered') {
      if (!participantUserId) {
        return res.status(400).json({ error: 'Participant user ID required for registered participants' });
      }
      
      const registration = await Registration.findOne({
        eventId: req.params.id,
        userId: participantUserId,
        approvalStatus: 'approved'
      });
      
      if (!registration) {
        return res.status(400).json({ error: 'User is not an approved participant of this event' });
      }
    } else if (participantType === 'spot') {
      if (!spotRegistrationId) {
        return res.status(400).json({ error: 'Spot registration ID required for spot participants' });
      }
      
      const spotReg = await SpotRegistration.findOne({
        _id: spotRegistrationId,
        eventId: req.params.id
      });
      
      if (!spotReg) {
        return res.status(400).json({ error: 'Spot registration not found' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid participant type' });
    }
    
    const existingWinner = await Winner.findOne({ eventId: req.params.id, position });
    if (existingWinner) {
      return res.status(400).json({ error: `Position ${position} already has a winner` });
    }
    
    let finalParticipantName = participantName;
    if (participantType === 'registered' && participantUserId) {
      const participant = await User.findById(participantUserId);
      if (participant) {
        finalParticipantName = participant.name;
      }
    } else if (participantType === 'spot' && spotRegistrationId) {
      const spotReg = await SpotRegistration.findById(spotRegistrationId);
      if (spotReg) {
        finalParticipantName = spotReg.participantName;
      }
    }
    
    const winner = new Winner({
      eventId: req.params.id,
      position,
      prize: prize || (event.prizes && event.prizes[position - 1]) || '',
      participantType,
      userId: participantType === 'registered' ? participantUserId : undefined,
      spotRegistrationId: participantType === 'spot' ? spotRegistrationId : undefined,
      participantName: finalParticipantName,
      addedBy: userId
    });
    
    await winner.save();
    
    // Send notification to winner (only for registered participants who have a user account)
    if (participantType === 'registered' && participantUserId) {
      const positionLabel = position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;
      const prizeText = winner.prize ? ` Prize: ${winner.prize}` : '';
      
      await notifyUser(
        req,
        participantUserId,
        'winner_announcement',
        `🏆 Congratulations! You secured ${positionLabel} place in '${event.title}'!${prizeText}`,
        { 
          eventId: event._id, 
          eventTitle: event.title, 
          eventImage: event.image,
          position: position,
          prize: winner.prize
        },
        'urgent'
      );
    }
    
    res.status(201).json({ success: true, winner });
  } catch (err) {
    console.error('Error adding winner:', err);
    res.status(500).json({ error: 'Failed to add winner' });
  }
});

app.get('/api/events/:id/winners', async (req, res) => {
  try {
    const winners = await Winner.find({ eventId: req.params.id })
      .populate('userId', 'name email department year regId')
      .populate('spotRegistrationId', 'participantName identifier')
      .populate('addedBy', 'name')
      .sort({ position: 1 });
    
    res.json({ winners });
  } catch (err) {
    console.error('Error fetching winners:', err);
    res.status(500).json({ error: 'Failed to fetch winners' });
  }
});

app.delete('/api/events/:id/winners/:winnerId', async (req, res) => {
  try {
    const { userId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const isOrganizer = String(event.organizerId) === String(userId);
    const isAdmin = user.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Only organizers or admins can remove winners' });
    }
    
    await Winner.findByIdAndDelete(req.params.winnerId);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing winner:', err);
    res.status(500).json({ error: 'Failed to remove winner' });
  }
});

// Get eligible participants for winner selection (approved registrations + spot registrations)
app.get('/api/events/:id/eligible-winners', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    if (event.status !== 'completed') {
      return res.status(400).json({ error: 'Event must be completed before selecting winners' });
    }
    
    const registrations = await Registration.find({
      eventId: req.params.id,
      approvalStatus: 'approved'
    }).populate('userId', 'name email department year regId section');
    
    const spotRegs = await SpotRegistration.find({ eventId: req.params.id });
    
    const existingWinners = await Winner.find({ eventId: req.params.id });
    const winnerUserIds = existingWinners.filter(w => w.userId).map(w => String(w.userId));
    const winnerSpotIds = existingWinners.filter(w => w.spotRegistrationId).map(w => String(w.spotRegistrationId));
    
    const eligibleRegistered = registrations
      .filter(r => r.userId && !winnerUserIds.includes(String(r.userId._id)))
      .map(r => ({
        type: 'registered',
        id: r.userId._id,
        name: r.userId.name,
        email: r.userId.email,
        department: r.userId.department,
        year: r.userId.year,
        regId: r.userId.regId,
        section: r.userId.section
      }));
    
    const eligibleSpot = spotRegs
      .filter(s => !winnerSpotIds.includes(String(s._id)))
      .map(s => ({
        type: 'spot',
        id: s._id,
        name: s.participantName,
        identifier: s.identifier,
        notes: s.notes
      }));
    
    res.json({
      registered: eligibleRegistered,
      spot: eligibleSpot,
      existingWinners: existingWinners.length,
      prizes: event.prizes || []
    });
  } catch (err) {
    console.error('Error fetching eligible winners:', err);
    res.status(500).json({ error: 'Failed to fetch eligible winners' });
  }
});


// Bulk delete events
app.delete('/api/events', async (req, res) => {
  try {
    const { eventIds } = req.body;
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'No event IDs provided.' });
    }
    const result = await Event.deleteMany({ _id: { $in: eventIds } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Find all registrations for this event to notify users
    const registrations = await Registration.find({ eventId: req.params.id }).populate('userId');
    
    // --- NOTIFICATION ---
    // Notify all registered users that the event is cancelled/deleted
    for (const reg of registrations) {
      if (reg.userId && reg.userId._id) {
        await notifyUser(
          req,
          reg.userId._id,
          'event_deleted',
          `The event '${event.title}' has been cancelled.`,
          { eventId: event._id, eventTitle: event.title, eventImage: event.image }
        );
      }
    }

    // CASCADE DELETE: Delete all sub-events and their related data
    const subEvents = await SubEvent.find({ parentEventId: req.params.id });
    const subEventIds = subEvents.map(se => se._id);
    
    if (subEventIds.length > 0) {
      // Delete all sub-event registrations
      await SubEventRegistration.deleteMany({ subEventId: { $in: subEventIds } });
      // Delete all sub-event waitlist entries
      await SubEventWaitlist.deleteMany({ subEventId: { $in: subEventIds } });
      // Delete all sub-events
      await SubEvent.deleteMany({ parentEventId: req.params.id });
      console.log(`🗑️ Cascade deleted ${subEventIds.length} sub-events and their data for event: ${event.title}`);
    }

    // Delete the event and all associated registrations
    await Event.findByIdAndDelete(req.params.id);
    await Registration.deleteMany({ eventId: req.params.id });

    // Auto-delete gallery and media for event
    try {
      await galleryController.deleteGalleryForEvent(req.params.id);
    } catch (galleryError) {
      console.error('Error deleting gallery for event:', galleryError);
      // Don't fail event deletion if gallery fails
    }

    // Invalidate caches after deletion
    invalidateCache.onEventChange(serverCache, req.params.id);
    invalidateCache.onGalleryChange(serverCache, req.params.id);
    invalidateCache.onRegistrationChange(serverCache, req.params.id);

    res.json({ 
      message: 'Event and associated registrations deleted',
      subEventsDeleted: subEventIds.length 
    });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Delete multiple events
app.delete('/api/events', async (req, res) => {
  try {
    const { eventIds } = req.body;
    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({ error: 'No event IDs provided.' });
    }

    // For each event, find registrations and notify users
    for (const eventId of eventIds) {
      const event = await Event.findById(eventId);
      if (event) {
        const registrations = await Registration.find({ eventId: eventId }).populate('userId');
        // Notify registered users
        for (const reg of registrations) {
          if (reg.userId && reg.userId._id) {
            await notifyUser(
              req,
              reg.userId._id,
              'event_deleted',
              `The event '${event.title}' has been cancelled.`,
              { eventId: event._id, eventTitle: event.title, eventImage: event.image }
            );
          }
        }
      }
    }

    // Perform bulk deletion
    await Event.deleteMany({ _id: { $in: eventIds } });

    // Auto-delete galleries for all deleted events
    for (const eventId of eventIds) {
      try {
        await galleryController.deleteGalleryForEvent(eventId);
      } catch (galleryError) {
        console.error(`Error deleting gallery for event ${eventId}:`, galleryError);
      }
    }

    res.json({ success: true, message: 'Events deleted successfully.' });
  } catch (err) {
    console.error('Error deleting events:', err);
    res.status(500).json({ error: 'Failed to delete events' });
  }
});

// --- CRON JOBS FOR REMINDER NOTIFICATIONS ---

// Auto-complete events that have passed their end time (runs every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    
    const eventsToComplete = await Event.find({
      status: { $in: ['upcoming', 'ongoing'] },
      completedAt: { $exists: false },
      $or: [
        { prizes: { $exists: false } },
        { prizes: { $size: 0 } }
      ]
    });
    
    let completedCount = 0;
    
    for (const event of eventsToComplete) {
      const eventDate = new Date(event.date);
      let eventEndDateTime = eventDate;
      
      if (event.endTime) {
        const [endHour, endMin] = event.endTime.split(':').map(Number);
        eventEndDateTime = new Date(eventDate);
        eventEndDateTime.setHours(endHour || 23, endMin || 59, 59, 999);
      } else if (event.time) {
        const [startHour, startMin] = event.time.split(':').map(Number);
        eventEndDateTime = new Date(eventDate);
        eventEndDateTime.setHours((startHour || 0) + 3, startMin || 0, 0, 0);
      } else {
        eventEndDateTime.setHours(23, 59, 59, 999);
      }
      
      if (now > eventEndDateTime) {
        event.status = 'completed';
        event.completedAt = now;
        await event.save();
        
        await SubEvent.updateMany(
          { parentEventId: event._id, status: { $ne: 'cancelled' } },
          { status: 'completed' }
        );
        
        completedCount++;
        console.log(`✅ Auto-completed event: "${event.title}"`);
      }
    }
    
    if (completedCount > 0) {
      console.log(`📅 Auto-completion: Marked ${completedCount} event(s) as completed.`);
    }
  } catch (error) {
    console.error('Error in event auto-completion cron:', error);
  }
});

// Update ongoing status for events that have started (runs every 5 minutes)
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    
    const eventsToMarkOngoing = await Event.find({
      status: 'upcoming',
      date: { $lte: now }
    });
    
    for (const event of eventsToMarkOngoing) {
      const eventDate = new Date(event.date);
      let eventEndDateTime = eventDate;
      
      if (event.endTime) {
        const [endHour, endMin] = event.endTime.split(':').map(Number);
        eventEndDateTime = new Date(eventDate);
        eventEndDateTime.setHours(endHour || 23, endMin || 59, 59, 999);
      } else if (event.time) {
        const [startHour, startMin] = event.time.split(':').map(Number);
        eventEndDateTime = new Date(eventDate);
        eventEndDateTime.setHours((startHour || 0) + 3, startMin || 0, 0, 0);
      } else {
        eventEndDateTime.setHours(23, 59, 59, 999);
      }
      
      if (now <= eventEndDateTime) {
        event.status = 'ongoing';
        await event.save();
        console.log(`🔄 Marked event as ongoing: "${event.title}"`);
      }
    }
  } catch (error) {
    console.error('Error in ongoing status update cron:', error);
  }
});

// Check every hour for events that need reminders
cron.schedule('0 * * * *', async () => {
  console.log('Running reminder notification check...');
  
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    
    // Find events starting in 24 hours
    const events24h = await Event.find({
      date: { $gte: in24Hours, $lt: in25Hours }
    });
    
    for (const event of events24h) {
      const registrations = await Registration.find({ eventId: event._id });
      
      for (const reg of registrations) {
        // Check if we already sent this reminder
        const existingNotif = await Notification.findOne({
          user: reg.userId,
          type: 'reminder_24h',
          'data.eventId': event._id,
          createdAt: { $gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } // Within last 2 hours
        });
        
        if (!existingNotif) {
          await notifyUser(
            { app: { get: () => io } },
            reg.userId,
            'reminder_24h',
            `🔔 Reminder: '${event.title}' starts tomorrow! Don't forget to attend.`,
            buildNotificationData(event),
            'urgent'
          );
        }
      }
    }
    
    // Find events starting in 1 hour
    const events1h = await Event.find({
      date: { $gte: in1Hour, $lt: in2Hours }
    });
    
    for (const event of events1h) {
      const registrations = await Registration.find({ eventId: event._id });
      
      for (const reg of registrations) {
        // Check if we already sent this reminder
        const existingNotif = await Notification.findOne({
          user: reg.userId,
          type: 'reminder_1h',
          'data.eventId': event._id,
          createdAt: { $gte: new Date(now.getTime() - 30 * 60 * 1000) } // Within last 30 minutes
        });
        
        if (!existingNotif) {
          await notifyUser(
            { app: { get: () => io } },
            reg.userId,
            'reminder_1h',
            `⏰ '${event.title}' starts in 1 hour! Get ready and head to the venue.`,
            buildNotificationData(event),
            'urgent'
          );
        }
      }
    }
    
    console.log(`Reminder check complete. Sent reminders for ${events24h.length} (24h) and ${events1h.length} (1h) events.`);
  } catch (error) {
    console.error('Error in reminder cron job:', error);
  }
});

// Check for trending events (events with high registration rate)
cron.schedule('0 0 * * *', async () => {
  console.log('Checking for trending events...');
  
  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find events with high registration in last 24 hours
    const recentRegistrations = await Registration.aggregate([
      { $match: { registeredAt: { $gte: yesterday } } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
      { $match: { count: { $gte: 10 } } }, // 10+ registrations in 24h
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    for (const reg of recentRegistrations) {
      const event = await Event.findById(reg._id);
      if (event) {
        // Notify all users about trending event
        const allUsers = await User.find({ role: 'student' }).limit(100);
        
        for (const user of allUsers) {
          // Check if already registered
          const isRegistered = await Registration.findOne({ userId: user._id, eventId: event._id });
          if (!isRegistered) {
            await notifyUser(
              { app: { get: () => io } },
              user._id,
              'trending_event',
              `🔥 Trending: '${event.title}' is getting popular! ${reg.count} people registered in the last 24 hours.`,
              { eventId: event._id, eventTitle: event.title, eventImage: event.image }
            );
          }
        }
      }
    }
    
    console.log(`Trending event check complete. Found ${recentRegistrations.length} trending events.`);
  } catch (error) {
    console.error('Error in trending events cron job:', error);
  }
});

// ================================
// AUTOMATED MONITORING & MAINTENANCE CRON JOBS
// ================================

// Health check monitoring (runs every minute)
cron.schedule('* * * * *', async () => {
  try {
    const health = await performHealthCheck();
    
    // Send alerts if issues detected
    if (health.alerts && health.alerts.length > 0) {
      await sendHealthAlert(health);
    }
    
    // Log status periodically (every 5 minutes)
    const minute = new Date().getMinutes();
    if (minute % 5 === 0) {
      console.log(`🏥 Health: ${health.status} | CPU: ${health.system.cpu}% | Memory: ${health.system.memory.usagePercent}% | DB: ${health.database.responseTime}ms`);
    }
  } catch (error) {
    console.error('Error in health monitoring cron:', error);
  }
});

// Index maintenance (runs daily at 3 AM - low traffic time)
cron.schedule('0 3 * * *', async () => {
  console.log('\n🔧 Running scheduled index maintenance...');
  
  try {
    const result = await runFullMaintenance();
    
    if (result.errors && result.errors.length > 0) {
      await sendAlert({
        type: 'index_maintenance',
        severity: 'warning',
        message: `Index maintenance completed with ${result.errors.length} error(s)`,
        details: result,
        suggestedAction: 'Review maintenance logs and fix any reported issues.',
      });
    } else {
      console.log(`✅ Index maintenance completed successfully in ${result.duration}ms`);
    }
  } catch (error) {
    console.error('Error in index maintenance cron:', error);
    await sendAlert({
      type: 'index_maintenance_failed',
      severity: 'critical',
      message: 'Scheduled index maintenance failed',
      details: { error: error.message },
      suggestedAction: 'Check database connectivity and review error logs.',
    });
  }
});

// Database stats logging (runs every 6 hours)
cron.schedule('0 */6 * * *', async () => {
  try {
    const stats = await getDatabaseStats();
    if (stats) {
      console.log(`📊 Database Stats: ${stats.collections} collections | ${stats.objects} documents | ${stats.totalSize} MB total`);
      
      // Alert if database size is growing significantly (over 500MB)
      if (stats.totalSize > 500) {
        await sendAlert({
          type: 'database_size',
          severity: 'warning',
          message: `Database size is ${stats.totalSize} MB`,
          details: stats,
          suggestedAction: 'Consider archiving old data or cleaning up unused collections.',
        });
      }
    }
  } catch (error) {
    console.error('Error in database stats cron:', error);
  }
});

// Memory leak detection (runs every 30 minutes)
let previousHeapUsed = 0;
let heapGrowthCount = 0;

cron.schedule('*/30 * * * *', async () => {
  try {
    const memory = getMemoryUsage();
    const currentHeap = memory.process.heapUsed;
    
    // Check for consistent heap growth (potential memory leak)
    if (previousHeapUsed > 0 && currentHeap > previousHeapUsed * 1.2) {
      heapGrowthCount++;
      
      if (heapGrowthCount >= 3) {
        await sendAlert({
          type: 'memory_leak_suspected',
          severity: 'warning',
          message: `Potential memory leak detected: heap grew from ${previousHeapUsed}MB to ${currentHeap}MB over 90 minutes`,
          details: memory,
          suggestedAction: 'Consider restarting the server and investigating for memory leaks.',
        });
        heapGrowthCount = 0;
      }
    } else {
      heapGrowthCount = 0;
    }
    
    previousHeapUsed = currentHeap;
  } catch (error) {
    console.error('Error in memory monitoring cron:', error);
  }
});

// Cleanup old notifications (runs daily at 4 AM)
cron.schedule('0 4 * * *', async () => {
  try {
    // TTL index should handle this, but we'll also clean up manually for safety
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({ createdAt: { $lt: thirtyDaysAgo }, read: true });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} old read notifications`);
    }
    
    // Also clean up old sessions
    const sessionsDb = mongoose.connection.db.collection('sessions');
    const expiredSessions = await sessionsDb.deleteMany({
      expires: { $lt: new Date() }
    });
    
    if (expiredSessions.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.deletedCount} expired sessions`);
    }
  } catch (error) {
    console.error('Error in cleanup cron:', error);
  }
});

console.log('⏰ Automated monitoring and maintenance jobs initialized');

// Event Analytics Endpoints
// Analytics endpoints
app.post('/api/analytics/events', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build query based on user role
    let eventQuery = {};
    if (user.role !== 'admin') {
      // For organizers, only show their events
      eventQuery = { organizerId: userId };
    }
    
    // Get all events (filtered by role)
    const events = await Event.find(eventQuery);
    const totalEvents = events.length;
    const upcomingEvents = events.filter(e => e.status === 'upcoming').length;
    const completedEvents = events.filter(e => e.status === 'completed').length;
    const cancelledEvents = events.filter(e => e.status === 'cancelled').length;
    
    // Get all registrations for these events
    const eventIds = events.map(e => e._id);
    const registrations = await Registration.find({ eventId: { $in: eventIds } })
      .populate('userId', 'name')
      .populate('eventId', 'title image maxParticipants date status');
    
    const totalRegistrations = registrations.length;
    const totalParticipants = registrations.filter(r => r.status === 'attended').length;
    const averageRegistrationsPerEvent = totalEvents > 0 ? totalRegistrations / totalEvents : 0;
    
    // Category breakdown
    const categoryCount = {};
    events.forEach(event => {
      const cat = event.category || 'Other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    
    // Top events by registration count
    const eventRegistrationCount = {};
    registrations.forEach(reg => {
      const eventId = reg.eventId._id.toString();
      eventRegistrationCount[eventId] = (eventRegistrationCount[eventId] || 0) + 1;
    });
    
    const topEvents = events
      .map(event => ({
        _id: event._id,
        title: event.title,
        image: event.image,
        registrations: eventRegistrationCount[event._id.toString()] || 0,
        capacity: event.maxParticipants,
        date: event.date,
        status: event.status
      }))
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 10);
    
    // Recent registrations
    const recentRegistrations = registrations
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
      .slice(0, 20)
      .map(reg => ({
        eventTitle: reg.eventId?.title || 'Unknown Event',
        userName: reg.userId?.name || 'Unknown User',
        registeredAt: reg.registeredAt,
        fromWaitlist: reg.fromWaitlist || false
      }));
    
    res.json({
      totalEvents,
      upcomingEvents,
      completedEvents,
      cancelledEvents,
      totalRegistrations,
      totalParticipants,
      averageRegistrationsPerEvent,
      categoryBreakdown,
      topEvents,
      recentRegistrations
    });
  } catch (error) {
    console.error('Error fetching event analytics:', error);
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

// Single event analytics
app.post('/api/analytics/events/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Check authorization
    if (user.role !== 'admin' && event.organizerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get registrations for this event
    const registrations = await Registration.find({ eventId })
      .populate('userId', 'name')
      .populate('eventId', 'title image maxParticipants date status');
    
    const totalRegistrations = registrations.length;
    const totalParticipants = registrations.filter(r => r.status === 'attended').length;
    
    // Recent registrations
    const recentRegistrations = registrations
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
      .slice(0, 20)
      .map(reg => ({
        eventTitle: event.title,
        userName: reg.userId?.name || 'Unknown User',
        registeredAt: reg.registeredAt,
        fromWaitlist: reg.fromWaitlist || false
      }));
    
    res.json({
      totalEvents: 1,
      upcomingEvents: event.status === 'upcoming' ? 1 : 0,
      completedEvents: event.status === 'completed' ? 1 : 0,
      cancelledEvents: event.status === 'cancelled' ? 1 : 0,
      totalRegistrations,
      totalParticipants,
      averageRegistrationsPerEvent: totalRegistrations,
      categoryBreakdown: [{ category: event.category, count: 1 }],
      topEvents: [{
        _id: event._id,
        title: event.title,
        image: event.image,
        registrations: totalRegistrations,
        capacity: event.maxParticipants,
        date: event.date,
        status: event.status
      }],
      recentRegistrations
    });
  } catch (error) {
    console.error('Error fetching single event analytics:', error);
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

// Broadcast announcement to all users
app.post('/api/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, userId, priority } = req.body;
    
    // Verify the sender is admin or organizer
    const sender = await User.findById(userId);
    if (!sender || (sender.role !== 'admin' && sender.role !== 'organizer')) {
      return res.status(403).json({ error: 'Unauthorized. Only admins and organizers can send announcements.' });
    }

    // Get all users
    const allUsers = await User.find({});
    let emailsSent = 0;
    
    // Create notifications for all users
    const notifications = await Promise.all(
      allUsers.map(async (user) => {
        try {
          // Check user notification preferences
          const prefs = await NotificationPreferences.findOne({ userId: user._id });
          
          // Check if user has disabled announcements
          if (prefs && prefs.preferences && prefs.preferences.announcements === false) {
            console.log(`User ${user._id} has disabled announcements, skipping`);
            return null;
          }
          
          const notification = new Notification({
            user: user._id, // Use 'user' field to match schema
            type: 'announcement',
            title: title,
            message: message,
            data: {
              sender: {
                id: sender._id,
                name: sender.name,
                role: sender.role
              },
              priority: priority || 'normal',
              timestamp: new Date()
            },
            read: false
          });
          
          await notification.save();
          
          // Emit socket event to user if connected
          io.to(`user_${user._id}`).emit('notification', {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            read: notification.read,
            createdAt: notification.createdAt
          });
          
          // Send email notification if enabled
          const shouldSendEmail = !prefs || prefs.emailNotifications !== false;
          if (shouldSendEmail && user.email) {
            try {
              await sendNotificationEmail(user.email, user.name, {
                type: 'announcement',
                message: message,
                title: title,
                data: {
                  sender: { name: sender.name, role: sender.role }
                },
                priority: priority || 'normal'
              });
              emailsSent++;
              console.log(`📧 Announcement email sent to ${user.email}`);
            } catch (emailError) {
              console.error(`Failed to send announcement email to ${user.email}:`, emailError.message);
            }
          }
          
          return notification;
        } catch (error) {
          console.error(`Failed to create notification for user ${user._id}:`, error);
          return null;
        }
      })
    );

    const successfulNotifications = notifications.filter(n => n !== null);

    res.status(200).json({ 
      success: true, 
      message: `Announcement sent to ${successfulNotifications.length} users`,
      count: successfulNotifications.length,
      emailsSent
    });
  } catch (error) {
    console.error('Error broadcasting announcement:', error);
    res.status(500).json({ error: 'Could not send announcement' });
  }
});

// Targeted broadcast announcement to specific users only
app.post('/api/notifications/broadcast/targeted', async (req, res) => {
  try {
    const { title, message, userId, priority, targetUserIds } = req.body;
    
    // Verify the sender is admin or organizer
    const sender = await User.findById(userId);
    if (!sender || (sender.role !== 'admin' && sender.role !== 'organizer')) {
      return res.status(403).json({ error: 'Unauthorized. Only admins and organizers can send announcements.' });
    }

    // Validate target users
    if (!targetUserIds || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return res.status(400).json({ error: 'Please select at least one user to send the announcement.' });
    }

    // Get only the selected users
    const targetUsers = await User.find({ _id: { $in: targetUserIds } });
    
    if (targetUsers.length === 0) {
      return res.status(404).json({ error: 'No valid users found from selection.' });
    }

    let emailsSent = 0;
    
    // Create notifications for selected users
    const notifications = await Promise.all(
      targetUsers.map(async (user) => {
        try {
          // Check user notification preferences
          const prefs = await NotificationPreferences.findOne({ userId: user._id });
          
          // Check if user has disabled announcements
          if (prefs && prefs.preferences && prefs.preferences.announcements === false) {
            console.log(`User ${user._id} has disabled announcements, skipping`);
            return null;
          }
          
          const notification = new Notification({
            user: user._id,
            type: 'announcement',
            title: title,
            message: message,
            data: {
              sender: {
                id: sender._id,
                name: sender.name,
                role: sender.role
              },
              priority: priority || 'normal',
              timestamp: new Date(),
              isTargeted: true
            },
            read: false
          });
          
          await notification.save();
          
          // Emit socket event to user if connected
          io.to(`user_${user._id}`).emit('notification', {
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            read: notification.read,
            createdAt: notification.createdAt
          });
          
          // Send email notification if enabled
          const shouldSendEmail = !prefs || prefs.emailNotifications !== false;
          if (shouldSendEmail && user.email) {
            try {
              await sendNotificationEmail(user.email, user.name, {
                type: 'announcement',
                message: message,
                title: title,
                data: {
                  sender: { name: sender.name, role: sender.role }
                },
                priority: priority || 'normal'
              });
              emailsSent++;
              console.log(`📧 Targeted announcement email sent to ${user.email}`);
            } catch (emailError) {
              console.error(`Failed to send announcement email to ${user.email}:`, emailError.message);
            }
          }
          
          return notification;
        } catch (error) {
          console.error(`Failed to create notification for user ${user._id}:`, error);
          return null;
        }
      })
    );

    const successfulNotifications = notifications.filter(n => n !== null);

    console.log(`📢 Targeted announcement sent to ${successfulNotifications.length}/${targetUserIds.length} users, ${emailsSent} emails`);

    res.status(200).json({ 
      success: true, 
      message: `Announcement sent to ${successfulNotifications.length} selected users`,
      count: successfulNotifications.length,
      emailsSent,
      totalTargeted: targetUserIds.length
    });
  } catch (error) {
    console.error('Error sending targeted announcement:', error);
    res.status(500).json({ error: 'Could not send targeted announcement' });
  }
});

// ================================
// SUB-EVENTS API ENDPOINTS
// ================================

// Get all sub-events for a parent event
app.get('/api/events/:eventId/sub-events', async (req, res) => {
  try {
    const { eventId } = req.params;
    const subEvents = await SubEvent.find({ parentEventId: eventId })
      .populate('organizerId', 'name email role')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ subEvents });
  } catch (error) {
    console.error('Error fetching sub-events:', error);
    res.status(500).json({ error: 'Failed to fetch sub-events' });
  }
});

// Get single sub-event by ID
app.get('/api/sub-events/:subEventId', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const subEvent = await SubEvent.findById(subEventId)
      .populate('organizerId', 'name email role avatar')
      .populate('parentEventId', 'title category');
    
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Get registration count for this sub-event
    const registrationCount = await SubEventRegistration.countDocuments({ subEventId });
    
    // Add registeredCount to the response
    const subEventWithCount = {
      ...subEvent.toObject(),
      registeredCount: registrationCount
    };
    
    res.status(200).json({ subEvent: subEventWithCount });
  } catch (error) {
    console.error('Error fetching sub-event:', error);
    res.status(500).json({ error: 'Failed to fetch sub-event' });
  }
});

// Create a new sub-event
app.post('/api/events/:eventId/sub-events', async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      title,
      description,
      date,
      time,
      venue,
      organizerId,
      image,
      requirements,
      prizes,
      registrationDeadline,
      accessControl,
      isTeamEvent,
      minTeamSize,
      maxTeamSize
    } = req.body;

    // Verify parent event exists
    const parentEvent = await Event.findById(eventId);
    if (!parentEvent) {
      return res.status(404).json({ error: 'Parent event not found' });
    }

    // Inherit maxParticipants from parent event
    const maxParticipants = parentEvent.maxParticipants;

    // Create sub-event
    const subEvent = new SubEvent({
      parentEventId: eventId,
      title,
      description,
      date,
      time,
      venue,
      maxParticipants, // Inherited from parent
      organizerId,
      image,
      requirements: requirements || [],
      prizes: prizes || [],
      registrationDeadline,
      accessControl: accessControl || {
        type: 'everyone',
        allowedDepartments: [],
        allowedYears: [],
        allowedRoles: []
      },
      status: 'upcoming',
      currentParticipants: 0,
      // Team event settings
      isTeamEvent: isTeamEvent === 'true' || isTeamEvent === true,
      minTeamSize: parseInt(minTeamSize) || 2,
      maxTeamSize: parseInt(maxTeamSize) || 4
    });

    await subEvent.save();

    // Create gallery for the sub-event
    try {
      await galleryController.createGalleryForEvent(eventId, subEvent._id);
      console.log(`📸 Gallery created for sub-event: ${title}`);
    } catch (galleryError) {
      console.error('Warning: Failed to create gallery for sub-event:', galleryError);
      // Don't fail the request, gallery can be created later
    }

    // --- NOTIFICATION ---
    // Notify parent event organizer about new sub-event
    if (parentEvent.organizerId && parentEvent.organizerId.toString() !== organizerId) {
      await notifyUser(
        req,
        parentEvent.organizerId,
        'sub_event_created',
        `New sub-event '${title}' has been created for your event '${parentEvent.title}'`,
        { 
          eventId: parentEvent._id, 
          eventTitle: parentEvent.title, 
          eventImage: parentEvent.image,
          subEventId: subEvent._id,
          subEventTitle: title
        },
        'high'
      );
    }

    res.status(201).json({ 
      message: 'Sub-event created successfully', 
      subEvent 
    });
  } catch (error) {
    console.error('Error creating sub-event:', error);
    res.status(500).json({ error: 'Failed to create sub-event' });
  }
});

// Update sub-event
app.put('/api/sub-events/:subEventId', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const updateData = req.body;
    
    updateData.updatedAt = new Date();
    
    const subEvent = await SubEvent.findByIdAndUpdate(
      subEventId,
      updateData,
      { new: true, runValidators: true }
    ).populate('organizerId', 'name email role');

    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    // --- NOTIFICATION ---
    // Notify parent event organizer about sub-event update
    const parentEvent = await Event.findById(subEvent.parentEventId);
    if (parentEvent && parentEvent.organizerId && parentEvent.organizerId.toString() !== subEvent.organizerId._id.toString()) {
      await notifyUser(
        req,
        parentEvent.organizerId,
        'sub_event_updated',
        `Sub-event '${subEvent.title}' has been updated for your event '${parentEvent.title}'`,
        { 
          eventId: parentEvent._id, 
          eventTitle: parentEvent.title, 
          eventImage: parentEvent.image,
          subEventId: subEvent._id,
          subEventTitle: subEvent.title
        },
        'medium'
      );
    }

    res.status(200).json({ 
      message: 'Sub-event updated successfully', 
      subEvent 
    });
  } catch (error) {
    console.error('Error updating sub-event:', error);
    res.status(500).json({ error: 'Failed to update sub-event' });
  }
});

// Delete sub-event
app.delete('/api/sub-events/:subEventId', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    // Get sub-event details before deleting
    const subEvent = await SubEvent.findById(subEventId);
    
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    // Get parent event for notification
    const parentEvent = await Event.findById(subEvent.parentEventId);
    
    // Delete all registrations for this sub-event
    await SubEventRegistration.deleteMany({ subEventId });
    
    // Delete all comments for this sub-event
    await SubEventComment.deleteMany({ subEventId });
    
    // Delete the sub-event
    await SubEvent.findByIdAndDelete(subEventId);

    // --- NOTIFICATION ---
    // Notify parent event organizer about sub-event deletion
    if (parentEvent && parentEvent.organizerId && parentEvent.organizerId.toString() !== subEvent.organizerId.toString()) {
      await notifyUser(
        req,
        parentEvent.organizerId,
        'sub_event_deleted',
        `Sub-event '${subEvent.title}' has been deleted from your event '${parentEvent.title}'`,
        { 
          eventId: parentEvent._id, 
          eventTitle: parentEvent.title, 
          eventImage: parentEvent.image,
          subEventTitle: subEvent.title
        },
        'high'
      );
    }

    res.status(200).json({ message: 'Sub-event deleted successfully' });
  } catch (error) {
    console.error('Error deleting sub-event:', error);
    res.status(500).json({ error: 'Failed to delete sub-event' });
  }
});

// Check if user can access sub-event
app.get('/api/sub-events/:subEventId/access-check/:userId', async (req, res) => {
  try {
    const { subEventId, userId } = req.params;
    
    const subEvent = await SubEvent.findById(subEventId);
    const user = await User.findById(userId);
    
    if (!subEvent || !user) {
      return res.status(404).json({ error: 'Sub-event or user not found', hasAccess: false });
    }
    
    const { accessControl } = subEvent;
    let hasAccess = true;
    let denialReason = '';
    
    if (accessControl.type === 'students_only' && user.role !== 'student') {
      hasAccess = false;
      denialReason = 'This sub-event is only for students';
    } else if (accessControl.type === 'faculty_only' && user.role !== 'faculty') {
      hasAccess = false;
      denialReason = 'This sub-event is only for faculty';
    } else if (accessControl.type === 'custom') {
      if (accessControl.allowedRoles?.length > 0 && !accessControl.allowedRoles.includes(user.role)) {
        hasAccess = false;
        denialReason = `Only for: ${accessControl.allowedRoles.join(', ')}`;
      }
      if (hasAccess && accessControl.allowedDepartments?.length > 0 && !accessControl.allowedDepartments.includes(user.department)) {
        hasAccess = false;
        denialReason = `Only for departments: ${accessControl.allowedDepartments.join(', ')}`;
      }
      if (hasAccess && user.role === 'student' && accessControl.allowedYears?.length > 0 && !accessControl.allowedYears.includes(user.year)) {
        hasAccess = false;
        denialReason = `Only for years: ${accessControl.allowedYears.join(', ')}`;
      }
    }
    
    res.status(200).json({ hasAccess, denialReason, accessControl });
  } catch (error) {
    console.error('Error checking access:', error);
    res.status(500).json({ error: 'Failed to check access', hasAccess: false });
  }
});

// Register for sub-event
app.post('/api/sub-events/:subEventId/register', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    // OPTIMIZATION: Fetch all initial data in parallel
    const [subEvent, user, existingSubReg, existingWaitlist] = await Promise.all([
      SubEvent.findById(subEventId),
      User.findById(userId),
      SubEventRegistration.findOne({ userId, subEventId }),
      SubEventWaitlist.findOne({ userId, subEventId, status: 'waiting' })
    ]);
    
    if (!subEvent || !user) {
      return res.status(404).json({ error: 'Sub-event or user not found' });
    }
    
    // Get parent event
    const parentEvent = await Event.findById(subEvent.parentEventId);
    if (!parentEvent) {
      return res.status(404).json({ error: 'Parent event not found' });
    }
    
    // Check access
    const { accessControl } = subEvent;
    let hasAccess = true;
    
    if (accessControl.type === 'students_only' && user.role !== 'student') hasAccess = false;
    else if (accessControl.type === 'faculty_only' && user.role !== 'faculty') hasAccess = false;
    else if (accessControl.type === 'custom') {
      if (accessControl.allowedRoles?.length > 0 && !accessControl.allowedRoles.includes(user.role)) hasAccess = false;
      if (accessControl.allowedDepartments?.length > 0 && !accessControl.allowedDepartments.includes(user.department)) hasAccess = false;
      if (user.role === 'student' && accessControl.allowedYears?.length > 0 && !accessControl.allowedYears.includes(user.year)) hasAccess = false;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this sub-event' });
    }
    
    // Check if already registered for sub-event
    if (existingSubReg) {
      return res.status(400).json({ error: 'Already registered for this sub-event' });
    }
    
    // Check if already on waitlist
    if (existingWaitlist) {
      return res.status(400).json({ error: 'Already on waitlist for this sub-event' });
    }
    
    // Get current sub-event registration count
    const currentSubEventCount = await SubEventRegistration.countDocuments({ subEventId });
    
    // Check if sub-event is full (using parent event's capacity)
    const isSubEventFull = subEvent.capacity && currentSubEventCount >= subEvent.capacity;
    
    // If sub-event is full, add to waitlist
    if (isSubEventFull) {
      const waitlistPosition = await SubEventWaitlist.countDocuments({ subEventId, status: 'waiting' }) + 1;
      
      const waitlistEntry = new SubEventWaitlist({
        userId,
        subEventId,
        parentEventId: subEvent.parentEventId,
        position: waitlistPosition,
        status: 'waiting'
      });
      
      await waitlistEntry.save();
      
      // FAST RESPONSE: Return immediately
      res.status(200).json({ 
        message: 'Added to waitlist',
        waitlist: true,
        position: waitlistPosition,
        waitlistEntry
      });
      
      // Background: Notify user about waitlist (non-blocking)
      notifyUser(
        req,
        user._id,
        'waitlist',
        `You've been added to the waitlist (position ${waitlistPosition}) for '${subEvent.title}'.`,
        { eventId: subEvent.parentEventId, eventTitle: subEvent.title }
      ).catch(err => console.error('Waitlist notification error:', err.message));
      
      return;
    }
    
    // Check capacity using parent event's maxParticipants (inherited)
    if (parentEvent.currentParticipants >= parentEvent.maxParticipants) {
      return res.status(400).json({ error: 'Event capacity is full (inherited from parent event)' });
    }
    
    // Check if user is already registered for parent event
    let parentRegistration = await Registration.findOne({ userId, eventId: subEvent.parentEventId });
    
    // If not registered for parent event, create parent registration
    if (!parentRegistration) {
      // Check parent event capacity
      if (parentEvent.currentParticipants >= parentEvent.maxParticipants) {
        return res.status(400).json({ error: 'Parent event is at full capacity' });
      }
      
      // Check parent event registration deadline
      if (new Date() > new Date(parentEvent.registrationDeadline)) {
        return res.status(400).json({ error: 'Parent event registration deadline has passed' });
      }
      
      // Create parent registration
      const parentRegistrationId = generateUniqueRegistrationId();
      const issuedAt = new Date().toISOString();
      
      // Build payload and plain-text QR content (include optional team/seating/ticketType)
      const qrPayload = {
        registrationId: parentRegistrationId,
        userId,
        eventIds: [subEvent.parentEventId],
        subEventIds: [subEventId],
        timestamp: Date.now(),
        name: user.name,
        email: user.email,
        college: user.college,
        department: user.department,
        section: user.section || 'A',
        year: user.year,
        regId: user.regId || parentRegistrationId.substring(0, 8).toUpperCase(),
        registeredAt: issuedAt,
        event_title: parentEvent.title,
        sub_event_title: subEvent.title,
        student_name: user.name,
        event_venue: parentEvent.venue,
        event_date: new Date(parentEvent.date).toLocaleDateString(),
        event_time: parentEvent.time,
        team: req.body.team || null,
        seating: req.body.seating || null,
        ticketType: req.body.ticketType || null,
        events: [{ title: parentEvent.title, venue: parentEvent.venue, date: new Date(parentEvent.date).toLocaleDateString(), time: parentEvent.time, subEvents: parentEvent.subEvents || [], team: req.body.team || null, seating: req.body.seating || null, ticketType: req.body.ticketType || null }]
      };

      const qrContent = generateQRTextContent(qrPayload);
      
      // Generate signature
      const signature = generateQRSignature({
        registration_id: parentRegistrationId,
        student_id: userId,
        event_id: subEvent.parentEventId,
        issued_at: issuedAt
      });
      
      // Generate QR code
      const qrCodeUrl = await generateQRCodeWithEventName(
        qrContent,
        parentEvent.title,
        {
          size: 400,
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          maxChars: 40,
          position: 'below',
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
          qrColor: '#000000'
        }
      );

      parentRegistration = new Registration({
        registrationId: parentRegistrationId,
        userId,
        eventId: subEvent.parentEventId,
        status: 'registered',
        approvalStatus: 'approved',
        approvalType: 'autoApproved',
        approvedAt: new Date(),
        qrCode: qrCodeUrl,
        qrPayload: { ...qrPayload, signature },
        registeredAt: new Date()
      });

      await parentRegistration.save();

      // Update parent event participant count
      parentEvent.currentParticipants += 1;
      await parentEvent.save();
      
      // Background: Notify user about parent event registration (non-blocking)
      notifyUser(
        req,
        user._id,
        'registered',
        `You have been registered for the main event: '${parentEvent.title}' through sub-event registration.`,
        { eventId: parentEvent._id, eventTitle: parentEvent.title, eventImage: parentEvent.image }
      ).catch(err => console.error('Parent registration notification error:', err.message));
    } else {
      // User already registered for parent - update QR code to include sub-event
      const existingSubEventIds = parentRegistration.qrPayload.subEventIds || [];
      if (!existingSubEventIds.includes(subEventId)) {
        existingSubEventIds.push(subEventId);
        
        // Get all registered sub-events for this parent
        const userSubEvents = await SubEventRegistration.find({
          userId,
          parentEventId: subEvent.parentEventId
        }).populate('subEventId');
        
        const subEventTitles = userSubEvents.map(sr => sr.subEventId?.title || '').filter(t => t);
        subEventTitles.push(subEvent.title);
        
        // Update QR code content with all sub-events
        const issuedAt = parentRegistration.registeredAt.toISOString();

        // Update QR payload
        parentRegistration.qrPayload.subEventIds = existingSubEventIds;
        parentRegistration.qrPayload.sub_event_titles = subEventTitles.join(', ');

        // Build events array and regenerate plain-text QR content
        parentRegistration.qrPayload.events = [
          {
            title: parentEvent.title,
            venue: parentEvent.venue,
            date: new Date(parentEvent.date).toLocaleDateString(),
            time: parentEvent.time,
            subEvents: subEventTitles,
            team: parentRegistration.qrPayload.team || null,
            seating: parentRegistration.qrPayload.seating || null,
            ticketType: parentRegistration.qrPayload.ticketType || null
          }
        ];

        const qrContentText = generateQRTextContent(parentRegistration.qrPayload);
        const qrCodeUrl = await generateQRCodeWithEventName(qrContentText, parentEvent.title, { size: 400, fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', maxChars: 40, position: 'below', backgroundColor: '#FFFFFF', textColor: '#000000', qrColor: '#000000' });
        parentRegistration.qrCode = qrCodeUrl;
        await parentRegistration.save();
      }
    }
    
    // Create sub-event registration
    const subRegistrationId = `SUBREG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const subRegistration = new SubEventRegistration({
      registrationId: subRegistrationId,
      userId,
      subEventId,
      parentEventId: subEvent.parentEventId,
      parentRegistrationId: parentRegistration.registrationId, // Link to parent registration
      status: 'registered',
      source: 'direct' // Direct registration (not from waitlist)
    });
    
    await subRegistration.save();
    
    // Update sub-event participant count
    subEvent.currentParticipants += 1;
    await subEvent.save();
    
    // FAST RESPONSE: Return immediately after saving
    res.status(201).json({ 
      message: 'Successfully registered for sub-event and parent event', 
      registration: subRegistration,
      parentRegistration: {
        id: parentRegistration.registrationId,
        qrCode: parentRegistration.qrCode
      }
    });
    
    // Background: Notify user about sub-event registration (non-blocking)
    notifyUser(
      req,
      user._id,
      'registered',
      `You have successfully registered for the sub-event: '${subEvent.title}' under '${parentEvent.title}'.`,
      { eventId: subEvent.parentEventId, eventTitle: parentEvent.title, eventImage: parentEvent.image }
    ).catch(err => console.error('Sub-event registration notification error:', err.message));
  } catch (error) {
    console.error('Error registering for sub-event:', error);
    res.status(500).json({ error: 'Failed to register for sub-event' });
  }
});

// Unregister from sub-event
app.post('/api/sub-events/:subEventId/unregister', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    const registration = await SubEventRegistration.findOne({ userId, subEventId });
    
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    const subEvent = await SubEvent.findById(subEventId);
    if (subEvent) {
      subEvent.currentParticipants = Math.max(0, subEvent.currentParticipants - 1);
      await subEvent.save();
    }
    
    // Update parent event registration QR code to remove this sub-event
    const parentRegistration = await Registration.findOne({ 
      userId, 
      eventId: registration.parentEventId 
    });
    
    if (parentRegistration && parentRegistration.qrPayload.subEventIds) {
      const subEventIds = parentRegistration.qrPayload.subEventIds.filter(id => id !== subEventId);
      
      // Get remaining sub-events
      const remainingSubEvents = await SubEventRegistration.find({
        userId,
        parentEventId: registration.parentEventId,
        subEventId: { $ne: subEventId }
      }).populate('subEventId');
      
      const subEventTitles = remainingSubEvents
        .map(sr => sr.subEventId?.title || '')
        .filter(t => t);
      
        // Update QR payload
        parentRegistration.qrPayload.subEventIds = subEventIds;
        parentRegistration.qrPayload.sub_event_titles = subEventTitles.join(', ');

        // Regenerate QR code if there are remaining sub-events
        const user = await User.findById(userId);
        const parentEvent = await Event.findById(registration.parentEventId);
        
        if (user && parentEvent) {
          // Build events array and regenerate plain-text QR content
          parentRegistration.qrPayload.events = [
            {
              title: parentEvent.title,
              venue: parentEvent.venue,
              date: new Date(parentEvent.date).toLocaleDateString(),
              time: parentEvent.time,
              subEvents: subEventTitles,
              team: parentRegistration.qrPayload.team || null,
              seating: parentRegistration.qrPayload.seating || null,
              ticketType: parentRegistration.qrPayload.ticketType || null
            }
          ];

          const qrContentText = generateQRTextContent(parentRegistration.qrPayload);
          const qrCodeUrl = await generateQRCodeWithEventName(qrContentText, parentEvent.title, { size: 400, fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', maxChars: 40, position: 'below', backgroundColor: '#FFFFFF', textColor: '#000000', qrColor: '#000000' });
          parentRegistration.qrCode = qrCodeUrl;
        }
      
      await parentRegistration.save();
    }
    
    // Delete sub-event registration
    await SubEventRegistration.findByIdAndDelete(registration._id);
    
    // Try to promote someone from waitlist
    await promoteFromWaitlist(subEventId);
    
    res.status(200).json({ message: 'Successfully unregistered from sub-event' });
  } catch (error) {
    console.error('Error unregistering from sub-event:', error);
    res.status(500).json({ error: 'Failed to unregister from sub-event' });
  }
});

// Get registrations for sub-event
app.get('/api/sub-events/:subEventId/registrations', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const registrations = await SubEventRegistration.find({ subEventId })
      .populate('userId', 'name email regId department year section mobile avatar')
      .sort({ registeredAt: -1 });
    
    res.status(200).json({ registrations });
  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// Get user's sub-event registration
app.get('/api/sub-events/:subEventId/registration/:userId', async (req, res) => {
  try {
    const { subEventId, userId } = req.params;
    
    const registration = await SubEventRegistration.findOne({ subEventId, userId });
    
    res.status(200).json({ registered: !!registration, registration });
  } catch (error) {
    console.error('Error checking registration:', error);
    res.status(500).json({ error: 'Failed to check registration' });
  }
});

// Add comment to sub-event
app.post('/api/sub-events/:subEventId/comments', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId, content, parentId } = req.body;
    
    const comment = new SubEventComment({
      subEventId,
      userId,
      content,
      parentId: parentId || null
    });
    
    await comment.save();
    
    const populatedComment = await SubEventComment.findById(comment._id)
      .populate('userId', 'name avatar email role');
    
    res.status(201).json({ message: 'Comment added successfully', comment: populatedComment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for sub-event
app.get('/api/sub-events/:subEventId/comments', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const comments = await SubEventComment.find({ subEventId, parentId: null })
      .populate('userId', 'name avatar email role')
      .sort({ createdAt: -1 });
    
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const replies = await SubEventComment.find({ parentId: comment._id })
          .populate('userId', 'name avatar email role')
          .sort({ createdAt: 1 });
        
        return {
          ...comment.toObject(),
          replies
        };
      })
    );
    
    res.status(200).json({ comments: commentsWithReplies });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Get waitlist for sub-event
app.get('/api/sub-events/:subEventId/waitlist', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const waitlist = await SubEventWaitlist.find({ subEventId, status: 'waiting' })
      .populate('userId', 'name email regId department year section mobile avatar')
      .sort({ joinedAt: 1 }); // First come, first served
    
    res.status(200).json({ waitlist });
  } catch (error) {
    console.error('Error fetching waitlist:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

// Check user's waitlist status
app.get('/api/sub-events/:subEventId/waitlist/:userId', async (req, res) => {
  try {
    const { subEventId, userId } = req.params;
    
    const waitlistEntry = await SubEventWaitlist.findOne({ subEventId, userId, status: 'waiting' });
    
    res.status(200).json({ 
      onWaitlist: !!waitlistEntry, 
      waitlistEntry 
    });
  } catch (error) {
    console.error('Error checking waitlist:', error);
    res.status(500).json({ error: 'Failed to check waitlist status' });
  }
});

// Remove from waitlist
app.post('/api/sub-events/:subEventId/waitlist/remove', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    const waitlistEntry = await SubEventWaitlist.findOne({ subEventId, userId, status: 'waiting' });
    
    if (!waitlistEntry) {
      return res.status(404).json({ error: 'Not on waitlist' });
    }
    
    waitlistEntry.status = 'cancelled';
    await waitlistEntry.save();
    
    // Update positions for remaining waitlist entries
    const remainingEntries = await SubEventWaitlist.find({ 
      subEventId, 
      status: 'waiting',
      joinedAt: { $gt: waitlistEntry.joinedAt }
    }).sort({ joinedAt: 1 });
    
    for (let i = 0; i < remainingEntries.length; i++) {
      remainingEntries[i].position = waitlistEntry.position + i;
      await remainingEntries[i].save();
    }
    
    res.status(200).json({ message: 'Removed from waitlist' });
  } catch (error) {
    console.error('Error removing from waitlist:', error);
    res.status(500).json({ error: 'Failed to remove from waitlist' });
  }
});

// Manually approve waitlist user (Admin/Organizer only)
app.post('/api/sub-events/:subEventId/waitlist/approve', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    // Find the waitlist entry
    const waitlistEntry = await SubEventWaitlist.findOne({ 
      subEventId, 
      userId, 
      status: 'waiting' 
    }).populate('userId');
    
    if (!waitlistEntry) {
      return res.status(404).json({ error: 'User not found on waitlist' });
    }
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    const user = waitlistEntry.userId;
    const parentEvent = await Event.findById(subEvent.parentEventId);
    
    if (!parentEvent) {
      return res.status(404).json({ error: 'Parent event not found' });
    }
    
    // Check if user is already registered for parent event
    let parentRegistration = await Registration.findOne({ userId: user._id, eventId: subEvent.parentEventId });
    
    // If not registered for parent event, create parent registration
    if (!parentRegistration) {
      const parentRegistrationId = generateUniqueRegistrationId();
      const issuedAt = new Date().toISOString();
      
      // Build QR payload and plain-text content (include optional team/seating/ticketType)
      const qrPayload = {
        registrationId: parentRegistrationId,
        userId: user._id,
        eventIds: [subEvent.parentEventId],
        subEventIds: [subEventId],
        timestamp: Date.now(),
        name: user.name,
        email: user.email,
        college: user.college,
        department: user.department,
        section: user.section || 'A',
        year: user.year,
        regId: user.regId || parentRegistrationId.substring(0, 8).toUpperCase(),
        registeredAt: issuedAt,
        event_title: parentEvent.title,
        sub_event_title: subEvent.title,
        student_name: user.name,
        event_venue: parentEvent.venue,
        event_date: new Date(parentEvent.date).toLocaleDateString(),
        event_time: parentEvent.time,
        team: req.body.team || waitlistEntry?.team || null,
        seating: req.body.seating || null,
        ticketType: req.body.ticketType || null,
        events: [{ title: parentEvent.title, venue: parentEvent.venue, date: new Date(parentEvent.date).toLocaleDateString(), time: parentEvent.time, subEvents: parentEvent.subEvents || [], team: req.body.team || waitlistEntry?.team || null }]
      };

      const signature = generateSignature(qrPayload);
      qrPayload.signature = signature;

      const qrContent = generateQRTextContent(qrPayload);

      const qrCodeUrl = await generateQRCodeWithEventName(
        qrContent,
        parentEvent.title,
        {
          size: 400,
          fontSize: 14,
          fontFamily: 'Arial',
          fontWeight: 'bold',
          maxChars: 40,
          position: 'below',
          backgroundColor: '#FFFFFF',
          textColor: '#000000',
          qrColor: '#000000'
        }
      );
      
      parentRegistration = new Registration({
        registrationId: parentRegistrationId,
        userId: user._id,
        eventId: subEvent.parentEventId,
        status: 'registered',
        approvalStatus: 'approved',
        approvalType: 'autoApproved',
        approvedAt: new Date(),
        qrCode: qrCodeUrl,
        qrPayload,
        registeredAt: issuedAt
      });
      
      await parentRegistration.save();
      
      parentEvent.currentParticipants += 1;
      await parentEvent.save();
    } else {
      // Update parent registration to include this sub-event
      if (!parentRegistration.qrPayload.subEventIds) {
        parentRegistration.qrPayload.subEventIds = [];
      }
      
      if (!parentRegistration.qrPayload.subEventIds.includes(subEventId)) {
        parentRegistration.qrPayload.subEventIds.push(subEventId);
        
        const subEvents = await SubEventRegistration.find({
          userId: user._id,
          parentEventId: subEvent.parentEventId
        }).populate('subEventId');
        
        const subEventTitles = [subEvent.title, ...subEvents.map(sr => sr.subEventId?.title || '').filter(t => t)];
        parentRegistration.qrPayload.sub_event_titles = subEventTitles.join(', ');
        
        const issuedAt = parentRegistration.registeredAt.toISOString();
        const subEventInfo = `\n🎫 Sub-Events: ${subEventTitles.join(', ')}`;

        // Build events array and regenerate plain-text QR content
        parentRegistration.qrPayload.events = [
          {
            title: parentEvent.title,
            venue: parentEvent.venue,
            date: new Date(parentEvent.date).toLocaleDateString(),
            time: parentEvent.time,
            subEvents: subEventTitles,
            team: parentRegistration.qrPayload.team || null,
            seating: parentRegistration.qrPayload.seating || null,
            ticketType: parentRegistration.qrPayload.ticketType || null
          }
        ];

        const qrContentText = generateQRTextContent(parentRegistration.qrPayload);
        const qrCodeUrl = await generateQRCodeWithEventName(qrContentText, parentEvent.title, { size: 400, fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', maxChars: 40, position: 'below', backgroundColor: '#FFFFFF', textColor: '#000000', qrColor: '#000000' });
        parentRegistration.qrCode = qrCodeUrl;
        await parentRegistration.save();
      }
    }
    
    // Create sub-event registration
    const subRegistrationId = `SUBREG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const subRegistration = new SubEventRegistration({
      registrationId: subRegistrationId,
      userId: user._id,
      subEventId,
      parentEventId: subEvent.parentEventId,
      parentRegistrationId: parentRegistration.registrationId,
      status: 'registered',
      source: 'waitlist' // Approved from waitlist by admin/organizer
    });
    
    await subRegistration.save();
    
    // Update waitlist entry
    waitlistEntry.status = 'promoted';
    waitlistEntry.notificationSent = true;
    await waitlistEntry.save();
    
    // Update positions for remaining waitlist
    const remainingEntries = await SubEventWaitlist.find({ 
      subEventId, 
      status: 'waiting',
      joinedAt: { $gt: waitlistEntry.joinedAt }
    }).sort({ joinedAt: 1 });
    
    for (let i = 0; i < remainingEntries.length; i++) {
      remainingEntries[i].position = i + 1;
      await remainingEntries[i].save();
    }
    
    // Notify user
    await notifyUser(
      req,
      user._id,
      'registered',
      `Great news! You've been approved from the waitlist and registered for '${subEvent.title}'.`,
      { eventId: subEvent.parentEventId, eventTitle: parentEvent.title }
    );
    
    res.status(200).json({ 
      message: 'User approved and registered successfully',
      registration: subRegistration
    });
  } catch (error) {
    console.error('Error approving waitlist user:', error);
    res.status(500).json({ error: 'Failed to approve waitlist user' });
  }
});

// Promote from waitlist (when someone unregisters)
async function promoteFromWaitlist(subEventId) {
  try {
    // Get the first person on waitlist
    const nextInLine = await SubEventWaitlist.findOne({ 
      subEventId, 
      status: 'waiting' 
    }).sort({ joinedAt: 1 }).populate('userId');
    
    if (!nextInLine) {
      return null; // No one on waitlist
    }
    
    const subEvent = await SubEvent.findById(subEventId);
    const user = nextInLine.userId;
    
    // Create sub-event registration
    const subRegistrationId = `SUBREG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const subRegistration = new SubEventRegistration({
      registrationId: subRegistrationId,
      userId: user._id,
      subEventId,
      parentEventId: subEvent.parentEventId,
      status: 'registered',
      source: 'waitlist'
    });
    
    await subRegistration.save();
    
    // Update waitlist entry
    nextInLine.status = 'promoted';
    nextInLine.notificationSent = true;
    await nextInLine.save();
    
    // Notify user
    // Note: You'll need to pass req object or implement a different notification method
    console.log(`✅ Promoted ${user.name} from waitlist for sub-event ${subEvent.title}`);
    
    // Update positions for remaining waitlist
    const remainingEntries = await SubEventWaitlist.find({ 
      subEventId, 
      status: 'waiting',
      joinedAt: { $gt: nextInLine.joinedAt }
    }).sort({ joinedAt: 1 });
    
    for (let i = 0; i < remainingEntries.length; i++) {
      remainingEntries[i].position = i + 1;
      await remainingEntries[i].save();
    }
    
    return subRegistration;
  } catch (error) {
    console.error('Error promoting from waitlist:', error);
    return null;
  }
}

// ================================
// END SUB-EVENTS API ENDPOINTS
// ================================

// ================================
// QR CODE VERIFICATION ENDPOINT
// ================================
// This endpoint is called when a QR code URL is scanned on mobile devices
app.get('/api/verify-registration/:registrationId', async (req, res) => {
  try {
    const { registrationId } = req.params;
    const { event: eventId } = req.query;
    
    // Find the registration
    const registration = await Registration.findOne({ registrationId })
      .populate('userId', 'name email regId department section year role')
      .populate('eventId', 'title venue date time status');
    
    if (!registration) {
      return res.status(404).json({
        valid: false,
        message: 'Registration not found',
        registrationId
      });
    }
    
    const user = registration.userId;
    const event = registration.eventId;
    
    res.json({
      valid: true,
      registration: {
        registrationId: registration.registrationId,
        status: registration.status,
        approvalStatus: registration.approvalStatus,
        registeredAt: registration.registeredAt,
        user: user ? {
          name: user.name,
          email: user.email,
          regId: user.regId,
          department: user.department,
          section: user.section,
          year: user.year,
          role: user.role
        } : null,
        event: event ? {
          id: event._id,
          title: event.title,
          venue: event.venue,
          date: event.date,
          time: event.time,
          status: event.status
        } : null
      }
    });
  } catch (error) {
    console.error('Error verifying registration:', error);
    res.status(500).json({
      valid: false,
      message: 'Error verifying registration',
      error: error.message
    });
  }
});

// ================================
// SUB-EVENT TEAM MANAGEMENT API ENDPOINTS
// ================================

// Create a new team for a sub-event
app.post('/api/sub-events/:subEventId/teams', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId, teamName } = req.body;

    if (!userId || !teamName) {
      return res.status(400).json({ error: 'User ID and team name are required' });
    }

    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    if (!subEvent.isTeamEvent) {
      return res.status(400).json({ error: 'This sub-event is not a team event' });
    }

    // Check if user already leads a team for this sub-event
    const existingTeam = await SubEventTeam.findOne({ subEventId, leaderId: userId });
    if (existingTeam) {
      return res.status(400).json({ error: 'You already have a team for this sub-event' });
    }

    // Check if user is a member of another team
    const memberOfTeam = await SubEventTeam.findOne({
      subEventId,
      'members.userId': userId
    });
    if (memberOfTeam) {
      return res.status(400).json({ error: 'You are already a member of another team' });
    }

    // Create the team
    const team = new SubEventTeam({
      subEventId,
      parentEventId: subEvent.parentEventId,
      name: teamName,
      leaderId: userId,
      members: [{
        userId,
        role: 'leader',
        joinedAt: new Date()
      }],
      maxMembers: subEvent.maxTeamSize || 4,
      status: 'forming'
    });

    await team.save();

    const populatedTeam = await SubEventTeam.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.status(201).json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Error creating sub-event team:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Team name already exists for this sub-event' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get all teams for a sub-event
app.get('/api/sub-events/:subEventId/teams', async (req, res) => {
  try {
    const { subEventId } = req.params;

    const teams = await SubEventTeam.find({ subEventId })
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar')
      .sort({ createdAt: -1 });

    res.json({ teams });
  } catch (error) {
    console.error('Error fetching sub-event teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get user's team for a sub-event
app.get('/api/sub-events/:subEventId/my-team', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const team = await SubEventTeam.findOne({
      subEventId,
      $or: [
        { leaderId: userId },
        { 'members.userId': userId }
      ]
    })
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    // Get pending invitations sent to this user for this sub-event
    const pendingInvites = await SubEventTeamInvitation.find({
      subEventId,
      toUserId: userId,
      status: 'pending'
    })
      .populate('teamId')
      .populate('fromUserId', 'name email avatar');

    // Get pending requests sent by this team
    const sentRequests = team ? await SubEventTeamInvitation.find({
      teamId: team._id,
      status: 'pending'
    }).populate('toUserId', 'name email regId department section year avatar') : [];

    res.json({
      success: true,
      team: team || null,
      pendingInvites,
      sentRequests,
      isLeader: team ? team.leaderId._id.toString() === userId : false
    });
  } catch (error) {
    console.error('Error fetching user team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Invite user to sub-event team
app.post('/api/sub-events/:subEventId/teams/:teamId/invite', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;
    const { leaderId, inviteeId, message } = req.body;

    const team = await SubEventTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== leaderId) {
      return res.status(403).json({ error: 'Only team leader can invite members' });
    }

    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is full' });
    }

    // Check if user is already in a team
    const existingTeam = await SubEventTeam.findOne({
      subEventId,
      $or: [
        { leaderId: inviteeId },
        { 'members.userId': inviteeId }
      ]
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'User is already in a team' });
    }

    // Check for existing pending invite
    const existingInvite = await SubEventTeamJoinRequest.findOne({
      teamId,
      toUserId: inviteeId,
      status: 'pending'
    });
    if (existingInvite) {
      return res.status(400).json({ error: 'Invite already sent to this user' });
    }

    const subEvent = await SubEvent.findById(subEventId);

    // Create invite
    const invite = new SubEventTeamJoinRequest({
      teamId,
      subEventId,
      fromUserId: leaderId,
      toUserId: inviteeId,
      message,
      expiresAt: subEvent?.registrationDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    await invite.save();

    // Notify invited user
    const leader = await User.findById(leaderId);
    await notifyUser(
      req,
      inviteeId,
      'team_invite',
      `${leader?.name || 'Someone'} invited you to join team "${team.name}" for sub-event`,
      { subEventId, teamId, teamName: team.name }
    );

    res.json({ success: true, invite });
  } catch (error) {
    console.error('Error inviting to sub-event team:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// Accept sub-event team invite
app.post('/api/sub-events/team-invitations/:inviteId/accept', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { userId } = req.body;

    const invite = await SubEventTeamJoinRequest.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invite.toUserId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation is no longer valid' });
    }

    const team = await SubEventTeam.findById(invite.teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is full' });
    }

    // Add member to team
    team.members.push({
      userId,
      role: 'member',
      joinedAt: new Date()
    });
    await team.save();

    // Update invite status
    invite.status = 'accepted';
    invite.respondedAt = new Date();
    await invite.save();

    const populatedTeam = await SubEventTeam.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Error accepting sub-event team invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Decline sub-event team invite
app.post('/api/sub-events/team-invitations/:inviteId/decline', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { userId } = req.body;

    const invite = await SubEventTeamJoinRequest.findById(inviteId);
    if (!invite) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invite.toUserId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    invite.status = 'rejected';
    invite.respondedAt = new Date();
    await invite.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error declining sub-event team invite:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

// Get user's pending invitations for sub-event
app.get('/api/sub-events/:subEventId/my-team-invitations', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const invitations = await SubEventTeamJoinRequest.find({
      subEventId,
      toUserId: userId,
      status: 'pending'
    })
      .populate('teamId')
      .populate('fromUserId', 'name email');

    // Format response
    const formattedInvitations = await Promise.all(invitations.map(async (inv) => {
      const team = await SubEventTeam.findById(inv.teamId)
        .populate('members.userId', 'name email');
      return {
        _id: inv._id,
        teamId: inv.teamId._id,
        teamName: inv.teamId.name,
        invitedBy: inv.fromUserId,
        status: inv.status,
        expiresAt: inv.expiresAt,
        members: team?.members || [],
        maxSize: team?.maxMembers || 4
      };
    }));

    res.json({ invitations: formattedInvitations });
  } catch (error) {
    console.error('Error fetching sub-event team invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Complete sub-event team registration
app.post('/api/sub-events/:subEventId/teams/:teamId/complete', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;
    const { userId } = req.body;

    const team = await SubEventTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only team leader can complete registration' });
    }

    if (team.status === 'complete') {
      return res.status(400).json({ error: 'Team registration already complete' });
    }

    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    const confirmedMembers = team.members.length;
    const minTeamSize = subEvent.minTeamSize || 2;

    if (confirmedMembers < minTeamSize) {
      return res.status(400).json({
        error: `Team needs at least ${minTeamSize} members. Currently has ${confirmedMembers}.`
      });
    }

    team.status = 'complete';
    team.updatedAt = new Date();
    await team.save();

    // Notify all team members
    for (const member of team.members) {
      if (member.userId.toString() !== userId) {
        await notifyUser(
          req,
          member.userId,
          'team_registration_complete',
          `Team "${team.name}" registration is now complete for the sub-event`,
          { subEventId, teamId: team._id, teamName: team.name }
        );
      }
    }

    const populatedTeam = await SubEventTeam.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Error completing sub-event team registration:', error);
    res.status(500).json({ error: 'Failed to complete registration' });
  }
});

// Remove member from sub-event team
app.post('/api/sub-events/:subEventId/teams/:teamId/remove-member', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { leaderId, memberId } = req.body;

    const team = await SubEventTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== leaderId) {
      return res.status(403).json({ error: 'Only team leader can remove members' });
    }

    if (memberId === leaderId) {
      return res.status(400).json({ error: 'Leader cannot remove themselves' });
    }

    team.members = team.members.filter(m => m.userId.toString() !== memberId);
    await team.save();

    const populatedTeam = await SubEventTeam.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({ success: true, team: populatedTeam });
  } catch (error) {
    console.error('Error removing member from sub-event team:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave sub-event team
app.post('/api/sub-events/:subEventId/teams/:teamId/leave', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.body;

    const team = await SubEventTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() === userId) {
      return res.status(400).json({ error: 'Leader cannot leave. Delete the team instead.' });
    }

    team.members = team.members.filter(m => m.userId.toString() !== userId);
    await team.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving sub-event team:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

// Delete sub-event team
app.delete('/api/sub-events/:subEventId/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { userId } = req.query;

    const team = await SubEventTeam.findById(teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const user = await User.findById(userId);
    const isLeader = team.leaderId.toString() === userId;
    const isAdmin = user?.role === 'admin';

    if (!isLeader && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete team' });
    }

    // Delete all pending invites
    await SubEventTeamJoinRequest.deleteMany({ teamId });
    
    // Delete the team
    await SubEventTeam.deleteOne({ _id: teamId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-event team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Search users for sub-event team invite
app.get('/api/sub-events/:subEventId/search-users', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { query, excludeUserId } = req.query;

    if (!query || query.length < 2) {
      return res.json({ users: [] });
    }

    // Find users matching the query
    const users = await User.find({
      $and: [
        { _id: { $ne: excludeUserId } },
        {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
            { regId: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    })
      .select('name email regId department year avatar')
      .limit(10);

    // Filter out users already in teams for this sub-event
    const teamsWithMembers = await SubEventTeam.find({ subEventId });
    const usersInTeams = new Set();
    teamsWithMembers.forEach(team => {
      usersInTeams.add(team.leaderId.toString());
      team.members.forEach(m => usersInTeams.add(m.userId.toString()));
    });

    const availableUsers = users.filter(u => !usersInTeams.has(u._id.toString()));

    res.json({ users: availableUsers });
  } catch (error) {
    console.error('Error searching users for sub-event:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Enhanced user search with registration status for sub-event team invitations
app.get('/api/sub-events/:subEventId/search-users-for-team', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { search, excludeUserId } = req.query;

    if (!search || search.trim().length < 2) {
      return res.json({ success: true, users: [], searchedEmail: null });
    }

    const searchTerm = search.trim();
    const isEmailSearch = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchTerm);

    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }

    // Get all users who are already in a team for this sub-event
    const teamsForSubEvent = await SubEventTeam.find({ subEventId });
    const usersInTeams = new Set();
    teamsForSubEvent.forEach(team => {
      usersInTeams.add(team.leaderId.toString());
      team.members.forEach(m => usersInTeams.add(m.userId.toString()));
    });

    // Get users with pending invitations for this sub-event
    const pendingInvites = await SubEventTeamInvitation.find({ subEventId, status: 'pending' });
    const usersWithPendingInvites = new Set(pendingInvites.map(r => r.toUserId?.toString()).filter(Boolean));

    // Get pending token invitations
    const pendingTokenInvites = await SubEventTeamInvitationToken.find({ subEventId, status: 'pending' });
    const emailsWithPendingTokenInvites = new Set(pendingTokenInvites.map(t => t.invitedEmail?.toLowerCase()).filter(Boolean));

    // Get registrations for this sub-event to check registration status
    const subEventRegistrations = await SubEventRegistration.find({ subEventId });
    const registeredUserIds = new Set(subEventRegistrations.map(r => r.userId.toString()));

    // Search for users
    const userSearchQuery = {
      _id: { $nin: [...usersInTeams, ...usersWithPendingInvites] }
    };

    if (excludeUserId) {
      userSearchQuery._id.$nin = [...userSearchQuery._id.$nin, excludeUserId];
    }

    userSearchQuery.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { regId: { $regex: searchTerm, $options: 'i' } }
    ];

    const users = await User.find(userSearchQuery)
      .select('name email regId department section year avatar role')
      .limit(20)
      .sort({ name: 1 });

    // Add registration status to each user
    const usersWithStatus = users.map(user => {
      const userId = user._id.toString();
      const isRegisteredForSubEvent = registeredUserIds.has(userId);
      const hasPendingInvite = usersWithPendingInvites.has(userId) || emailsWithPendingTokenInvites.has(user.email.toLowerCase());
      
      return {
        ...user.toObject(),
        registrationStatus: isRegisteredForSubEvent ? 'registered' : 'platform_only',
        hasPendingInvite,
        canInvite: !hasPendingInvite
      };
    });

    // If email search and no user found, check if we should allow inviting non-platform user
    let nonPlatformInvite = null;
    if (isEmailSearch && users.length === 0) {
      const existingTokenInvite = emailsWithPendingTokenInvites.has(searchTerm.toLowerCase());
      
      nonPlatformInvite = {
        email: searchTerm,
        registrationStatus: 'not_on_platform',
        hasPendingInvite: existingTokenInvite,
        canInvite: !existingTokenInvite
      };
    }

    res.json({
      success: true,
      users: usersWithStatus,
      nonPlatformInvite,
      searchedEmail: isEmailSearch ? searchTerm : null
    });
  } catch (error) {
    console.error('Error searching users for sub-event team:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Rename sub-event team
app.patch('/api/sub-events/:subEventId/teams/:teamId/rename', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;
    const { name, userId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'New team name is required' });
    }

    const team = await SubEventTeam.findOne({ _id: teamId, subEventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the team leader can rename the team' });
    }

    const subEvent = await SubEvent.findById(subEventId);
    if (new Date() > new Date(subEvent.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot rename team after registration deadline' });
    }

    const existingTeam = await SubEventTeam.findOne({ 
      subEventId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: teamId }
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }

    team.name = name;
    team.updatedAt = new Date();
    await team.save();

    res.json({ success: true, team });
  } catch (error) {
    console.error('Error renaming sub-event team:', error);
    res.status(500).json({ error: 'Failed to rename team' });
  }
});

// Invite platform user to sub-event and team
app.post('/api/sub-events/:subEventId/teams/:teamId/invite-to-event', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;
    const { fromUserId, toUserId, message } = req.body;

    const team = await SubEventTeam.findOne({ _id: teamId, subEventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== fromUserId) {
      return res.status(403).json({ error: 'Only the team leader can invite members' });
    }

    const subEvent = await SubEvent.findById(subEventId);
    if (new Date() > new Date(subEvent.registrationDeadline)) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    const maxMembers = subEvent.maxTeamSize || 4;
    if (team.members.length + 1 >= maxMembers) {
      return res.status(400).json({ error: 'Team is already at maximum capacity' });
    }

    // Check if user exists
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already in a team
    const existingTeam = await SubEventTeam.findOne({
      subEventId,
      $or: [
        { leaderId: toUserId },
        { 'members.userId': toUserId }
      ]
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'User is already in a team for this sub-event' });
    }

    // Check for existing pending invitation
    const existingInvite = await SubEventTeamInvitation.findOne({
      subEventId,
      toUserId,
      status: 'pending'
    });
    if (existingInvite) {
      return res.status(400).json({ error: 'User already has a pending invitation' });
    }

    // Create invitation with event invite flag
    const invitation = new SubEventTeamInvitation({
      subEventId,
      teamId,
      fromUserId,
      toUserId,
      message,
      inviteToEvent: true,
      status: 'pending'
    });
    await invitation.save();

    res.json({ success: true, invitation });
  } catch (error) {
    console.error('Error inviting user to sub-event:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Invite non-platform user by email to sub-event team
app.post('/api/sub-events/:subEventId/teams/:teamId/invite-by-email', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;
    const { fromUserId, email, message } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const team = await SubEventTeam.findOne({ _id: teamId, subEventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (team.leaderId.toString() !== fromUserId) {
      return res.status(403).json({ error: 'Only the team leader can invite members' });
    }

    const subEvent = await SubEvent.findById(subEventId).populate('eventId', 'title');
    if (new Date() > new Date(subEvent.registrationDeadline)) {
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    const maxMembers = subEvent.maxTeamSize || 4;
    if (team.members.length + 1 >= maxMembers) {
      return res.status(400).json({ error: 'Team is already at maximum capacity' });
    }

    // Check if email already belongs to a platform user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'This email belongs to a platform user. Please use the regular invite.' });
    }

    // Check for existing pending token invitation
    const existingToken = await SubEventTeamInvitationToken.findOne({
      subEventId,
      invitedEmail: email.toLowerCase(),
      status: 'pending'
    });
    if (existingToken) {
      return res.status(400).json({ error: 'This email already has a pending invitation' });
    }

    // Generate unique token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Create token invitation
    const tokenInvitation = new SubEventTeamInvitationToken({
      subEventId,
      teamId,
      invitedBy: fromUserId,
      invitedEmail: email.toLowerCase(),
      message,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      status: 'pending'
    });
    await tokenInvitation.save();

    // Send email invitation
    const inviter = await User.findById(fromUserId);
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join-sub-event-team/${token}`;
    
    try {
      await sendEmail({
        to: email,
        subject: `Team Invitation - ${team.name} for ${subEvent.title}`,
        html: `
          <h2>You've been invited to join a team!</h2>
          <p>${inviter.name} has invited you to join their team "${team.name}" for the sub-event "${subEvent.title}"${subEvent.eventId?.title ? ` (part of ${subEvent.eventId.title})` : ''}.</p>
          ${message ? `<p>Message: ${message}</p>` : ''}
          <p><a href="${inviteLink}" style="padding: 10px 20px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
          <p>This link will expire in 7 days.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error inviting by email to sub-event team:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get pending token invitations for a sub-event team
app.get('/api/sub-events/:subEventId/teams/:teamId/token-invites', async (req, res) => {
  try {
    const { subEventId, teamId } = req.params;

    const invitations = await SubEventTeamInvitationToken.find({
      teamId,
      subEventId,
      status: 'pending'
    })
      .populate('invitedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invitations
    });
  } catch (error) {
    console.error('Error fetching sub-event token invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// ================================
// SUB-EVENT WINNER & SPOT REGISTRATION API ENDPOINTS
// ================================

// Complete sub-event (mark as completed)
app.post('/api/sub-events/:subEventId/complete', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to complete this sub-event' });
    }
    
    // Update sub-event status
    subEvent.status = 'completed';
    subEvent.updatedAt = new Date();
    await subEvent.save();
    
    res.json({ success: true, subEvent });
  } catch (error) {
    console.error('Error completing sub-event:', error);
    res.status(500).json({ error: 'Failed to complete sub-event' });
  }
});

// Reopen sub-event (mark as upcoming)
app.post('/api/sub-events/:subEventId/reopen', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId } = req.body;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to reopen this sub-event' });
    }
    
    // Update sub-event status
    subEvent.status = 'upcoming';
    subEvent.updatedAt = new Date();
    await subEvent.save();
    
    res.json({ success: true, subEvent });
  } catch (error) {
    console.error('Error reopening sub-event:', error);
    res.status(500).json({ error: 'Failed to reopen sub-event' });
  }
});

// Get sub-event spot registrations
app.get('/api/sub-events/:subEventId/spot-registrations', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const spotRegistrations = await SubEventSpotRegistration.find({ subEventId })
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ spotRegistrations });
  } catch (error) {
    console.error('Error fetching sub-event spot registrations:', error);
    res.status(500).json({ error: 'Failed to fetch spot registrations' });
  }
});

// Add sub-event spot registration
app.post('/api/sub-events/:subEventId/spot-registrations', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId, participantName, identifier, notes } = req.body;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to add spot registrations' });
    }
    
    const spotReg = new SubEventSpotRegistration({
      subEventId,
      participantName,
      identifier,
      notes,
      addedBy: userId
    });
    
    await spotReg.save();
    
    const populated = await SubEventSpotRegistration.findById(spotReg._id)
      .populate('addedBy', 'name email');
    
    res.json({ spotRegistration: populated });
  } catch (error) {
    console.error('Error adding sub-event spot registration:', error);
    res.status(500).json({ error: 'Failed to add spot registration' });
  }
});

// Delete sub-event spot registration
app.delete('/api/sub-events/:subEventId/spot-registrations/:spotRegId', async (req, res) => {
  try {
    const { subEventId, spotRegId } = req.params;
    const { userId } = req.query;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete spot registrations' });
    }
    
    // Check if spot registration is a winner
    const isWinner = await SubEventWinner.findOne({ spotRegistrationId: spotRegId });
    if (isWinner) {
      return res.status(400).json({ error: 'Cannot delete spot registration that has been awarded a position' });
    }
    
    await SubEventSpotRegistration.deleteOne({ _id: spotRegId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting sub-event spot registration:', error);
    res.status(500).json({ error: 'Failed to delete spot registration' });
  }
});

// Get sub-event winners
app.get('/api/sub-events/:subEventId/winners', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const winners = await SubEventWinner.find({ subEventId })
      .populate('userId', 'name email regId department year avatar')
      .populate('spotRegistrationId')
      .populate('addedBy', 'name email')
      .sort({ position: 1 });
    
    res.json({ winners });
  } catch (error) {
    console.error('Error fetching sub-event winners:', error);
    res.status(500).json({ error: 'Failed to fetch winners' });
  }
});

// Get eligible winners for sub-event (registered attendees + spot registrations not yet winners)
app.get('/api/sub-events/:subEventId/eligible-winners', async (req, res) => {
  try {
    const { subEventId } = req.params;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Get existing winners
    const existingWinners = await SubEventWinner.find({ subEventId });
    const winnerUserIds = new Set(existingWinners.filter(w => w.userId).map(w => w.userId.toString()));
    const winnerSpotIds = new Set(existingWinners.filter(w => w.spotRegistrationId).map(w => w.spotRegistrationId.toString()));
    
    // Get registered users who are not winners
    const registrations = await SubEventRegistration.find({ 
      subEventId,
      status: { $in: ['registered', 'attended'] }
    }).populate('userId', 'name email regId department year avatar');
    
    const eligibleRegistered = registrations.filter(r => 
      r.userId && !winnerUserIds.has(r.userId._id.toString())
    );
    
    // Get spot registrations who are not winners
    const spotRegistrations = await SubEventSpotRegistration.find({ subEventId });
    const eligibleSpot = spotRegistrations.filter(s => !winnerSpotIds.has(s._id.toString()));
    
    res.json({ 
      registered: eligibleRegistered, 
      spot: eligibleSpot,
      prizes: subEvent.prizes || []
    });
  } catch (error) {
    console.error('Error fetching eligible winners:', error);
    res.status(500).json({ error: 'Failed to fetch eligible winners' });
  }
});

// Add sub-event winner
app.post('/api/sub-events/:subEventId/winners', async (req, res) => {
  try {
    const { subEventId } = req.params;
    const { userId, position, participantType, participantUserId, spotRegistrationId } = req.body;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to add winners' });
    }
    
    // Check if position is already taken
    const existingWinner = await SubEventWinner.findOne({ subEventId, position });
    if (existingWinner) {
      return res.status(400).json({ error: `Position ${position} is already assigned` });
    }
    
    // Get participant name
    let participantName = '';
    if (participantType === 'registered') {
      const participant = await User.findById(participantUserId);
      participantName = participant?.name || 'Unknown';
    } else {
      const spotReg = await SubEventSpotRegistration.findById(spotRegistrationId);
      participantName = spotReg?.participantName || 'Unknown';
    }
    
    // Get prize for position
    const prize = subEvent.prizes && subEvent.prizes[position - 1] ? subEvent.prizes[position - 1] : null;
    
    const winner = new SubEventWinner({
      subEventId,
      position,
      prize,
      participantType,
      userId: participantType === 'registered' ? participantUserId : null,
      spotRegistrationId: participantType === 'spot' ? spotRegistrationId : null,
      participantName,
      addedBy: userId
    });
    
    await winner.save();
    
    const populated = await SubEventWinner.findById(winner._id)
      .populate('userId', 'name email regId department year avatar')
      .populate('spotRegistrationId')
      .populate('addedBy', 'name email');
    
    res.json({ winner: populated });
  } catch (error) {
    console.error('Error adding sub-event winner:', error);
    res.status(500).json({ error: 'Failed to add winner' });
  }
});

// Remove sub-event winner
app.delete('/api/sub-events/:subEventId/winners/:winnerId', async (req, res) => {
  try {
    const { subEventId, winnerId } = req.params;
    const { userId } = req.body;
    
    const subEvent = await SubEvent.findById(subEventId);
    if (!subEvent) {
      return res.status(404).json({ error: 'Sub-event not found' });
    }
    
    // Check if user is authorized
    const user = await User.findById(userId);
    const isOrganizer = subEvent.organizerId.toString() === userId;
    const isAdmin = user?.role === 'admin';
    
    if (!isOrganizer && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to remove winners' });
    }
    
    await SubEventWinner.deleteOne({ _id: winnerId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing sub-event winner:', error);
    res.status(500).json({ error: 'Failed to remove winner' });
  }
});

// ================================
// TEAM MANAGEMENT API ENDPOINTS
// ================================

// Create a new team for an event
app.post('/api/events/:eventId/teams', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { name, leaderId, maxMembers } = req.body;

    if (!name || !leaderId) {
      return res.status(400).json({ error: 'Team name and leader ID are required' });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if registration deadline has passed
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Registration deadline has passed. Cannot create team.' });
    }

    // Check if user exists
    const leader = await User.findById(leaderId);
    if (!leader) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has a team for this event (as leader or member)
    const existingTeam = await Team.findOne({
      eventId,
      $or: [
        { leaderId },
        { 'members.userId': leaderId }
      ]
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'You are already part of a team for this event' });
    }

    // Check if team name is unique for this event
    const existingTeamName = await Team.findOne({ eventId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingTeamName) {
      return res.status(400).json({ error: 'A team with this name already exists for this event' });
    }

    // Create the team
    const team = new Team({
      eventId,
      name,
      leaderId,
      maxMembers: maxMembers || 5,
      members: [{
        userId: leaderId,
        role: 'leader',
        joinedAt: new Date()
      }],
      status: 'forming'
    });

    await team.save();

    // Populate and return
    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar')
      .populate('eventId', 'title registrationDeadline');

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'A team with this name already exists or you already lead a team for this event' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get all teams for an event
app.get('/api/events/:eventId/teams', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query; // Optional: filter to check if user is in a team

    const query = { eventId };

    const teams = await Team.find(query)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar')
      .populate('eventId', 'title registrationDeadline')
      .sort({ createdAt: -1 });

    // If userId provided, also check if user is in any team
    let userTeam = null;
    if (userId) {
      userTeam = teams.find(team => 
        team.leaderId._id.toString() === userId ||
        team.members.some(m => m.userId._id.toString() === userId)
      );
    }

    res.json({
      success: true,
      teams,
      userTeam: userTeam || null,
      totalTeams: teams.length
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get a specific team
app.get('/api/events/:eventId/teams/:teamId', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;

    const team = await Team.findOne({ _id: teamId, eventId })
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar')
      .populate('eventId', 'title registrationDeadline');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get pending join requests for this team
    const pendingRequests = await TeamJoinRequest.find({ teamId, status: 'pending' })
      .populate('toUserId', 'name email regId department section year avatar')
      .populate('fromUserId', 'name email');

    res.json({
      success: true,
      team,
      pendingRequests
    });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Get user's team for an event
app.get('/api/events/:eventId/my-team', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const team = await Team.findOne({
      eventId,
      $or: [
        { leaderId: userId },
        { 'members.userId': userId }
      ]
    })
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar')
      .populate('eventId', 'title registrationDeadline');

    // Get pending requests sent by/to this user for this event
    const pendingInvites = await TeamJoinRequest.find({
      eventId,
      toUserId: userId,
      status: 'pending'
    })
      .populate('teamId')
      .populate('fromUserId', 'name email avatar');

    const sentRequests = team ? await TeamJoinRequest.find({
      teamId: team._id,
      status: 'pending'
    }).populate('toUserId', 'name email regId department section year avatar') : [];

    res.json({
      success: true,
      team: team || null,
      pendingInvites,
      sentRequests,
      isLeader: team ? team.leaderId._id.toString() === userId : false
    });
  } catch (error) {
    console.error('Error fetching user team:', error);
    res.status(500).json({ error: 'Failed to fetch user team' });
  }
});

// Rename team
app.patch('/api/events/:eventId/teams/:teamId/rename', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { name, userId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'New team name is required' });
    }

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is the leader
    if (team.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the team leader can rename the team' });
    }

    // Check registration deadline
    const event = await Event.findById(eventId);
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot rename team after registration deadline' });
    }

    // Check if new name is unique
    const existingTeam = await Team.findOne({ 
      eventId, 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: teamId }
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }

    const oldName = team.name;
    team.name = name;
    team.updatedAt = new Date();
    await team.save();

    // Notify team members about rename
    for (const member of team.members) {
      if (member.userId.toString() !== userId) {
        await notifyUser(
          req,
          member.userId,
          'team_renamed',
          `Team "${oldName}" has been renamed to "${name}"`,
          { eventId, teamId: team._id, teamName: name, eventTitle: event.title }
        );
      }
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({
      success: true,
      message: 'Team renamed successfully',
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error renaming team:', error);
    res.status(500).json({ error: 'Failed to rename team' });
  }
});

// Complete team registration
app.post('/api/events/:eventId/teams/:teamId/complete', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { userId } = req.body;

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if user is the leader
    if (team.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the team leader can complete registration' });
    }

    // Check if team is already complete
    if (team.status === 'complete') {
      return res.status(400).json({ error: 'Team registration is already complete' });
    }

    // Get event to check minTeamSize
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check registration deadline
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot complete registration after deadline' });
    }

    // Count team members (all members in the array are confirmed)
    const confirmedMembers = team.members.length;
    const minTeamSize = event.minTeamSize || 2;

    if (confirmedMembers < minTeamSize) {
      return res.status(400).json({ 
        error: `Team needs at least ${minTeamSize} members. Currently has ${confirmedMembers}.` 
      });
    }

    // Update team status
    team.status = 'complete';
    team.updatedAt = new Date();
    await team.save();

    // Notify all team members
    for (const member of team.members) {
      if (member.userId.toString() !== userId) {
        await notifyUser(
          req,
          member.userId,
          'team_registration_complete',
          `Team "${team.name}" registration is now complete for "${event.title}"`,
          { eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
        );
      }
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({
      success: true,
      message: 'Team registration completed successfully',
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error completing team registration:', error);
    res.status(500).json({ error: 'Failed to complete team registration' });
  }
});

// Send team join request (invite a user)
app.post('/api/events/:eventId/teams/:teamId/invite', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { fromUserId, toUserId, message } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ error: 'Both sender and recipient user IDs are required' });
    }

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if sender is the leader
    if (team.leaderId.toString() !== fromUserId) {
      return res.status(403).json({ error: 'Only the team leader can send invitations' });
    }

    // Check registration deadline
    const event = await Event.findById(eventId);
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot invite members after registration deadline' });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is already full' });
    }

    // Check if target user exists
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if target user is already in a team for this event
    const userExistingTeam = await Team.findOne({
      eventId,
      $or: [
        { leaderId: toUserId },
        { 'members.userId': toUserId }
      ]
    });
    if (userExistingTeam) {
      return res.status(400).json({ error: 'This user is already part of a team for this event' });
    }

    // Check if there's already a pending request
    const existingRequest = await TeamJoinRequest.findOne({
      teamId,
      toUserId,
      status: 'pending'
    });
    if (existingRequest) {
      return res.status(400).json({ error: 'An invitation is already pending for this user' });
    }

    // Create the join request
    const joinRequest = new TeamJoinRequest({
      teamId,
      eventId,
      fromUserId,
      toUserId,
      message,
      status: 'pending',
      expiresAt: event.registrationDeadline
    });

    await joinRequest.save();

    const leader = await User.findById(fromUserId);

    // Notify the target user with enhanced event details
    await notifyUser(
      req,
      toUserId,
      'team_invite',
      `👥 ${leader.name} has invited you to join team "${team.name}" for "${event.title}"`,
      buildNotificationData(event, { 
        teamId: team._id, 
        teamName: team.name, 
        requestId: joinRequest._id,
        relatedUser: fromUserId
      })
    );

    const populatedRequest = await TeamJoinRequest.findById(joinRequest._id)
      .populate('toUserId', 'name email regId department section year avatar')
      .populate('fromUserId', 'name email avatar');

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      request: populatedRequest
    });
  } catch (error) {
    console.error('Error sending team invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Accept team join request
app.post('/api/teams/requests/:requestId/accept', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    const request = await TeamJoinRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.toUserId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only accept requests sent to you' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is no longer pending' });
    }

    // Check if request has expired
    if (request.expiresAt && new Date() > new Date(request.expiresAt)) {
      request.status = 'expired';
      await request.save();
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    const team = await Team.findById(request.teamId);
    if (!team) {
      return res.status(404).json({ error: 'Team no longer exists' });
    }

    // Check if user is already in another team
    const existingTeam = await Team.findOne({
      eventId: request.eventId,
      $or: [
        { leaderId: userId },
        { 'members.userId': userId }
      ]
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'You are already part of a team for this event' });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is now full' });
    }

    // Add user to team
    team.members.push({
      userId,
      role: 'member',
      joinedAt: new Date()
    });
    team.updatedAt = new Date();

    // Check if team is now complete
    if (team.members.length === team.maxMembers) {
      team.status = 'complete';
    }

    await team.save();

    // Update request status
    request.status = 'accepted';
    request.respondedAt = new Date();
    await request.save();

    // Cancel any other pending requests for this user for this event
    await TeamJoinRequest.updateMany(
      { eventId: request.eventId, toUserId: userId, status: 'pending', _id: { $ne: requestId } },
      { status: 'cancelled' }
    );

    const event = await Event.findById(request.eventId);
    const user = await User.findById(userId);

    // Notify the team leader
    await notifyUser(
      req,
      team.leaderId,
      'team_invite_accepted',
      `${user.name} has joined your team "${team.name}"`,
      { 
        eventId: request.eventId, 
        teamId: team._id, 
        teamName: team.name, 
        eventTitle: event.title,
        relatedUser: userId
      }
    );

    // Notify other team members
    for (const member of team.members) {
      if (member.userId.toString() !== userId && member.userId.toString() !== team.leaderId.toString()) {
        await notifyUser(
          req,
          member.userId,
          'team_invite_accepted',
          `${user.name} has joined team "${team.name}"`,
          { eventId: request.eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
        );
      }
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({
      success: true,
      message: 'You have joined the team',
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error accepting team invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Reject team join request
app.post('/api/teams/requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    const request = await TeamJoinRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.toUserId.toString() !== userId) {
      return res.status(403).json({ error: 'You can only reject requests sent to you' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is no longer pending' });
    }

    request.status = 'rejected';
    request.respondedAt = new Date();
    await request.save();

    const team = await Team.findById(request.teamId);
    const user = await User.findById(userId);
    const event = await Event.findById(request.eventId);

    // Notify the team leader
    if (team) {
      await notifyUser(
        req,
        team.leaderId,
        'team_invite_rejected',
        `${user.name} has declined the invitation to join "${team.name}"`,
        { eventId: request.eventId, teamId: team._id, teamName: team.name, eventTitle: event?.title }
      );
    }

    res.json({
      success: true,
      message: 'Invitation rejected'
    });
  } catch (error) {
    console.error('Error rejecting team invitation:', error);
    res.status(500).json({ error: 'Failed to reject invitation' });
  }
});

// Cancel a sent invitation (by leader)
app.delete('/api/teams/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { userId } = req.body;

    const request = await TeamJoinRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only the sender (leader) can cancel
    if (request.fromUserId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the sender can cancel this invitation' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'This request is no longer pending' });
    }

    request.status = 'cancelled';
    await request.save();

    res.json({
      success: true,
      message: 'Invitation cancelled'
    });
  } catch (error) {
    console.error('Error cancelling invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// Remove a team member (by leader)
app.post('/api/events/:eventId/teams/:teamId/remove-member', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { leaderId, memberId } = req.body;

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if requester is the leader
    if (team.leaderId.toString() !== leaderId) {
      return res.status(403).json({ error: 'Only the team leader can remove members' });
    }

    // Can't remove yourself (leader)
    if (leaderId === memberId) {
      return res.status(400).json({ error: 'Team leader cannot be removed. Delete the team instead.' });
    }

    // Check registration deadline
    const event = await Event.findById(eventId);
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot modify team after registration deadline' });
    }

    // Check if member exists in team
    const memberIndex = team.members.findIndex(m => m.userId.toString() === memberId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found in team' });
    }

    // Remove member
    team.members.splice(memberIndex, 1);
    team.status = 'forming';
    team.updatedAt = new Date();
    await team.save();

    const removedUser = await User.findById(memberId);

    // Notify the removed member
    await notifyUser(
      req,
      memberId,
      'team_member_removed',
      `You have been removed from team "${team.name}" for "${event.title}"`,
      { eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
    );

    // Notify other team members
    for (const member of team.members) {
      if (member.userId.toString() !== leaderId) {
        await notifyUser(
          req,
          member.userId,
          'team_member_removed',
          `${removedUser.name} has been removed from team "${team.name}"`,
          { eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
        );
      }
    }

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({
      success: true,
      message: 'Member removed successfully',
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Leave team (by member)
app.post('/api/events/:eventId/teams/:teamId/leave', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { userId } = req.body;

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // If leader wants to leave, they must delete the team instead
    if (team.leaderId.toString() === userId) {
      return res.status(400).json({ error: 'Team leader cannot leave. Delete the team instead.' });
    }

    // Check if user is a member
    const memberIndex = team.members.findIndex(m => m.userId.toString() === userId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'You are not a member of this team' });
    }

    // Remove member
    team.members.splice(memberIndex, 1);
    team.status = 'forming';
    team.updatedAt = new Date();
    await team.save();

    const user = await User.findById(userId);
    const event = await Event.findById(eventId);

    // Notify team leader
    await notifyUser(
      req,
      team.leaderId,
      'team_member_left',
      `${user.name} has left your team "${team.name}"`,
      { eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
    );

    // Notify other members
    for (const member of team.members) {
      if (member.userId.toString() !== team.leaderId.toString()) {
        await notifyUser(
          req,
          member.userId,
          'team_member_left',
          `${user.name} has left team "${team.name}"`,
          { eventId, teamId: team._id, teamName: team.name, eventTitle: event.title }
        );
      }
    }

    res.json({
      success: true,
      message: 'You have left the team'
    });
  } catch (error) {
    console.error('Error leaving team:', error);
    res.status(500).json({ error: 'Failed to leave team' });
  }
});

// Delete team (by leader only)
app.delete('/api/events/:eventId/teams/:teamId', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { userId } = req.body;

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Only leader can delete
    if (team.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the team leader can delete the team' });
    }

    const event = await Event.findById(eventId);

    // Notify all members before deletion
    for (const member of team.members) {
      if (member.userId.toString() !== userId) {
        await notifyUser(
          req,
          member.userId,
          'team_disbanded',
          `Team "${team.name}" for "${event.title}" has been disbanded by the leader`,
          { eventId, teamName: team.name, eventTitle: event.title }
        );
      }
    }

    // Delete all pending requests for this team
    await TeamJoinRequest.deleteMany({ teamId });

    // Delete the team
    await Team.findByIdAndDelete(teamId);

    res.json({
      success: true,
      message: 'Team deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Get pending team invitations for a user
app.get('/api/users/:userId/team-invitations', async (req, res) => {
  try {
    const { userId } = req.params;
    const { eventId } = req.query;

    const query = { toUserId: userId, status: 'pending' };
    if (eventId) {
      query.eventId = eventId;
    }

    const invitations = await TeamJoinRequest.find(query)
      .populate({
        path: 'teamId',
        populate: [
          { path: 'leaderId', select: 'name email avatar' },
          { path: 'members.userId', select: 'name email avatar' }
        ]
      })
      .populate('eventId', 'title registrationDeadline image')
      .populate('fromUserId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invitations,
      count: invitations.length
    });
  } catch (error) {
    console.error('Error fetching team invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Search users for team invitation (excludes users already in a team for this event)
app.get('/api/events/:eventId/available-users', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { search, excludeUserId } = req.query;

    // Get all users who are already in a team for this event
    const teamsForEvent = await Team.find({ eventId });
    const usersInTeams = new Set();
    teamsForEvent.forEach(team => {
      usersInTeams.add(team.leaderId.toString());
      team.members.forEach(m => usersInTeams.add(m.userId.toString()));
    });

    // Get users with pending invitations for this event
    const pendingInvites = await TeamJoinRequest.find({ eventId, status: 'pending' });
    const usersWithPendingInvites = new Set(pendingInvites.map(r => r.toUserId.toString()));

    // Build search query
    const searchQuery = {
      _id: { $nin: [...usersInTeams, ...usersWithPendingInvites] }
    };

    if (excludeUserId) {
      searchQuery._id.$ne = excludeUserId;
    }

    if (search) {
      searchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { regId: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(searchQuery)
      .select('name email regId department section year avatar role')
      .limit(20)
      .sort({ name: 1 });

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error searching available users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Enhanced user search with registration status for team invitations
app.get('/api/events/:eventId/search-users-for-team', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { search, excludeUserId } = req.query;

    if (!search || search.trim().length < 2) {
      return res.json({ success: true, users: [], searchedEmail: null });
    }

    const searchTerm = search.trim();

    // Check if search is an email format
    const isEmailSearch = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(searchTerm);

    // Get event details for registration deadline
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all users who are already in a team for this event
    const teamsForEvent = await Team.find({ eventId });
    const usersInTeams = new Set();
    teamsForEvent.forEach(team => {
      usersInTeams.add(team.leaderId.toString());
      team.members.forEach(m => usersInTeams.add(m.userId.toString()));
    });

    // Get users with pending invitations for this event
    const pendingInvites = await TeamJoinRequest.find({ eventId, status: 'pending' });
    const usersWithPendingInvites = new Set(pendingInvites.map(r => r.toUserId.toString()));

    // Get pending token invitations
    const pendingTokenInvites = await TeamInvitationToken.find({ eventId, status: 'pending' });
    const emailsWithPendingTokenInvites = new Set(pendingTokenInvites.map(t => t.invitedEmail.toLowerCase()));

    // Get registrations for this event to check registration status
    const eventRegistrations = await Registration.find({ eventId });
    const registeredUserIds = new Set(eventRegistrations.map(r => r.userId.toString()));

    // Search for users
    const userSearchQuery = {
      _id: { $nin: [...usersInTeams, ...usersWithPendingInvites] }
    };

    if (excludeUserId) {
      userSearchQuery._id.$nin = [...userSearchQuery._id.$nin, excludeUserId];
    }

    userSearchQuery.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { regId: { $regex: searchTerm, $options: 'i' } }
    ];

    const users = await User.find(userSearchQuery)
      .select('name email regId department section year avatar role')
      .limit(20)
      .sort({ name: 1 });

    // Add registration status to each user
    const usersWithStatus = users.map(user => {
      const userId = user._id.toString();
      const isRegisteredForEvent = registeredUserIds.has(userId);
      const hasPendingInvite = usersWithPendingInvites.has(userId) || emailsWithPendingTokenInvites.has(user.email.toLowerCase());
      
      return {
        ...user.toObject(),
        registrationStatus: isRegisteredForEvent ? 'registered' : 'platform_only',
        hasPendingInvite,
        canInvite: !hasPendingInvite
      };
    });

    // If email search and no user found, check if we should allow inviting non-platform user
    let nonPlatformInvite = null;
    if (isEmailSearch && users.length === 0) {
      // Check if email already has pending token invite
      const existingTokenInvite = emailsWithPendingTokenInvites.has(searchTerm.toLowerCase());
      
      nonPlatformInvite = {
        email: searchTerm,
        registrationStatus: 'not_on_platform',
        hasPendingInvite: existingTokenInvite,
        canInvite: !existingTokenInvite
      };
    }

    res.json({
      success: true,
      users: usersWithStatus,
      nonPlatformInvite,
      searchedEmail: isEmailSearch ? searchTerm : null
    });
  } catch (error) {
    console.error('Error searching users for team:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get pending team invitations for the current user for an event
app.get('/api/events/:eventId/my-team-invitations', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find pending team join requests for this user and event
    const pendingRequests = await TeamJoinRequest.find({
      userId: userId,
      eventId: eventId,
      status: 'pending',
      type: 'invitation' // Only get invitations, not join requests
    }).populate('teamId');
    
    // Also check for token-based invitations by email
    const tokenInvites = await TeamInvitationToken.find({
      eventId: eventId,
      invitedEmail: user.email.toLowerCase(),
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    // Build invitation list with team details
    const invitations = [];
    
    // Process TeamJoinRequest invitations
    for (const request of pendingRequests) {
      if (!request.teamId) continue;
      
      const team = await Team.findById(request.teamId._id)
        .populate('leaderId', 'name email')
        .populate('members.userId', 'name email');
      
      if (!team) continue;
      
      const inviter = await User.findById(request.fromUserId).select('name email');
      
      invitations.push({
        _id: request._id,
        type: 'join_request',
        teamId: team._id,
        teamName: team.name,
        invitedBy: inviter || { name: 'Unknown', email: '' },
        status: request.status,
        expiresAt: request.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        members: team.members.map(m => ({
          userId: m.userId,
          role: m.role
        })),
        maxSize: team.maxSize
      });
    }
    
    // Process token-based invitations
    for (const tokenInvite of tokenInvites) {
      const team = await Team.findById(tokenInvite.teamId)
        .populate('leaderId', 'name email')
        .populate('members.userId', 'name email');
      
      if (!team) continue;
      
      const inviter = await User.findById(tokenInvite.invitedBy).select('name email');
      
      invitations.push({
        _id: tokenInvite._id,
        type: 'token_invite',
        teamId: team._id,
        teamName: team.name,
        invitedBy: inviter || { name: 'Unknown', email: '' },
        status: tokenInvite.status,
        expiresAt: tokenInvite.expiresAt,
        members: team.members.map(m => ({
          userId: m.userId,
          role: m.role
        })),
        maxSize: team.maxSize
      });
    }
    
    res.json({
      success: true,
      invitations
    });
  } catch (error) {
    console.error('Error fetching team invitations:', error);
    res.status(500).json({ error: 'Failed to fetch team invitations' });
  }
});

// Accept team invitation (for join requests)
app.post('/api/team-invitations/:invitationId/accept', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // First check if it's a TeamJoinRequest invitation
    let request = await TeamJoinRequest.findById(invitationId);
    
    if (request) {
      // This is a TeamJoinRequest invitation
      if (request.userId.toString() !== userId) {
        return res.status(403).json({ error: 'This invitation is not for you' });
      }
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'This invitation is no longer pending' });
      }
      
      const team = await Team.findById(request.teamId);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      // Check if team is full
      if (team.members.length >= team.maxSize) {
        request.status = 'rejected';
        await request.save();
        return res.status(400).json({ error: 'Team is already full' });
      }
      
      // Check if user is already in team
      const alreadyMember = team.members.some(m => 
        m.userId && m.userId.toString() === userId
      );
      if (alreadyMember) {
        request.status = 'accepted';
        await request.save();
        return res.json({ success: true, message: 'You are already in this team' });
      }
      
      // Add user to team
      team.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });
      await team.save();
      
      // Update request status
      request.status = 'accepted';
      await request.save();
      
      // Notify team leader
      notifyUser(
        req,
        team.leaderId,
        'team_member_joined',
        `${user.name} has accepted your invitation and joined team "${team.name}"`,
        { teamId: team._id, teamName: team.name, eventId: team.eventId }
      ).catch(err => console.error('Notification error:', err.message));
      
      return res.json({ success: true, message: 'Successfully joined the team!' });
    }
    
    // Check if it's a token invitation
    const tokenInvite = await TeamInvitationToken.findById(invitationId);
    
    if (tokenInvite) {
      if (tokenInvite.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(403).json({ error: 'This invitation is not for you' });
      }
      
      if (tokenInvite.status !== 'pending') {
        return res.status(400).json({ error: 'This invitation is no longer pending' });
      }
      
      if (new Date() > new Date(tokenInvite.expiresAt)) {
        tokenInvite.status = 'expired';
        await tokenInvite.save();
        return res.status(400).json({ error: 'This invitation has expired' });
      }
      
      const team = await Team.findById(tokenInvite.teamId);
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      
      // Check if team is full
      if (team.members.length >= team.maxSize) {
        tokenInvite.status = 'expired';
        await tokenInvite.save();
        return res.status(400).json({ error: 'Team is already full' });
      }
      
      // Check if user is already in team
      const alreadyMember = team.members.some(m => 
        m.userId && m.userId.toString() === userId
      );
      if (alreadyMember) {
        tokenInvite.status = 'accepted';
        tokenInvite.acceptedBy = userId;
        await tokenInvite.save();
        return res.json({ success: true, message: 'You are already in this team' });
      }
      
      // Add user to team
      team.members.push({
        userId: userId,
        role: 'member',
        joinedAt: new Date()
      });
      await team.save();
      
      // Update token status
      tokenInvite.status = 'accepted';
      tokenInvite.acceptedBy = userId;
      await tokenInvite.save();
      
      // Notify team leader
      notifyUser(
        req,
        team.leaderId,
        'team_member_joined',
        `${user.name} has accepted your invitation and joined team "${team.name}"`,
        { teamId: team._id, teamName: team.name, eventId: team.eventId }
      ).catch(err => console.error('Notification error:', err.message));
      
      return res.json({ success: true, message: 'Successfully joined the team!' });
    }
    
    return res.status(404).json({ error: 'Invitation not found' });
  } catch (error) {
    console.error('Error accepting team invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Decline team invitation
app.post('/api/team-invitations/:invitationId/decline', async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // First check if it's a TeamJoinRequest invitation
    let request = await TeamJoinRequest.findById(invitationId);
    
    if (request) {
      if (request.userId.toString() !== userId) {
        return res.status(403).json({ error: 'This invitation is not for you' });
      }
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'This invitation is no longer pending' });
      }
      
      request.status = 'rejected';
      await request.save();
      
      // Optionally notify team leader
      const team = await Team.findById(request.teamId);
      if (team) {
        notifyUser(
          req,
          team.leaderId,
          'team_invitation_declined',
          `${user.name} has declined your invitation to join team "${team.name}"`,
          { teamId: team._id, teamName: team.name, eventId: team.eventId }
        ).catch(err => console.error('Notification error:', err.message));
      }
      
      return res.json({ success: true, message: 'Invitation declined' });
    }
    
    // Check if it's a token invitation
    const tokenInvite = await TeamInvitationToken.findById(invitationId);
    
    if (tokenInvite) {
      if (tokenInvite.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(403).json({ error: 'This invitation is not for you' });
      }
      
      if (tokenInvite.status !== 'pending') {
        return res.status(400).json({ error: 'This invitation is no longer pending' });
      }
      
      tokenInvite.status = 'rejected';
      await tokenInvite.save();
      
      // Optionally notify team leader
      const team = await Team.findById(tokenInvite.teamId);
      if (team) {
        notifyUser(
          req,
          team.leaderId,
          'team_invitation_declined',
          `${user.name} has declined your invitation to join team "${team.name}"`,
          { teamId: team._id, teamName: team.name, eventId: team.eventId }
        ).catch(err => console.error('Notification error:', err.message));
      }
      
      return res.json({ success: true, message: 'Invitation declined' });
    }
    
    return res.status(404).json({ error: 'Invitation not found' });
  } catch (error) {
    console.error('Error declining team invitation:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// Send invitation to platform user who is NOT registered for the event
app.post('/api/events/:eventId/teams/:teamId/invite-to-event', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { fromUserId, toUserId, message } = req.body;

    if (!fromUserId || !toUserId) {
      return res.status(400).json({ error: 'Both sender and recipient user IDs are required' });
    }

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if sender is the leader
    if (team.leaderId.toString() !== fromUserId) {
      return res.status(403).json({ error: 'Only the team leader can send invitations' });
    }

    // Check registration deadline
    const event = await Event.findById(eventId);
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot invite members after registration deadline' });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is already full' });
    }

    // Check if target user exists
    const toUser = await User.findById(toUserId);
    if (!toUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already registered for the event
    const existingRegistration = await Registration.findOne({ eventId, userId: toUserId });
    if (existingRegistration) {
      return res.status(400).json({ error: 'This user is already registered for the event. Use regular invite instead.' });
    }

    // Check if target user is already in a team for this event
    const userExistingTeam = await Team.findOne({
      eventId,
      $or: [
        { leaderId: toUserId },
        { 'members.userId': toUserId }
      ]
    });
    if (userExistingTeam) {
      return res.status(400).json({ error: 'This user is already part of a team for this event' });
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');

    // Create the invitation token
    const invitationToken = new TeamInvitationToken({
      token,
      teamId,
      eventId,
      invitedBy: fromUserId,
      invitedEmail: toUser.email,
      inviteType: 'platform_user',
      status: 'pending',
      message,
      expiresAt: event.registrationDeadline
    });

    await invitationToken.save();

    const leader = await User.findById(fromUserId);

    // Notify the target user
    await notifyUser(
      req,
      toUserId,
      'team_invite',
      `🎯 ${leader.name} invited you to join team "${team.name}" for "${event.title}". Register for the event to accept!`,
      buildNotificationData(event, { 
        teamId: team._id, 
        teamName: team.name, 
        invitationToken: token,
        relatedUser: fromUserId,
        requiresEventRegistration: true
      })
    );

    // Send email notification
    try {
      const teamInviteEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Team Invitation</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi ${toUser.name},
            </p>
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              <strong>${leader.name}</strong> has invited you to join team <strong>"${team.name}"</strong> for the event <strong>"${event.title}"</strong>.
            </p>
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #7c3aed; margin: 0 0 10px 0;">Next Steps:</h3>
              <ol style="color: #374151; margin: 0; padding-left: 20px;">
                <li>Register for the event "${event.title}"</li>
                <li>Once registered, you'll automatically join team "${team.name}"</li>
              </ol>
            </div>
            ${message ? `<p style="font-style: italic; color: #6b7280; background: #f3e8ff; padding: 15px; border-radius: 8px;">"${message}"</p>` : ''}
            <p style="font-size: 14px; color: #9ca3af; margin-top: 20px;">
              This invitation expires on ${new Date(event.registrationDeadline).toLocaleDateString()}.
            </p>
          </div>
        </div>
      `;

      await sendEmail(toUser.email, `Team Invitation: ${team.name} - ${event.title}`, teamInviteEmailHtml);
    } catch (emailError) {
      console.error('Error sending team invite email:', emailError);
    }

    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully. The user will auto-join your team when they register for the event.',
      invitationToken: invitationToken._id
    });
  } catch (error) {
    console.error('Error sending event invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Send invitation to non-platform user (by email)
app.post('/api/events/:eventId/teams/:teamId/invite-by-email', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;
    const { fromUserId, email, message } = req.body;

    if (!fromUserId || !email) {
      return res.status(400).json({ error: 'Sender ID and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const team = await Team.findOne({ _id: teamId, eventId });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Check if sender is the leader
    if (team.leaderId.toString() !== fromUserId) {
      return res.status(403).json({ error: 'Only the team leader can send invitations' });
    }

    // Check registration deadline
    const event = await Event.findById(eventId);
    if (new Date() > new Date(event.registrationDeadline)) {
      return res.status(400).json({ error: 'Cannot invite members after registration deadline' });
    }

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'Team is already full' });
    }

    // Check if user with this email exists on platform
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'This email belongs to a registered user. Please search for them by name or email instead.',
        userId: existingUser._id
      });
    }

    // Check if there's already a pending invitation for this email
    const existingInvite = await TeamInvitationToken.findOne({
      eventId,
      invitedEmail: email.toLowerCase(),
      status: 'pending'
    });
    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation is already pending for this email' });
    }

    // Generate unique token
    const token = require('crypto').randomBytes(32).toString('hex');

    // Create the invitation token
    const invitationToken = new TeamInvitationToken({
      token,
      teamId,
      eventId,
      invitedBy: fromUserId,
      invitedEmail: email.toLowerCase(),
      inviteType: 'non_platform',
      status: 'pending',
      message,
      expiresAt: event.registrationDeadline
    });

    await invitationToken.save();

    const leader = await User.findById(fromUserId);
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join-team/${token}`;

    // Send email invitation
    try {
      const inviteEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px; border-radius: 16px 16px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 You're Invited!</h1>
          </div>
          <div style="background: #f8fafc; padding: 30px; border-radius: 0 0 16px 16px;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              Hi there,
            </p>
            <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
              <strong>${leader.name}</strong> has invited you to join team <strong>"${team.name}"</strong> for the event <strong>"${event.title}"</strong> on EventHub!
            </p>
            
            <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #7c3aed; margin: 0 0 15px 0;">📅 Event Details</h3>
              <p style="margin: 5px 0; color: #374151;"><strong>Event:</strong> ${event.title}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Team:</strong> ${team.name}</p>
              <p style="margin: 5px 0; color: #374151;"><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</p>
              ${event.venue ? `<p style="margin: 5px 0; color: #374151;"><strong>Venue:</strong> ${event.venue}</p>` : ''}
            </div>
            
            ${message ? `<p style="font-style: italic; color: #6b7280; background: #f3e8ff; padding: 15px; border-radius: 8px; margin: 20px 0;">"${message}"</p>` : ''}
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); color: white; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Accept Invitation & Register
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              Click the button above to create your account and join the team automatically.
            </p>
            <p style="font-size: 14px; color: #9ca3af; margin-top: 10px;">
              This invitation expires on ${new Date(event.registrationDeadline).toLocaleDateString()}.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #9ca3af;">
              If the button doesn't work, copy and paste this link: ${inviteLink}
            </p>
          </div>
        </div>
      `;

      await sendEmail(email, `You're Invited to Join Team "${team.name}" - ${event.title}`, inviteEmailHtml);
    } catch (emailError) {
      console.error('Error sending invite email:', emailError);
      // Continue anyway - invitation is created
    }

    res.status(201).json({
      success: true,
      message: `Invitation email sent to ${email}. They will need to register on the platform and for the event.`,
      invitationToken: invitationToken._id
    });
  } catch (error) {
    console.error('Error sending email invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get pending token invitations for a team (leader view)
app.get('/api/events/:eventId/teams/:teamId/token-invites', async (req, res) => {
  try {
    const { eventId, teamId } = req.params;

    const invitations = await TeamInvitationToken.find({
      teamId,
      eventId,
      status: 'pending'
    })
      .populate('invitedBy', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invitations
    });
  } catch (error) {
    console.error('Error fetching token invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Cancel a token invitation
app.delete('/api/teams/token-invites/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { userId } = req.body;

    const invitation = await TeamInvitationToken.findById(tokenId).populate('teamId');
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if requester is the team leader
    if (invitation.teamId.leaderId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the team leader can cancel invitations' });
    }

    invitation.status = 'cancelled';
    await invitation.save();

    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling token invitation:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// Validate invitation token (for join-team page)
app.get('/api/teams/validate-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const invitation = await TeamInvitationToken.findOne({ token })
      .populate('teamId', 'name members maxMembers status')
      .populate('eventId', 'title date venue registrationDeadline')
      .populate('invitedBy', 'name email avatar');

    if (!invitation) {
      return res.status(404).json({ 
        valid: false, 
        error: 'Invalid invitation link' 
      });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ 
        valid: false, 
        error: `This invitation has already been ${invitation.status}` 
      });
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ 
        valid: false, 
        error: 'This invitation has expired' 
      });
    }

    // Check if team is full
    if (invitation.teamId.members.length >= invitation.teamId.maxMembers) {
      return res.status(400).json({ 
        valid: false, 
        error: 'This team is already full' 
      });
    }

    res.json({
      valid: true,
      invitation: {
        _id: invitation._id,
        team: invitation.teamId,
        event: invitation.eventId,
        invitedBy: invitation.invitedBy,
        invitedEmail: invitation.invitedEmail,
        inviteType: invitation.inviteType,
        message: invitation.message,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Error validating token:', error);
    res.status(500).json({ valid: false, error: 'Failed to validate invitation' });
  }
});

// Accept invitation token (after user registers/logs in)
app.post('/api/teams/accept-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const invitation = await TeamInvitationToken.findOne({ token })
      .populate('teamId')
      .populate('eventId');

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `This invitation has already been ${invitation.status}` });
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    const team = invitation.teamId;
    const event = invitation.eventId;

    // Check if team is full
    if (team.members.length >= team.maxMembers) {
      return res.status(400).json({ error: 'This team is already full' });
    }

    // Check if user is already in a team for this event
    const existingTeam = await Team.findOne({
      eventId: event._id,
      $or: [
        { leaderId: userId },
        { 'members.userId': userId }
      ]
    });
    if (existingTeam) {
      return res.status(400).json({ error: 'You are already part of a team for this event' });
    }

    // Check if user is registered for the event
    const registration = await Registration.findOne({ eventId: event._id, userId });
    if (!registration) {
      return res.status(400).json({ 
        error: 'You must register for the event first before joining a team',
        requiresEventRegistration: true,
        eventId: event._id
      });
    }

    // Add user to team
    team.members.push({
      userId,
      role: 'member',
      joinedAt: new Date()
    });

    // Update team status if full
    if (team.members.length >= team.maxMembers) {
      team.status = 'complete';
    }

    team.updatedAt = new Date();
    await team.save();

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedBy = userId;
    await invitation.save();

    // Notify team leader
    const acceptingUser = await User.findById(userId);
    await notifyUser(
      req,
      team.leaderId,
      'team_invite_accepted',
      `✅ ${acceptingUser.name} has accepted your invitation and joined team "${team.name}"`,
      buildNotificationData(event, { 
        teamId: team._id, 
        teamName: team.name,
        relatedUser: userId
      })
    );

    const populatedTeam = await Team.findById(team._id)
      .populate('leaderId', 'name email regId department section year avatar')
      .populate('members.userId', 'name email regId department section year avatar');

    res.json({
      success: true,
      message: `Successfully joined team "${team.name}"`,
      team: populatedTeam
    });
  } catch (error) {
    console.error('Error accepting token invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Auto-process token invitations when user registers for an event
// This should be called after successful event registration
app.post('/api/events/:eventId/process-pending-invites', async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, userEmail } = req.body;

    // Find any pending token invitations for this user's email and event
    const pendingInvites = await TeamInvitationToken.find({
      eventId,
      invitedEmail: userEmail.toLowerCase(),
      status: 'pending'
    }).populate('teamId');

    const processedInvites = [];

    for (const invite of pendingInvites) {
      const team = invite.teamId;
      
      // Check if team is full
      if (team.members.length >= team.maxMembers) {
        invite.status = 'expired';
        await invite.save();
        continue;
      }

      // Check if user is already in a team
      const existingTeam = await Team.findOne({
        eventId,
        $or: [
          { leaderId: userId },
          { 'members.userId': userId }
        ]
      });
      if (existingTeam) {
        continue;
      }

      // Add user to team
      team.members.push({
        userId,
        role: 'member',
        joinedAt: new Date()
      });

      if (team.members.length >= team.maxMembers) {
        team.status = 'complete';
      }

      team.updatedAt = new Date();
      await team.save();

      // Update invitation
      invite.status = 'accepted';
      invite.acceptedBy = userId;
      await invite.save();

      // Notify team leader
      const user = await User.findById(userId);
      const event = await Event.findById(eventId);
      await notifyUser(
        req,
        team.leaderId,
        'team_invite_accepted',
        `✅ ${user.name} has registered and automatically joined team "${team.name}"`,
        buildNotificationData(event, { 
          teamId: team._id, 
          teamName: team.name,
          relatedUser: userId
        })
      );

      processedInvites.push({
        teamId: team._id,
        teamName: team.name
      });

      // Only join one team
      break;
    }

    res.json({
      success: true,
      processedInvites,
      joinedTeam: processedInvites.length > 0 ? processedInvites[0] : null
    });
  } catch (error) {
    console.error('Error processing pending invites:', error);
    res.status(500).json({ error: 'Failed to process pending invites' });
  }
});

// ================================
// END TEAM MANAGEMENT API ENDPOINTS
// ================================

// Admin endpoint for rate limit stats
app.get('/api/admin/rate-limits', (req, res) => {
  res.json(getRateLimitStats());
});

// Admin endpoint for error stats
app.get('/api/admin/errors', (req, res) => {
  res.json(getErrorStats());
});

// ==================== STATIC FILES & SPA FALLBACK ====================
// Serve static files from the built frontend
const frontendPath = path.join(__dirname, '../dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
  
  // SPA fallback: serve index.html for all non-API routes
  // This allows React Router to handle client-side routing
  // IMPORTANT: Only match routes that don't start with /api
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: true, message: 'Route not found: ' + req.method + ' ' + req.path });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  logger.warn('⚠️ Frontend dist folder not found at', frontendPath, '- SPA routes will not work');
}

// 404 handler for unknown routes (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Start server - bind to 0.0.0.0 to allow network access
const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0'; // Listen on all network interfaces
server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT} (accessible on LAN)\n`);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n⚠️ ${signal} received. Starting graceful shutdown...`);
  
  try {
    // Close server
    server.close(() => {
      console.log('✅ HTTP server closed');
    });
    
    // Close database connection
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    
    // Shutdown mail system
    await shutdownMailSystem();
    console.log('✅ Mail system shutdown');
    
    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  
  await sendAlert({
    type: 'uncaught_exception',
    severity: 'critical',
    message: `Uncaught exception: ${error.message}`,
    details: { stack: error.stack },
    suggestedAction: 'Review error and restart server if necessary.',
    skipCooldown: true,
  });
  
  // Exit with error code
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  
  await sendAlert({
    type: 'unhandled_rejection',
    severity: 'critical',
    message: `Unhandled promise rejection: ${reason}`,
    details: { reason: String(reason) },
    suggestedAction: 'Review the code for unhandled promise rejections.',
    skipCooldown: true,
  });
});

// Automatic year update scheduler
// Runs daily at midnight to check if students' years need to be updated
setInterval(async () => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // Run updates on July 1st (start of new academic year)
    if (currentMonth === 7 && currentDay === 1) {
      console.log('🎓 Running automatic year update for all students...');
      
      // Find all students with admission data
      const students = await User.find({ 
        role: 'student',
        admissionMonth: { $exists: true },
        admissionYear: { $exists: true }
      });
      
      let updatedCount = 0;
      
      for (const student of students) {
        const newYear = calculateCurrentYear(student.admissionMonth, student.admissionYear);
        
        if (student.year !== newYear) {
          student.year = newYear;
          await student.save();
          updatedCount++;
          console.log(`Updated ${student.name} (${student.email}) to year ${newYear}`);
        }
      }
      
      console.log(`✅ Automatic year update complete. Updated ${updatedCount} student(s).`);
    }
  } catch (error) {
    console.error('❌ Error in automatic year update:', error);
  }
}, 24 * 60 * 60 * 1000); // Run once per day (24 hours)

console.log('⏰ Automatic year update scheduler initialized (runs daily at midnight)');
