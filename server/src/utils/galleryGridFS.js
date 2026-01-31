import mongoose from 'mongoose';
import { Readable } from 'stream';

/**
 * Gallery GridFS Storage Manager
 * 
 * Uses MongoDB GridFS for efficient large file storage.
 * GridFS splits files into 255KB chunks, providing:
 * - No 16MB document size limit
 * - Efficient streaming (no Base64 overhead)
 * - Better memory usage (streaming vs buffering)
 * - Native range request support for video seeking
 * 
 * Performance: ~3x faster uploads compared to Base64 storage
 */

let galleryBucket = null;

/**
 * Initialize the GridFS bucket for gallery media
 * Call this after MongoDB connection is established
 */
export const initializeGalleryGridFS = () => {
  if (mongoose.connection.readyState !== 1) {
    console.warn('[GridFS] Cannot initialize - MongoDB not connected');
    return null;
  }
  
  galleryBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'galleryMedia',
    chunkSizeBytes: 1024 * 1024 // 1MB chunks for better streaming performance
  });
  
  console.log('[GridFS] Gallery media bucket initialized');
  return galleryBucket;
};

/**
 * Get the GridFS bucket (initializes if needed)
 */
export const getGalleryBucket = () => {
  if (!galleryBucket && mongoose.connection.readyState === 1) {
    return initializeGalleryGridFS();
  }
  return galleryBucket;
};

/**
 * Upload a file to GridFS
 * @param {Buffer|Readable} fileData - File data as Buffer or readable stream
 * @param {string} fileName - Unique filename
 * @param {Object} metadata - File metadata (mimeType, eventId, etc.)
 * @returns {Promise<ObjectId>} - GridFS file ID
 */
export const uploadToGridFS = (fileData, fileName, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const bucket = getGalleryBucket();
    if (!bucket) {
      return reject(new Error('GridFS bucket not initialized'));
    }

    const uploadStream = bucket.openUploadStream(fileName, {
      metadata: {
        ...metadata,
        uploadedAt: new Date()
      }
    });

    uploadStream.on('error', (error) => {
      console.error(`[GridFS] Upload error for ${fileName}:`, error.message);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log(`[GridFS] Successfully uploaded: ${fileName} (${uploadStream.id})`);
      resolve(uploadStream.id);
    });

    // Handle both Buffer and Stream inputs
    if (Buffer.isBuffer(fileData)) {
      const readable = new Readable();
      readable.push(fileData);
      readable.push(null);
      readable.pipe(uploadStream);
    } else if (fileData.pipe) {
      // It's a stream
      fileData.pipe(uploadStream);
    } else {
      reject(new Error('Invalid file data type - expected Buffer or Readable stream'));
    }
  });
};

/**
 * Upload from a stream directly (for streaming uploads)
 * Returns the upload stream that can be piped to
 */
export const createUploadStream = (fileName, metadata = {}) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }

  return bucket.openUploadStream(fileName, {
    metadata: {
      ...metadata,
      uploadedAt: new Date()
    }
  });
};

/**
 * Download a file from GridFS by filename
 * @param {string} fileName - The filename to retrieve
 * @returns {Readable} - Download stream
 */
export const downloadFromGridFS = (fileName) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }

  return bucket.openDownloadStreamByName(fileName);
};

/**
 * Download a file from GridFS by ID
 * @param {ObjectId} fileId - The GridFS file ID
 * @returns {Readable} - Download stream
 */
export const downloadFromGridFSById = (fileId) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }

  return bucket.openDownloadStream(fileId);
};

/**
 * Get file info from GridFS
 * @param {string} fileName - The filename to look up
 * @returns {Promise<Object|null>} - File info or null
 */
export const getFileInfo = async (fileName) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    return null;
  }

  const cursor = bucket.find({ filename: fileName });
  const files = await cursor.toArray();
  return files.length > 0 ? files[0] : null;
};

/**
 * Get file info by ID
 * @param {ObjectId} fileId - The GridFS file ID
 * @returns {Promise<Object|null>} - File info or null
 */
export const getFileInfoById = async (fileId) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    return null;
  }

  const cursor = bucket.find({ _id: fileId });
  const files = await cursor.toArray();
  return files.length > 0 ? files[0] : null;
};

/**
 * Delete a file from GridFS by filename
 * @param {string} fileName - The filename to delete
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFromGridFS = async (fileName) => {
  try {
    const bucket = getGalleryBucket();
    if (!bucket) {
      console.warn('[GridFS] Cannot delete - bucket not initialized');
      return false;
    }

    const fileInfo = await getFileInfo(fileName);
    if (!fileInfo) {
      console.warn(`[GridFS] File not found for deletion: ${fileName}`);
      return false;
    }

    await bucket.delete(fileInfo._id);
    console.log(`[GridFS] Deleted file: ${fileName}`);
    return true;
  } catch (error) {
    console.error(`[GridFS] Error deleting ${fileName}:`, error.message);
    return false;
  }
};

/**
 * Delete a file from GridFS by ID
 * @param {ObjectId} fileId - The GridFS file ID
 * @returns {Promise<boolean>} - Success status
 */
export const deleteFromGridFSById = async (fileId) => {
  try {
    const bucket = getGalleryBucket();
    if (!bucket) {
      console.warn('[GridFS] Cannot delete - bucket not initialized');
      return false;
    }

    await bucket.delete(fileId);
    console.log(`[GridFS] Deleted file by ID: ${fileId}`);
    return true;
  } catch (error) {
    console.error(`[GridFS] Error deleting file ${fileId}:`, error.message);
    return false;
  }
};

/**
 * Stream file with range support (for video seeking)
 * @param {string} fileName - The filename
 * @param {Object} range - Range object { start, end }
 * @returns {Object} - { stream, start, end, fileSize }
 */
export const streamWithRange = async (fileName, range = null) => {
  const bucket = getGalleryBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }

  const fileInfo = await getFileInfo(fileName);
  if (!fileInfo) {
    throw new Error('File not found');
  }

  const fileSize = fileInfo.length;
  let start = 0;
  let end = fileSize - 1;

  if (range) {
    start = range.start || 0;
    end = range.end !== undefined ? Math.min(range.end, fileSize - 1) : fileSize - 1;
    
    // Validate range
    if (start >= fileSize) {
      throw new Error('Invalid range: start position exceeds file size');
    }
    if (start > end) {
      throw new Error('Invalid range: start exceeds end');
    }
  }

  const downloadStream = bucket.openDownloadStreamByName(fileName, {
    start,
    end: end + 1 // GridFS end is exclusive
  });

  return {
    stream: downloadStream,
    start,
    end,
    fileSize,
    contentLength: end - start + 1,
    fileInfo
  };
};

/**
 * Check if GridFS is available
 */
export const isGridFSAvailable = () => {
  return galleryBucket !== null || mongoose.connection.readyState === 1;
};

export default {
  initializeGalleryGridFS,
  getGalleryBucket,
  uploadToGridFS,
  createUploadStream,
  downloadFromGridFS,
  downloadFromGridFSById,
  getFileInfo,
  getFileInfoById,
  deleteFromGridFS,
  deleteFromGridFSById,
  streamWithRange,
  isGridFSAvailable
};
