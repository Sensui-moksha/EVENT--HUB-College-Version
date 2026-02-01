import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Database, Search, Image as ImageIcon, Loader2, Check, FileText, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

interface ImageItem {
  id: string;
  type: 'gridfs' | 'url';
  url: string;
  filename?: string;
  contentType?: string;
  width?: number;
  height?: number;
  uploadDate?: string;
  size?: number;
  title?: string;
}

interface ImageBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imageUrl: string, width?: number, height?: number) => void;
  onUploadNew: () => void;
}

const ImageBrowser: React.FC<ImageBrowserProps> = ({ isOpen, onClose, onSelectImage, onUploadNew }) => {
  const [activeTab, setActiveTab] = useState<'database' | 'upload'>('database');
  const [images, setImages] = useState<{ gridFsImages: ImageItem[]; urlImages: ImageItem[] }>({ gridFsImages: [], urlImages: [] });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  
  // Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<ImageItem | null>(null);
  
  // Multi-select delete states
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [showMultiDeleteConfirm, setShowMultiDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'database') {
      fetchImages();
    }
  }, [isOpen, activeTab]);

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/images`);
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  };

  const allImages = [...images.gridFsImages, ...images.urlImages];
  
  const filteredImages = allImages.filter(img => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      img.filename?.toLowerCase().includes(search) ||
      img.title?.toLowerCase().includes(search) ||
      img.url.toLowerCase().includes(search)
    );
  });

  const handleSelectImage = (image: ImageItem) => {
    setSelectedImage(image);
  };

  const handleConfirmSelection = () => {
    if (selectedImage) {
      const imageUrl = selectedImage.type === 'gridfs' 
        ? `${API_BASE_URL}${selectedImage.url}` 
        : selectedImage.url;
      onSelectImage(imageUrl, selectedImage.width, selectedImage.height);
      onClose();
    }
  };

  const handleUploadNew = () => {
    onUploadNew();
    onClose();
  };

  // Handle file selection for direct database upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      setUploadPreview(URL.createObjectURL(file));
      // Set default filename without extension
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setUploadFileName(nameWithoutExt);
      setShowNameInput(true);
    }
  };

  // Upload file directly to database
  const handleDirectUpload = async () => {
    if (!uploadFile || !uploadFileName.trim()) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      // Create a new file with the custom name
      const extension = uploadFile.name.split('.').pop() || 'jpg';
      const newFileName = `${uploadFileName.trim()}.${extension}`;
      const renamedFile = new File([uploadFile], newFileName, { type: uploadFile.type });
      formData.append('image', renamedFile);
      
      const response = await fetch(`${API_BASE_URL}/api/images/upload`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        // Reset upload state
        setUploadFile(null);
        setUploadPreview('');
        setUploadFileName('');
        setShowNameInput(false);
        // Refresh the images list
        await fetchImages();
        // Switch to database tab to show the new image
        setActiveTab('database');
        // Optionally auto-select the uploaded image
        if (result.imageUrl) {
          setSelectedImage({
            id: result.id || result.imageUrl,
            type: 'gridfs',
            url: result.imageUrl,
            filename: newFileName,
            width: result.width,
            height: result.height,
          });
        }
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Cancel upload
  const cancelUpload = () => {
    setUploadFile(null);
    setUploadPreview('');
    setUploadFileName('');
    setShowNameInput(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Delete image from database
  const handleDeleteImage = async (image: ImageItem) => {
    if (image.type !== 'gridfs') {
      alert('Only database images can be deleted from here.');
      return;
    }
    
    setDeleting(image.id);
    try {
      const response = await fetch(`${API_BASE_URL}/api/images/${image.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Remove from local state
        setImages(prev => ({
          ...prev,
          gridFsImages: prev.gridFsImages.filter(img => img.id !== image.id)
        }));
        // Clear selection if this was selected
        if (selectedImage?.id === image.id) {
          setSelectedImage(null);
        }
        setShowDeleteConfirm(null);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete image');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete image. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  // Toggle delete mode
  const toggleDeleteMode = () => {
    if (deleteMode) {
      // Exit delete mode
      setDeleteMode(false);
      setSelectedForDelete(new Set());
    } else {
      // Enter delete mode
      setDeleteMode(true);
      setSelectedImage(null);
    }
  };

  // Toggle image selection for delete
  const toggleSelectForDelete = (image: ImageItem) => {
    if (image.type !== 'gridfs') return; // Only allow deleting database images
    
    const newSelected = new Set(selectedForDelete);
    if (newSelected.has(image.id)) {
      newSelected.delete(image.id);
    } else {
      newSelected.add(image.id);
    }
    setSelectedForDelete(newSelected);
  };

  // Get selected images for delete
  const getSelectedDeleteImages = (): ImageItem[] => {
    return images.gridFsImages.filter(img => selectedForDelete.has(img.id));
  };

  // Calculate total size of selected images
  const getSelectedTotalSize = (): number => {
    return getSelectedDeleteImages().reduce((total, img) => total + (img.size || 0), 0);
  };

  // Handle multi-delete
  const handleMultiDelete = async () => {
    const imagesToDelete = getSelectedDeleteImages();
    if (imagesToDelete.length === 0) return;
    
    setDeleting('multi');
    let deletedCount = 0;
    const failedIds: string[] = [];
    const errors: string[] = [];
    
    for (const image of imagesToDelete) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/images/${image.id}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          deletedCount++;
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Delete failed for', image.id, errorData);
          failedIds.push(image.id);
          errors.push(`${image.filename || image.id}: ${errorData.error || errorData.details || 'Failed'}`);
        }
      } catch (error) {
        console.error('Delete failed for', image.id, error);
        failedIds.push(image.id);
        errors.push(`${image.filename || image.id}: Network error`);
      }
    }
    
    // Update local state - remove successfully deleted images
    const successfullyDeleted = new Set(
      [...selectedForDelete].filter(id => !failedIds.includes(id))
    );
    setImages(prev => ({
      ...prev,
      gridFsImages: prev.gridFsImages.filter(img => !successfullyDeleted.has(img.id))
    }));
    
    // Clear selections
    setSelectedForDelete(new Set());
    setShowMultiDeleteConfirm(false);
    setDeleteMode(false);
    setDeleting(null);
    
    if (failedIds.length > 0 && deletedCount > 0) {
      alert(`Deleted ${deletedCount} image${deletedCount !== 1 ? 's' : ''}. ${failedIds.length} failed to delete.${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 3).join('\n') : ''}`);
    } else if (failedIds.length > 0 && deletedCount === 0) {
      alert(`Failed to delete images.${errors.length > 0 ? '\n\nErrors:\n' + errors.slice(0, 3).join('\n') : ''}`);
    }
  };

  // Select all database images for delete
  const selectAllForDelete = () => {
    const allDbImageIds = new Set(images.gridFsImages.map(img => img.id));
    setSelectedForDelete(allDbImageIds);
  };

  // Clear all selections
  const clearDeleteSelection = () => {
    setSelectedForDelete(new Set());
  };

  // Quick add from database tab
  const triggerQuickAdd = () => {
    setActiveTab('upload');
    // Small delay to ensure tab switch, then trigger file input
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col"
          style={{ height: '85vh', maxHeight: '85vh' }}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">Select Image</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b flex-shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'database'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Database className="w-4 h-4" />
              Database Images
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload New
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {activeTab === 'database' ? (
              <div className="h-full flex flex-col overflow-hidden">
                {/* Search and Actions */}
                <div className="p-4 border-b flex-shrink-0">
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search images..."
                        value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    </div>
                    {/* Add Button */}
                    <button
                      type="button"
                      onClick={triggerQuickAdd}
                      disabled={deleteMode}
                      className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        deleteMode 
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                      title="Add new image to database"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add</span>
                    </button>
                    {/* Delete Button - transforms based on mode */}
                    {!deleteMode ? (
                      <button
                        type="button"
                        onClick={toggleDeleteMode}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        title="Select images to delete"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={toggleDeleteMode}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                          title="Cancel delete mode"
                        >
                          <X className="w-4 h-4" />
                          <span className="hidden sm:inline">Cancel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => selectedForDelete.size > 0 && setShowMultiDeleteConfirm(true)}
                          disabled={selectedForDelete.size === 0}
                          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all ${
                            selectedForDelete.size > 0
                              ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                          title={selectedForDelete.size > 0 ? `Delete ${selectedForDelete.size} selected images` : 'Select images to delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>
                            {selectedForDelete.size > 0 
                              ? `Delete (${selectedForDelete.size}) • ${formatFileSize(getSelectedTotalSize())}`
                              : 'Select images'
                            }
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Delete mode helper actions */}
                  {deleteMode && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Quick select:</span>
                      <button
                        type="button"
                        onClick={selectAllForDelete}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Select All ({images.gridFsImages.length})
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        type="button"
                        onClick={clearDeleteSelection}
                        className="text-sm text-gray-600 hover:text-gray-800 hover:underline"
                      >
                        Clear Selection
                      </button>
                      {selectedForDelete.size > 0 && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span className="text-sm text-red-600 font-medium">
                            {selectedForDelete.size} selected ({formatFileSize(getSelectedTotalSize())})
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Image Grid - Scrollable area */}
                <div className="flex-1 overflow-y-auto p-4 scrollbar-custom" style={{ minHeight: 0 }}>
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                  ) : filteredImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                      <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
                      <p>No images found</p>
                      <button
                        type="button"
                        onClick={triggerQuickAdd}
                        className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Upload New Image
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredImages.map((image) => (
                        <div
                          key={image.id}
                          onClick={() => {
                            if (deleteMode) {
                              toggleSelectForDelete(image);
                            } else {
                              handleSelectImage(image);
                            }
                          }}
                          className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                            deleteMode
                              ? selectedForDelete.has(image.id)
                                ? 'border-red-600 ring-2 ring-red-200 bg-red-50'
                                : image.type === 'gridfs'
                                  ? 'border-transparent hover:border-red-300'
                                  : 'border-transparent opacity-50 cursor-not-allowed'
                              : selectedImage?.id === image.id
                                ? 'border-blue-600 ring-2 ring-blue-200'
                                : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <div className="bg-gray-100 flex items-center justify-center" style={{ minHeight: '120px', maxHeight: '300px' }}>
                            <img
                              src={image.type === 'gridfs' ? `${API_BASE_URL}${image.url}` : image.url}
                              alt={image.filename || image.title || 'Image'}
                              className="w-full h-auto max-h-[300px] object-contain"
                              loading="lazy"
                            />
                          </div>
                          {/* Delete mode checkbox */}
                          {deleteMode && image.type === 'gridfs' && (
                            <div className={`absolute top-2 right-2 rounded transition-all ${
                              selectedForDelete.has(image.id) 
                                ? 'bg-red-600 text-white' 
                                : 'bg-white/80 text-gray-600 border border-gray-300'
                            }`}>
                              {selectedForDelete.has(image.id) ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </div>
                          )}
                          {/* Regular selection check */}
                          {!deleteMode && selectedImage?.id === image.id && (
                            <div className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-1">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                          {/* Image info - always visible */}
                          <div className="bg-gray-800/90 p-2">
                            <p className="text-white text-sm font-medium truncate">
                              {image.filename || image.title || 'Image'}
                            </p>
                            {image.width && image.height && (
                              <p className="text-gray-300 text-xs">
                                {image.width} × {image.height}px
                              </p>
                            )}
                          </div>
                          {image.type === 'gridfs' && (
                            <div className="absolute top-2 left-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                              DB
                            </div>
                          )}
                          {image.type === 'url' && (
                            <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded">
                              URL
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Image Preview */}
                {selectedImage && (
                  <div className="p-4 border-t bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedImage.type === 'gridfs' ? `${API_BASE_URL}${selectedImage.url}` : selectedImage.url}
                        alt="Selected"
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {selectedImage.filename || selectedImage.title || 'Selected Image'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedImage.width && selectedImage.height && `${selectedImage.width} × ${selectedImage.height}px`}
                          {selectedImage.size && ` • ${formatFileSize(selectedImage.size)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleConfirmSelection}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                      >
                        Use This Image
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Upload Tab */
              <div className="h-full flex flex-col items-center justify-center p-8">
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                  aria-label="Select image file"
                />
                
                {!showNameInput ? (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-10 h-10 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload to Database</h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      Upload a new image directly to the database. Supported formats: JPG, PNG, GIF, WebP
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center justify-center gap-2"
                      >
                        <Database className="w-5 h-5" />
                        Save to Database
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadNew}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium inline-flex items-center justify-center gap-2"
                      >
                        <Upload className="w-5 h-5" />
                        Use for This Event Only
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Name Input Step */
                  <div className="w-full max-w-md">
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      {uploadPreview && (
                        <img 
                          src={uploadPreview} 
                          alt="Preview" 
                          className="w-full h-48 object-contain rounded-lg mb-4 bg-white"
                        />
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span className="truncate">{uploadFile?.name}</span>
                        <span className="text-gray-400">({formatFileSize(uploadFile?.size)})</span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 mb-2">
                        Enter a name for this image
                      </label>
                      <input
                        id="fileName"
                        type="text"
                        value={uploadFileName}
                        onChange={(e) => setUploadFileName(e.target.value)}
                        placeholder="Enter image name..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This name will help you find the image later
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={cancelUpload}
                        disabled={uploading}
                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDirectUpload}
                        disabled={uploading || !uploadFileName.trim()}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Database className="w-5 h-5" />
                            Save to Database
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Image?</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Are you sure you want to delete "{showDeleteConfirm.filename || 'this image'}"? This action cannot be undone.
                  </p>
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={`${API_BASE_URL}${showDeleteConfirm.url}`}
                      alt="To delete"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div className="text-sm text-gray-500">
                      {showDeleteConfirm.width && showDeleteConfirm.height && (
                        <p>{showDeleteConfirm.width} × {showDeleteConfirm.height}px</p>
                      )}
                      {showDeleteConfirm.size && <p>{formatFileSize(showDeleteConfirm.size)}</p>}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(null)}
                      disabled={deleting === showDeleteConfirm.id}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(showDeleteConfirm)}
                      disabled={deleting === showDeleteConfirm.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {deleting === showDeleteConfirm.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Multi-Delete Confirmation Modal */}
          <AnimatePresence>
            {showMultiDeleteConfirm && selectedForDelete.size > 0 && (
              <motion.div
                className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Delete {selectedForDelete.size} Images?</h3>
                      <p className="text-sm text-gray-500">This will free up {formatFileSize(getSelectedTotalSize())}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-4">
                    Are you sure you want to delete these {selectedForDelete.size} images? This action cannot be undone.
                  </p>
                  
                  {/* Preview of selected images */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
                    <div className="grid grid-cols-4 gap-2">
                      {getSelectedDeleteImages().slice(0, 8).map((img) => (
                        <div key={img.id} className="relative">
                          <img
                            src={`${API_BASE_URL}${img.url}`}
                            alt={img.filename || 'Image'}
                            className="w-full aspect-square object-cover rounded"
                          />
                        </div>
                      ))}
                      {selectedForDelete.size > 8 && (
                        <div className="w-full aspect-square bg-gray-200 rounded flex items-center justify-center text-gray-500 text-sm font-medium">
                          +{selectedForDelete.size - 8}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      {selectedForDelete.size} images • {formatFileSize(getSelectedTotalSize())} total
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMultiDeleteConfirm(false)}
                      disabled={deleting === 'multi'}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleMultiDelete}
                      disabled={deleting === 'multi'}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {deleting === 'multi' ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Delete {selectedForDelete.size} Images
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ImageBrowser;
