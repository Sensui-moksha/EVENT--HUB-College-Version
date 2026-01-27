import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader, ArrowLeft, Play, X, Settings, Image as ImageIcon, Video, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL, prefetchVideo } from '../utils/api';
import { cacheManager, cacheKeys, CACHE_TTL, invalidateCache } from '../utils/cacheManager';
import MediaLightbox from '../components/MediaLightbox';

interface MediaItem {
  _id: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  mimeType?: string;
  source?: 'main' | 'sub';
  subEventTitle?: string;
}

interface GalleryData {
  id: string;
  eventId: string;
  published: boolean;
  mediaCount: number;
  coverImage?: string;
}

interface EventData {
  id: string;
  title: string;
  description?: string;
}

interface SubEventGallery {
  subEventId: string;
  subEventTitle: string;
  gallery: GalleryData;
  media: MediaItem[];
}

const GalleryDetail: React.FC = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  
  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;
  
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [event, setEvent] = useState<EventData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [subEventGalleries, setSubEventGalleries] = useState<SubEventGallery[]>([]);
  const [expandedSubEvents, setExpandedSubEvents] = useState<Record<string, boolean>>({});
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);

  const isAdminOrOrganizer = !!user && (user.role === 'admin' || user.role === 'organizer');

  // Get full URL for media
  const getMediaUrl = useCallback((url: string) => {
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  }, []);

  // Prefetch videos when hovering over thumbnails for smoother playback
  const prefetchVideoOnHover = useCallback((mediaItem: MediaItem) => {
    if (mediaItem.type === 'video') {
      prefetchVideo(getMediaUrl(mediaItem.publicUrl));
    }
  }, [getMediaUrl]);

  // Prefetch next/prev videos when in lightbox
  const prefetchAdjacentVideos = useCallback((currentIndex: number) => {
    const indices = [currentIndex - 1, currentIndex + 1];
    indices.forEach(i => {
      const normalizedIndex = (i + allMedia.length) % allMedia.length;
      const item = allMedia[normalizedIndex];
      if (item?.type === 'video') {
        prefetchVideo(getMediaUrl(item.publicUrl));
      }
    });
  }, [allMedia, getMediaUrl]);

  const fetchGallery = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    
    try {
      // Check cache first
      const cacheKey = cacheKeys.gallery(eventId);
      const mediaCacheKey = cacheKeys.galleryMedia(eventId);
      
      const cachedGallery = cacheManager.get<{ gallery: GalleryData; event: EventData }>(cacheKey);
      const cachedMedia = cacheManager.get<MediaItem[]>(mediaCacheKey);
      
      if (cachedGallery && cachedMedia) {
        setGallery(cachedGallery.gallery);
        setEvent(cachedGallery.event);
        setMedia(cachedMedia);
        setLoading(false);
        // Refresh in background
        fetchFromServer();
        return;
      }
      
      await fetchFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
      setLoading(false);
    }
    
    async function fetchFromServer() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/gallery/${eventId}`, { credentials: 'include' });
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load gallery');
        }
        
        // Cache the data
        cacheManager.set(cacheKeys.gallery(eventId!), { gallery: data.gallery, event: data.event }, { ttl: CACHE_TTL.GALLERY });
        cacheManager.set(cacheKeys.galleryMedia(eventId!), data.media || [], { ttl: CACHE_TTL.GALLERY_MEDIA });
        
        setGallery(data.gallery);
        setMedia(data.media || []);
        setEvent(data.event);

        // Fetch sub-event galleries
        const subRes = await fetch(`${API_BASE_URL}/api/gallery/${eventId}/sub-events`, { credentials: 'include' });
        if (subRes.ok) {
          const subData = await subRes.json();
          setSubEventGalleries(subData.subEventGalleries || []);
        }
        
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load gallery');
        setLoading(false);
      }
    }
  }, [eventId]);

  useEffect(() => {
    fetchGallery();
  }, [eventId]);

  // Combine all media for lightbox navigation
  useEffect(() => {
    const mainMedia = media.map(m => ({ ...m, source: 'main' as const }));
    const subMedia = subEventGalleries.flatMap(seg => 
      seg.media.map(m => ({ ...m, source: 'sub' as const, subEventTitle: seg.subEventTitle }))
    );
    setAllMedia([...mainMedia, ...subMedia]);
  }, [media, subEventGalleries]);

  const toggleSubEventExpanded = (subEventId: string) => {
    setExpandedSubEvents(prev => ({
      ...prev,
      [subEventId]: !prev[subEventId]
    }));
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    // Prefetch adjacent videos for smoother playback
    prefetchAdjacentVideos(index);
  };

  const closeLightbox = () => {
    setLightboxIndex(-1);
  };

  // Keyboard navigation handled by MediaLightbox component

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <Loader size={48} className="animate-spin mx-auto mb-4 text-white" />
          <p className="text-white/70">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-8 text-center">
          <p className="text-red-400 font-semibold mb-4">{error}</p>
          <Link 
            to="/gallery"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Galleries
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-20 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <Link 
              to="/gallery"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft size={18} />
              Back to Galleries
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              {event?.title || 'Gallery'}
            </h1>
            {event?.description && (
              <p className="text-white/60 max-w-2xl">{event.description}</p>
            )}
          </div>
          
          {/* Admin/Organizer: Manage button */}
          {isAdminOrOrganizer && (
            <Link
              to={`/dashboard/gallery/${eventId}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white rounded-xl font-medium transition-all shadow-lg"
            >
              <Settings size={18} />
              Manage Gallery
            </Link>
          )}
        </div>

        {/* Media count */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm">
            {media.length} {media.length === 1 ? 'item' : 'items'}
          </span>
          {subEventGalleries.length > 0 && (
            <span className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-full text-sm flex items-center gap-2">
              <Layers size={14} />
              {subEventGalleries.length} sub-event {subEventGalleries.length === 1 ? 'gallery' : 'galleries'}
              <span className="text-purple-400">
                ({subEventGalleries.reduce((acc, s) => acc + s.media.length, 0)} items)
              </span>
            </span>
          )}
          {!gallery?.published && (
            <span className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-full text-sm">
              Unpublished
            </span>
          )}
        </div>

        {/* Media Grid */}
        {media.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/10 flex items-center justify-center">
              <ImageIcon size={40} className="text-white/40" />
            </div>
            <p className="text-white/60 text-lg">No photos or videos yet</p>
            {isAdminOrOrganizer && (
              <Link
                to={`/dashboard/gallery/${eventId}`}
                className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors"
              >
                Upload Media
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {media.map((item, index) => (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative group aspect-square rounded-xl overflow-hidden bg-white/5 cursor-pointer"
                onClick={() => openLightbox(index)}
              >
                {item.type === 'image' ? (
                  <img
                    src={getMediaUrl(item.publicUrl)}
                    alt={item.fileName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="relative w-full h-full bg-slate-800">
                    <video
                      src={getMediaUrl(item.publicUrl)}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      poster={item.thumbnailUrl ? getMediaUrl(item.thumbnailUrl) : undefined}
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play size={28} className="text-white ml-1" fill="white" />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Type indicator */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-md text-white/80 text-xs flex items-center gap-1">
                  {item.type === 'image' ? <ImageIcon size={12} /> : <Video size={12} />}
                  {item.type}
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            ))}
          </div>
        )}

        {/* Sub-Event Galleries */}
        {subEventGalleries.length > 0 && (
          <div className="mt-12 space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Layers size={24} className="text-purple-400" />
              <h2 className="text-2xl font-bold text-white">Sub-Event Galleries</h2>
              <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                {subEventGalleries.length} {subEventGalleries.length === 1 ? 'gallery' : 'galleries'}
              </span>
            </div>

            {subEventGalleries.map((subEvent) => (
              <motion.div
                key={subEvent.subEventId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden"
              >
                {/* Sub-event header */}
                <button
                  onClick={() => toggleSubEventExpanded(subEvent.subEventId)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      <Layers size={20} className="text-purple-400" />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-semibold text-white">{subEvent.subEventTitle}</h3>
                      <p className="text-white/60 text-sm">
                        {subEvent.media.length} {subEvent.media.length === 1 ? 'item' : 'items'}
                        {!subEvent.gallery.published && (
                          <span className="ml-2 text-amber-400">(Unpublished)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  {expandedSubEvents[subEvent.subEventId] ? (
                    <ChevronUp size={20} className="text-white/60" />
                  ) : (
                    <ChevronDown size={20} className="text-white/60" />
                  )}
                </button>

                {/* Sub-event media grid */}
                <AnimatePresence>
                  {expandedSubEvents[subEvent.subEventId] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 pt-2">
                        {subEvent.media.length === 0 ? (
                          <p className="text-white/40 text-center py-8">No media in this gallery</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                            {subEvent.media.map((item, idx) => {
                              // Calculate global index for lightbox
                              const globalIndex = media.length + subEventGalleries
                                .slice(0, subEventGalleries.findIndex(s => s.subEventId === subEvent.subEventId))
                                .reduce((acc, s) => acc + s.media.length, 0) + idx;
                              
                              return (
                                <motion.div
                                  key={item._id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: idx * 0.03 }}
                                  className="relative group aspect-square rounded-lg overflow-hidden bg-white/5 cursor-pointer"
                                  onClick={() => openLightbox(globalIndex)}
                                >
                                  {item.type === 'image' ? (
                                    <img
                                      src={getMediaUrl(item.publicUrl)}
                                      alt={item.fileName}
                                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="relative w-full h-full bg-slate-800">
                                      <video
                                        src={getMediaUrl(item.publicUrl)}
                                        className="w-full h-full object-cover"
                                        muted
                                        playsInline
                                        preload="metadata"
                                        poster={item.thumbnailUrl ? getMediaUrl(item.thumbnailUrl) : undefined}
                                      />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Play size={20} className="text-white" fill="white" />
                                      </div>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Media Lightbox */}
      {lightboxIndex >= 0 && (
        <MediaLightbox
          media={allMedia}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </div>
  );
};

export default GalleryDetail;
