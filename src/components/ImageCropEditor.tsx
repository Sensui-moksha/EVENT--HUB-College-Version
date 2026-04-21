import React, { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface CropEditorProps {
  originalFile: File;
  onCancel: () => void;
  onSave: (blob: Blob, dims: { width: number; height: number }) => void;
}

const readFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
};

// Utility to create cropped image blob
const createCroppedBlob = async (
  imageSrc: string,
  crop: { x: number; y: number },
  zoom: number,
  areaPixels: { width: number; height: number; x: number; y: number },
  fileType: string
): Promise<{ blob: Blob; width: number; height: number }> => {
  const image: HTMLImageElement = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = areaPixels.width;
  canvas.height = areaPixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(
    image,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    areaPixels.width,
    areaPixels.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({ blob: blob || new Blob(), width: areaPixels.width, height: areaPixels.height });
    }, fileType || 'image/webp', 0.9);
  });
};

const CropEditor: React.FC<CropEditorProps> = ({ originalFile, onCancel, onSave }) => {
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ width: number; height: number; x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    readFile(originalFile).then(setImageDataUrl);
  }, [originalFile]);

  const onCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageDataUrl || !croppedAreaPixels) return;
    setSaving(true);
    try {
      const { blob, width, height } = await createCroppedBlob(imageDataUrl, crop, zoom, croppedAreaPixels, originalFile.type);
      onSave(blob, { width, height });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Image (Crop / Resize)</h2>
          <button onClick={onCancel} className="p-2 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="relative w-full h-[400px] bg-black/5 rounded overflow-hidden">
          {imageDataUrl && (
            <Cropper
              image={imageDataUrl}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              restrictPosition={false}
            />
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom(Math.max(1, zoom - 0.1))}
              className="p-2 rounded bg-gray-100 hover:bg-gray-200"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium">Zoom: {zoom.toFixed(2)}</span>
            <button
              type="button"
              onClick={() => setZoom(zoom + 0.1)}
              className="p-2 rounded bg-gray-100 hover:bg-gray-200"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              disabled={saving}
            >
              <Check className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropEditor;
