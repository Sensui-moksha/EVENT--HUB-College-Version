import { useCallback, useRef, useEffect, useState } from 'react';
import { API_BASE_URL, prefetchVideo } from '../utils/api';

interface VideoOptimizationOptions {
  /**
   * Number of videos to prefetch ahead
   */
  prefetchAhead?: number;
  /**
   * Enable preloading metadata for faster initial load
   */
  preloadMetadata?: boolean;
  /**
   * Buffer size in seconds (how much to buffer ahead)
   */
  bufferSize?: number;
  /**
   * Enable aggressive buffering for smoother playback
   */
  aggressiveBuffering?: boolean;
}

interface VideoInfo {
  url: string;
  thumbnailUrl?: string;
  duration?: number;
}

/**
 * Hook for optimizing video playback in galleries and media viewers
 * 
 * Features:
 * - Prefetches videos ahead of current viewing position
 * - Manages video buffering for smooth playback
 * - Handles range requests for efficient seeking
 * - Integrates with service worker cache
 */
export const useVideoOptimization = (
  videos: VideoInfo[] = [],
  currentIndex: number = 0,
  options: VideoOptimizationOptions = {}
) => {
  const { prefetchAhead = 2, preloadMetadata = true, aggressiveBuffering = true } = options;
  
  const prefetchedUrls = useRef<Set<string>>(new Set());
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Get full URL for video
  const getVideoUrl = useCallback((url: string) => {
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  }, []);

  // Prefetch videos around current index
  useEffect(() => {
    if (videos.length === 0) return;

    const startIndex = Math.max(0, currentIndex - 1);
    const endIndex = Math.min(videos.length - 1, currentIndex + prefetchAhead);

    for (let i = startIndex; i <= endIndex; i++) {
      const video = videos[i];
      if (!video) continue;
      
      const fullUrl = getVideoUrl(video.url);
      
      // Skip if already prefetched
      if (prefetchedUrls.current.has(fullUrl)) continue;
      
      // Prefetch via service worker
      prefetchVideo(fullUrl);
      prefetchedUrls.current.add(fullUrl);
    }
  }, [videos, currentIndex, prefetchAhead, getVideoUrl]);

  // Create optimized video element with proper attributes
  const createOptimizedVideoElement = useCallback((
    url: string,
    options: {
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
      controls?: boolean;
      poster?: string;
    } = {}
  ): HTMLVideoElement => {
    const fullUrl = getVideoUrl(url);
    
    // Return cached element if exists
    const existing = videoRefs.current.get(fullUrl);
    if (existing) {
      return existing;
    }
    
    const video = document.createElement('video');
    
    // Set attributes for optimal loading
    video.preload = preloadMetadata ? 'metadata' : 'none';
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Apply options
    video.autoplay = options.autoplay ?? false;
    video.muted = options.muted ?? false;
    video.loop = options.loop ?? false;
    video.controls = options.controls ?? true;
    
    if (options.poster) {
      video.poster = options.poster;
    }
    
    video.src = fullUrl;
    
    // Cache the element
    videoRefs.current.set(fullUrl, video);
    
    return video;
  }, [getVideoUrl, preloadMetadata]);

  // Get video props optimized for React with YouTube-like buffering
  const getVideoProps = useCallback((
    url: string,
    options: {
      autoplay?: boolean;
      muted?: boolean;
      loop?: boolean;
      controls?: boolean;
      poster?: string;
      onLoadedMetadata?: () => void;
      onCanPlay?: () => void;
      onError?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
      onProgress?: (buffered: number, duration: number) => void;
    } = {}
  ): React.VideoHTMLAttributes<HTMLVideoElement> & { ref?: React.RefCallback<HTMLVideoElement> } => {
    const fullUrl = getVideoUrl(url);
    
    return {
      src: fullUrl,
      // Use 'auto' for aggressive buffering (loads video ahead like YouTube)
      preload: aggressiveBuffering ? 'auto' : (preloadMetadata ? 'metadata' : 'none'),
      playsInline: true,
      crossOrigin: 'anonymous',
      autoPlay: options.autoplay,
      muted: options.muted,
      loop: options.loop,
      controls: options.controls ?? true,
      poster: options.poster,
      onLoadedMetadata: options.onLoadedMetadata,
      onCanPlay: options.onCanPlay,
      onError: options.onError,
      // Track buffering progress
      onProgress: options.onProgress ? (e) => {
        const video = e.currentTarget;
        if (video.buffered.length > 0) {
          const bufferedEnd = video.buffered.end(video.buffered.length - 1);
          options.onProgress?.(bufferedEnd, video.duration);
        }
      } : undefined,
      // Performance optimizations
      style: {
        // Hardware acceleration
        transform: 'translateZ(0)',
        willChange: 'transform',
      }
    };
  }, [getVideoUrl, preloadMetadata, aggressiveBuffering]);

  // Preload specific video
  const preloadVideo = useCallback((url: string) => {
    const fullUrl = getVideoUrl(url);
    if (prefetchedUrls.current.has(fullUrl)) return;
    
    prefetchVideo(fullUrl);
    prefetchedUrls.current.add(fullUrl);
  }, [getVideoUrl]);

  // Clear prefetch cache (useful when leaving gallery)
  const clearPrefetchCache = useCallback(() => {
    prefetchedUrls.current.clear();
    videoRefs.current.clear();
  }, []);

  return {
    getVideoUrl,
    getVideoProps,
    createOptimizedVideoElement,
    preloadVideo,
    clearPrefetchCache,
    prefetchedCount: prefetchedUrls.current.size,
  };
};

/**
 * Hook for video player state management with buffering info
 * Provides YouTube-like buffer progress tracking
 */
export const useVideoPlayer = (_videoUrl?: string) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [bufferProgress, setBufferProgress] = useState(0); // 0-100%
  const [isBuffering, setIsBuffering] = useState(false);
  const [loadedSeconds, setLoadedSeconds] = useState(0);
  
  // Monitor buffer state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const updateBuffer = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration || 1;
        setBufferProgress(Math.min(100, (bufferedEnd / duration) * 100));
        setLoadedSeconds(bufferedEnd);
      }
    };
    
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handleCanPlay = () => setIsBuffering(false);
    
    video.addEventListener('progress', updateBuffer);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadeddata', updateBuffer);
    
    return () => {
      video.removeEventListener('progress', updateBuffer);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadeddata', updateBuffer);
    };
  }, []);
  
  const play = useCallback(() => {
    videoRef.current?.play().catch(console.warn);
  }, []);
  
  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);
  
  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);
  
  const setVolume = useCallback((volume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);
  
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, []);
  
  const toggleFullscreen = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await videoRef.current.requestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen not supported:', e);
    }
  }, []);
  
  // Get buffer ranges for visualization (like YouTube's grey bar)
  const getBufferRanges = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.buffered.length) return [];
    
    const ranges: { start: number; end: number }[] = [];
    for (let i = 0; i < video.buffered.length; i++) {
      ranges.push({
        start: video.buffered.start(i),
        end: video.buffered.end(i)
      });
    }
    return ranges;
  }, []);

  return {
    videoRef,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    // Buffer info
    bufferProgress,
    isBuffering,
    loadedSeconds,
    getBufferRanges,
  };
};

export default useVideoOptimization;
