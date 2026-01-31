import path from 'path';
import fs from 'fs/promises';

/**
 * Gallery Storage Manager
 * 
 * Handles all file operations for gallery media:
 * - Converts files to Base64 for MongoDB storage
 * - Generates unique filenames
 * - Retrieves files from MongoDB
 * - Deletes files from MongoDB
 * 
 * All files are stored directly in MongoDB as Base64 encoded data
 */
class GalleryStorageManager {
  constructor() {
    // MongoDB storage doesn't need file system paths
    this.imagesDir = 'images';
    this.videosDir = 'videos';
  }

  /**
   * Validate file type and size
   */
  validateFile(file, mediaType = null) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    
    const isValidImage = validImageTypes.includes(file.mimetype);
    const isValidVideo = validVideoTypes.includes(file.mimetype);
    
    if (!isValidImage && !isValidVideo) {
      throw new Error(`Invalid file type: ${file.mimetype}`);
    }

    const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB for images
    const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB for videos
    
    if (isValidImage && file.size > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 25MB)`);
    }
    
    if (isValidVideo && file.size > MAX_VIDEO_SIZE) {
      throw new Error(`Video too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max 500MB)`);
    }

    return true;
  }

  /**
   * Generate unique filename
   */
  generateUniqueFileName(originalName, mediaType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const ext = originalName.split('.').pop();
    return `${timestamp}-${random}.${ext}`;
  }

  /**
   * Convert file buffer to Base64
   */
  fileToBase64(buffer) {
    return buffer.toString('base64');
  }

  /**
   * Convert Base64 back to Buffer
   */
  base64ToFile(base64Data) {
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Save file to MongoDB as Base64
   * Returns the unique filename
   */
  async saveFile(eventId, mediaType, uniqueFileName, fileBuffer) {
    // Convert to Base64 - actual storage happens in controller
    const base64Data = this.fileToBase64(fileBuffer);
    
    return {
      base64: base64Data,
      fileName: uniqueFileName,
      size: fileBuffer.length
    };
  }

  /**
   * Delete is handled by MongoDB deletion
   * This is kept for compatibility
   */
  async deleteFile(mediaId) {
    // Deletion handled at MongoDB level
    return { success: true };
  }

  /**
   * Get file from Base64 storage
   */
  getFileFromBase64(base64Data) {
    return this.base64ToFile(base64Data);
  }

  /**
   * Note: File system folder operations are NO LONGER NEEDED
   * as all files are stored in MongoDB
   * Keeping these for backward compatibility if needed
   */
  async createEventGalleryFolders(eventId) {
    // MongoDB storage doesn't need folders
    return { success: true, message: 'Using MongoDB storage' };
  }

  async deleteEventGalleryFolders(eventId) {
    // MongoDB deletion is handled by GalleryMedia records deletion
    return { success: true, message: 'Using MongoDB storage' };
  }
}

export default GalleryStorageManager;
