import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader, Image, Camera, Sparkles, ChevronLeft, ChevronRight, Plus, X, EyeOff } from 'lucide-react';
import { useGalleryList } from '../hooks/useGallery';
import { useAuth } from '../contexts/AuthContext';
import GalleryCard from '../components/GalleryCard';
import { API_BASE_URL } from '../utils/api';
import { invalidateCache } from '../utils/cacheManager';
import AlertModal from '../components/AlertModal';

// Types for gallery (for local state)
type GalleryListItem = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDescription: string;
  mediaCount: number;
  coverImage?: any;
  published?: boolean;
};
import { pageVariants, staggerContainerVariants } from '../utils/animations';

/**
 * Gallery Page
 * 
 * Public gallery listing page with elegant theme
 * Features glassmorphism, gradients, and stunning animations
 * 
 * Route: /gallery
 */

export const Gallery: React.FC = () => {
  const navigate = useNavigate();
  const { galleries, loading, error, pagination, refetch } = useGalleryList();
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  
  // Edit/Delete modal state (for future admin features)
  const [editGallery, setEditGallery] = useState<GalleryListItem | null>(null);
  const [deleteGallery, setDeleteGallery] = useState<GalleryListItem | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  // Create gallery modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  
  // Alert modal state
  const [alertModal, setAlertModal] = useState<{ show: boolean; title: string; message: string } | null>(null);

  const isAdminOrOrganizer = user && (user.role === 'admin' || user.role === 'organizer');

  useEffect(() => {
    refetch(page, 12);
  }, [page]);
  
  // Fetch events for create gallery modal
  useEffect(() => {
    if (createModalOpen && isAdminOrOrganizer) {
      fetch('/api/events', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setEvents(data.events || data || []))
        .catch(err => console.error('Failed to fetch events:', err));
    }
  }, [createModalOpen, isAdminOrOrganizer]);

  const handleCardClick = (eventId: string) => {
    navigate(`/gallery/${eventId}`);
  };
  
  // Create gallery for event
  const handleCreateGallery = async () => {
    if (!selectedEventId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/gallery/${selectedEventId}/create`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        setCreateModalOpen(false);
        setSelectedEventId('');
        refetch(page, 12);
        // Navigate to gallery manager
        navigate(`/dashboard/gallery/${selectedEventId}`);
      }
    } catch (err) {
      console.error('Failed to create gallery:', err);
    } finally {
      setCreating(false);
    }
  };

  // Handlers for edit/delete
  const handleEdit = (gallery: GalleryListItem) => {
    setEditGallery(gallery);
    setEditModalOpen(true);
  };
  const handleDelete = (gallery: GalleryListItem) => {
    // ...removed console log for production...
    setDeleteGallery(gallery);
    setDeleteModalOpen(true);
  };

  // API actions for edit/delete
  const saveEdit = async (updated: { title?: string; description?: string }) => {
    if (!editGallery) return;
    try {
      await fetch(`${API_BASE_URL}/api/gallery/${editGallery.eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
        credentials: 'include'
      });
      setEditModalOpen(false);
      refetch(page, 12);
    } catch (err) {
      console.error('Failed to save edit', err);
    }
  };

  const confirmDeleteGallery = async () => {
    if (!deleteGallery) return;
    try {
      // ...removed console log for production...
      const response = await fetch(`${API_BASE_URL}/api/gallery/${deleteGallery.eventId}`, { method: 'DELETE', credentials: 'include' });
      // ...removed console log for production...
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed with status ${response.status}`);
      }
      // Invalidate gallery cache
      invalidateCache.onGalleryChange(deleteGallery.eventId);
      setDeleteGallery(null);
      setDeleteModalOpen(false);
      // refresh list
      refetch(page, 12);
    } catch (err) {
      console.error('Failed to delete gallery', err);
      setAlertModal({
        show: true,
        title: 'Delete Failed',
        message: `Failed to delete gallery: ${err instanceof Error ? err.message : 'Unknown error'}`
      });
    }
  };

  if (loading && galleries.length === 0) {
    return (
      <div className="min-h-screen pt-16 sm:pt-20 lg:pt-24 pb-8 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 blur-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 opacity-50 animate-pulse rounded-full"></div>
            <Loader size={56} className="animate-spin mx-auto mb-4 text-white relative z-10" />
          </div>
          <p className="text-white/80 font-medium text-lg mt-6">Curating memories...</p>
        </div>
      </div>
    );
  }

  // totalPhotos not used currently

  return (
    <motion.div 
      className="min-h-screen pt-16 sm:pt-20 lg:pt-24 pb-8 relative overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Info Banner for Admins/Organizers */}
      {isAdminOrOrganizer && (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 z-20 relative mt-2 mb-6">
          <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 backdrop-blur-sm border border-violet-300/30 rounded-xl p-4 flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <Camera className="w-5 h-5 text-violet-400" />
            </div>
            <div className="flex-1">
              <p className="text-white/90 text-sm font-medium mb-1">
                Manage Event Galleries
              </p>
              <p className="text-white/70 text-xs">
                Galleries are automatically created for each event. You can also manually create galleries for events.
                <span className="inline-flex items-center gap-1 ml-2 text-amber-400">
                  <EyeOff size={12} />
                  Unpublished galleries are only visible to you
                </span>
              </p>
            </div>
            <div className="flex-shrink-0 flex gap-2">
              <button
                onClick={() => setCreateModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg text-white text-sm font-medium transition-all flex items-center gap-2"
              >
                <Plus size={16} />
                Create Gallery
              </button>
              <Link
                to="/dashboard"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg text-white text-sm font-medium transition-all"
              >
                My Events
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* Animated Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900 -z-10">
        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl"></div>
        
        {/* subtle overlay intentionally removed to satisfy linting rules */}
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 relative z-10">
        {/* Hero Header */}
        <motion.div 
          className="text-center mb-10 sm:mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          {/* Floating badge */}
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/90 text-sm font-medium mb-6"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Capturing Memories</span>
          </motion.div>

          {/* Glowing icon */}
          <motion.div 
            className="flex justify-center mb-6"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6, type: "spring" }}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl blur-xl opacity-60 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl p-4 shadow-2xl">
                <Camera className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
              </div>
            </div>
          </motion.div>

          {/* Title with gradient */}
          <motion.h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <span className="bg-gradient-to-r from-white via-purple-200 to-white bg-clip-text text-transparent">
              Event Galleries
            </span>
          </motion.h1>

          <motion.p 
            className="text-base sm:text-lg lg:text-xl text-white/70 max-w-2xl mx-auto px-4 sm:px-0 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Relive the magic of unforgettable moments. Explore stunning photos and videos from our college events.
          </motion.p>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div 
            className="mb-8 p-5 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-2xl"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="font-semibold text-red-300">Error loading galleries</p>
            <p className="text-sm mt-1 text-red-300/70">{error}</p>
          </motion.div>
        )}

        {/* Content */}
        {galleries.length === 0 ? (
          <motion.div 
            className="text-center py-12 sm:py-20"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative max-w-lg mx-auto">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-fuchsia-600/20 rounded-3xl blur-2xl"></div>
              
              {/* Card */}
              <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/10">
                {/* Animated rings */}
                <div className="relative w-28 h-28 mx-auto mb-8">
                  <div className="absolute inset-0 rounded-full border-2 border-violet-500/30 animate-ping"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-fuchsia-500/40 animate-ping"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                      <Image className="w-10 h-10 text-white" />
                    </div>
                  </div>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                  No galleries yet
                </h3>
                <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                  Beautiful moments are being captured.<br />
                  Check back soon for stunning event memories!
                </p>

                {/* Decorative line */}
                <div className="mt-8 h-1 w-24 mx-auto rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
              </div>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Section header */}
            <motion.div 
              className="flex items-center justify-between mb-6 sm:mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <h2 className="text-xl sm:text-2xl font-semibold text-white">
                Browse Galleries
              </h2>
              <div className="text-sm text-white/50">
                Showing {galleries.length} galleries
              </div>
            </motion.div>

            {/* Gallery cards grid */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 mb-10"
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {galleries.map((gallery, index) => (
                <GalleryCard
                  key={gallery.id}
                  event={{
                    title: gallery.eventTitle,
                    description: gallery.eventDescription
                  }}
                  gallery={{
                    mediaCount: gallery.mediaCount,
                    coverImage: gallery.coverImage,
                    published: gallery.published
                  }}
                  onClick={() => handleCardClick(gallery.eventId)}
                  index={index}
                  onEdit={() => handleEdit(gallery)}
                  onDelete={() => handleDelete(gallery)}
                />
              ))}
            </motion.div>

            {/* Pagination - Elegant style */}
            {pagination && pagination.pages > 1 && (
              <motion.div 
                className="flex items-center justify-center gap-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium text-sm hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                >
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                  Previous
                </button>

                <div className="flex gap-2">
                  {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-xl font-medium text-sm transition-all duration-300 ${
                        p === page
                          ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/30'
                          : 'bg-white/10 backdrop-blur-md border border-white/20 text-white/70 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                  disabled={page === pagination.pages}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-white font-medium text-sm hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
                >
                  Next
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </motion.div>
            )}
          </>
        )}
      </div>
    {/* Edit Gallery Modal (placeholder) */}
    {editModalOpen && editGallery && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold"
            onClick={() => setEditModalOpen(false)}
            aria-label="Close"
          >
            &times;
          </button>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Edit Gallery</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget as HTMLFormElement);
              const title = form.get('title') as string;
              const description = form.get('description') as string;
              await saveEdit({ title, description });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input name="title" defaultValue={editGallery.eventTitle} placeholder="Gallery title" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea name="description" defaultValue={editGallery.eventDescription} placeholder="Short description" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200" onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold">Save</button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Delete Gallery Modal with data warning */}
    {deleteModalOpen && deleteGallery && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold"
            onClick={() => setDeleteModalOpen(false)}
            aria-label="Close"
          >
            &times;
          </button>
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Delete Gallery</h2>
          <div className="text-gray-700 mb-2">Are you sure you want to delete <b>{deleteGallery.eventTitle}</b>?</div>
          
          {/* Warning when gallery has media */}
          {deleteGallery.mediaCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-red-700 font-semibold">Warning: This gallery contains {deleteGallery.mediaCount} media item{deleteGallery.mediaCount > 1 ? 's' : ''}!</p>
                  <p className="text-red-600 text-sm mt-1">All photos and videos will be permanently deleted. This action cannot be undone.</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold hover:from-red-500 hover:to-pink-500"
              onClick={() => confirmDeleteGallery()}
            >
              {deleteGallery.mediaCount > 0 ? 'Delete All' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Create Gallery Modal */}
    {createModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <motion.div 
          className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            onClick={() => setCreateModalOpen(false)}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold mb-2 text-gray-900">Create Gallery</h2>
          <p className="text-gray-600 text-sm mb-6">Select an event to create a gallery for it.</p>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2" id="event-select-label">Select Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              aria-labelledby="event-select-label"
              title="Select an event to create gallery"
            >
              <option value="">Choose an event...</option>
              {events.map((event: any) => (
                <option key={event._id} value={event._id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="px-5 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
              onClick={() => setCreateModalOpen(false)}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateGallery}
              disabled={!selectedEventId || creating}
              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Create Gallery
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    
    {/* Alert Modal */}
    <AlertModal
      isOpen={alertModal?.show || false}
      onClose={() => setAlertModal(null)}
      title={alertModal?.title || ''}
      message={alertModal?.message || ''}
      variant="danger"
    />

    </motion.div>
  );
};

export default Gallery;
