import mongoose from 'mongoose';

/**
 * Gallery Schema
 * 
 * Represents a gallery for an event.
 * One event = One gallery (1:1 relationship)
 */
const gallerySchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },

    subEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubEvent',
      default: null,
      index: true
    },

    folderPath: {
      type: String,
      required: true
    },

    coverMediaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GalleryMedia',
      default: null
    },

    published: {
      type: Boolean,
      default: false
    },

    mediaCount: {
      type: Number,
      default: 0
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    collection: 'galleries'
  }
);

// Indexes for performance
gallerySchema.index({ eventId: 1 });
gallerySchema.index({ subEventId: 1 });
gallerySchema.index({ published: 1 });
gallerySchema.index({ updatedAt: -1 });
// Compound unique index - one gallery per event/subevent combination
gallerySchema.index({ eventId: 1, subEventId: 1 }, { unique: true });

export default mongoose.model('Gallery', gallerySchema);
