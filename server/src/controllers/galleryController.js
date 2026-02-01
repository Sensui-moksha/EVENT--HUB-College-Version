import mongoose from 'mongoose';
import Busboy from 'busboy';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Gallery from '../models/Gallery.js';
import GalleryMedia from '../models/GalleryMedia.js';
import { storageManager } from '../utils/galleryUpload.js';
import GalleryCacheManager from '../utils/galleryCacheManager.js';
import serverCache, { invalidateCache } from '../services/cacheService.js';
import mediaCacheService, { httpCacheHeaders } from '../services/mediaCacheService.js';
import logger from '../utils/logger.js';
import { 
  uploadToGridFS, 
  createUploadStream,
  downloadFromGridFS, 
  deleteFromGridFS,
  streamWithRange,
  getFileInfo,
  isGridFSAvailable 
} from '../utils/galleryGridFS.js';

// Lazy-load Event model (registered in main index.js)
const getEventModel = () => mongoose.model('Event');

// Initialize cache manager (100MB max in-memory cache) - Legacy, keeping for Base64 storage
const cacheManager = new GalleryCacheManager(100 * 1024 * 1024);

/**
 * Gallery Controller
 * 
 * Handles all gallery operations:
 * - Upload media to MongoDB
 * - Delete media from MongoDB
 * - Reorder media
 * - Set cover image
 * - Publish/unpublish gallery
 * - Retrieve gallery data (public and private)
 * - Serve media files from MongoDB (with caching)
 * 
 * Caching Strategy:
 * - In-memory cache for frequently accessed media (LRU eviction)
 * - HTTP Cache headers for browser/CDN caching  
 * - ETag support for conditional requests (304 Not Modified)
 * - GridFS streaming for large videos (no memory buffering)
 * 
 * Security: All operations enforce role-based access control
 */

// ==================== PUBLIC OPERATIONS ====================

/**
 * Serve media file from MongoDB with optimized caching
 * GET /api/gallery/media/:fileName
 * 
 * Features:
 * - ETag/Conditional requests (304 Not Modified)
 * - HTTP Cache headers for browser/CDN caching
 * - In-memory caching for hot content
 * - GridFS streaming for videos (range requests)
 * - Base64 fallback for legacy storage
 */
export const serveMedia = async (req, res) => {
  try {
    const { fileName } = req.params;

    // Check ETag for conditional request (304 Not Modified)
    const cachedETag = mediaCacheService.getETag(fileName);
    if (cachedETag && httpCacheHeaders.checkConditionalRequest(req, cachedETag)) {
      res.status(304);
      res.setHeader('ETag', cachedETag);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return res.end();
    }

    // Get media document (without file data for GridFS)
    const media = await GalleryMedia.findOne({ fileName }).select('-fileData');
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const isVideo = media.mimeType.startsWith('video');
    const range = req.headers.range;
    
    // ==================== GridFS Storage (New - Faster) ====================
    if (media.storageType === 'gridfs' && media.gridFSFileId) {
      try {
        const fileInfo = await getFileInfo(fileName);
        if (!fileInfo) {
          logger.production(`GridFS file not found for ${fileName}, checking Base64...`);
        } else {
          const fileSize = fileInfo.length;
          const etag = `"${fileName}-${fileSize}"`;
          
          // For videos, always handle range requests for smooth playback
          if (isVideo) {
            // Set video cache headers
            httpCacheHeaders.forVideo(res, etag);
            
            // Default chunk size for video buffering (2MB chunks for smooth ahead-loading)
            const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB - optimal for streaming
            
            let start = 0;
            let end = fileSize - 1;
            
            if (range) {
              // Parse range header: "bytes=start-end"
              const parts = range.replace(/bytes=/, '').split('-');
              start = parseInt(parts[0], 10);
              // If end is not specified, serve a chunk (enables ahead-loading)
              end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
            } else {
              // No range requested - serve first chunk to start buffering quickly
              end = Math.min(CHUNK_SIZE - 1, fileSize - 1);
            }
            
            // Ensure valid range
            start = Math.max(0, start);
            end = Math.min(end, fileSize - 1);
            const contentLength = end - start + 1;
            
            // Stream the requested range
            const streamData = await streamWithRange(fileName, { start, end });
            
            // HTTP 206 Partial Content for range requests (enables seeking & buffering)
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Length', contentLength);
            res.setHeader('Content-Type', media.mimeType);
            
            // ETag for this specific range
            res.setHeader('ETag', `"${fileName}-${start}-${end}"`);
            res.setHeader('X-Storage', 'GridFS');
            res.setHeader('X-Content-Duration', media.duration || '');
            res.setHeader('X-Cache', 'STREAM');
            
            // CORS headers for video players
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Range');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, X-Cache');
            
            // CDN caching hints
            res.setHeader('CDN-Cache-Control', 'public, max-age=2592000');
            res.setHeader('Cloudflare-CDN-Cache-Control', 'public, max-age=2592000');
            
            // Timing headers for debugging
            res.setHeader('X-Chunk-Size', CHUNK_SIZE);
            res.setHeader('X-Served-Range', `${start}-${end}`);
            
            streamData.stream.on('error', (err) => {
              console.error('Video stream error:', err);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream video' });
              }
            });
            
            streamData.stream.pipe(res);
            return;
          }
          
          // For images - serve with aggressive caching
          // Set image cache headers (7 days, immutable)
          httpCacheHeaders.forImage(res, etag);
          
          res.setHeader('Content-Type', media.mimeType);
          res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', fileSize);
          res.setHeader('X-Storage', 'GridFS');
          res.setHeader('X-Cache', 'STREAM');
          
          const downloadStream = downloadFromGridFS(fileName);
          downloadStream.on('error', (err) => {
            console.error('GridFS stream error:', err);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to stream media' });
            }
          });
          
          downloadStream.pipe(res);
          return;
        }
      } catch (gridfsError) {
        logger.production(`GridFS error for ${fileName}, falling back to Base64:`, gridfsError.message);
        // Fall through to Base64 handling
      }
    }
    
    // ==================== Base64 Storage (Legacy) ====================
    // Check cache first
    let cachedBuffer = cacheManager.get(fileName);

    if (cachedBuffer) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Storage', 'Base64');
    } else {
      // Fetch full document with fileData
      const fullMedia = await GalleryMedia.findOne({ fileName });
      if (!fullMedia || !fullMedia.fileData) {
        return res.status(404).json({ error: 'Media file data not found' });
      }

      // Convert Base64 back to Buffer
      cachedBuffer = storageManager.base64ToFile(fullMedia.fileData);

      // Store in cache for next request
      cacheManager.set(fileName, cachedBuffer, { mimeType: media.mimeType });
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Storage', 'Base64');
    }

    const fileSize = cachedBuffer.length;
    
    // Handle video streaming with chunked responses for smooth playback
    if (isVideo) {
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
      
      let start = 0;
      let end = fileSize - 1;
      
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + CHUNK_SIZE - 1, fileSize - 1);
      } else {
        // No range - serve first chunk for quick start
        end = Math.min(CHUNK_SIZE - 1, fileSize - 1);
      }
      
      // Ensure valid range
      start = Math.max(0, start);
      end = Math.min(end, fileSize - 1);
      const contentLength = end - start + 1;
      
      const chunk = cachedBuffer.slice(start, end + 1);
      
      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', contentLength);
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('ETag', `"${fileName}-${start}-${end}"`);
      
      // CORS headers for video players
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Range');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
      
      return res.send(chunk);
    }

    // Set response headers for full file (images)
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', `"${fileName}"`);

    // Send file
    res.send(cachedBuffer);
  } catch (error) {
    console.error('Error serving media:', error);
    res.status(500).json({ error: 'Failed to serve media' });
  }
};

