import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { generateThumbnail, blobToFile } from '../utils/imageProcessing';
import { API_BASE_URL } from '../utils/api';
import ImageBrowser from './ImageBrowser';

// Helper function to get full image URL for relative paths
const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  // If it's already a full URL or data URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  // If it's a relative path (like /api/images/...), prepend API_BASE_URL
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

type AspectRatioOption = {
  label: string;
  value: number | undefined; // undefined = free form
};

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: 'Free', value: undefined },
  { label: '16:9', value: 16 / 9 },
  { label: '4:3', value: 4 / 3 },
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
];

type Props = {
  initialPreviewUrl?: string;
  editingEventId?: string;
  embeddedMode?: boolean;
  externalImageUrl?: string;
  onExternalImageEdit?: (editedBlob: Blob, previewUrl: string, width: number, height: number) => void;
  onChange: (payload: {
    mode: 'none' | 'upload';
    file?: File;
    blob?: Blob;
    previewUrl?: string;
    width?: number;
    height?: number;
    originalName?: string;
    deleted?: boolean;
  }) => void;
};

const ImageUploadManager: React.FC<Props> = ({ 
  initialPreviewUrl, 
  editingEventId, 
  embeddedMode = false, 
  externalImageUrl, 
  onExternalImageEdit, 
  onChange 
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [file, setFile] = useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialPreviewUrl);
  const [cropOpen, setCropOpen] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number }>({});
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<number | undefined>(undefined);
  const [isEditingExternalUrl, setIsEditingExternalUrl] = useState(false);
  const [externalImageDataUrl, setExternalImageDataUrl] = useState<string | undefined>();
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setPreviewUrl(initialPreviewUrl);
  }, [initialPreviewUrl]);

  const selectFile = () => fileInputRef.current?.click();

  // Allow external trigger (from URL container button) - now opens browser
  useEffect(() => {
    const handler = () => setShowImageBrowser(true);
    window.addEventListener('trigger-local-upload', handler as EventListener);
    return () => window.removeEventListener('trigger-local-upload', handler as EventListener);
  }, []);

  // Listen for external URL edit trigger
  useEffect(() => {
    const handler = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const url = customEvent.detail?.url || externalImageUrl;
      if (url) {
        try {
          const proxyUrl = `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
          }
          
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          
          setExternalImageDataUrl(dataUrl);
          setIsEditingExternalUrl(true);
          setCrop(undefined);
          setCompletedCrop(undefined);
          setScale(1);
          setCropOpen(true);
        } catch (err) {
          console.error('Failed to load external image for editing:', err);
          alert('Failed to load image for editing. The image URL may be inaccessible or invalid.');
        }
      }
    };
    window.addEventListener('trigger-edit-external-image', handler);
    return () => window.removeEventListener('trigger-edit-external-image', handler);
  }, [externalImageUrl]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const objectUrl = URL.createObjectURL(f);
    setPreviewUrl(objectUrl);
    onChange({ mode: 'upload', file: f, previewUrl: objectUrl, originalName: f.name });
    try {
      const t = await generateThumbnail(f, 512);
      setDimensions({ width: t.width, height: t.height });
    } catch (err) {
      console.warn('Thumbnail generation failed', err);
    }
  };

  // When image loads in crop modal, set initial crop
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // If aspect ratio is set, create a centered crop with that aspect
    if (selectedAspectRatio) {
      const newCrop = centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          selectedAspectRatio,
          width,
          height
        ),
        width,
        height
      );
      setCrop(newCrop);
    } else {
      // Free form - select entire image by default
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100
      });
    }
  }, [selectedAspectRatio]);

  // Select full image
  const selectFullImage = () => {
    setCrop({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100
    });
  };

  // Get cropped image from canvas
  const getCroppedImage = async (): Promise<{ blob: Blob; width: number; height: number } | null> => {
    if (!imgRef.current || !completedCrop) return null;
    
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    };

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ blob, width: Math.round(pixelCrop.width), height: Math.round(pixelCrop.height) });
          } else {
            resolve(null);
          }
        },
        'image/webp',
        0.9
      );
    });
  };

  const doCrop = async () => {
    const result = await getCroppedImage();
    if (!result) {
      alert('Please select an area to crop');
      return;
    }

    const { blob, width, height } = result;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setDimensions({ width, height });
    
    const croppedFile = blobToFile(blob, isEditingExternalUrl ? 'cropped_external_image.webp' : (file?.name.replace(/(\.[^.]+)?$/, '_cropped$1') || 'cropped_image.webp'));
    setFile(croppedFile);
    
    onChange({ mode: 'upload', file: croppedFile, blob, previewUrl: url, width, height, originalName: croppedFile.name });
    
    if (isEditingExternalUrl && onExternalImageEdit) {
      onExternalImageEdit(blob, url, width, height);
    }
    
    setCropOpen(false);
    setIsEditingExternalUrl(false);
    setExternalImageDataUrl(undefined);
  };

  const onDelete = async () => {
    setFile(undefined);
    setPreviewUrl(undefined);
    setDimensions({});
    if (editingEventId) {
      onChange({ mode: 'none', deleted: true });
    } else {
      onChange({ mode: 'none' });
    }
  };

  const onReplace = () => selectFile();

  const handleBrowserSelectImage = (imageUrl: string, width?: number, height?: number) => {
    setPreviewUrl(imageUrl);
    setDimensions({ width, height });
    
    // For database images (GridFS), just use the URL reference - NO re-upload needed!
    // This prevents duplicates: the image already exists in the database
    if (imageUrl.includes('/api/images/')) {
      // Clear file to indicate we're using a database reference, not uploading
      setFile(undefined);
      // Pass the database URL directly - the event will store this URL reference
      onChange({ 
        mode: 'none', // Not uploading a new file
        previewUrl: imageUrl, 
        width, 
        height,
        originalName: undefined,
        // Special flag to indicate using existing database image
        file: undefined,
        blob: undefined
      });
      setShowImageBrowser(false);
      return;
    }
    
    // For external URLs, fetch and prepare for upload (keeping original format)
    const fullUrl = getFullImageUrl(imageUrl);
    fetch(fullUrl)
      .then(res => res.blob())
      .then(blob => {
        // Extract filename from URL or use default, keeping original extension
        const urlPath = imageUrl.split('/').pop() || 'image';
        const extension = urlPath.includes('.') ? urlPath.split('.').pop() : 'jpg';
        const fileName = `selected_image.${extension}`;
        const selectedFile = new File([blob], fileName, { type: blob.type || `image/${extension}` });
        setFile(selectedFile);
        onChange({ mode: 'upload', file: selectedFile, blob, previewUrl: imageUrl, width, height, originalName: fileName });
      })
      .catch(err => {
        console.error('Failed to fetch selected image:', err);
        onChange({ mode: 'upload', previewUrl: imageUrl, width, height });
      });
    setShowImageBrowser(false);
  };

  // Handle aspect ratio change
  const handleAspectRatioChange = (ratio: number | undefined) => {
    setSelectedAspectRatio(ratio);
    
    if (imgRef.current && ratio) {
      const { width, height } = imgRef.current;
      const newCrop = centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          ratio,
          width,
          height
        ),
        width,
        height
      );
      setCrop(newCrop);
    } else if (!ratio) {
      // Free form - keep current crop or select all
      selectFullImage();
    }
  };

  // Open crop modal for existing image
  const openCropModal = () => {
    setCrop(undefined);
    setCompletedCrop(undefined);
    setScale(1);
    setCropOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* Image Browser Modal */}
      <ImageBrowser
        isOpen={showImageBrowser}
        onClose={() => setShowImageBrowser(false)}
        onSelectImage={handleBrowserSelectImage}
        onUploadNew={() => {
          setShowImageBrowser(false);
          selectFile();
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} aria-label="Select image file" />
        {!embeddedMode && (
          <button type="button" onClick={() => setShowImageBrowser(true)} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded w-full sm:w-auto">Upload Local File</button>
        )}
        {previewUrl && (
          <>
            <button type="button" onClick={openCropModal} className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 w-full sm:w-auto">Edit</button>
            <button type="button" onClick={onDelete} className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 w-full sm:w-auto">Delete</button>
            <button type="button" onClick={onReplace} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded w-full sm:w-auto">Replace</button>
          </>
        )}
      </div>

      <AnimatePresence>
        {previewUrl && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-2"
            aria-label="Selected image preview"
          >
            <img src={getFullImageUrl(previewUrl)} alt="Selected upload preview" className="w-full h-40 md:h-48 object-cover rounded border" />
            {dimensions.width && dimensions.height && (
              <p className="text-xs text-gray-500 mt-1">{dimensions.width} × {dimensions.height}px</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {cropOpen && (previewUrl || externalImageDataUrl) && (
          <motion.div
            key="crop-backdrop"
            className="fixed inset-0 bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-full h-full flex items-center justify-center p-4">
              <motion.div
                key="crop-modal"
                className="bg-white rounded-lg p-4 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                aria-label="Crop image"
              >
                <h3 className="text-lg font-semibold mb-3">Adjust Image Size</h3>
                <p className="text-sm text-gray-500 mb-3">Drag corners or edges to resize. Drag inside to move the selection.</p>
                
                {/* Aspect Ratio Selection */}
                <div className="mb-3">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Aspect Ratio</label>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.label}
                        type="button"
                        onClick={() => handleAspectRatioChange(ratio.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                          selectedAspectRatio === ratio.value
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                  {/* Select Full Image button - only shown when Free is selected */}
                  {selectedAspectRatio === undefined && (
                    <button
                      type="button"
                      onClick={selectFullImage}
                      className="mt-2 px-3 py-1.5 text-sm rounded-lg border bg-green-600 text-white border-green-600 hover:bg-green-700"
                    >
                      Select Full Image
                    </button>
                  )}
                </div>

                {/* Crop Area */}
                <div className="relative bg-gray-100 rounded overflow-hidden flex items-center justify-center" style={{ maxHeight: '60vh' }}>
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={selectedAspectRatio}
                    className="max-h-[60vh]"
                  >
                    <img
                      ref={imgRef}
                      src={isEditingExternalUrl ? externalImageDataUrl : getFullImageUrl(previewUrl || '')}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      style={{ 
                        maxHeight: '60vh', 
                        maxWidth: '100%',
                        transform: `scale(${scale})`,
                        transformOrigin: 'center'
                      }}
                      crossOrigin="anonymous"
                    />
                  </ReactCrop>
                </div>

                {/* Scale control */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-3 gap-3">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-sm whitespace-nowrap" htmlFor="scale-slider">Scale</label>
                    <input 
                      id="scale-slider"
                      type="range" 
                      min="0.5" 
                      max="2" 
                      step="0.1" 
                      value={scale} 
                      onChange={(e) => setScale(parseFloat(e.target.value))} 
                      className="flex-1 sm:w-32"
                      aria-label="Scale level"
                    />
                    <span className="text-sm text-gray-500">{scale.toFixed(1)}x</span>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      type="button" 
                      onClick={() => {
                        setCropOpen(false);
                        setIsEditingExternalUrl(false);
                        setExternalImageDataUrl(undefined);
                      }} 
                      className="flex-1 sm:flex-none px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      onClick={doCrop} 
                      className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ImageUploadManager;
