import mongoose from 'mongoose';

/**
 * GalleryMedia Schema
 * 
 * Represents individual media items (images/videos) within a gallery.
 * Many media items belong to one gallery (Many:1 relationship)
 * 
 * Files are stored directly in MongoDB as Base64 encoded data.
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

    fileData: {
      type: String,
      required: true
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

export default mongoose.model('GalleryMedia', galleryMediaSchema);
