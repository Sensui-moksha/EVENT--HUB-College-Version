import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface MediaItem {
  _id: string;
  fileName: string;
  publicUrl: string;
  thumbnailUrl?: string;
  type: 'image' | 'video';
}

interface LightboxProps {
  images: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * Lightbox Component
 * 
 * Full-screen media viewer with:
 * - Navigation between media items
 * - Close button and ESC key support
 * - Touch/keyboard navigation
 */
export const Lightbox: React.FC<LightboxProps> = ({ images, initialIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  const current = images[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900/98 via-slate-800/98 to-slate-900/98 backdrop-blur-sm flex items-center justify-center"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Close button - Peaceful styling */}
      <button
        onClick={onClose}
        title="Close lightbox"
        aria-label="Close lightbox"
        className="absolute top-6 right-6 text-white/80 hover:text-white hover:bg-white/10 p-3 rounded-full transition-all duration-300"
      >
        <X size={22} />
      </button>

      {/* Main image/video */}
      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8 md:p-12">
        {current.type === 'image' ? (
          <img
            src={current.publicUrl}
            alt={current.fileName}
            className={`max-h-[85vh] max-w-[90vw] w-auto h-auto object-contain cursor-zoom-in rounded-lg shadow-2xl ${
              isZoomed ? 'scale-150 cursor-zoom-out' : ''
            } transition-transform duration-300`}
            onClick={() => setIsZoomed(!isZoomed)}
          />
        ) : (
          <video
            key={current._id}
            src={current.publicUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            controlsList="nodownload"
            onLoadStart={(e) => {
              const video = e.currentTarget;
              video.load();
            }}
            className="max-h-[85vh] max-w-[90vw] w-auto h-auto object-contain rounded-lg shadow-2xl bg-black"
          >
            <source src={current.publicUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>

      {/* Navigation arrows - Responsive touch-friendly buttons */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            title="Previous image"
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 p-3 sm:p-4 rounded-full transition-all duration-300 backdrop-blur-sm touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
          <button
            onClick={handleNext}
            title="Next image"
            aria-label="Next image"
            className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 text-white/80 hover:text-white hover:bg-white/10 p-3 sm:p-4 rounded-full transition-all duration-300 backdrop-blur-sm touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </>
      )}

      {/* Counter and metadata - Responsive pill */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 text-white text-center bg-white/10 backdrop-blur-md px-4 sm:px-6 py-2 sm:py-3 rounded-full">
        <p className="text-xs sm:text-sm font-light tracking-wider">
          {currentIndex + 1} <span className="text-white/50 mx-1">of</span> {images.length}
        </p>
      </div>

      {/* Thumbnails strip - Responsive and touch-friendly */}
      {images.length > 1 && (
        <div className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-3 overflow-x-auto max-w-[90vw] sm:max-w-md px-3 sm:px-4 py-2 scrollbar-hide">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              title={`View image ${idx + 1}`}
              aria-label={`View image ${idx + 1}`}
              className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 touch-manipulation ${
                idx === currentIndex 
                  ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-slate-900/50 scale-110' 
                  : 'opacity-50 hover:opacity-80 hover:scale-105'
              }`}
            >
              <img
                src={img.thumbnailUrl || img.publicUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Lightbox;