import multer from 'multer';
import path from 'path';
import GalleryStorageManager from './galleryStorage.js';
import { createUploadStream, getGalleryBucket } from './galleryGridFS.js';

/**
 * Gallery Upload Configuration
 * 
 * Configures multer for gallery media uploads
 * Handles:
 * - File type validation
 * - Size limits (up to 500MB)
 * - Direct GridFS storage (bypasses memory and CDN)
 * - Filename generation
 * 
 * Files are stored directly to MongoDB GridFS without intermediate memory buffering.
 * No chunking is required for files < 100MB - they upload directly in one request.
 */

const storageManager = new GalleryStorageManager();

const fileFilter = (req, file, cb) => {
  const mediaType = req.params.mediaType || req.body.mediaType;
  
  try {
    storageManager.validateFile(file, mediaType);
    cb(null, true);
  } catch (error) {
    cb(new Error(error.message), false);
  }
};

/**
 * Custom GridFS Storage for Multer
 * Streams uploaded files directly to MongoDB GridFS
 * 
 * Benefits:
 * - No memory overhead (streaming storage)
 * - Direct MongoDB storage (bypasses CDN)
 * - Smooth uploads for files up to 500MB
 * - No chunking needed for files < 100MB
 */
const createGridFSStorage = () => {
  return {
    _handleFile: async (req, file, cb) => {
      try {
        const bucket = getGalleryBucket();
        if (!bucket) {
          return cb(new Error('GridFS bucket not available'));
        }

        // Generate unique filename
        const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        // Prepare metadata
        const metadata = {
          originalName: file.originalname,
          mimeType: file.mimetype,
          uploadedBy: req.user?.id || 'anonymous',
          uploadedAt: new Date()
        };

        // Create upload stream that pipes to GridFS
        const uploadStream = createUploadStream(uniqueFileName, metadata);

        uploadStream.on('error', (err) => {
          console.error('[Multer-GridFS] Upload error:', err.message);
          cb(err);
        });

        uploadStream.on('finish', () => {
          console.log('[Multer-GridFS] File uploaded successfully:', uniqueFileName);
          // Return file info for controller
          cb(null, {
            filename: uniqueFileName,
            encoding: file.encoding,
            mimetype: file.mimetype,
            size: file.size,
            originalname: file.originalname,
            gridFSFileId: uploadStream.id // Store GridFS ID for later retrieval
          });
        });

        // Pipe file data to GridFS
        file.stream.pipe(uploadStream);
      } catch (err) {
        console.error('[Multer-GridFS] Setup error:', err.message);
        cb(err);
      }
    },

    _removeFile: async (req, file, cb) => {
      // Files are already in GridFS, cleanup happens in controller
      cb(null);
    }
  };
};

const storage = createGridFSStorage();

const galleryUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max - no chunking needed for < 100MB
    files: 10, // Max 10 files per request
    fieldSize: 500 * 1024 * 1024 // 500MB field size
  }
});

export {
  galleryUpload,
  storageManager
};