/**
 * Get gallery for an event (public)
 * Returns published galleries or galleries for authenticated admin/organizer
 */
export const getEventGallery = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // Get event and gallery
    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let gallery = await Gallery.findOne({ eventId });
    if (!gallery) {
      // Auto-create gallery for this event
      gallery = new Gallery({
        eventId,
        folderPath: `mongodb://gallery/${eventId}`,
        published: false
      });
      await gallery.save();
    }

    // Check authorization - unpublished galleries can only be viewed by admin/organizer or event creator
    if (!gallery.published) {
      // Debug logging
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Gallery Auth] Unpublished gallery access attempt');
        console.log('[Gallery Auth] User ID:', userId || 'guest');
        console.log('[Gallery Auth] User Role:', userRole || 'guest');
        console.log('[Gallery Auth] Event Creator:', event.createdBy?.toString() || 'none');
      }
      
      // Guest users (no userId) cannot view unpublished galleries
      if (!userId) {
        return res.status(403).json({ error: 'Gallery not published' });
      }
      
      // Check if user has permission
      const isAdmin = userRole === 'admin' || userRole === 'organizer';
      const isEventOrganizer = event.createdBy && event.createdBy.toString() === userId.toString();
      
      if (!isAdmin && !isEventOrganizer) {
        return res.status(403).json({ error: 'Gallery not published' });
      }
    }

    // Get media items
    const media = await GalleryMedia.find({ galleryId: gallery._id })
      .sort({ order: 1 })
      .select('fileName filePath publicUrl thumbnailUrl type dimensions duration uploadedAt');

    // Get cover image if set
    let coverImage = null;
    if (gallery.coverMediaId) {
      coverImage = await GalleryMedia.findById(gallery.coverMediaId)
        .select('publicUrl thumbnailUrl');
    }

    res.json({
      gallery: {
        id: gallery._id,
        eventId: gallery.eventId,
        published: gallery.published,
        mediaCount: media.length,
        coverImage
      },
      media,
      event: {
        id: event._id,
        title: event.title,
        description: event.description
      }
    });
  } catch (error) {
    console.error('Error fetching gallery:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
};

/**
 * List galleries (for /gallery page)
 * Shows all published galleries for everyone
 * Shows all galleries (including unpublished) for admin/organizers
 * Includes sub-event galleries grouped under main events
 */
export const listPublishedGalleries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Check if user is admin/organizer (they can see all galleries)
    const userRole = req.user?.role;
    const isAdminOrOrganizer = userRole === 'admin' || userRole === 'organizer';
    
    // Build query - admin/organizers see all, others see only published
    // Only show main event galleries (subEventId is null)
    const query = isAdminOrOrganizer 
      ? { subEventId: null } 
      : { published: true, subEventId: null };
    
    // Debug logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Gallery List] User role:', userRole || 'guest');
      console.log('[Gallery List] Query:', JSON.stringify(query));
    }

    // Get main event galleries with event info
    const galleries = await Gallery.find(query)
      .populate({
        path: 'eventId',
        select: 'title description image coverImage location status'
      })
      .populate('coverMediaId', 'publicUrl thumbnailUrl fileName')
      .skip(skip)
      .limit(limit)
      .sort({ updatedAt: -1 });

    // Get sub-event gallery counts for each main event
    const eventIds = galleries.map(g => g.eventId?._id).filter(Boolean);
    
    // Count sub-event galleries per main event
    const subEventCounts = await Gallery.aggregate([
      { 
        $match: { 
          eventId: { $in: eventIds },
          subEventId: { $ne: null },
          ...(isAdminOrOrganizer ? {} : { published: true })
        } 
      },
      { 
        $group: { 
          _id: '$eventId', 
          count: { $sum: 1 },
          totalMedia: { $sum: '$mediaCount' }
        } 
      }
    ]);
    
    // Create a lookup map
    const subEventCountMap = {};
    subEventCounts.forEach(item => {
      subEventCountMap[item._id.toString()] = {
        count: item.count,
        totalMedia: item.totalMedia
      };
    });

    // Filter out galleries where event was deleted
    const filteredGalleries = galleries
      .filter(g => g.eventId)
      .map(g => {
        // Use gallery cover image, or fall back to event image
        let coverImage = g.coverMediaId;
        if (!coverImage && g.eventId.image) {
          coverImage = { publicUrl: g.eventId.image };
        }
        
        const eventIdStr = g.eventId._id.toString();
        const subEventInfo = subEventCountMap[eventIdStr] || { count: 0, totalMedia: 0 };
        
        return {
          id: g._id,
          eventId: g.eventId._id,
          eventTitle: g.eventId.title,
          eventDescription: g.eventId.description,
          mediaCount: g.mediaCount,
          coverImage,
          published: g.published,  // Include publish status for admin view
          subEventGalleryCount: subEventInfo.count,
          subEventMediaCount: subEventInfo.totalMedia
        };
      });

    const total = await Gallery.countDocuments(query);
    
    // Debug logging to help troubleshoot
    if (process.env.NODE_ENV !== 'production') {
      const totalGalleries = await Gallery.countDocuments({ subEventId: null });
      const publishedGalleries = await Gallery.countDocuments({ published: true, subEventId: null });
      console.log('[Gallery List] Total galleries:', totalGalleries);
      console.log('[Gallery List] Published galleries:', publishedGalleries);
      console.log('[Gallery List] Returned:', filteredGalleries.length);
    }

    res.json({
      galleries: filteredGalleries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error listing galleries:', error);
    res.status(500).json({ error: 'Failed to list galleries' });
  }
};

