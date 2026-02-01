import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import AccessControlForm from '../components/AccessControlForm';
import ImageUploadManager from '../components/ImageUploadManager';
import { AccessControl } from '../types/subEvent';
import { API_BASE_URL } from '../utils/api';
import { uploadFormDataWithProgress } from '../utils/upload';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  Image,
  ArrowLeft,
  Plus,
  X,
  Tag,
  Trophy,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { pageVariants } from '../utils/animations';

// Helper function to get full image URL for relative paths
const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  // If it's already a full URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // If it's a relative path (like /api/images/...), prepend API_BASE_URL
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const CreateSubEvent: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  // Stable user ID to prevent unnecessary re-renders
  const userId = user?._id || user?.id;

  // Refs for scrolling to errors
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [loading, setLoading] = useState(false);
  const [parentEvent, setParentEvent] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'technical',
    customCategory: '',
    date: '',
    startTime: '',
    endTime: '',
    venue: '',
    capacity: 0,
    imageUrl: '',
    requirements: [''],
    prizes: [''],
    tags: ['']
  });

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [accessControl, setAccessControl] = useState<AccessControl>({
    type: 'everyone',
    allowedDepartments: [],
    allowedYears: [],
    allowedRoles: []
  });

  // Image states
  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [localImageFile, setLocalImageFile] = useState<File | undefined>();
  const [localImagePreview, setLocalImagePreview] = useState<string | undefined>();
  const [localImageMeta, setLocalImageMeta] = useState<{ width?: number; height?: number; originalName?: string }>({});
  const [localImageDeleted, setLocalImageDeleted] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [urlImageDimensions, setUrlImageDimensions] = useState<{ width?: number; height?: number }>({});

  // Team event settings
  const [isTeamEvent, setIsTeamEvent] = useState<boolean>(false);
  const [minTeamSize, setMinTeamSize] = useState<number>(2);
  const [maxTeamSize, setMaxTeamSize] = useState<number>(4);

  // Fetch parent event data
  useEffect(() => {
    const fetchParentEvent = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const event = await response.json();
          setParentEvent(event);
          // Auto-populate date and venue from parent event
          setFormData(prev => ({
            ...prev,
            date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
            venue: event.venue || '',
            capacity: event.maxParticipants || 0
          }));
        }
      } catch (error) {
        console.error('Error fetching parent event:', error);
      }
    };

    if (eventId) {
      fetchParentEvent();
    }
  }, [eventId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 0 : value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Requirements handlers
  const addRequirement = () => {
    setFormData(prev => ({ ...prev, requirements: [...prev.requirements, ''] }));
  };

  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.filter((_, i) => i !== index)
    }));
  };

  const updateRequirement = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.map((req, i) => i === index ? value : req)
    }));
  };

  // Prizes handlers
  const addPrize = () => {
    setFormData(prev => ({ ...prev, prizes: [...prev.prizes, ''] }));
  };

  const removePrize = (index: number) => {
    setFormData(prev => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index)
    }));
  };

  const updatePrize = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => i === index ? value : prize)
    }));
  };

  // Tags handlers
  const handleTagChange = (index: number, value: string) => {
    const newTags = [...formData.tags];
    newTags[index] = value;
    setFormData(prev => ({ ...prev, tags: newTags }));
  };

  const addTag = () => {
    setFormData(prev => ({ ...prev, tags: [...prev.tags, ''] }));
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  // Image URL handler with loading state
  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, imageUrl: url }));
    
    if (!url) {
      setImagePreview('');
      setImageLoading(false);
      setUrlImageDimensions({});
      return;
    }

    setImageLoading(true);
    setImagePreview('');

    const img = new window.Image();
    img.onload = () => {
      setImagePreview(url);
      setImageLoading(false);
      setUrlImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      addToast({
        type: 'error',
        title: 'Image Not Reachable',
        message: 'Could not load image from the provided URL.'
      });
      setImagePreview('');
      setImageLoading(false);
      setUrlImageDimensions({});
    };
    img.src = url;
  };

  // Local upload handler
  const handleLocalUploadChange = (payload: { 
    mode: 'none' | 'upload'; 
    file?: File; 
    blob?: Blob; 
    previewUrl?: string; 
    width?: number; 
    height?: number; 
    originalName?: string; 
    deleted?: boolean; 
  }) => {
    if (payload.deleted) {
      setLocalImageDeleted(true);
      setLocalImageFile(undefined);
      setLocalImagePreview(undefined);
      setLocalImageMeta({});
      // Also clear URL image since user deleted
      setFormData(prev => ({ ...prev, image: '' }));
      return;
    }
    if (payload.mode === 'upload' && payload.file) {
      // Uploading a new file (cropped, edited, or from external URL)
      setLocalImageDeleted(false);
      setLocalImageFile(payload.file);
      setLocalImagePreview(payload.previewUrl);
      setLocalImageMeta({ width: payload.width, height: payload.height, originalName: payload.originalName });
      // Clear URL image since we're uploading
      setFormData(prev => ({ ...prev, image: '' }));
    } else if (payload.mode === 'none' && payload.previewUrl) {
      // Using existing database image URL (no re-upload needed!)
      // This prevents duplicate storage - just reference the existing image
      setLocalImageDeleted(false);
      setLocalImageFile(undefined); // No file to upload
      setLocalImagePreview(payload.previewUrl);
      setLocalImageMeta({ width: payload.width, height: payload.height });
      // Store the database image URL directly in form data
      setFormData(prev => ({ ...prev, image: payload.previewUrl || '' }));
    } else if (payload.mode === 'none') {
      // Cleared / reset
      setLocalImageFile(undefined);
      setLocalImagePreview(undefined);
      setLocalImageMeta({});
    }
  };

  // Scroll to first error
  const scrollToError = (fieldName: string) => {
    const refMap: Record<string, React.RefObject<any>> = {
      title: titleRef,
      description: descriptionRef,
      startTime: startTimeRef,
      endTime: endTimeRef
    };

    const ref = refMap[fieldName];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref.current.focus();
      // Add highlight animation
      ref.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
      }, 3000);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.startTime) {
      newErrors.startTime = 'Start time is required';
    }
    if (!formData.endTime) {
      newErrors.endTime = 'End time is required';
    }
    if (formData.startTime && formData.endTime && formData.startTime >= formData.endTime) {
      newErrors.endTime = 'End time must be after start time';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      // Scroll to first error
      const firstErrorField = Object.keys(newErrors)[0];
      scrollToError(firstErrorField);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventId) {
      addToast({ type: 'error', title: 'Event ID not found' });
      return;
    }

    // Validate form
    if (!validateForm()) {
      addToast({ type: 'error', title: 'Please fill all required fields' });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Determine image dimensions
      const imageDimensions = localImageFile && !localImageDeleted 
        ? { imageWidth: localImageMeta.width, imageHeight: localImageMeta.height }
        : formData.imageUrl && urlImageDimensions.width 
          ? { imageWidth: urlImageDimensions.width, imageHeight: urlImageDimensions.height }
          : {};

      // Handle multipart upload if local file exists
      if (localImageFile && !localImageDeleted) {
        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        fd.append('time', `${formData.startTime} - ${formData.endTime}`);
        fd.append('venue', formData.venue);
        fd.append('organizerId', userId || '');
        fd.append('accessControl', JSON.stringify(accessControl));
        
        if (formData.date) {
          fd.append('date', formData.date);
          fd.append('registrationDeadline', formData.date);
        }
        if (formData.capacity > 0) {
          fd.append('capacity', String(formData.capacity));
        }
        
        // Add team event settings
        fd.append('isTeamEvent', String(isTeamEvent));
        if (isTeamEvent) {
          fd.append('minTeamSize', String(minTeamSize));
          fd.append('maxTeamSize', String(maxTeamSize));
        }
        
        // Add requirements and prizes
        formData.requirements.filter(r => r.trim()).forEach(r => fd.append('requirements', r));
        formData.prizes.filter(p => p.trim()).forEach(p => fd.append('prizes', p));
        
        fd.append('image', localImageFile);
        if (localImageMeta.width) fd.append('imageWidth', String(localImageMeta.width));
        if (localImageMeta.height) fd.append('imageHeight', String(localImageMeta.height));

        setUploadProgress(0);
        const response = await uploadFormDataWithProgress(
          `/api/events/${eventId}/sub-events`,
          fd,
          (p) => setUploadProgress(p),
          'POST'
        );
        setUploadProgress(null);

        if (response.ok) {
          addToast({ type: 'success', title: 'Sub-event created successfully!' });
          navigate(`/events/${eventId}`);
        } else {
          const error = await response.json();
          addToast({ type: 'error', title: error.message || 'Failed to create sub-event' });
        }
      } else {
        // JSON payload
        const payload: any = {
          title: formData.title,
          description: formData.description,
          time: `${formData.startTime} - ${formData.endTime}`,
          venue: formData.venue,
          organizerId: userId,
          image: formData.imageUrl || '',
          requirements: formData.requirements.filter(r => r.trim()),
          prizes: formData.prizes.filter(p => p.trim()),
          accessControl: accessControl,
          isTeamEvent: isTeamEvent,
          ...(isTeamEvent && { minTeamSize, maxTeamSize }),
          ...imageDimensions
        };

        if (formData.date) {
          payload.date = formData.date;
          payload.registrationDeadline = formData.date;
        }
        if (formData.capacity > 0) {
          payload.capacity = formData.capacity;
        }

        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/sub-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          addToast({ type: 'success', title: 'Sub-event created successfully!' });
          navigate(`/events/${eventId}`);
        } else {
          const error = await response.json();
          addToast({ type: 'error', title: error.message || 'Failed to create sub-event' });
        }
      }
    } catch (error) {
      console.error('Error creating sub-event:', error);
      addToast({ type: 'error', title: 'An error occurred while creating the sub-event' });
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const categories = [
    { value: 'technical', label: 'Technical' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'sports', label: 'Sports' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'seminar', label: 'Seminar' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen pt-24 pb-8"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/events/${eventId}`)}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Event</span>
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Create Sub-Event
          </h1>
          <p className="text-gray-600">
            Create a sub-event with custom access control and settings
          </p>

          {/* Parent Event Info */}
          {parentEvent && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <p className="text-sm font-medium text-blue-900">
                Parent Event: {parentEvent.title}
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-blue-700">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {parentEvent.date ? new Date(parentEvent.date).toLocaleDateString() : 'No date set'}
                </span>
                {parentEvent.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {parentEvent.venue}
                  </span>
                )}
                {parentEvent.maxParticipants && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {parentEvent.maxParticipants} max
                  </span>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Date and venue are auto-filled from parent event (you can modify them if needed)
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Sub-Event Title *
                </label>
                <input
                  ref={titleRef}
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.title ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter sub-event title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {formData.category === 'other' && (
                  <div className="mt-3">
                    <input
                      name="customCategory"
                      type="text"
                      value={formData.customCategory}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter custom category"
                    />
                  </div>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="date"
                      name="date"
                      type="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      ref={startTimeRef}
                      id="startTime"
                      name="startTime"
                      type="time"
                      required
                      value={formData.startTime}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.startTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.startTime && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.startTime}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-2">
                    End Time *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      ref={endTimeRef}
                      id="endTime"
                      name="endTime"
                      type="time"
                      required
                      value={formData.endTime}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        errors.endTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.endTime && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.endTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Venue */}
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Venue
                </label>
                <input
                  id="venue"
                  name="venue"
                  type="text"
                  value={formData.venue}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g., Seminar Hall A, Room 101"
                />
              </div>

              {/* Capacity */}
              <div>
                <label htmlFor="capacity" className="block text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4 inline mr-1" />
                  Capacity (0 = unlimited)
                </label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Max participants (0 for unlimited)"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  ref={descriptionRef}
                  id="description"
                  name="description"
                  required
                  rows={6}
                  value={formData.description}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none ${
                    errors.description ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Describe the sub-event in detail..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Image URL + Local Upload Unified Container */}
              <div>
                <label htmlFor="imageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Image URL
                </label>
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {/* URL Input Row */}
                  <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 relative min-w-0">
                      <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        id="imageUrl"
                        name="imageUrl"
                        type="text"
                        value={formData.imageUrl}
                        onChange={handleImageUrlChange}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="https://example.com/image.jpg or /api/images/..."
                      />
                    </div>
                    <div className="flex flex-col sm:items-center shrink-0">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 mb-1 sm:mb-1">OR</span>
                      <button
                        type="button"
                        onClick={() => {
                          // Scroll to local upload manager or trigger file select directly if no file yet
                          const uploadSection = document.getElementById('local-upload-manager-sub');
                          if (uploadSection) {
                            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                          // If user has not chosen a local image yet, open file dialog of the manager via a custom event
                          const ev = new CustomEvent('trigger-local-upload');
                          window.dispatchEvent(ev);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 shadow-sm whitespace-nowrap w-full sm:w-auto"
                      >
                        Upload File
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {/* Loading indicator while fetching image */}
                    {imageLoading && !localImagePreview && (
                      <motion.div
                        key="loading-preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="mt-3 flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-dashed border-gray-300"
                      >
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Loader2 size={32} className="animate-spin text-blue-500" />
                          <span className="text-sm">Loading image...</span>
                        </div>
                      </motion.div>
                    )}
                    {imagePreview && !localImagePreview && (
                      <motion.div
                        key="url-preview"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="mt-1"
                      >
                        <img src={getFullImageUrl(imagePreview)} alt="Event Preview" className="w-full max-h-64 object-contain rounded-lg border bg-gray-50" />
                        {urlImageDimensions.width && urlImageDimensions.height && (
                          <p className="text-xs text-gray-500 mt-1">{urlImageDimensions.width} × {urlImageDimensions.height}px</p>
                        )}
                        {/* Edit button for URL image */}
                        <button
                          type="button"
                          title="Edit or adjust the image size"
                          onClick={() => {
                            const ev = new CustomEvent('trigger-edit-external-image', { detail: { url: formData.imageUrl } });
                            window.dispatchEvent(ev);
                          }}
                          className="mt-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 shadow-sm"
                        >
                          Edit / Adjust Size
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Embedded Local Upload Manager (mirrors stand-alone) */}
                  <div id="local-upload-manager-sub" className="mt-2">
                    <ImageUploadManager
                      initialPreviewUrl={localImagePreview}
                      embeddedMode={true}
                      externalImageUrl={formData.imageUrl}
                      onExternalImageEdit={(blob, previewUrl, width, height) => {
                        // Convert the edited external image to a local upload
                        const file = new File([blob], 'edited_image.webp', { type: 'image/webp' });
                        setLocalImageFile(file);
                        setLocalImagePreview(previewUrl);
                        setLocalImageMeta({ width, height, originalName: 'edited_image.webp' });
                        // Keep showing the local preview instead of URL
                        setImagePreview('');
                      }}
                      onChange={handleLocalUploadChange}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Paste an external URL or upload any size local image. Cropping and replace/delete supported. Uploads stream to storage.
                  </p>
                </div>

                {/* Upload Progress */}
                {uploadProgress !== null && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full Width Sections */}
          <div className="mt-8 space-y-8">
            {/* Team Event Section */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Team Event</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {isTeamEvent 
                      ? "This is a team-based sub-event. Participants must form teams to register."
                      : "This is an individual sub-event. Each participant registers separately."
                    }
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    title={isTeamEvent ? "Disable team event" : "Enable team event"}
                    onClick={() => setIsTeamEvent(!isTeamEvent)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                      isTeamEvent ? 'bg-indigo-500' : 'bg-gray-300'
                    }`}
                  >
                    <motion.span
                      layout
                      className="inline-block h-6 w-6 rounded-full bg-white"
                      animate={{ x: isTeamEvent ? 28 : 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  </button>
                </div>
              </div>
              
              {/* Team Size Controls */}
              <AnimatePresence>
                {isTeamEvent && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Team Size
                          </label>
                          <select
                            value={minTeamSize}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setMinTeamSize(val);
                              if (val > maxTeamSize) setMaxTeamSize(val);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            title="Select minimum team size"
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>{n} members</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Maximum Team Size
                          </label>
                          <select
                            value={maxTeamSize}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setMaxTeamSize(val);
                              if (val < minTeamSize) setMinTeamSize(val);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            title="Select maximum team size"
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n} disabled={n < minTeamSize}>{n} members</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <p className="text-sm text-indigo-700 mt-3">
                        <strong>Team Requirements:</strong> Each team must have between {minTeamSize} and {maxTeamSize} members. 
                        One person creates the team and invites others to join before the registration deadline.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Access Control */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Access Control
              </h2>
              <AccessControlForm value={accessControl} onChange={setAccessControl} />
            </div>

            {/* Requirements */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Requirements
              </h2>
              <div className="space-y-3">
                {formData.requirements.map((req, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={req}
                      onChange={(e) => updateRequirement(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g., Laptop required, Basic programming knowledge"
                    />
                    {formData.requirements.length > 1 && (
                      <button
                        type="button"
                        title="Remove requirement"
                        onClick={() => removeRequirement(index)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRequirement}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Requirement
                </button>
              </div>
            </div>

            {/* Prizes */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Prizes
              </h2>
              <div className="space-y-3">
                {formData.prizes.map((prize, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={prize}
                      onChange={(e) => updatePrize(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g., 1st Prize - ₹5000, Certificate for all"
                    />
                    {formData.prizes.length > 1 && (
                      <button
                        type="button"
                        title="Remove prize"
                        onClick={() => removePrize(index)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPrize}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Prize
                </button>
              </div>
            </div>

            {/* Tags */}
            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-purple-500" />
                Tags
              </h2>
              <div className="space-y-3">
                {formData.tags.map((tag, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => handleTagChange(index, e.target.value)}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="e.g., workshop, hands-on, beginner-friendly"
                    />
                    {formData.tags.length > 1 && (
                      <button
                        type="button"
                        title="Remove tag"
                        onClick={() => removeTag(index)}
                        className="p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addTag}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Tag
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-4 mt-10 pt-8 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate(`/events/${eventId}`)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg disabled:opacity-50 transition-all font-medium shadow-lg flex items-center justify-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Create Sub-Event
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default CreateSubEvent;
