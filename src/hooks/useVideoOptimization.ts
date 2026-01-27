import { useCallback, useRef, useEffect } from 'react';
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
   * Buffer size in seconds
   */
  bufferSize?: number;
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
  const { prefetchAhead = 2, preloadMetadata = true } = options;
  
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

  // Get video props optimized for React
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
    } = {}
  ): React.VideoHTMLAttributes<HTMLVideoElement> => {
    const fullUrl = getVideoUrl(url);
    
    return {
      src: fullUrl,
      preload: preloadMetadata ? 'metadata' : 'none',
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
      // Performance optimizations
      style: {
        // Hardware acceleration
        transform: 'translateZ(0)',
        willChange: 'transform',
      }
    };
  }, [getVideoUrl, preloadMetadata]);

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
 * Hook for video player state management
 */
export const useVideoPlayer = (_videoUrl?: string) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
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

  return {
    videoRef,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
  };
};

export default useVideoOptimization;
