import React, { useState, useRef, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  Download,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

interface MediaItem {
  _id: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video' | 'audio' | 'model';
  mimeType?: string;
}

interface MediaLightboxProps {
  media: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Unified Media Lightbox Component
 * 
 * Full-screen media viewer supporting:
 * - Images (with zoom controls)
 * - Videos (custom player with 10s skip buttons)
 * - Audio (with waveform-style player)
 * - 3D Models (basic viewer)
 * - Touch swipe gestures
 * - Keyboard navigation
 * - Smooth animations
 */
export const MediaLightbox: React.FC<MediaLightboxProps> = ({ media, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showSwipeCounter, setShowSwipeCounter] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  
  // Video player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [bufferedProgress, setBufferedProgress] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const lastTapRef = useRef<number | null>(null);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const current = media[currentIndex];

  // Navigation functions
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
    resetMediaState();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
    resetMediaState();
  };

  const resetMediaState = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setZoomLevel(1);
    setBufferedProgress(0);
    setIsBuffering(false);
  };

  // Swipe handlers for touch devices
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrevious(),
    trackMouse: true,
    trackTouch: true,
    preventScrollOnSwipe: true,
    delta: 50,
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        case 'ArrowUp':
          e.preventDefault();
          increaseVolume();
          break;
        case 'ArrowDown':
          e.preventDefault();
          decreaseVolume();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying]);

  // Show a brief swipe counter on mobile when user changes images
  useEffect(() => {
    setShowSwipeCounter(true);
    const t = setTimeout(() => setShowSwipeCounter(false), 1500);
    return () => clearTimeout(t);
  }, [currentIndex]);

  const isLandscape = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(orientation: landscape)').matches;

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const width = rect.width || window.innerWidth;
    const isLeft = x < width * 0.35;
    const isRight = x > width * 0.65;
    const isCenter = !isLeft && !isRight;

    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 300) {
      // double tap
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current as NodeJS.Timeout);
        tapTimeoutRef.current = null;
      }
      lastTapRef.current = null;
      if (isLeft) skipBackward5();
      else if (isRight) skipForward5();
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        lastTapRef.current = null;
        // single tap: toggle controls visibility (mobile/tablet/desktop touch)
        setShowControls((s) => {
          const next = !s;
          if (next) scheduleAutoHideControls(3000);
          else if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current as NodeJS.Timeout);
          return next;
        });
      }, 300) as unknown as NodeJS.Timeout;
    }
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current as NodeJS.Timeout);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current as NodeJS.Timeout);
    };
  }, []);

  // Ensure controls are visible when video is paused/not playing; auto-hide when playing
  useEffect(() => {
    if (current.type === 'video') {
      if (!isPlaying) {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current as NodeJS.Timeout);
      } else {
        scheduleAutoHideControls(3000);
      }
    }
  }, [isPlaying, currentIndex]);

  // Track mobile landscape to hide certain UI elements
  useEffect(() => {
    const check = () => {
      const mobileLandscape = typeof window !== 'undefined' && window.innerWidth <= 1024 && window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
      setIsMobileLandscape(mobileLandscape);
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Video player functions
  const togglePlayPause = () => {
    if (current.type === 'video' && videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (current.type === 'audio' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipBackward = () => {
    skip(-10);
  };

  const skipForward = () => {
    skip(10);
  };

  const skip = (seconds: number) => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      const next = Math.min(ref.duration || Infinity, Math.max(0, ref.currentTime + seconds));
      ref.currentTime = next;
      setCurrentTime(next);
    }
  };

  const skipBackward5 = () => skip(-5);
  const skipForward5 = () => skip(5);

  const toggleMute = () => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      ref.muted = !ref.muted;
      setIsMuted(ref.muted);
    }
  };

  const increaseVolume = () => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      const newVolume = Math.min(1, ref.volume + 0.1);
      ref.volume = newVolume;
      setVolume(newVolume);
      if (newVolume > 0) setIsMuted(false);
    }
  };

  const decreaseVolume = () => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      const newVolume = Math.max(0, ref.volume - 0.1);
      ref.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      ref.currentTime = parseFloat(e.target.value);
      setCurrentTime(parseFloat(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ref = current.type === 'video' ? videoRef.current : audioRef.current;
    if (ref) {
      const newVolume = parseFloat(e.target.value);
      ref.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = () => {
    const ref = current.type === 'video' ? videoRef.current : null;
    if (ref) {
      if (!document.fullscreenElement) {
        ref.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls after inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const scheduleAutoHideControls = (ms = 3000) => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current as NodeJS.Timeout);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && isLandscape() && window.innerWidth <= 1024) {
        setShowControls(false);
      }
    }, ms) as unknown as NodeJS.Timeout;
  };

  // Zoom controls for images
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.5, 1));
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = current.publicUrl;
    link.download = current.fileName;
    link.click();
  };

  // Render media based on type
  const renderMedia = () => {
    switch (current.type) {
      case 'image':
        return (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full flex items-center justify-center px-2 sm:px-4"
          >
            <img
              src={current.publicUrl}
              alt={current.fileName}
              className="max-h-[70vh] sm:max-h-[80vh] md:max-h-[85vh] max-w-[95vw] sm:max-w-[90vw] w-auto h-auto object-contain rounded-lg shadow-2xl transition-transform duration-300"
              style={{ transform: `scale(${zoomLevel})` }}
              draggable={false}
            />
            
            {/* Image zoom controls */}
            <div className="absolute bottom-28 sm:bottom-4 right-2 sm:right-4 flex gap-2 z-[60]">
              <button
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                title="Zoom Out"
              >
                <ZoomOut size={18} className="sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 3}
                className="p-2 sm:p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm"
                title="Zoom In"
              >
                <ZoomIn size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </motion.div>
        );

      case 'video':
        return (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full flex items-center justify-center px-2 sm:px-4"
            onMouseMove={handleMouseMove}
            onTouchStart={() => {
              setShowControls(true);
              if (isLandscape() && window.innerWidth <= 768) scheduleAutoHideControls(3000);
            }}
            onTouchEnd={handleTouchEnd}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            <video
              ref={videoRef}
              className="max-h-[65vh] sm:max-h-[75vh] md:max-h-[80vh] max-w-[95vw] sm:max-w-[90vw] w-auto h-auto rounded-lg shadow-2xl bg-black"
              onClick={() => current.type === 'video' && togglePlayPause()}
              onTouchStart={() => {
                setShowControls(true);
                if (isLandscape() && window.innerWidth <= 1024) scheduleAutoHideControls(3000);
              }}
              onTouchEnd={handleTouchEnd}
              onTimeUpdate={(e) => {
                setCurrentTime(e.currentTarget.currentTime);
                // Update buffered progress
                if (e.currentTarget.buffered.length > 0) {
                  const bufferedEnd = e.currentTarget.buffered.end(e.currentTarget.buffered.length - 1);
                  setBufferedProgress((bufferedEnd / e.currentTarget.duration) * 100);
                }
              }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onProgress={(e) => {
                // Track buffered chunks for streaming
                if (e.currentTarget.buffered.length > 0) {
                  const bufferedEnd = e.currentTarget.buffered.end(e.currentTarget.buffered.length - 1);
                  setBufferedProgress((bufferedEnd / e.currentTarget.duration) * 100);
                }
              }}
              playsInline
              preload="metadata"
            >
              <source src={current.publicUrl} type="video/mp4" />
              <source src={current.publicUrl} type="video/webm" />
              Your browser does not support the video tag.
            </video>

            {/* Buffering Indicator */}
            {isBuffering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm">Buffering...</span>
                </div>
              </div>
            )}

            {/* Custom Video Controls */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3 sm:p-4 md:p-6 rounded-b-lg"
                >
                  {/* Progress Bar with Buffering Indicator */}
                  <div className="mb-2 sm:mb-4">
                    <div className="relative h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden">
                      {/* Buffered progress (gray) */}
                      <div 
                        className="absolute top-0 left-0 h-full bg-white/40 rounded-full transition-all duration-300"
                        style={{ width: `${bufferedProgress}%` }}
                      />
                      {/* Played progress (violet) */}
                      <div 
                        className="absolute top-0 left-0 h-full bg-violet-500 rounded-full"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      />
                      {/* Seekable input */}
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer touch-none"
                      />
                      {/* Seek thumb */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 bg-violet-500 rounded-full shadow-lg pointer-events-none transition-transform hover:scale-110"
                        style={{ left: `calc(${duration ? (currentTime / duration) * 100 : 0}% - 6px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] sm:text-xs text-white/70 mt-1">
                      <span>{formatTime(currentTime)}</span>
                      <div className="flex items-center gap-2">
                        {isBuffering && (
                          <span className="text-violet-400 animate-pulse">Buffering...</span>
                        )}
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
                      {/* 10s Backward */}
                      <button
                        onClick={skipBackward}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-all group"
                        title="Skip backward 10 seconds"
                      >
                        <div className="relative">
                          <RotateCcw size={16} className="sm:w-5 sm:h-5 text-white" />
                          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] sm:text-[10px] font-bold text-white">
                            10
                          </span>
                        </div>
                      </button>

                      {/* Play/Pause */}
                      <button
                        onClick={togglePlayPause}
                        className="p-2 sm:p-3 bg-violet-600 hover:bg-violet-700 rounded-full transition-all"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? <Pause size={18} className="sm:w-6 sm:h-6 text-white" /> : <Play size={18} className="sm:w-6 sm:h-6 text-white ml-0.5" />}
                      </button>

                      {/* 10s Forward */}
                      <button
                        onClick={skipForward}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-all group"
                        title="Skip forward 10 seconds"
                      >
                        <div className="relative">
                          <RotateCw size={16} className="sm:w-5 sm:h-5 text-white" />
                          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] sm:text-[10px] font-bold text-white">
                            10
                          </span>
                        </div>
                      </button>

                      {/* Volume Control - Hidden on mobile */}
                      <div className="hidden sm:flex items-center gap-2 group">
                        <button
                          onClick={toggleMute}
                          className="p-2 hover:bg-white/10 rounded-full transition-all"
                          title={isMuted ? 'Unmute' : 'Mute'}
                        >
                          {isMuted || volume === 0 ? <VolumeX size={18} className="sm:w-5 sm:h-5 text-white" /> : <Volume2 size={18} className="sm:w-5 sm:h-5 text-white" />}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={volume}
                          onChange={handleVolumeChange}
                          className="w-0 group-hover:w-16 sm:group-hover:w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer transition-all duration-300
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-3
                            [&::-webkit-slider-thumb]:h-3
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-white
                            [&::-webkit-slider-thumb]:cursor-pointer
                            [&::-moz-range-thumb]:w-3
                            [&::-moz-range-thumb]:h-3
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-white
                            [&::-moz-range-thumb]:border-0"
                        />
                      </div>
                    </div>

                    {/* Right controls */}
                    <div className="flex items-center gap-1 sm:gap-2">
                      {/* Mobile mute button */}
                      <button
                        onClick={toggleMute}
                        className="sm:hidden p-1.5 hover:bg-white/10 rounded-full transition-all"
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted || volume === 0 ? <VolumeX size={16} className="text-white" /> : <Volume2 size={16} className="text-white" />}
                      </button>
                      <button
                        onClick={toggleFullscreen}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-full transition-all"
                        title="Fullscreen"
                      >
                        <Maximize size={16} className="sm:w-5 sm:h-5 text-white" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case 'audio':
        return (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-sm sm:max-w-lg md:max-w-2xl mx-auto px-4"
          >
            <audio
              ref={audioRef}
              src={current.publicUrl}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              preload="metadata"
            />

            {/* Audio Player UI */}
            <div className="bg-gradient-to-br from-violet-900/40 to-purple-900/40 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/10">
              {/* Waveform visualization placeholder */}
              <div className="h-32 mb-6 bg-black/30 rounded-lg flex items-center justify-center">
                <div className="flex items-end gap-1 h-20">
                  {[...Array(50)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-violet-500 to-purple-400 rounded-full transition-all"
                      style={{
                        height: `${Math.random() * 100}%`,
                        opacity: i / 50 < currentTime / duration ? 1 : 0.3,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* File name */}
              <h3 className="text-white text-xl font-semibold mb-4 text-center truncate">{current.fileName}</h3>

              {/* Progress bar */}
              <div className="mb-6">
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-violet-500
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="flex justify-between text-sm text-white/60 mt-2">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={skipBackward}
                  className="p-3 hover:bg-white/10 rounded-full transition-all"
                  title="Skip backward 10 seconds"
                >
                  <div className="relative">
                    <RotateCcw size={24} className="text-white" />
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                      10
                    </span>
                  </div>
                </button>

                <button
                  onClick={togglePlayPause}
                  className="p-4 bg-violet-600 hover:bg-violet-700 rounded-full transition-all shadow-lg"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause size={28} className="text-white" /> : <Play size={28} className="text-white ml-1" />}
                </button>

                <button
                  onClick={skipForward}
                  className="p-3 hover:bg-white/10 rounded-full transition-all"
                  title="Skip forward 10 seconds"
                >
                  <div className="relative">
                    <RotateCw size={24} className="text-white" />
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-white">
                      10
                    </span>
                  </div>
                </button>

                <button
                  onClick={toggleMute}
                  className="p-3 hover:bg-white/10 rounded-full transition-all"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={24} className="text-white" /> : <Volume2 size={24} className="text-white" />}
                </button>
              </div>
            </div>
          </motion.div>
        );

      case 'model':
        return (
          <motion.div
            key={current._id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="relative w-full h-full flex items-center justify-center"
          >
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-8 max-w-2xl">
              <div className="text-white text-center">
                <h3 className="text-2xl font-bold mb-4">3D Model Viewer</h3>
                <p className="text-white/60 mb-6">{current.fileName}</p>
                <div className="bg-black/30 rounded-lg p-12 mb-6">
                  <p className="text-white/40">3D model viewer coming soon...</p>
                  <p className="text-sm text-white/30 mt-2">File: {current.publicUrl}</p>
                </div>
                <a
                  href={current.publicUrl}
                  download={current.fileName}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 rounded-lg transition-all"
                >
                  <Download size={20} />
                  Download Model
                </a>
              </div>
            </div>
          </motion.div>
        );

      default:
        return (
          <div className="text-white text-center">
            <p>Unsupported media type</p>
          </div>
        );
    }
  };

  return (
    <div
      {...swipeHandlers}
      className="fixed inset-0 z-[60] overflow-hidden bg-gradient-to-br from-slate-900/98 via-slate-800/98 to-slate-900/98 backdrop-blur-md flex items-center justify-center"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-12 sm:top-6 right-3 sm:right-6 text-white/90 hover:text-white hover:bg-white/10 p-2 sm:p-3 rounded-full transition-all duration-300 z-[70]"
        title="Close (ESC)"
      >
        <X size={20} className="sm:w-6 sm:h-6" />
      </button>

      {/* Download button */}
      <button
        onClick={handleDownload}
        className="absolute top-12 sm:top-6 right-14 sm:right-20 text-white/80 hover:text-white hover:bg-white/10 p-2 sm:p-3 rounded-full transition-all duration-300 z-[70]"
        title="Download"
      >
        <Download size={20} className="sm:w-6 sm:h-6" />
      </button>

      {/* Media counter */}
      {media.length > 1 && (
        <div className="absolute top-12 sm:top-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-white text-xs sm:text-sm z-[70]">
          {currentIndex + 1} / {media.length}
        </div>
      )}

      {/* Main content */}
      <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <AnimatePresence mode="wait">
          {renderMedia()}
        </AnimatePresence>
      </div>

      {/* Navigation arrows */}
      {media.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="hidden sm:flex absolute left-1 sm:left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 p-2 sm:p-4 rounded-full transition-all duration-300 z-[60]"
            title="Previous (←)"
          >
            <ChevronLeft size={24} className="sm:w-8 sm:h-8" />
          </button>
          <button
            onClick={handleNext}
            className="hidden sm:flex absolute right-1 sm:right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 p-2 sm:p-4 rounded-full transition-all duration-300 z-[60]"
            title="Next (→)"
          >
            <ChevronRight size={24} className="sm:w-8 sm:h-8" />
          </button>
        </>
      )}

      {/* Keyboard shortcuts hint */}
      {!isMobileLandscape && (
        <div className="absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 sm:px-6 sm:py-3 rounded-full text-white/60 text-[10px] sm:text-xs z-50 hidden md:block">
          <span className="mr-4">←→ Navigate</span>
          <span className="mr-4">Space Play/Pause</span>
          <span className="mr-4">F Fullscreen</span>
          <span>ESC Close</span>
        </div>
      )}

      {/* Mobile swipe counter - shows briefly while user swipes through images */}
      {showSwipeCounter && (
        <div className="sm:hidden absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-white text-sm z-[70]">
          {`${currentIndex + 1}/${media.length}`}
        </div>
      )}
    </div>
  );
};

export default MediaLightbox;
