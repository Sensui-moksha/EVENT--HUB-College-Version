import multer from 'multer';
import path from 'path';
import GalleryStorageManager from './galleryStorage.js';

/**
 * Gallery Upload Configuration
 * 
 * Configures multer for gallery media uploads
 * Handles:
 * - File type validation
 * - Size limits (increased for videos)
 * - Storage location
 * - Filename generation
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

const storage = multer.memoryStorage();

const galleryUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max for videos
    files: 10, // Max 10 files per request
    fieldSize: 500 * 1024 * 1024 // 500MB field size
  }
});

export {
  galleryUpload,
  storageManager
};
