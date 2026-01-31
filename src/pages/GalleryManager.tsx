import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, AlertCircle, CheckCircle, Upload, Settings, ArrowLeft } from 'lucide-react';
import { useGalleryManagement, useGalleryUpload } from '../hooks/useGallery';
import MediaUploader from '../components/MediaUploader';
import GalleryGrid from '../components/GalleryGrid';

/**
 * Gallery Manager Page
 * 
 * Admin/Organizer interface for managing event galleries
 * Features:
 * - Upload images and videos
 * - Delete media
 * - Reorder media (drag-and-drop)
 * - Set cover image
 * - Publish/unpublish gallery
 * - View statistics
 * 
 * Route: /dashboard/gallery/:eventId
 */
export const GalleryManager: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');
  const [successMessage, setSuccessMessage] = useState('');

  const {
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
    refetch
  } = useGalleryManagement(eventId || '');

  const { uploading, uploadError, uploadProgress, uploadSpeed, timeRemaining, uploadedBytes, totalBytes, uploadFiles, uploadStatus } = useGalleryUpload(eventId || '');

  const handleFileUpload = async (files: File[]) => {
    try {
      await uploadFiles(files);
      // Refresh gallery data after upload
      await refetch();
      setSuccessMessage(`${files.length} file(s) uploaded successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  const handlePublish = async (published: boolean) => {
    const success = await togglePublish(published);
    if (success) {
      setSuccessMessage(`Gallery ${published ? 'published' : 'unpublished'}`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader size={48} className="animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-700 font-medium">Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Check if it's an authentication error
    const isAuthError = error.includes('Access denied') || error.includes('log in') || error.includes('Unauthorized');
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-600" />
          <p className="text-red-600 font-semibold mb-4">{error}</p>
          {isAuthError && (
            <div className="space-y-3">
              <p className="text-gray-600 text-sm">Your session has expired. Please log in again.</p>
              <button
                onClick={() => {
                  localStorage.removeItem('user');
                  window.location.href = '/login';
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Back button and title */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back</span>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Gallery Manager</h1>
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              {stats && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Total Media</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalFiles}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Images</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.imageCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Videos</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.videoCount}</p>
                  </div>
                </>
              )}
            </div>

            {/* Publish toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {galleryData?.published ? 'Published' : 'Unpublished'}
              </span>
              <button
                onClick={() => handlePublish(!galleryData?.published)}
                title={galleryData?.published ? 'Unpublish gallery' : 'Publish gallery'}
                aria-label={galleryData?.published ? 'Unpublish gallery' : 'Publish gallery'}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition ${
                  galleryData?.published
                    ? 'bg-green-500'
                    : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
                    galleryData?.published ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
            <CheckCircle size={20} />
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <AlertCircle size={20} />
            <p className="font-medium">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-6 mt-8 pb-8">
        <div className="flex gap-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-4 px-4 font-semibold transition border-b-2 ${
              activeTab === 'upload'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <Upload size={18} className="inline mr-2" />
            Upload Media
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-4 px-4 font-semibold transition border-b-2 ${
              activeTab === 'manage'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-600 border-transparent hover:text-gray-900'
            }`}
          >
            <Settings size={18} className="inline mr-2" />
            Manage Media
          </button>
        </div>

        {/* Upload tab */}
        {activeTab === 'upload' && (
          <div className="bg-white rounded-lg shadow p-8 mb-8">
            <MediaUploader
              onFilesSelected={handleFileUpload}
              isLoading={uploading}
              uploadProgress={uploadProgress}
              uploadSpeed={uploadSpeed}
              timeRemaining={timeRemaining}
              uploadedBytes={uploadedBytes}
              totalBytes={totalBytes}
              uploadStatus={uploadStatus}
              acceptedTypes={['image/*', 'video/*']}
              multiple={true}
            />
          </div>
        )}

        {/* Manage tab */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-lg shadow p-8 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Manage Media</h2>

            {media.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No media uploaded yet</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-6">
                  Drag to reorder • Click ✓ to set cover • Click ✕ to remove from cover • Click 🗑 to delete
                </p>
                <GalleryGrid
                  media={media}
                  coverMediaId={galleryData?.coverMediaId}
                  onDelete={deleteMedia}
                  onReorder={reorderMedia}
                  onSetCover={setCoverImage}
                  onRemoveCover={removeCoverImage}
                  isManagement={true}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryManager;
