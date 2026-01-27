// Utility helpers for client-side image handling: thumbnail generation, cropping extraction
// These functions avoid imposing any size limits; large images are processed via canvas downscaling
// to provide responsive previews without blocking the UI.

export interface CropAreaPixels {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Generate a downscaled thumbnail (max dimension constraint) for preview purposes.
 * Does not mutate the original File/Blob. Returns a data URL string.
 */
export async function generateThumbnail(file: File | Blob, maxDim = 512): Promise<{ dataUrl: string; width: number; height: number; }> {
  const img = await readImage(file);
  const { canvas, targetW, targetH } = scaleToFit(img, maxDim);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { dataUrl, width: targetW, height: targetH };
}

/**
 * Extract a cropped portion from an image given pixel crop area (from react-easy-crop) and produce a Blob.
 */
export async function getCroppedImageBlob(file: File | Blob, crop: CropAreaPixels, mime: string = 'image/jpeg', quality = 0.9): Promise<{ blob: Blob; width: number; height: number; }> {
  const img = await readImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob(b => resolve(b!), mime, quality));
  return { blob, width: crop.width, height: crop.height };
}

function readImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function scaleToFit(img: HTMLImageElement, maxDim: number) {
  const { width, height } = img;
  if (width <= maxDim && height <= maxDim) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return { canvas, targetW: width, targetH: height };
  }
  const ratio = width / height;
  let targetW = maxDim;
  let targetH = Math.round(maxDim / ratio);
  if (targetH > maxDim) {
    targetH = maxDim;
    targetW = Math.round(maxDim * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  return { canvas, targetW, targetH };
}

/**
 * Convert a Blob to a File (useful when user crops and we want a File-like object).
 */
export function blobToFile(blob: Blob, originalName: string): File {
  return new File([blob], originalName, { type: blob.type });
}

/**
 * Prepare FormData for upload endpoint from either original or cropped file.
 */
export function buildImageUploadFormData(file: File, meta?: Record<string, any>): FormData {
  const fd = new FormData();
  fd.append('image', file);
  if (meta) {
    Object.entries(meta).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v));
    });
  }
  return fd;
}
