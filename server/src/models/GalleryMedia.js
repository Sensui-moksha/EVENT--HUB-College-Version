import mongoose from 'mongoose';

/**
 * GalleryMedia Schema
 * 
 * Represents individual media items (images/videos) within a gallery.
 * Many media items belong to one gallery (Many:1 relationship)
 * 
 * Files are stored in MongoDB GridFS for efficient large file handling.
 * The gridFSFileId references the file in the 'galleryMedia' GridFS bucket.
 */
const galleryMediaSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },

    galleryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gallery',
      required: true,
      index: true
    },

    fileName: {
      type: String,
      required: true
    },

    // Original filename from user's upload
    originalName: {
      type: String,
      required: false
    },

    // Legacy Base64 storage (for backward compatibility during migration)
    fileData: {
      type: String,
      required: false, // No longer required - GridFS is primary
      default: null
    },

    // GridFS file reference (primary storage)
    gridFSFileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Will be required after migration
      index: true
    },

    // Storage type indicator for handling both old and new files
    storageType: {
      type: String,
      enum: ['base64', 'gridfs'],
      default: 'gridfs'
    },

    publicUrl: {
      type: String,
      required: true
    },

    thumbnailUrl: {
      type: String,
      default: null
    },

    type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
      index: true
    },

    mimeType: {
      type: String,
      required: true
    },

    fileSize: {
      type: Number,
      required: true
    },

    dimensions: {
      width: { type: Number },
      height: { type: Number }
    },

    duration: {
      type: Number,
      default: null
    },

    order: {
      type: Number,
      default: 0
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    uploadedAt: {
      type: Date,
      default: Date.now
    },

    metadata: {
      type: Map,
      of: String,
      default: new Map()
    }
  },
  {
    timestamps: true,
    collection: 'gallery_media'
  }
);

// Indexes for performance
galleryMediaSchema.index({ eventId: 1, galleryId: 1 });
galleryMediaSchema.index({ galleryId: 1, order: 1 });
galleryMediaSchema.index({ type: 1 });
galleryMediaSchema.index({ uploadedAt: -1 });
galleryMediaSchema.index({ fileName: 1 }, { unique: true });
galleryMediaSchema.index({ gridFSFileId: 1 }); // Index for GridFS lookups
galleryMediaSchema.index({ storageType: 1 }); // Index for storage type queries

export default mongoose.model('GalleryMedia', galleryMediaSchema);
