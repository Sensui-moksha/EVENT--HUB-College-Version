import React from 'react';
import { Edit, Trash2, EyeOff, Eye as EyeIcon, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import { Image as ImageIcon, MapPin, Users, Camera, Eye, Sparkles } from 'lucide-react';

interface CoverImage {
  publicUrl?: string;
  thumbnailUrl?: string;
}

interface GalleryData {
  mediaCount?: number;
  coverImage?: CoverImage;
  published?: boolean;
  subEventGalleryCount?: number;
  subEventMediaCount?: number;
}

interface EventData {
  title: string;
  description?: string;
  location?: string;
  attendees?: number;
}

interface GalleryCardProps {
  event: EventData;
  gallery: GalleryData;
  onClick: () => void;
  index?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * GalleryCard Component
 * 
 * Elegant gallery card with glassmorphism effects
 * Features stunning hover animations and gradient overlays
 */
const GalleryCard: React.FC<GalleryCardProps> = ({ event, gallery, onClick, index = 0, onEdit, onDelete }) => {
  const mediaCount = gallery.mediaCount || 0;
  const coverImage = gallery.coverImage?.publicUrl || gallery.coverImage?.thumbnailUrl;
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  // Treat undefined/null as unpublished (false) - only explicitly true means published
  const isPublished = gallery.published === true;
  const isUnpublished = !isPublished;
  const subEventCount = gallery.subEventGalleryCount || 0;
  const totalMediaWithSubEvents = mediaCount + (gallery.subEventMediaCount || 0);

  return (
    <motion.div
      onClick={onClick}
      className={`group relative cursor-pointer ${isUnpublished ? 'opacity-80' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
    >
      {/* Glow effect on hover */}
      <div className={`absolute -inset-1 bg-gradient-to-r ${isUnpublished ? 'from-amber-600 to-orange-600' : 'from-violet-600 to-fuchsia-600'} rounded-2xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500`}></div>
      
      {/* Main card */}
      <div className="relative bg-white/10 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/20 shadow-xl group-hover:border-white/40 transition-all duration-500">
        {/* Cover image */}
        <div className="relative w-full h-52 overflow-hidden">
          {coverImage ? (
            <img
              src={coverImage}
              alt={event.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-900/50 to-fuchsia-900/50">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full blur-lg opacity-40 animate-pulse"></div>
                <Camera size={48} className="text-white/40 relative z-10" />
              </div>
            </div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Media count badge - floating style */}
          <div className="absolute top-3 right-3 flex flex-col gap-1.5 items-end">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-xs font-semibold">
              <ImageIcon size={12} className="text-violet-300" />
              <span>{subEventCount > 0 ? totalMediaWithSubEvents : mediaCount}</span>
            </div>
            
            {/* Sub-event count badge */}
            {subEventCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/80 backdrop-blur-md border border-purple-400/50 text-white text-xs font-semibold">
                <Layers size={12} />
                <span>{subEventCount} sub-event{subEventCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Unpublished badge */}
          {isUnpublished && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/90 backdrop-blur-md border border-amber-400/50 text-white text-xs font-semibold">
              <EyeOff size={12} />
              <span>Unpublished</span>
            </div>
          )}

          {/* Published badge - shown to admins/organizers */}
          {!isUnpublished && user && (user.role === 'admin' || user.role === 'organizer') && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/90 backdrop-blur-md border border-emerald-400/50 text-white text-xs font-semibold">
              <EyeIcon size={12} />
              <span>Published</span>
            </div>
          )}

          {/* Sparkle effect on hover - only for published and non-admin users */}
          {!isUnpublished && (!user || (user.role !== 'admin' && user.role !== 'organizer')) && (
            <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-all duration-300 delay-100">
              <Sparkles size={16} className="text-amber-400 animate-pulse" />
            </div>
          )}

          {/* Title overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-bold text-white text-lg leading-tight line-clamp-2 drop-shadow-lg group-hover:text-violet-200 transition-colors duration-300">
              {event.title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-3">
          {/* Description */}
          {event.description && (
            <p className="text-white/60 text-sm mb-3 line-clamp-2 leading-relaxed">{event.description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/50 mb-4">
            {event.location && (
              <div className="flex items-center gap-1">
                <MapPin size={11} className="text-violet-400" />
                <span className="truncate max-w-[120px]">{event.location}</span>
              </div>
            )}

            {event.attendees !== undefined && (
              <div className="flex items-center gap-1">
                <Users size={11} className="text-fuchsia-400" />
                <span>{event.attendees}</span>
              </div>
            )}

            <div className="flex items-center gap-1">
              <Camera size={11} className="text-amber-400" />
              <span>{mediaCount} {mediaCount === 1 ? 'photo' : 'photos'}</span>
            </div>
          </div>

          {/* Actions: Open, Edit, Delete (admin/organizer only) */}
          <div className="flex gap-2 mt-2">
            <button
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 group-hover:scale-[1.02]"
              title="Open Gallery"
              onClick={onClick}
            >
              <Eye size={16} />
              <span>Open</span>
            </button>
            {(user && (user.role === 'admin' || user.role === 'organizer')) && (
              <>
                <button
                  className="flex items-center justify-center px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500 transition-all duration-300"
                  title="Edit Gallery"
                  onClick={e => { e.stopPropagation(); onEdit && onEdit(); }}
                >
                  <Edit size={16} />
                </button>
                <button
                  className="flex items-center justify-center px-3 py-2 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white hover:from-red-500 hover:to-pink-500 transition-all duration-300"
                  title="Delete Gallery"
                  onClick={e => { e.stopPropagation(); onDelete && onDelete(); }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
    </motion.div>
  );
};

export default GalleryCard;
