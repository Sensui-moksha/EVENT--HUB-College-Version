import React from 'react';
import { Upload, X, CloudUpload, Loader2, XCircle } from 'lucide-react';

interface MediaUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onCancelUpload?: () => void;
  isLoading?: boolean;
  uploadProgress?: number;
  uploadSpeed?: number | null; // bytes per second
  timeRemaining?: number | null; // seconds
  uploadedBytes?: number; // bytes uploaded
  totalBytes?: number; // total bytes
  uploadStatus?: string; // Status message for chunked uploads
  acceptedTypes?: string[];
  multiple?: boolean;
}

/**
 * MediaUploader Component
 * 
 * Drag-and-drop file uploader with:
 * - Multiple file selection
 * - Drag-and-drop support
 * - File preview
 * - Type/size validation
 * - Upload button with progress
 * - Chunked upload status display
 */
export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onFilesSelected,
  onCancelUpload,
  isLoading = false,
  uploadProgress,
  uploadSpeed,
  timeRemaining,
  uploadedBytes,
  totalBytes,
  uploadStatus,
  acceptedTypes = ['image/*', 'video/*'],
  multiple = true
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      const isValidType = acceptedTypes.some((type) => {
        if (type === 'image/*') return file.type.startsWith('image/');
        if (type === 'video/*') return file.type.startsWith('video/');
        return file.type === type;
      });

      // Increased limits: 25MB for images, 500MB for videos
      const maxSize = file.type.startsWith('video/') ? 500 * 1024 * 1024 : 25 * 1024 * 1024;
      const isSizeValid = file.size <= maxSize;

      return isValidType && isSizeValid;
    });

    if (validFiles.length > 0) {
      const newFiles = multiple ? [...selectedFiles, ...validFiles] : validFiles;
      setSelectedFiles(newFiles);
      // Don't auto-upload - wait for user to click upload button
    }
  };

  const handleUploadClick = () => {
    if (selectedFiles.length > 0 && !isLoading) {
      onFilesSelected(selectedFiles);
    }
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clear files after successful upload
  React.useEffect(() => {
    if (!isLoading && uploadProgress === 100) {
      // Wait a moment then clear files
      const timer = setTimeout(() => {
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading, uploadProgress]);

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number | null | undefined) => {
    if (!bytesPerSecond || bytesPerSecond <= 0) return '';
    const k = 1024;
    if (bytesPerSecond < k) return `${Math.round(bytesPerSecond)} B/s`;
    if (bytesPerSecond < k * k) return `${(bytesPerSecond / k).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (k * k)).toFixed(1)} MB/s`;
  };

  const formatTimeRemaining = (seconds: number | null | undefined) => {
    if (!seconds || seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s remaining`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s remaining`;
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Upload className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="font-semibold text-gray-700">
          {isDragging ? 'Drop files here' : 'Drag files or click to browse'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Images up to 25MB, Videos up to 500MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileInputChange}
        disabled={isLoading}
      />

      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">
              Selected Files ({selectedFiles.length})
            </h3>
            {!isLoading && (
              <button
                onClick={clearAllFiles}
                className="text-sm text-gray-500 hover:text-red-500 transition"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {file.type}
                  </p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                  title="Remove file"
                  aria-label={`Remove ${file.name}`}
                  className="ml-3 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Progress Bar */}
          {isLoading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-600">Uploading...</span>
                <span className="text-sm font-bold text-blue-600">{(uploadProgress || 0).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-150 ease-linear"
                  style={{ width: `${uploadProgress || 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span className="font-medium">
                  {uploadSpeed ? formatSpeed(uploadSpeed) : 'Calculating...'}
                </span>
                <span className="font-medium">
                  {timeRemaining ? formatTimeRemaining(timeRemaining) : ''}
                </span>
              </div>
              {/* Show bytes uploaded / total */}
              {uploadedBytes !== undefined && totalBytes !== undefined && totalBytes > 0 && (
                <div className="text-xs text-gray-400 mt-1 text-center">
                  {formatFileSize(uploadedBytes)} / {formatFileSize(totalBytes)}
                </div>
              )}
              {/* Status message for chunked uploads */}
              {uploadStatus && (
                <p className="text-xs text-blue-600 mt-2 text-center font-medium bg-blue-50 rounded-lg py-2">
                  {uploadStatus}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1 text-center">
                Please wait while your files are being uploaded...
              </p>
            </div>
          )}

          {/* Upload Button */}
          {!isLoading && (
            <button
              onClick={handleUploadClick}
              disabled={selectedFiles.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              <CloudUpload size={20} />
              Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* Uploading State - Show Cancel Button */}
          {isLoading && (
            <div className="mt-4 flex gap-3">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-400 text-white font-semibold rounded-lg cursor-not-allowed"
              >
                <Loader2 size={20} className="animate-spin" />
                Uploading...
              </button>
              {onCancelUpload && (
                <button
                  onClick={() => {
                    onCancelUpload();
                    setSelectedFiles([]);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all shadow-lg"
                  title="Cancel upload"
                >
                  <XCircle size={20} />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
