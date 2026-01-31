import mongoose from 'mongoose';
import Gallery from '../models/Gallery.js';
import GalleryMedia from '../models/GalleryMedia.js';
import { storageManager } from '../utils/galleryUpload.js';
import GalleryCacheManager from '../utils/galleryCacheManager.js';
import serverCache, { invalidateCache } from '../services/cacheService.js';
import logger from '../utils/logger.js';

// Lazy-load Event model (registered in main index.js)
const getEventModel = () => mongoose.model('Event');

// Initialize cache manager (100MB max in-memory cache)
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
 * Caching: Frequently accessed images are cached in memory for faster serving
 * Security: All operations enforce role-based access control
 */

// ==================== PUBLIC OPERATIONS ====================

/**
 * Serve media file from MongoDB with caching
 * GET /api/gallery/media/:fileName
 * 
 * Files are cached in memory after first access for faster subsequent requests
 * Cache is automatically evicted when space is needed
 */
export const serveMedia = async (req, res) => {
  try {
    const { fileName } = req.params;

    // Check cache first
    let cachedBuffer = cacheManager.get(fileName);
    let media = null;

    if (cachedBuffer) {
      // Found in cache - use it
      media = await GalleryMedia.findOne({ fileName }).select('mimeType fileName');
      if (!media) {
        cacheManager.delete(fileName);
        return res.status(404).json({ error: 'Media not found' });
      }
      res.setHeader('X-Cache', 'HIT'); // Debug header showing cache hit
    } else {
      // Not in cache - fetch from MongoDB
      media = await GalleryMedia.findOne({ fileName });
      if (!media) {
        return res.status(404).json({ error: 'Media not found' });
      }

      // Convert Base64 back to Buffer
      cachedBuffer = storageManager.base64ToFile(media.fileData);

      // Store in cache for next request
      cacheManager.set(fileName, cachedBuffer, { mimeType: media.mimeType });
      res.setHeader('X-Cache', 'MISS'); // Debug header showing cache miss
    }

    const fileSize = cachedBuffer.length;
    const isVideo = media.mimeType.startsWith('video');
    
    // Handle Range requests for video streaming
    const range = req.headers.range;
    if (range && isVideo) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      // Slice the buffer for the requested range
      const chunk = cachedBuffer.slice(start, end + 1);
      
      res.status(206); // Partial Content
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days for videos
      return res.send(chunk);
    }

    // Set response headers for full file
    res.setHeader('Content-Type', media.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
    res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests
    res.setHeader('Content-Length', fileSize);
    
    // Long cache for media files (7 days for videos, 1 day for images)
    if (isVideo) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
    
    // ETag for browser validation
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
 * Files are saved directly to MongoDB as Base64 encoded data
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
        folderPath: `mongodb://gallery/${eventId}`,
        published: false
      });
      await gallery.save();
      logger.production(`Auto-created gallery for event ${eventId} during upload`);
    }

    const uploadedMedia = [];

    // Process each file
    for (const file of files) {
      if (!file) continue;

      const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

      try {
        // Validate file
        storageManager.validateFile(file, mediaType);

        // Generate unique filename
        const uniqueFileName = storageManager.generateUniqueFileName(file.originalname, mediaType);
        
        // Convert file to Base64 for MongoDB storage
        const fileBase64 = storageManager.fileToBase64(file.buffer);

        // Generate public URL (served from /api/gallery/media/:fileName endpoint)
        const publicUrl = `/api/gallery/media/${uniqueFileName}`;

        // Get dimensions/duration if needed
        let dimensions = null;
        let duration = null;

        // Create media document with Base64 data stored in MongoDB
        // IMPORTANT: fileName must match the uniqueFileName used in publicUrl
        const media = new GalleryMedia({
          eventId,
          galleryId: gallery._id,
          fileName: uniqueFileName,  // Use unique filename for URL lookup
          originalName: file.originalname,  // Keep original name for display
          fileData: fileBase64,  // BASE64 ENCODED FILE STORED DIRECTLY IN MONGODB
          publicUrl,
          type: mediaType,
          mimeType: file.mimetype,
          fileSize: file.size,
          dimensions,
          duration,
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
 * Deletes from MongoDB and clears from cache
 */
export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const media = await GalleryMedia.findById(mediaId);
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Clear from cache
    cacheManager.delete(media.fileName);

    // Delete database record (file data stored in MongoDB is automatically removed)
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

    res.json({ success: true, message: 'Media deleted from MongoDB and cache' });
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