/**
 * Get sub-event galleries for a main event
 * GET /api/gallery/:eventId/sub-events
 * Returns all sub-event galleries with their media for a main event
 */
export const getSubEventGalleries = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userRole = req.user?.role;
    const isAdminOrOrganizer = userRole === 'admin' || userRole === 'organizer';

    // Validate eventId
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }

    // Get SubEvent model
    const SubEvent = mongoose.model('SubEvent');

    // Build query - admin/organizers see all, others see only published
    const query = {
      eventId: new mongoose.Types.ObjectId(eventId),
      subEventId: { $ne: null },
      ...(isAdminOrOrganizer ? {} : { published: true })
    };

    // Get sub-event galleries
    const subEventGalleries = await Gallery.find(query)
      .populate({
        path: 'subEventId',
        select: 'title description'
      })
      .populate('coverMediaId', 'publicUrl thumbnailUrl fileName')
      .sort({ 'subEventId.title': 1 });

    // Get media for each sub-event gallery
    const result = await Promise.all(
      subEventGalleries
        .filter(g => g.subEventId) // Filter out galleries where sub-event was deleted
        .map(async (gallery) => {
          const media = await GalleryMedia.find({ galleryId: gallery._id })
            .sort({ order: 1 })
            .select('fileName publicUrl thumbnailUrl type mimeType');

          return {
            subEventId: gallery.subEventId._id,
            subEventTitle: gallery.subEventId.title,
            subEventDescription: gallery.subEventId.description,
            gallery: {
              id: gallery._id,
              eventId: gallery.eventId,
              published: gallery.published,
              mediaCount: gallery.mediaCount,
              coverImage: gallery.coverMediaId
            },
            media
          };
        })
    );

    res.json({ subEventGalleries: result });
  } catch (error) {
    console.error('Error fetching sub-event galleries:', error);
    res.status(500).json({ error: 'Failed to fetch sub-event galleries' });
  }
};

// ==================== ADMIN/ORGANIZER OPERATIONS ====================

/**
 * Upload media to gallery (admin/organizer only)
 * Files are saved directly to MongoDB GridFS for optimal performance
 * Supports multiple files, images and videos
 */
export const uploadMedia = async (req, res) => {
  try {
    const { eventId } = req.params;
    const files = req.files || [req.file];
    const userId = req.user.id;

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Check if GridFS is available - REQUIRED
    if (!isGridFSAvailable()) {
      return res.status(503).json({ 
        error: 'Storage system temporarily unavailable. Please try again in a moment.',
        code: 'GRIDFS_UNAVAILABLE'
      });
    }

    // Verify event and gallery exist
    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let gallery = await Gallery.findOne({ eventId });
    // Auto-create gallery if it doesn't exist
    if (!gallery) {
      gallery = new Gallery({
        eventId,
        folderPath: `gridfs://galleryMedia/${eventId}`,
        published: false
      });
      await gallery.save();
      logger.production(`Auto-created gallery for event ${eventId} during upload`);
    }

    const uploadedMedia = [];

    // Process each file using GridFS
    for (const file of files) {
      if (!file) continue;

      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

      try {
        // Validate file
        storageManager.validateFile(file, mediaType);

        // Generate unique filename
        const uniqueFileName = storageManager.generateUniqueFileName(file.originalname, mediaType);
        
        // Upload to GridFS (faster than Base64)
        const gridFSFileId = await uploadToGridFS(file.buffer, uniqueFileName, {
          eventId,
          galleryId: gallery._id.toString(),
          originalName: file.originalname,
          mimeType: file.mimetype,
          mediaType,
          uploadedBy: userId
        });

        // Generate public URL (served from /api/gallery/media/:fileName endpoint)
        const publicUrl = `/api/gallery/media/${uniqueFileName}`;

        // Create media document with GridFS reference (NO Base64)
        const media = new GalleryMedia({
          eventId,
          galleryId: gallery._id,
          fileName: uniqueFileName,
          originalName: file.originalname,
          gridFSFileId: gridFSFileId, // GridFS file reference
          storageType: 'gridfs', // Mark as GridFS storage
          fileData: null, // No Base64 data
          publicUrl,
          type: mediaType,
          mimeType: file.mimetype,
          fileSize: file.size,
          dimensions: null,
          duration: null,
          order: uploadedMedia.length,
          uploadedBy: userId
        });

        await media.save();
        uploadedMedia.push(media);
      } catch (fileError) {
        console.error(`Error uploading file ${file.originalname}:`, fileError);
      }
    }

    // Update gallery media count
    gallery.mediaCount = await GalleryMedia.countDocuments({ galleryId: gallery._id });
    await gallery.save();

    // Invalidate gallery cache after upload
    invalidateCache.onGalleryChange(serverCache, eventId);

    res.json({
      success: true,
      message: `${uploadedMedia.length} file(s) uploaded to MongoDB`,
      media: uploadedMedia
    });
  } catch (error) {
    console.error('Error in uploadMedia:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
};

/**
 * Delete media from gallery (admin/organizer only)
 * Deletes from MongoDB/GridFS and clears from cache
 */
export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const media = await GalleryMedia.findById(mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Clear from memory cache
    cacheManager.delete(media.fileName);

    // Delete from GridFS if stored there
    if (media.storageType === 'gridfs' && media.gridFSFileId) {
      try {
        await deleteFromGridFS(media.fileName);
        logger.production(`[GridFS] Deleted file: ${media.fileName}`);
      } catch (gridfsErr) {
        logger.production(`[GridFS] Error deleting ${media.fileName}:`, gridfsErr.message);
        // Continue with document deletion even if GridFS delete fails
      }
    }

    // Delete database record
    await GalleryMedia.findByIdAndDelete(mediaId);

    // Update gallery if this was cover image
    const gallery = await Gallery.findById(media.galleryId);
    if (gallery.coverMediaId?.toString() === mediaId) {
      gallery.coverMediaId = null;
    }

    // Update media count
    gallery.mediaCount = await GalleryMedia.countDocuments({ galleryId: gallery._id });
    await gallery.save();

    // Invalidate gallery cache after deletion
    invalidateCache.onGalleryChange(serverCache, media.eventId?.toString());

    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
};

/**
 * Reorder media in gallery (admin/organizer only)
 * Expects array of mediaIds in desired order
 */
export const reorderMedia = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { mediaOrder } = req.body;

    if (!Array.isArray(mediaOrder) || mediaOrder.length === 0) {
      return res.status(400).json({ error: 'Invalid media order' });
    }

    // Update order for each media item
    for (let i = 0; i < mediaOrder.length; i++) {
      await GalleryMedia.findByIdAndUpdate(
        mediaOrder[i],
        { order: i },
        { new: true }
      );
    }

    res.json({ success: true, message: 'Media reordered' });
  } catch (error) {
    console.error('Error reordering media:', error);
    res.status(500).json({ error: 'Reorder failed' });
  }
};

