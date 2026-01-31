import mongoose from 'mongoose';
import Busboy from 'busboy';
import { PassThrough } from 'stream';
import Gallery from '../models/Gallery.js';
import GalleryMedia from '../models/GalleryMedia.js';
import { storageManager } from '../utils/galleryUpload.js';
import GalleryCacheManager from '../utils/galleryCacheManager.js';
import serverCache, { invalidateCache } from '../services/cacheService.js';
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
 * Supports both GridFS (new) and Base64 (legacy) storage.
 * GridFS files are streamed directly for better performance.
 * Base64 files are cached in memory after first access.
 */
export const serveMedia = async (req, res) => {
  try {
    const { fileName } = req.params;

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
          
          // For videos, always handle range requests for smooth playback
          if (isVideo) {
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
            
            // Aggressive caching for video chunks (7 days)
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
            res.setHeader('ETag', `"${fileName}-${start}-${end}"`);
            res.setHeader('X-Storage', 'GridFS');
            res.setHeader('X-Content-Duration', media.duration || '');
            
            // CORS headers for video players
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Range');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
            
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
          
          // For images - serve full file with caching
          res.setHeader('Content-Type', media.mimeType);
          res.setHeader('Content-Disposition', `inline; filename="${media.fileName}"`);
          res.setHeader('Accept-Ranges', 'bytes');
          res.setHeader('Content-Length', fileSize);
          res.setHeader('ETag', `"${fileName}"`);
          res.setHeader('X-Storage', 'GridFS');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          
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

