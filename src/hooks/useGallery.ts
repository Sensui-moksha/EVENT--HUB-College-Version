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
 * CHUNKED UPLOAD for large videos:
 * - Videos over 3MB use chunked upload to avoid Cloudflare 100s timeout
 * - 2MB chunks ensure each request completes quickly
 * - Automatic retry on chunk failure
 * 
 * BACKGROUND TAB BEHAVIOR:
 * - Upload continues even when tab is in background (XHR is network-level)
 * - Progress updates may be throttled by browser (batched to ~1/sec)
 * - Progress syncs immediately when tab becomes visible again
 */

// Chunked upload threshold and chunk size
const CHUNKED_UPLOAD_THRESHOLD = 3 * 1024 * 1024; // 3MB - use chunked for larger videos
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks - safe for Cloudflare timeout

export const useGalleryUpload = (eventId: string) => {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [currentXhr, setCurrentXhr] = useState<XMLHttpRequest | null>(null);
  const [_isTabActive, setIsTabActive] = useState(true);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const abortControllerRef = { current: null as AbortController | null };

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, [currentXhr]);

  /**
   * Upload a single large file using chunked upload
   * This avoids Cloudflare's 100-second timeout by uploading in small pieces
   */
  const uploadFileChunked = useCallback(
    async (file: File, onProgress: (loaded: number, total: number) => void): Promise<GalleryMedia> => {
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      setUploadStatus(`Initializing chunked upload for ${file.name}...`);
      
      // 1. Initialize upload
      const initResponse = await apiRequest(`/api/gallery/${eventId}/upload-chunk/init`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks
        })
      });
      
      if (!initResponse.success) {
        throw new Error(initResponse.error || 'Failed to initialize upload');
      }
      
      const { uploadId } = initResponse;
      let uploadedChunks = 0;
      
      abortControllerRef.current = new AbortController();
      
      try {
        // 2. Upload each chunk
        for (let i = 0; i < totalChunks; i++) {
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error('Upload cancelled');
          }
          
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const chunkSize = end - start;
          
          setUploadStatus(`Uploading chunk ${i + 1}/${totalChunks}...`);
          
          // Convert blob to ArrayBuffer for reliable Content-Length with HTTP/2
          const chunkArrayBuffer = await chunk.arrayBuffer();
          
          // Upload chunk with retry
          let retries = 3;
          let lastError: Error | null = null;
          while (retries > 0) {
            try {
              console.log(`[Chunked] Uploading chunk ${i + 1}/${totalChunks} (${(chunkSize / 1024).toFixed(1)}KB)`);
              
              const chunkResponse = await fetch(
                getApiUrl(`/api/gallery/${eventId}/upload-chunk/${uploadId}/${i}`),
                {
                  method: 'POST',
                  body: chunkArrayBuffer,
                  credentials: 'include',
                  signal: abortControllerRef.current?.signal,
                  headers: {
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': chunkArrayBuffer.byteLength.toString()
                  }
                }
              );
              
              if (!chunkResponse.ok) {
                const errorText = await chunkResponse.text();
                let errorMsg = `Chunk upload failed: ${chunkResponse.status}`;
                try {
                  const errorData = JSON.parse(errorText);
                  errorMsg = errorData.error || errorMsg;
                } catch { /* ignore */ }
                throw new Error(errorMsg);
              }
              
              const result = await chunkResponse.json();
              console.log(`[Chunked] Chunk ${i + 1} uploaded:`, result);
              
              uploadedChunks++;
              // Update progress based on actual bytes uploaded
              onProgress(Math.min(uploadedChunks * CHUNK_SIZE, file.size), file.size);
              break; // Success, exit retry loop
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err));
              retries--;
              if (retries === 0) {
                console.error(`[Chunked] Failed to upload chunk ${i} after all retries:`, lastError);
                throw lastError;
              }
              console.log(`[Chunked] Retrying chunk ${i}, ${retries} attempts left. Error:`, lastError.message);
              await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
            }
          }
        }
        
        // 3. Complete upload with retry logic for network resilience
        setUploadStatus('Assembling file...');
        let completeRetries = 7; // Increased retries for slow connections
        let completeError: Error | null = null;
        let completeResponse: { success: boolean; error?: string; retryable?: boolean; media?: GalleryMedia } | null = null;
        
        while (completeRetries > 0) {
          try {
            // Use fetch directly with longer timeout for assembly
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000); // 4 minute timeout
            
            const response = await fetch(
              getApiUrl(`/api/gallery/${eventId}/upload-chunk/${uploadId}/complete`),
              { 
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
              }
            );
            
            clearTimeout(timeoutId);
            completeResponse = await response.json();
            
            if (completeResponse.success) {
              break; // Success!
            }
            
            // Check if server says it's not retryable
            if (completeResponse.retryable === false) {
              throw new Error(completeResponse.error || 'Upload cannot be completed');
            }
            
            completeError = new Error(completeResponse.error || 'Failed to complete upload');
            completeRetries--;
            
            if (completeRetries > 0) {
              console.log(`[Chunked] Complete request failed, retrying... (${completeRetries} attempts left):`, completeError.message);
              setUploadStatus(`Assembling file... (retry ${7 - completeRetries}/7)`);
              await new Promise(r => setTimeout(r, 3000)); // Wait 3s before retry
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            const isAbort = errorMsg.includes('aborted') || errorMsg.includes('abort');
            const isTimeout = isAbort || errorMsg.includes('timeout');
            const isNetworkError = errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('Failed to fetch');
            
            completeError = new Error(
              isTimeout ? 'Server is taking too long to assemble the file. Retrying...' :
              isNetworkError ? 'Network connection lost. Retrying...' :
              errorMsg
            );
            completeRetries--;
            
            if (completeRetries > 0) {
              console.log(`[Chunked] Complete request error, retrying... (${completeRetries} attempts left):`, completeError.message);
              setUploadStatus(`Assembling file... (retry ${7 - completeRetries}/7)`);
              await new Promise(r => setTimeout(r, isTimeout ? 5000 : 3000)); // Wait longer after timeout
            }
          }
        }
        
        if (!completeResponse?.success) {
          throw completeError || new Error('Failed to assemble file after multiple attempts. Please try again.');
        }
        
        return completeResponse.media as GalleryMedia;
      } catch (err) {
        // Cancel the chunked upload on error
        try {
          await fetch(
            getApiUrl(`/api/gallery/${eventId}/upload-chunk/${uploadId}`),
            { method: 'DELETE', credentials: 'include' }
          );
        } catch { /* ignore cleanup error */ }
        throw err;
      }
    },
    [eventId]
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<GalleryMedia[]> => {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      setUploadSpeed(null);
      setTimeRemaining(null);
      setUploadStatus('');
      setUploadedBytes(0);
      
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);
      setTotalBytes(totalSize);

      // Check if any video files need chunked upload (> 3MB)
      const largeVideoFiles = files.filter(
        f => f.type.startsWith('video/') && f.size > CHUNKED_UPLOAD_THRESHOLD
      );
      const regularFiles = files.filter(
        f => !(f.type.startsWith('video/') && f.size > CHUNKED_UPLOAD_THRESHOLD)
      );

      const allMedia: GalleryMedia[] = [];
      let totalUploaded = 0;

      try {
        // 1. Upload large videos using chunked upload
        for (const file of largeVideoFiles) {
          console.log(`[Upload] Using chunked upload for ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
          
          const media = await uploadFileChunked(file, (loaded, _total) => {
            const currentProgress = (totalUploaded + loaded) / totalSize * 100;
            setUploadProgress(Math.min(currentProgress, 99));
            setUploadedBytes(totalUploaded + loaded);
          });
          
          allMedia.push(media);
          totalUploaded += file.size;
        }

        // 2. Upload regular files (images and small videos) via streaming
        if (regularFiles.length > 0) {
          setUploadStatus('Uploading files...');
          const streamMedia = await new Promise<GalleryMedia[]>((resolve, reject) => {
            const formData = new FormData();
            regularFiles.forEach((file) => {
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
            let displayProgress = (totalUploaded / totalSize) * 100;
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
              
              // Update actual progress (accounting for already uploaded chunked files)
              actualProgress = ((totalUploaded + loaded) / totalSize) * 100;
              setUploadedBytes(totalUploaded + loaded);
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
                const remaining = totalSize - totalUploaded - loaded;
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
              setCurrentXhr(null);
              
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  resolve(data.media || []);
                } catch {
                  reject(new Error('Invalid server response'));
                }
              } else {
                let errorMsg = 'Upload failed';
                try {
                  const data = JSON.parse(xhr.responseText);
                  errorMsg = data.error || errorMsg;
                } catch { /* ignore */ }
                reject(new Error(errorMsg));
              }
            });

            xhr.addEventListener('error', () => {
              stopProgressAnimation();
              setCurrentXhr(null);
              reject(new Error('Network error. Connection may have been reset. Try uploading videos individually.'));
            });

            xhr.addEventListener('abort', () => {
              stopProgressAnimation();
              setCurrentXhr(null);
              reject(new Error('Upload cancelled'));
            });
            
            xhr.addEventListener('timeout', () => {
              stopProgressAnimation();
              setCurrentXhr(null);
              reject(new Error('Upload timed out. Try a smaller file or check your connection.'));
            });

            xhr.open('POST', url);
            xhr.withCredentials = true;
            xhr.send(formData);
          });

          allMedia.push(...streamMedia);
        }

        // Success
        setUploadProgress(100);
        setTimeRemaining(0);
        setUploadStatus('');
        invalidateCache.onGalleryChange(eventId);
        return allMedia;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(errorMsg);
        throw err;
      } finally {
        setUploading(false);
        setCurrentXhr(null);
      }
    },
    [eventId, cancelUpload, uploadFileChunked]
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
    cancelUpload,
    uploadStatus
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