/**
 * Set or remove gallery cover image (admin/organizer only)
 * Pass mediaId: null to remove cover and fall back to event image
 */
export const setCoverImage = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { mediaId } = req.body;

    // If mediaId is null, remove cover image
    if (mediaId === null) {
      const gallery = await Gallery.findOneAndUpdate(
        { eventId },
        { coverMediaId: null },
        { new: true }
      );
      return res.json({ success: true, message: 'Cover image removed', gallery });
    }

    // Verify media exists and belongs to gallery
    const media = await GalleryMedia.findById(mediaId);
    if (!media || media.eventId.toString() !== eventId) {
      return res.status(404).json({ error: 'Media not found or belongs to different event' });
    }

    // Update gallery
    const gallery = await Gallery.findOneAndUpdate(
      { eventId },
      { coverMediaId: mediaId },
      { new: true }
    );

    res.json({ success: true, gallery });
  } catch (error) {
    console.error('Error setting cover image:', error);
    res.status(500).json({ error: 'Failed to set cover image' });
  }
};

/**
 * Publish or unpublish gallery (admin/organizer only)
 */
export const togglePublish = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { published } = req.body;

    const gallery = await Gallery.findOneAndUpdate(
      { eventId },
      { published: Boolean(published) },
      { new: true }
    );

    if (!gallery) {
      return res.status(404).json({ error: 'Gallery not found' });
    }

    res.json({
      success: true,
      message: `Gallery ${published ? 'published' : 'unpublished'}`,
      gallery
    });
  } catch (error) {
    console.error('Error publishing gallery:', error);
    res.status(500).json({ error: 'Publish failed' });
  }
};

/**
 * Get gallery management data (admin/organizer only)
 * Full details for dashboard - auto-creates gallery if missing
 */
export const getGalleryManagement = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists first
    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let gallery = await Gallery.findOne({ eventId })
      .populate('coverMediaId', 'publicUrl thumbnailUrl fileName');

    // Auto-create gallery if it doesn't exist
    if (!gallery) {
      gallery = new Gallery({
        eventId,
        folderPath: `mongodb://gallery/${eventId}`,
        published: false
      });
      await gallery.save();
      logger.production(`Auto-created gallery for event ${eventId}`);
    }

    const media = await GalleryMedia.find({ galleryId: gallery._id })
      .select('_id fileName filePath publicUrl type uploadedAt order')
      .sort({ order: 1 });

    const stats = {
      totalFiles: media.length,
      imageCount: media.filter(m => m.type === 'image').length,
      videoCount: media.filter(m => m.type === 'video').length,
      totalSize: media.reduce((sum, m) => sum + (m.fileSize || 0), 0)
    };

    res.json({
      gallery,
      media,
      stats
    });
  } catch (error) {
    console.error('Error fetching gallery management:', error);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
};

/**
 * Update gallery-related data (event title/description)
 * PATCH /api/gallery/:eventId
 */
export const updateGallery = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { title, description } = req.body;

    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;

    await event.save();

    res.json({ success: true, event });
  } catch (error) {
    console.error('Error updating gallery/event:', error);
    res.status(500).json({ error: 'Failed to update gallery' });
  }
};

/**
 * Delete entire gallery and all media for an event (admin only)
 * DELETE /api/gallery/:eventId
 */
export const deleteGallery = async (req, res) => {
  try {
    const { eventId } = req.params;
    // Reuse internal helper
    await deleteGalleryForEvent(eventId);
    res.json({ success: true, message: 'Gallery and media deleted' });
  } catch (error) {
    console.error('Error deleting gallery:', error);
    res.status(500).json({ error: 'Failed to delete gallery' });
  }
};

/**
 * Create gallery for an event (API endpoint)
 * POST /api/gallery/:eventId/create
 * 
 * Used for events created before gallery integration
 * Creates an unpublished gallery ready for media uploads
 */
export const createGalleryEndpoint = async (req, res) => {
  try {
    const { eventId } = req.params;

    // Verify event exists
    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if gallery already exists
    let gallery = await Gallery.findOne({ eventId });
    if (gallery) {
      return res.json({ 
        success: true, 
        message: 'Gallery already exists', 
        gallery,
        created: false
      });
    }

    // Create new gallery
    gallery = await createGalleryForEvent(eventId);

    res.status(201).json({ 
      success: true, 
      message: 'Gallery created successfully', 
      gallery,
      created: true
    });
  } catch (error) {
    console.error('Error creating gallery:', error);
    res.status(500).json({ error: 'Failed to create gallery' });
  }
};

