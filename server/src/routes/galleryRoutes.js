import express from 'express';
import * as galleryController from '../controllers/galleryController.js';
import { authenticateToken, authorizeRole, optionalAuth } from '../middleware/auth.js';
import { galleryUpload } from '../utils/galleryUpload.js';
import { routeCache, serverCache, invalidateCache } from '../middleware/cacheMiddleware.js';

const router = express.Router();

/**
 * Gallery Routes
 * 
 * Public routes:
 * - GET /api/gallery - List published galleries
 * - GET /api/gallery/media/:fileName - Serve media file
 * - GET /api/gallery/:eventId - Get event gallery (public for published)
 * 
 * Protected routes (Admin/Organizer):
 * - POST /api/gallery/:eventId/upload - Upload media
 * - DELETE /api/gallery/media/:mediaId - Delete media
 * - PATCH /api/gallery/:eventId/reorder - Reorder media
 * - PATCH /api/gallery/:eventId/cover - Set cover image
 * - PATCH /api/gallery/:eventId/publish - Publish/unpublish
 * - GET /api/gallery/:eventId/manage - Get management data
 */

// ==================== PUBLIC ROUTES ====================

/**
 * List galleries - with caching
 * GET /api/gallery
 * Uses optionalAuth - shows all galleries to admin/organizers, only published to others
 */
router.get('/', optionalAuth, routeCache.publicGalleries, galleryController.listPublishedGalleries);

/**
 * Serve media file from MongoDB
 * GET /api/gallery/media/:fileName
 * 
 * IMPORTANT: This must come BEFORE /:eventId to avoid matching 'media' as eventId
 */
router.get('/media/:fileName', galleryController.serveMedia);

/**
 * Get sub-event galleries for a main event
 * GET /api/gallery/:eventId/sub-events
 * Uses optionalAuth to check if user is logged in but doesn't require it
 */
router.get('/:eventId/sub-events', optionalAuth, galleryController.getSubEventGalleries);

/**
 * Get event gallery (public for published galleries) - with caching
 * GET /api/gallery/:eventId
 * Uses optionalAuth to check if user is logged in but doesn't require it
 */
router.get('/:eventId', optionalAuth, routeCache.galleryDetail, galleryController.getEventGallery);

// ==================== PROTECTED ROUTES ====================

/**
 * Create gallery for an event (if doesn't exist)
 * POST /api/gallery/:eventId/create
 * 
 * Used for events created before gallery integration
 * Creates an unpublished gallery ready for media uploads
 */
router.post(
  '/:eventId/create',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.createGalleryEndpoint
);

/**
 * Upload media to gallery
 * POST /api/gallery/:eventId/upload
 * 
 * Request:
 *   - Multipart form with files
 *   - Field 'mediaType' can specify 'image' or 'video'
 * 
 * Response:
 *   - Array of uploaded media objects
 * 
 * Note: Extended timeout for large video uploads (up to 15 minutes)
 */
router.post(
  '/:eventId/upload',
  // Extend request timeout for this specific route (15 minutes)
  (req, res, next) => {
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes
    next();
  },
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryUpload.array('files', 10),
  galleryController.uploadMedia
);

/**
 * FAST STREAMING UPLOAD - Bypasses memory buffering for faster uploads
 * POST /api/gallery/:eventId/upload-stream
 * 
 * Use this endpoint for large files (videos). It streams directly to MongoDB
 * without loading the entire file into memory first, resulting in:\n * - 2-3x faster upload speeds\n * - Lower memory usage\n * - Better handling of large files\n * \n * Request:\n *   - Multipart form with files (field name: 'files')\n * \n * Response:\n *   - Array of uploaded media objects\n */
router.post(
  '/:eventId/upload-stream',
  // Extend request timeout for streaming uploads (15 minutes)
  (req, res, next) => {
    req.setTimeout(15 * 60 * 1000);
    res.setTimeout(15 * 60 * 1000);
    next();
  },
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  // NO multer middleware - busboy handles streaming directly in the controller
  galleryController.uploadMediaStream
);

// ==================== CHUNKED UPLOAD ROUTES ====================
// For large video files that may timeout on Cloudflare (100s limit)

/**
 * Initialize chunked upload
 * POST /api/gallery/:eventId/upload-chunk/init
 */
router.post(
  '/:eventId/upload-chunk/init',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.initChunkedUpload
);

/**
 * Upload a chunk
 * POST /api/gallery/:eventId/upload-chunk/:uploadId/:chunkIndex
 */
router.post(
  '/:eventId/upload-chunk/:uploadId/:chunkIndex',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.uploadChunk
);

/**
 * Complete chunked upload
 * POST /api/gallery/:eventId/upload-chunk/:uploadId/complete
 */
router.post(
  '/:eventId/upload-chunk/:uploadId/complete',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.completeChunkedUpload
);

/**
 * Cancel chunked upload
 * DELETE /api/gallery/:eventId/upload-chunk/:uploadId
 */
router.delete(
  '/:eventId/upload-chunk/:uploadId',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.cancelChunkedUpload
);

/**
 * Delete media from gallery
 * DELETE /api/gallery/media/:mediaId
 */
router.delete(
  '/media/:mediaId',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.deleteMedia
);

/**
 * Reorder media in gallery
 * PATCH /api/gallery/:eventId/reorder
 * 
 * Request body:
 *   {
 *     "mediaOrder": ["id1", "id2", "id3"]
 *   }
 */
router.patch(
  '/:eventId/reorder',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.reorderMedia
);

/**
 * Set gallery cover image
 * PATCH /api/gallery/:eventId/cover
 * 
 * Request body:
 *   {
 *     "mediaId": "..."
 *   }
 */
router.patch(
  '/:eventId/cover',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.setCoverImage
);

/**
 * Publish or unpublish gallery
 * PATCH /api/gallery/:eventId/publish
 * 
 * Request body:
 *   {
 *     "published": true/false
 *   }
 */
router.patch(
  '/:eventId/publish',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.togglePublish
);

/**
 * Update gallery related details (event title/description or other settings)
 * PATCH /api/gallery/:eventId
 */
router.patch(
  '/:eventId',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.updateGallery
);

/**
 * Delete entire gallery and related media (admin and organizer)
 * DELETE /api/gallery/:eventId
 */
router.delete(
  '/:eventId',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.deleteGallery
);

/**
 * Get gallery management data
 * GET /api/gallery/:eventId/manage
 */
router.get(
  '/:eventId/manage',
  authenticateToken,
  authorizeRole('admin', 'organizer'),
  galleryController.getGalleryManagement
);

// ==================== CACHE MANAGEMENT ROUTES ====================

/**
 * Get cache statistics (admin only)
 * GET /api/gallery/cache/stats
 * 
 * Returns cache hit rate, size usage, and top cached items
 */
router.get(
  '/cache/stats',
  authenticateToken,
  authorizeRole('admin'),
  galleryController.getCacheStats
);

/**
 * Clear cache (admin only)
 * POST /api/gallery/cache/clear
 * 
 * Clears all cached media to free up memory
 */
router.post(
  '/cache/clear',
  authenticateToken,
  authorizeRole('admin'),
  galleryController.clearCache
);

export default router;