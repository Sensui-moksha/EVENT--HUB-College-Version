import React, { useCallback } from 'react';
import { Trash2, ImageIcon, VideoIcon, CheckCircle, XCircle, Star } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

interface MediaItem {
  _id: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
}

interface GalleryGridProps {
  media: MediaItem[];
  coverMediaId?: string | null;
  onMediaClick?: (index: number) => void;
  onDelete?: (mediaId: string) => Promise<boolean>;
  onSetCover?: (mediaId: string) => Promise<boolean>;
  onRemoveCover?: () => Promise<boolean>;
  onReorder?: (order: string[]) => Promise<boolean>;
  isManagement?: boolean;
}

/**
 * GalleryGrid Component
 * 
 * Masonry layout for gallery media with:
 * - Responsive grid
 * - Hover effects
 * - Management controls (if admin)
 * - Drag-and-drop reordering
 */
export const GalleryGrid: React.FC<GalleryGridProps> = ({
  media,
  coverMediaId,
  onMediaClick,
  onDelete,
  onSetCover,
  onRemoveCover,
  onReorder,
  isManagement = false
}) => {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);

  // Helper function to get full media URL (handles both relative and absolute URLs)
  const getMediaUrl = useCallback((url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }, []);

  const handleDragStart = (_e: React.DragEvent, mediaId: string) => {
    setDraggedId(mediaId);
  };

  const handleDragOver = (e: React.DragEvent, mediaId: string) => {
    e.preventDefault();
    setDragOverId(mediaId);
  };

  const handleDrop = async (e: React.DragEvent, mediaId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === mediaId || !onReorder) return;

    // Reorder media
    const draggedIndex = media.findIndex((m) => m._id === draggedId);
    const targetIndex = media.findIndex((m) => m._id === mediaId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newMedia = [...media];
    [newMedia[draggedIndex], newMedia[targetIndex]] = [
      newMedia[targetIndex],
      newMedia[draggedIndex]
    ];

    const newOrder = newMedia.map((m) => m._id);
    await onReorder(newOrder);
    setDraggedId(null);
  };

  const handleDelete = async (mediaId: string) => {
    if (!onDelete) return;
    if (confirm('Delete this media?')) {
      await onDelete(mediaId);
    }
  };

  const handleSetCover = async (mediaId: string) => {
    if (!onSetCover) return;
    await onSetCover(mediaId);
  };

  const handleRemoveCover = async () => {
    if (!onRemoveCover) return;
    await onRemoveCover();
  };

  if (media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-slate-400">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-teal-50 to-emerald-50 flex items-center justify-center">
          <span className="text-xl sm:text-2xl">🌿</span>
        </div>
        <p className="font-light text-sm sm:text-base">No media in this gallery yet</p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 lg:gap-5 auto-rows-[minmax(140px,auto)] sm:auto-rows-[minmax(180px,auto)] md:auto-rows-[minmax(200px,auto)] lg:auto-rows-[minmax(220px,auto)]"
    >
      {media.map((item, index) => (
        <div
          key={item._id}
          draggable={isManagement}
          onDragStart={(e) => handleDragStart(e, item._id)}
          onDragOver={(e) => handleDragOver(e, item._id)}
          onDrop={(e) => handleDrop(e, item._id)}
          onMouseEnter={() => setHoveredId(item._id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={() => onMediaClick?.(index)}
          className={`relative group rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden bg-gradient-to-br from-teal-50 to-emerald-50 cursor-pointer transition-all duration-500 hover:shadow-xl hover:shadow-teal-100/50 touch-manipulation ${
            isManagement ? 'cursor-move' : ''
          } ${dragOverId === item._id ? 'ring-2 ring-teal-400 ring-offset-2' : ''}`}
        >
          {/* Image/Video thumbnail */}
          {item.type === 'image' ? (
            <img
              src={getMediaUrl(item.thumbnailUrl || item.publicUrl)}
              alt={item.fileName}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
              <video
                src={getMediaUrl(item.publicUrl)}
                className="w-full h-full object-cover"
                muted
                preload="metadata"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 to-slate-800/40 flex items-center justify-center">
                <VideoIcon className="w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 text-white/80" />
              </div>
            </div>
          )}

          {/* Media type indicator - Responsive pill */}
          <div className="absolute top-2 sm:top-3 left-2 sm:left-3 flex gap-1.5 sm:gap-2">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-white/90 backdrop-blur-sm text-slate-600 text-[10px] sm:text-xs rounded-full font-medium shadow-sm">
              {item.type === 'image' ? (
                <ImageIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-500" />
              ) : (
                <VideoIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-500" />
              )}
              <span className="hidden xs:inline">{item.type}</span>
            </span>
            {/* Cover badge */}
            {coverMediaId === item._id && (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 bg-amber-400/95 backdrop-blur-sm text-amber-900 text-[10px] sm:text-xs rounded-full font-semibold shadow-sm">
                <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-900" />
                <span className="hidden sm:inline">Cover</span>
              </span>
            )}
          </div>

          {/* Hover overlay - Touch-friendly for mobile */}
          {(hoveredId === item._id || isManagement) && (
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-800/30 to-transparent flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300">
              {isManagement && (
                <>
                  {/* Show "Remove from Cover" button if this is the cover, otherwise "Set as Cover" */}
                  {coverMediaId === item._id ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCover();
                      }}
                      className="p-2 sm:p-2.5 bg-amber-400/90 backdrop-blur-sm text-amber-900 rounded-full hover:bg-amber-500 transition-all duration-300 shadow-lg touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                      title="Remove from cover (use event image)"
                      aria-label="Remove from cover"
                    >
                      <XCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCover(item._id);
                      }}
                      className="p-2 sm:p-2.5 bg-white/90 backdrop-blur-sm text-teal-600 rounded-full hover:bg-teal-500 hover:text-white transition-all duration-300 shadow-lg touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                      title="Set as cover"
                      aria-label="Set as cover"
                    >
                      <CheckCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item._id);
                    }}
                    className="p-2 sm:p-2.5 bg-white/90 backdrop-blur-sm text-rose-500 rounded-full hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-lg touch-manipulation min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                    title="Delete"
                    aria-label="Delete media"
                  >
                    <Trash2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                </>
              )}
              {!isManagement && (
                <button 
                  className="px-3 sm:px-5 py-2 sm:py-2.5 bg-white/95 backdrop-blur-sm text-slate-700 rounded-full font-medium hover:bg-white transition-all duration-300 shadow-lg text-xs sm:text-sm touch-manipulation"
                  title="View media"
                  aria-label="View media"
                >
                  View
                </button>
              )}
            </div>
          )}

          {/* File name on hover - Mobile-friendly */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/80 via-slate-900/40 to-transparent p-2 sm:p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            <p className="text-white/90 text-[10px] sm:text-xs truncate font-light">{item.fileName}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GalleryGrid;