// ==================== INTERNAL OPERATIONS ====================

/**
 * Create gallery for new event (called during event creation)
 * Creates gallery record and storage folders
 */
export const createGalleryForEvent = async (eventId, subEventId = null) => {
  try {
    // Check if gallery already exists
    const existingGallery = await Gallery.findOne({ 
      eventId, 
      subEventId: subEventId || null 
    });
    
    if (existingGallery) {
      return existingGallery;
    }

    // MongoDB storage - no folders needed
    // Create gallery document
    const gallery = new Gallery({
      eventId,
      subEventId: subEventId || null,
      folderPath: subEventId 
        ? `mongodb://gallery/${eventId}/sub/${subEventId}`
        : `mongodb://gallery/${eventId}`,
      published: false
    });

    await gallery.save();
    return gallery;
  } catch (error) {
    console.error(`Error creating gallery for event ${eventId}${subEventId ? ` sub-event ${subEventId}` : ''}:`, error);
    throw error;
  }
};

/**
 * Delete gallery and all media for an event (called during event deletion)
 * Removes storage folders and database records
 * Also deletes all sub-event galleries for the event
 */
export const deleteGalleryForEvent = async (eventId) => {
  try {
    // Delete main gallery and all sub-event galleries for this event
    const galleries = await Gallery.find({ eventId });
    
    for (const gallery of galleries) {
      // Clear all related cache entries
      const allMedia = await GalleryMedia.find({ galleryId: gallery._id });
      allMedia.forEach(media => {
        cacheManager.delete(media.fileName);
      });

      await GalleryMedia.deleteMany({ galleryId: gallery._id });
      await Gallery.deleteOne({ _id: gallery._id });
    }

    // Delete storage folders
    await storageManager.deleteEventGalleryFolders(eventId);
    
    logger.production(`🗑️ Deleted ${galleries.length} galleries (main + sub-events) for event ${eventId}`);
  } catch (error) {
    console.error(`Error deleting gallery for event ${eventId}:`, error);
    throw error;
  }
};

/**
 * Get cache statistics (admin only)
 * GET /api/gallery/cache/stats
 */
