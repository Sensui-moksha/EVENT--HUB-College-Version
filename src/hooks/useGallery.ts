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
      const data = await apiRequest(`gallery/${eventId}`);
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
 */
export const useGalleryUpload = (eventId: string) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFiles = useCallback(
    async (files: File[]): Promise<GalleryMedia[]> => {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);

      return new Promise((resolve, reject) => {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const url = getApiUrl(`gallery/${eventId}/upload`);

        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener('load', () => {
          setUploading(false);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              setUploadProgress(100);
              // Invalidate gallery cache after successful upload
              invalidateCache.onGalleryChange(eventId);
              resolve(data.media || []);
            } catch {
              setUploadError('Invalid response from server');
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              const errorMsg = data.error || 'Upload failed';
              setUploadError(errorMsg);
              reject(new Error(errorMsg));
            } catch {
              setUploadError('Upload failed');
              reject(new Error('Upload failed'));
            }
          }
        });

        xhr.addEventListener('error', () => {
          setUploading(false);
          setUploadError('Network error during upload');
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          setUploading(false);
          setUploadError('Upload cancelled');
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', url);
        xhr.withCredentials = true; // Include cookies for session auth
        xhr.send(formData);
      });
    },
    [eventId]
  );

  return { uploading, uploadError, uploadProgress, uploadFiles };
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
      const data = await apiRequest(`gallery/${eventId}/manage`);
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
        await apiRequest(`gallery/media/${mediaId}`, { method: 'DELETE' });
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
        await apiRequest(`gallery/${eventId}/reorder`, {
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
        const data = await apiRequest(`gallery/${eventId}/cover`, {
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
        const data = await apiRequest(`gallery/${eventId}/cover`, {
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
        const data = await apiRequest(`gallery/${eventId}/publish`, {
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
      const data = await apiRequest(`gallery?page=${page}&limit=${limit}`);
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
  return `${API_BASE_URL}/gallery/media/${fileName}`;
};
