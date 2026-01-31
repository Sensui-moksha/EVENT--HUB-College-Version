import { useState, useCallback, useEffect } from 'react';
import { apiRequest, getApiUrl, API_BASE_URL } from '../utils/api';
import { cacheManager, cacheKeys, CACHE_TTL, invalidateCache } from '../utils/cacheManager';

// Type definitions
interface GalleryMedia {
  _id: string;
  eventId: string;
  galleryId: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
  mimeType: string;
  fileSize: number;
  order: number;
  uploadedAt: string;
}

interface Gallery {
  id: string;
  eventId: string;
  published: boolean;
  mediaCount: number;
  coverImage?: {
    publicUrl: string;
    thumbnailUrl?: string;
  };
  // Populated event data from backend
  event?: {
    title: string;
    description?: string;
  };
}

interface GalleryStats {
  totalMedia: number;
  totalFiles: number;
  images: number;
  imageCount: number;
  videos: number;
  videoCount: number;
  totalSize: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface GalleryListItem {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDescription: string;
  mediaCount: number;
  coverImage?: {
    publicUrl: string;
    thumbnailUrl?: string;
  };
  published?: boolean;
}

/**
 * Hook for fetching gallery data (public) with caching
 */
export const useGallery = (eventId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [media, setMedia] = useState<GalleryMedia[]>([]);

  const fetchGallery = useCallback(async (forceRefresh = false) => {
    if (!eventId) return;
    
    // Check cache first
    if (!forceRefresh) {
      const cacheKey = cacheKeys.gallery(eventId);
      const cached = cacheManager.get<{ gallery: Gallery; media: GalleryMedia[] }>(cacheKey);
      if (cached) {
        setGallery(cached.gallery);
        setMedia(cached.media || []);
        // Background refresh
        setLoading(false);
        fetchGalleryFromServer();
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    await fetchGalleryFromServer();
  }, [eventId]);

  const fetchGalleryFromServer = async () => {
    try {
      const data = await apiRequest(`/api/gallery/${eventId}`);
      // Cache the result
      cacheManager.set(cacheKeys.gallery(eventId), {
        gallery: data.gallery,
        media: data.media || []
      }, { ttl: CACHE_TTL.GALLERY });
      
      setGallery(data.gallery);
      setMedia(data.media || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (eventId) {
      fetchGallery();
    }
  }, [eventId]);

  return { gallery, media, loading, error, refetch: () => fetchGallery(true) };
};

/**
 * Hook for uploading media files with progress tracking
 * Uses XMLHttpRequest for reliable progress tracking and background tab support
 * GridFS-only uploads for maximum performance
 * 
 * BACKGROUND TAB BEHAVIOR:
 * - Upload continues even when tab is in background (XHR is network-level)
 * - Progress updates may be throttled by browser (batched to ~1/sec)
 * - Progress syncs immediately when tab becomes visible again
 */
export const useGalleryUpload = (eventId: string) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [currentXhr, setCurrentXhr] = useState<XMLHttpRequest | null>(null);
  const [isTabActive, setIsTabActive] = useState(true);

  // Track tab visibility to sync progress when user returns
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setIsTabActive(isVisible);
      
      // When tab becomes visible again, force a progress state refresh
      if (isVisible && uploading) {
        console.log('[Upload] Tab active - syncing progress');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [uploading]);

  // Cancel upload function
  const cancelUpload = useCallback(() => {
    if (currentXhr) {
      currentXhr.abort();
      setCurrentXhr(null);
    }
  }, [currentXhr]);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<GalleryMedia[]> => {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      setUploadSpeed(null);
      setTimeRemaining(null);
      setUploadedBytes(0);
      
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      setTotalBytes(totalSize);

      return new Promise((resolve, reject) => {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        // Use GridFS streaming endpoint - faster than Base64
        const url = getApiUrl(`/api/gallery/${eventId}/upload-stream`);

        const xhr = new XMLHttpRequest();
        setCurrentXhr(xhr);
        
        // 60 minute timeout for very large videos (increased from 30)
        xhr.timeout = 60 * 60 * 1000;
        
        // Track upload metrics
        const startTime = Date.now();
        let lastTime = startTime;
        let lastLoaded = 0;
        
        // Speed history for accurate averaging
        const speedHistory: number[] = [];
        const MAX_SPEED_SAMPLES = 10;
        
        // Keep track for progress interpolation
        let actualProgress = 0;
        let displayProgress = 0;
        let progressInterval: ReturnType<typeof setInterval> | null = null;
        let lastProgressUpdate = Date.now();
        
        // Smooth progress animation (runs every 50ms)
        const startProgressAnimation = () => {
          if (progressInterval) return;
          progressInterval = setInterval(() => {
            const now = Date.now();
            
            // If no real progress update in 10 seconds, show a slight animation to indicate activity
            if (now - lastProgressUpdate > 10000 && displayProgress < 99) {
              // Slow artificial progress to show upload is still working
              displayProgress = Math.min(displayProgress + 0.05, actualProgress + 1);
            } else if (displayProgress < actualProgress) {
              // Smoothly catch up to actual progress
              const diff = actualProgress - displayProgress;
              const increment = Math.max(0.1, diff * 0.15);
              displayProgress = Math.min(actualProgress, displayProgress + increment);
            }
            setUploadProgress(Math.round(displayProgress * 100) / 100);
          }, 50);
        };
        
        const stopProgressAnimation = () => {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        };
        
        xhr.upload.addEventListener('progress', (event) => {
          if (!event.lengthComputable) return;
          
          const now = Date.now();
          const loaded = event.loaded;
          const total = event.total;
          
          // Update actual progress
          actualProgress = (loaded / total) * 100;
          setUploadedBytes(loaded);
          lastProgressUpdate = now;
          
          // Start animation if not started
          startProgressAnimation();
          
          // Calculate speed (at least 300ms between calculations for stability)
          const timeDiff = now - lastTime;
          if (timeDiff >= 300) {
            const bytesDiff = loaded - lastLoaded;
            const instantSpeed = (bytesDiff / timeDiff) * 1000; // bytes per second
            
            // Add to history for averaging
            speedHistory.push(instantSpeed);
            if (speedHistory.length > MAX_SPEED_SAMPLES) {
              speedHistory.shift();
            }
            
            // Calculate average speed (more stable)
            const avgSpeed = speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length;
            setUploadSpeed(avgSpeed);
            
            // Calculate ETA
            const remaining = total - loaded;
            if (avgSpeed > 0) {
              const eta = Math.ceil(remaining / avgSpeed);
              setTimeRemaining(eta);
            }
            
            lastTime = now;
            lastLoaded = loaded;
          }
        });

        xhr.addEventListener('load', () => {
          stopProgressAnimation();
          setUploading(false);
          setCurrentXhr(null);
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              displayProgress = 100;
              setTimeRemaining(0);
              invalidateCache.onGalleryChange(eventId);
              resolve(data.media || []);
            } catch {
              setUploadError('Invalid server response');
              reject(new Error('Invalid server response'));
            }
          } else {
            let errorMsg = 'Upload failed';
            try {
              const data = JSON.parse(xhr.responseText);
              errorMsg = data.error || errorMsg;
            } catch { /* ignore */ }
            setUploadError(errorMsg);
            reject(new Error(errorMsg));
          }
        });

        xhr.addEventListener('error', () => {
          stopProgressAnimation();
          setUploading(false);
          setCurrentXhr(null);
          setUploadError('Network error. Check your connection and try again.');
          reject(new Error('Network error'));
        });

        xhr.addEventListener('abort', () => {
          stopProgressAnimation();
          setUploading(false);
          setCurrentXhr(null);
          setUploadError('Upload cancelled');
          reject(new Error('Upload cancelled'));
        });
        
        xhr.addEventListener('timeout', () => {
          stopProgressAnimation();
          setUploading(false);
          setCurrentXhr(null);
          setUploadError('Upload timed out. Try a smaller file or check your connection.');
          reject(new Error('Upload timeout'));
        });

        xhr.open('POST', url);
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    [eventId, cancelUpload]
  );

  return { 
    uploadFiles, 
    uploading, 
    uploadError, 
    uploadProgress, 
    uploadSpeed, 
    timeRemaining,
    uploadedBytes,
    totalBytes,
    cancelUpload
  };
};

/**
 * Hook for managing gallery (admin/organizer)
 */
export const useGalleryManagement = (eventId: string) => {
  const [galleryData, setGalleryData] = useState<Gallery | null>(null);
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [stats, setStats] = useState<GalleryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchManagement = useCallback(async () => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/gallery/${eventId}/manage`);
      setGalleryData(data.gallery);
      setMedia(data.media || []);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const deleteMedia = useCallback(
    async (mediaId: string): Promise<boolean> => {
      try {
        await apiRequest(`/api/gallery/media/${mediaId}`, { method: 'DELETE' });
        setMedia((prev) => prev.filter((m) => m._id !== mediaId));
        // Invalidate cache after deletion
        invalidateCache.onGalleryChange(eventId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Delete failed');
        return false;
      }
    },
    [eventId]
  );

  const reorderMedia = useCallback(
    async (mediaOrder: string[]): Promise<boolean> => {
      try {
        await apiRequest(`/api/gallery/${eventId}/reorder`, {
          method: 'PATCH',
          body: JSON.stringify({ mediaOrder }),
        });
        const newMedia = [...media].sort((a, b) => {
          return mediaOrder.indexOf(a._id) - mediaOrder.indexOf(b._id);
        });
        setMedia(newMedia);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Reorder failed');
        return false;
      }
    },
    [eventId, media]
  );

  const setCoverImage = useCallback(
    async (mediaId: string): Promise<boolean> => {
      try {
        const data = await apiRequest(`/api/gallery/${eventId}/cover`, {
          method: 'PATCH',
          body: JSON.stringify({ mediaId }),
        });
        setGalleryData(data.gallery);
        // Invalidate cache after cover image change
        invalidateCache.onGalleryChange(eventId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to set cover image');
        return false;
      }
    },
    [eventId]
  );

  const removeCoverImage = useCallback(
    async (): Promise<boolean> => {
      try {
        const data = await apiRequest(`/api/gallery/${eventId}/cover`, {
          method: 'PATCH',
          body: JSON.stringify({ mediaId: null }),
        });
        setGalleryData(data.gallery);
        // Invalidate cache after cover image removal
        invalidateCache.onGalleryChange(eventId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove cover image');
        return false;
      }
    },
    [eventId]
  );

  const togglePublish = useCallback(
    async (published: boolean): Promise<boolean> => {
      try {
        const data = await apiRequest(`/api/gallery/${eventId}/publish`, {
          method: 'PATCH',
          body: JSON.stringify({ published }),
        });
        setGalleryData(data.gallery);
        // Invalidate cache after publish toggle
        invalidateCache.onGalleryChange(eventId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Publish failed');
        return false;
      }
    },
    [eventId]
  );

  useEffect(() => {
    if (eventId) {
      fetchManagement();
    }
  }, [eventId, fetchManagement]);

  return {
    galleryData,
    media,
    stats,
    loading,
    error,
    deleteMedia,
    reorderMedia,
    setCoverImage,
    removeCoverImage,
    togglePublish,
    refetch: fetchManagement,
  };
};

/**
 * Hook for listing published galleries with caching
 */
export const useGalleryList = () => {
  const [galleries, setGalleries] = useState<GalleryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const fetchGalleries = async (page = 1, limit = 12, forceRefresh = false) => {
    const cacheKey = `${cacheKeys.galleries()}_page${page}_limit${limit}`;
    
    // Check cache first
    if (!forceRefresh) {
      const cached = cacheManager.get<{ galleries: GalleryListItem[]; pagination: Pagination }>(cacheKey);
      if (cached) {
        setGalleries(cached.galleries || []);
        setPagination(cached.pagination);
        setLoading(false);
        return;
      }
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/api/gallery?page=${page}&limit=${limit}`);
      // Cache the result
      cacheManager.set(cacheKey, {
        galleries: data.galleries || [],
        pagination: data.pagination
      }, { ttl: CACHE_TTL.GALLERY });
      
      setGalleries(data.galleries || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load galleries');
    } finally {
      setLoading(false);
    }
  };

  // Memoize refetch to prevent recreation on every render
  const refetch = useCallback((page?: number, limit?: number) => fetchGalleries(page, limit, true), []);
  
  return { galleries, loading, error, pagination, refetch };
};

/**
 * Helper to get media URL from MongoDB storage
 */
export const getMediaUrl = (fileName: string): string => {
  return `${API_BASE_URL}/api/gallery/media/${fileName}`;
};