export const getCacheStats = async (req, res) => {
  try {
    const stats = cacheManager.getStats();
    const topItems = cacheManager.getTopItems(20);

    res.json({
      stats,
      topCachedItems: topItems,
      message: 'Cache is improving photo load times'
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
};

/**
 * Clear cache (admin only)
 * POST /api/gallery/cache/clear
 */
export const clearCache = async (req, res) => {
  try {
    cacheManager.clear();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
};

/**
 * STREAMING UPLOAD with GridFS - True streaming directly to MongoDB GridFS
 * POST /api/gallery/:eventId/upload-stream
 * 
 * Performance improvements:
 * - No Base64 encoding overhead (saves 33% storage)
 * - True streaming (no memory buffering of entire file)
 * - GridFS chunks enable efficient partial reads for video seeking
 * - ~3x faster uploads for large files
 */
export const uploadMediaStream = async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.id;

  // Validate event exists
  const Event = getEventModel();
  const event = await Event.findById(eventId);
  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  // Check if GridFS is available - REQUIRED, no fallback to Base64
  if (!isGridFSAvailable()) {
    logger.production('GridFS not available - upload cannot proceed');
    return res.status(503).json({ 
      error: 'Storage system temporarily unavailable. Please try again in a moment.',
      code: 'GRIDFS_UNAVAILABLE'
    });
  }

  // Get or create gallery
  let gallery = await Gallery.findOne({ eventId });
  if (!gallery) {
    gallery = new Gallery({
      eventId,
      folderPath: `gridfs://galleryMedia/${eventId}`,
      published: false
    });
    await gallery.save();
    logger.production(`Auto-created gallery for event ${eventId} during GridFS streaming upload`);
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB max per file
      files: 10 // Max 10 files per request
    }
  });

  const uploadedMedia = [];
  const uploadPromises = [];
  let fileCount = 0;

  busboy.on('file', (fieldname, fileStream, info) => {
    const { filename, mimeType } = info;
    fileCount++;
    
    const mediaType = mimeType.startsWith('video') ? 'video' : 'image';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const publicUrl = `/api/gallery/media/${uniqueFileName}`;
    
    let fileSize = 0;
    
    const uploadPromise = new Promise((resolve, reject) => {
      // Create GridFS upload stream
      const gridFSUploadStream = createUploadStream(uniqueFileName, {
        eventId,
        galleryId: gallery._id.toString(),
        originalName: filename,
        mimeType,
        mediaType,
        uploadedBy: userId
      });
      
      // Use a pass-through to track file size while streaming
      const passThrough = new PassThrough();
      
      passThrough.on('data', (chunk) => {
        fileSize += chunk.length;
      });
      
      // Pipe: fileStream -> passThrough (for size tracking) -> gridFSUploadStream
      fileStream.pipe(passThrough).pipe(gridFSUploadStream);
      
      gridFSUploadStream.on('error', (err) => {
        logger.production(`GridFS upload error for ${filename}:`, err.message);
        reject(err);
      });
      
      gridFSUploadStream.on('finish', async () => {
        try {
          // Create media document with GridFS reference
          const media = new GalleryMedia({
            eventId,
            galleryId: gallery._id,
            fileName: uniqueFileName,
            originalName: filename,
            gridFSFileId: gridFSUploadStream.id, // Store GridFS file ID
            storageType: 'gridfs', // Mark as GridFS storage
            fileData: null, // No Base64 data needed
            publicUrl,
            type: mediaType,
            mimeType: mimeType,
            fileSize: fileSize,
            dimensions: null,
            duration: null,
            order: fileCount - 1,
            uploadedBy: userId
          });
          
          await media.save();
          uploadedMedia.push(media);
          logger.production(`[GridFS] Uploaded ${filename} (${(fileSize / 1024 / 1024).toFixed(2)}MB) as ${uniqueFileName}`);
          resolve(media);
        } catch (err) {
          logger.production(`Error saving GridFS media document ${filename}:`, err.message);
          // Try to clean up the GridFS file
          try {
            await deleteFromGridFS(uniqueFileName);
          } catch (cleanupErr) {
            logger.production(`Failed to cleanup GridFS file ${uniqueFileName}:`, cleanupErr.message);
          }
          reject(err);
        }
      });
      
      fileStream.on('error', (err) => {
        logger.production(`File stream error for ${filename}:`, err.message);
        reject(err);
      });
    });
    
    uploadPromises.push(uploadPromise);
  });

  busboy.on('finish', async () => {
    try {
      // Wait for all files to finish uploading
      await Promise.all(uploadPromises);
      
      // Update gallery media count
      gallery.mediaCount = await GalleryMedia.countDocuments({ galleryId: gallery._id });
      await gallery.save();
      
      // Invalidate cache
      invalidateCache.onGalleryChange(serverCache, eventId);
      
      res.json({
        success: true,
        message: `${uploadedMedia.length} file(s) uploaded via GridFS streaming`,
        media: uploadedMedia,
        storageType: 'gridfs'
      });
    } catch (error) {
      logger.production('Error finalizing GridFS streaming upload:', error.message);
      res.status(500).json({ error: 'Upload failed during finalization' });
    }
  });

  busboy.on('error', (error) => {
    logger.production('Busboy streaming error:', error.message);
    res.status(500).json({ error: 'Upload stream failed' });
  });

  // Pipe the request directly to busboy (FAST - no intermediate buffering)
  req.pipe(busboy);
};

/**
 * Fallback Base64 upload for when GridFS is not available
 * This preserves backward compatibility
 */
const uploadMediaStreamBase64 = async (req, res, eventId, userId) => {
  // Get or create gallery
  let gallery = await Gallery.findOne({ eventId });
  if (!gallery) {
    gallery = new Gallery({
      eventId,
      folderPath: `mongodb://gallery/${eventId}`,
      published: false
    });
    await gallery.save();
  }

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: 500 * 1024 * 1024,
      files: 10
    }
  });

  const uploadedMedia = [];
  const uploadPromises = [];
  let fileCount = 0;

  busboy.on('file', (fieldname, fileStream, info) => {
    const { filename, mimeType } = info;
    fileCount++;
    
    const mediaType = mimeType.startsWith('video') ? 'video' : 'image';
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const publicUrl = `/api/gallery/media/${uniqueFileName}`;
    
    const chunks = [];
    let fileSize = 0;
    
    const uploadPromise = new Promise((resolve, reject) => {
      fileStream.on('data', (chunk) => {
        chunks.push(chunk);
        fileSize += chunk.length;
      });
      
      fileStream.on('end', async () => {
        try {
          const fileBuffer = Buffer.concat(chunks);
          const fileBase64 = fileBuffer.toString('base64');
          
          const media = new GalleryMedia({
            eventId,
            galleryId: gallery._id,
            fileName: uniqueFileName,
            originalName: filename,
            fileData: fileBase64,
            storageType: 'base64',
            gridFSFileId: null,
            publicUrl,
            type: mediaType,
            mimeType: mimeType,
            fileSize: fileSize,
            dimensions: null,
            duration: null,
            order: fileCount - 1,
            uploadedBy: userId
          });
          
          await media.save();
          uploadedMedia.push(media);
          resolve(media);
        } catch (err) {
          reject(err);
        }
      });
      
      fileStream.on('error', reject);
    });
    
    uploadPromises.push(uploadPromise);
  });

  busboy.on('finish', async () => {
    try {
      await Promise.all(uploadPromises);
      gallery.mediaCount = await GalleryMedia.countDocuments({ galleryId: gallery._id });
      await gallery.save();
      invalidateCache.onGalleryChange(serverCache, eventId);
      
      res.json({
        success: true,
        message: `${uploadedMedia.length} file(s) uploaded via Base64 (fallback)`,
        media: uploadedMedia,
        storageType: 'base64'
      });
    } catch (error) {
      res.status(500).json({ error: 'Upload failed during finalization' });
    }
  });

  busboy.on('error', () => {
    res.status(500).json({ error: 'Upload stream failed' });
  });

  req.pipe(busboy);
};

// ==================== CHUNKED UPLOAD FOR LARGE FILES ====================
// Uses temporary files on disk instead of memory for large video uploads
// This prevents memory issues and Cloudflare timeouts for files up to 500MB

// Metadata storage for chunked uploads (only stores metadata, not file data)
const chunkedUploads = new Map();

// Temp directory for chunk storage
const CHUNK_TEMP_DIR = path.join(os.tmpdir(), 'event-hub-chunks');

// Ensure temp directory exists
try {
  if (!fs.existsSync(CHUNK_TEMP_DIR)) {
    fs.mkdirSync(CHUNK_TEMP_DIR, { recursive: true });
  }
} catch (err) {
  logger.production(`[Chunked] Warning: Could not create temp directory: ${err.message}`);
}

// Cleanup stale chunked uploads after 1 hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [uploadId, upload] of chunkedUploads.entries()) {
    if (upload.lastActivity < oneHourAgo) {
      logger.production(`[Chunked] Cleaning up stale upload: ${uploadId}`);
      // Delete temp files
      try {
        const uploadDir = path.join(CHUNK_TEMP_DIR, uploadId);
        if (fs.existsSync(uploadDir)) {
          fs.rmSync(uploadDir, { recursive: true, force: true });
        }
      } catch (err) {
        logger.production(`[Chunked] Error cleaning temp files: ${err.message}`);
      }
      chunkedUploads.delete(uploadId);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

/**
 * Initialize chunked upload
 * POST /api/gallery/:eventId/upload-chunk/init
 * 
 * For large video files that may timeout on Cloudflare (100s limit).
 * Uses disk-based storage to handle files up to 500MB without memory issues.
 * Returns an uploadId to use for subsequent chunk uploads.
 */
export const initChunkedUpload = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { fileName, fileSize, mimeType, totalChunks } = req.body;
    const userId = req.user?.id;

    // Validate
    if (!fileName || !fileSize || !mimeType || !totalChunks) {
      return res.status(400).json({ error: 'Missing required fields: fileName, fileSize, mimeType, totalChunks' });
    }

    // Validate event exists
    const Event = getEventModel();
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if GridFS is available
    if (!isGridFSAvailable()) {
      return res.status(503).json({ 
        error: 'Storage system temporarily unavailable',
        code: 'GRIDFS_UNAVAILABLE'
      });
    }

    // Get or create gallery
    let gallery = await Gallery.findOne({ eventId });
    if (!gallery) {
      gallery = new Gallery({
        eventId,
        folderPath: `gridfs://galleryMedia/${eventId}`,
        published: false
      });
      await gallery.save();
    }

    // Generate unique upload ID
    const uploadId = `${eventId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Create temp directory for this upload
    const uploadDir = path.join(CHUNK_TEMP_DIR, uploadId);
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      logger.production(`[Chunked] Failed to create temp directory: ${err.message}`);
      return res.status(500).json({ error: 'Failed to initialize upload storage' });
    }

    // Store upload metadata (not file data - that goes to disk)
    chunkedUploads.set(uploadId, {
      eventId,
      galleryId: gallery._id.toString(),
      userId,
      fileName: uniqueFileName,
      originalName: fileName,
      mimeType,
      fileSize: parseInt(fileSize),
      totalChunks: parseInt(totalChunks),
      receivedChunks: new Set(), // Just track which chunks received, not the data
      uploadDir,
      lastActivity: Date.now(),
      status: 'initialized'
    });

    logger.production(`[Chunked] Initialized upload ${uploadId} for ${fileName} (${(fileSize / 1024 / 1024).toFixed(2)}MB, ${totalChunks} chunks)`);

    res.json({
      success: true,
      uploadId,
      message: 'Chunked upload initialized'
    });
  } catch (error) {
    logger.production('Error initializing chunked upload:', error.message);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
};

/**
 * Upload a chunk
 * POST /api/gallery/:eventId/upload-chunk/:uploadId/:chunkIndex
 * 
 * Uploads a single chunk of the file to a temp file on disk.
 * This prevents memory issues for large video uploads.
 */
export const uploadChunk = async (req, res) => {
  try {
    const { eventId, uploadId, chunkIndex } = req.params;
    const index = parseInt(chunkIndex);

    // Validate upload exists
    const upload = chunkedUploads.get(uploadId);
    if (!upload) {
      return res.status(404).json({ error: 'Upload not found or expired' });
    }

    if (upload.eventId !== eventId) {
      return res.status(403).json({ error: 'Upload ID does not match event' });
    }

    let chunkData;
    
    // Check if body was parsed by express.raw() middleware
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      chunkData = req.body;
    } else {
      // Fallback: Read from stream if not already parsed
      const chunks = [];
      await new Promise((resolve, reject) => {
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', resolve);
        req.on('error', reject);
      });
      chunkData = Buffer.concat(chunks);
    }
    
    if (!chunkData || chunkData.length === 0) {
      return res.status(400).json({ error: 'No chunk data received' });
    }
    
    // Write chunk to temp file on disk (not memory)
    const chunkPath = path.join(upload.uploadDir, `chunk_${index.toString().padStart(5, '0')}`);
    try {
      fs.writeFileSync(chunkPath, chunkData);
    } catch (err) {
      logger.production(`[Chunked] Failed to write chunk to disk: ${err.message}`);
      // Cleanup on disk write failure - the upload is unusable
      try {
        if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
          fs.rmSync(upload.uploadDir, { recursive: true, force: true });
        }
        chunkedUploads.delete(uploadId);
        logger.production(`[Chunked] Cleaned up failed upload ${uploadId} due to disk write error`);
      } catch { /* ignore cleanup error */ }
      return res.status(500).json({ error: 'Failed to save chunk - storage full or unavailable', retryable: false });
    }
    
    // Track which chunks we've received
    upload.receivedChunks.add(index);
    upload.lastActivity = Date.now();

    logger.production(`[Chunked] Saved chunk ${index + 1}/${upload.totalChunks} for ${uploadId} (${(chunkData.length / 1024).toFixed(1)}KB)`);

    res.json({
      success: true,
      chunkIndex: index,
      receivedChunks: upload.receivedChunks.size,
      totalChunks: upload.totalChunks
    });
  } catch (error) {
    logger.production('Error uploading chunk:', error.message);
    // Cleanup on unexpected error
    const upload = chunkedUploads.get(uploadId);
    if (upload) {
      try {
        if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
          fs.rmSync(upload.uploadDir, { recursive: true, force: true });
        }
        chunkedUploads.delete(uploadId);
        logger.production(`[Chunked] Cleaned up failed upload ${uploadId} due to error: ${error.message}`);
      } catch { /* ignore cleanup error */ }
    }
    res.status(500).json({ error: 'Failed to upload chunk', retryable: true });
  }
};

/**
 * Complete chunked upload
 * POST /api/gallery/:eventId/upload-chunk/:uploadId/complete
 * 
 * Streams chunks from disk to GridFS - no memory buffering needed.
 * This handles files up to 500MB without memory issues.
 */
export const completeChunkedUpload = async (req, res) => {
  let uploadId = null;
  let upload = null;
  
  try {
    const { eventId } = req.params;
    uploadId = req.params.uploadId;
    const userId = req.user?.id;

    logger.production(`[Chunked] Starting assembly for upload ${uploadId}`);

    // Validate upload exists
    upload = chunkedUploads.get(uploadId);
    if (!upload) {
      logger.production(`[Chunked] Upload ${uploadId} not found or expired`);
      return res.status(404).json({ error: 'Upload not found or expired. Please try uploading again.' });
    }

    if (upload.eventId !== eventId) {
      return res.status(403).json({ error: 'Upload ID does not match event' });
    }

    // Check all chunks received
    if (upload.receivedChunks.size !== upload.totalChunks) {
      logger.production(`[Chunked] Missing chunks for ${uploadId}: ${upload.receivedChunks.size}/${upload.totalChunks}`);
      return res.status(400).json({ 
        error: `Missing chunks: received ${upload.receivedChunks.size}/${upload.totalChunks}. Some chunks may have failed to upload.`,
        receivedChunks: upload.receivedChunks.size,
        totalChunks: upload.totalChunks,
        retryable: true
      });
    }

    // Verify all chunk files exist on disk
    logger.production(`[Chunked] Verifying ${upload.totalChunks} chunk files for ${uploadId}...`);
    for (let i = 0; i < upload.totalChunks; i++) {
      const chunkPath = path.join(upload.uploadDir, `chunk_${i.toString().padStart(5, '0')}`);
      if (!fs.existsSync(chunkPath)) {
        logger.production(`[Chunked] Missing chunk file ${i} for ${uploadId}`);
        return res.status(400).json({ error: `Missing chunk ${i}. Please try uploading again.`, retryable: true });
      }
    }

    // Upload to GridFS by streaming chunks directly (no memory buffering)
    const mediaType = upload.mimeType.startsWith('video') ? 'video' : 'image';
    const publicUrl = `/api/gallery/media/${upload.fileName}`;

    logger.production(`[Chunked] Streaming ${upload.totalChunks} chunks to GridFS for ${uploadId}...`);

    const gridFSUploadStream = createUploadStream(upload.fileName, {
      eventId,
      galleryId: upload.galleryId,
      originalName: upload.originalName,
      mimeType: upload.mimeType,
      mediaType,
      uploadedBy: userId
    });

    let totalBytesWritten = 0;

    try {
      // Stream each chunk file to GridFS in order
      for (let i = 0; i < upload.totalChunks; i++) {
        const chunkPath = path.join(upload.uploadDir, `chunk_${i.toString().padStart(5, '0')}`);
        const chunkData = fs.readFileSync(chunkPath);
        
        await new Promise((resolve, reject) => {
          const canContinue = gridFSUploadStream.write(chunkData, (err) => {
            if (err) reject(err);
            else resolve();
          });
          // If buffer is full, wait for drain
          if (!canContinue) {
            gridFSUploadStream.once('drain', resolve);
          }
        });
        
        totalBytesWritten += chunkData.length;
        
        // Log progress for large files
        if (i % 10 === 0 || i === upload.totalChunks - 1) {
          logger.production(`[Chunked] GridFS progress: ${i + 1}/${upload.totalChunks} chunks (${(totalBytesWritten / 1024 / 1024).toFixed(1)}MB)`);
        }
      }

      // Finalize the GridFS upload
      await new Promise((resolve, reject) => {
        gridFSUploadStream.end((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.production(`[Chunked] GridFS upload complete for ${uploadId}: ${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB`);
    } catch (gridfsError) {
      logger.production(`[Chunked] GridFS error for ${uploadId}: ${gridfsError.message}`);
      // IMPORTANT: Clean up temp files on GridFS failure to save storage
      try {
        if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
          fs.rmSync(upload.uploadDir, { recursive: true, force: true });
          logger.production(`[Chunked] Cleaned up temp files after GridFS error for ${uploadId}`);
        }
        chunkedUploads.delete(uploadId);
      } catch { /* ignore cleanup error */ }
      return res.status(500).json({ 
        error: `Failed to save file to storage: ${gridfsError.message}`,
        retryable: true 
      });
    }

    // Create media document
    const gallery = await Gallery.findById(upload.galleryId);
    const media = new GalleryMedia({
      eventId,
      galleryId: upload.galleryId,
      fileName: upload.fileName,
      originalName: upload.originalName,
      gridFSFileId: gridFSUploadStream.id,
      storageType: 'gridfs',
      fileData: null,
      publicUrl,
      type: mediaType,
      mimeType: upload.mimeType,
      fileSize: totalBytesWritten,
      dimensions: null,
      duration: null,
      order: 0,
      uploadedBy: userId
    });

    await media.save();

    // Update gallery media count
    if (gallery) {
      gallery.mediaCount = await GalleryMedia.countDocuments({ galleryId: gallery._id });
      await gallery.save();
    }

    // Cleanup temp files and metadata
    try {
      if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
        fs.rmSync(upload.uploadDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      logger.production(`[Chunked] Warning: Failed to cleanup temp files: ${cleanupErr.message}`);
    }
    chunkedUploads.delete(uploadId);
    invalidateCache.onGalleryChange(serverCache, eventId);

    logger.production(`[Chunked] Successfully completed upload ${uploadId}: ${upload.originalName} (${(totalBytesWritten / 1024 / 1024).toFixed(2)}MB)`);

    res.json({
      success: true,
      message: 'File uploaded successfully via chunked upload',
      media: media,
      storageType: 'gridfs'
    });
  } catch (error) {
    logger.production(`[Chunked] Error completing upload ${uploadId}: ${error.message}`);
    // Try to cleanup on error
    if (uploadId && upload) {
      try {
        if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
          fs.rmSync(upload.uploadDir, { recursive: true, force: true });
        }
      } catch { /* ignore cleanup error */ }
      chunkedUploads.delete(uploadId);
    }
    res.status(500).json({ 
      error: `Failed to complete upload: ${error.message}`,
      retryable: true 
    });
  }
};

/**
 * Cancel chunked upload
 * DELETE /api/gallery/:eventId/upload-chunk/:uploadId
 * Cleans up temp files and metadata
 */
export const cancelChunkedUpload = async (req, res) => {
  try {
    const { uploadId } = req.params;
    
    const upload = chunkedUploads.get(uploadId);
    if (upload) {
      // Delete temp files
      try {
        if (upload.uploadDir && fs.existsSync(upload.uploadDir)) {
          fs.rmSync(upload.uploadDir, { recursive: true, force: true });
        }
      } catch (err) {
        logger.production(`[Chunked] Warning: Failed to cleanup temp files: ${err.message}`);
      }
      chunkedUploads.delete(uploadId);
      logger.production(`[Chunked] Cancelled upload ${uploadId}`);
    }

    res.json({ success: true, message: 'Upload cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel upload' });
  }
};