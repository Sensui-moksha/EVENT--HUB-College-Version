import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import AccessControlForm from '../components/AccessControlForm';
import ImageUploadManager from '../components/ImageUploadManager';
import { AccessControl, SubEvent } from '../types/subEvent';
import { API_BASE_URL } from '../utils/api';
import { uploadFormDataWithProgress } from '../utils/upload';
import { invalidateCache } from '../utils/cacheManager';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ArrowLeft,
  Plus,
  X,
  Trophy,
  AlertCircle,
  Loader2,
  Save
} from 'lucide-react';
import { pageVariants } from '../utils/animations';

// Helper function to get full image URL for relative paths
const getFullImageUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const EditSubEvent: React.FC = () => {
  const { user: _user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [subEvent, setSubEvent] = useState<SubEvent | null>(null);
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [accessControl, setAccessControl] = useState<AccessControl>({
    type: 'everyone',
    allowedDepartments: [],
    allowedYears: [],
    allowedRoles: []
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  const [localImageFile, setLocalImageFile] = useState<File | undefined>();
  const [localImagePreview, setLocalImagePreview] = useState<string | undefined>();
  const [localImageMeta, setLocalImageMeta] = useState<{ width?: number; height?: number; originalName?: string }>({});
  const [localImageDeleted, setLocalImageDeleted] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [urlImageDimensions, setUrlImageDimensions] = useState<{ width?: number; height?: number }>({});

  const [isTeamEvent, setIsTeamEvent] = useState<boolean>(false);
  const [minTeamSize, setMinTeamSize] = useState<number>(2);
  const [maxTeamSize, setMaxTeamSize] = useState<number>(4);

  // Fetch existing sub-event data
  useEffect(() => {
    const fetchSubEvent = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const se = data.subEvent || data;
          setSubEvent(se);
          
          // Parse time string (format: "HH:MM - HH:MM")
          let startTime = '';
          let endTime = '';
          if (se.time) {
            const timeParts = se.time.split(' - ');
            if (timeParts.length === 2) {
              startTime = timeParts[0].trim();
              endTime = timeParts[1].trim();
            } else {
              startTime = se.time;
            }
          }

          setFormData({
            title: se.title || '',
            description: se.description || '',
            category: se.category || 'technical',
            customCategory: '',
            date: se.date ? new Date(se.date).toISOString().split('T')[0] : '',
            startTime,
            endTime,
            venue: se.venue || '',
            capacity: se.maxParticipants || se.capacity || 0,
            imageUrl: se.image || se.imageUrl || '',
            requirements: se.requirements?.length ? se.requirements : [''],
            prizes: se.prizes?.length ? se.prizes : [''],
            tags: se.tags?.length ? se.tags : ['']
          });

          if (se.accessControl) {
            setAccessControl(se.accessControl);
          }

          setIsTeamEvent(se.isTeamEvent || false);
          setMinTeamSize(se.minTeamSize || 2);
          setMaxTeamSize(se.maxTeamSize || 4);

          // Set image preview
          if (se.image || se.imageUrl) {
            setImagePreview(getFullImageUrl(se.image || se.imageUrl));
          }
        } else {
          addToast({ type: 'error', title: 'Failed to load sub-event' });
          navigate(-1);
        }
      } catch (error) {
        console.error('Error fetching sub-event:', error);
        addToast({ type: 'error', title: 'Error loading sub-event' });
        navigate(-1);
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchSubEvent();
    }
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'capacity' ? parseInt(value) || 0 : value
    }));
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
      return;
    }
    if (payload.mode === 'upload' && payload.file) {
      setLocalImageDeleted(false);
      setLocalImageFile(payload.file);
      setLocalImagePreview(payload.previewUrl);
      setLocalImageMeta({ width: payload.width, height: payload.height, originalName: payload.originalName });
    } else if (payload.mode === 'none') {
      setLocalImageFile(undefined);
      setLocalImagePreview(undefined);
      setLocalImageMeta({});
    }
  };

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
      ref.current.classList.add('ring-2', 'ring-red-500', 'ring-offset-2');
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-red-500', 'ring-offset-2');
      }, 3000);
    }
  };

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
      const firstErrorField = Object.keys(newErrors)[0];
      scrollToError(firstErrorField);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!id) {
      addToast({ type: 'error', title: 'Sub-event ID not found' });
      return;
    }

    if (!validateForm()) {
      addToast({ type: 'error', title: 'Please fill all required fields' });
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const imageDimensions = localImageFile && !localImageDeleted 
        ? { imageWidth: localImageMeta.width, imageHeight: localImageMeta.height }
        : formData.imageUrl && urlImageDimensions.width 
          ? { imageWidth: urlImageDimensions.width, imageHeight: urlImageDimensions.height }
          : {};

      if (localImageFile && !localImageDeleted) {
        const fd = new FormData();
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        fd.append('time', `${formData.startTime} - ${formData.endTime}`);
        fd.append('venue', formData.venue);
        fd.append('accessControl', JSON.stringify(accessControl));
        
        if (formData.date) {
          fd.append('date', formData.date);
        }
        if (formData.capacity > 0) {
          fd.append('capacity', String(formData.capacity));
        }
        
        fd.append('isTeamEvent', String(isTeamEvent));
        if (isTeamEvent) {
          fd.append('minTeamSize', String(minTeamSize));
          fd.append('maxTeamSize', String(maxTeamSize));
        }
        
        formData.requirements.filter(r => r.trim()).forEach(r => fd.append('requirements', r));
        formData.prizes.filter(p => p.trim()).forEach(p => fd.append('prizes', p));
        
        fd.append('image', localImageFile);
        if (localImageMeta.width) fd.append('imageWidth', String(localImageMeta.width));
        if (localImageMeta.height) fd.append('imageHeight', String(localImageMeta.height));

        setUploadProgress(0);
        const response = await uploadFormDataWithProgress(
          `/api/sub-events/${id}`,
          fd,
          (p) => setUploadProgress(p),
          'PUT'
        );
        setUploadProgress(null);

        if (response.ok) {
          invalidateCache.onSubEventChange(subEvent?.parentEventId);
          addToast({ type: 'success', title: 'Sub-event updated successfully!' });
          navigate(`/sub-events/${id}`);
        } else {
          const error = await response.json();
          addToast({ type: 'error', title: error.message || 'Failed to update sub-event' });
        }
      } else {
        const payload: any = {
          title: formData.title,
          description: formData.description,
          time: `${formData.startTime} - ${formData.endTime}`,
          venue: formData.venue,
          image: localImageDeleted ? '' : (formData.imageUrl || ''),
          requirements: formData.requirements.filter(r => r.trim()),
          prizes: formData.prizes.filter(p => p.trim()),
          accessControl: accessControl,
          isTeamEvent: isTeamEvent,
          ...(isTeamEvent && { minTeamSize, maxTeamSize }),
          ...imageDimensions
        };

        if (formData.date) {
          payload.date = formData.date;
        }
        if (formData.capacity > 0) {
          payload.capacity = formData.capacity;
        }

        const response = await fetch(`${API_BASE_URL}/api/sub-events/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          invalidateCache.onSubEventChange(subEvent?.parentEventId);
          addToast({ type: 'success', title: 'Sub-event updated successfully!' });
          navigate(`/sub-events/${id}`);
        } else {
          const error = await response.json();
          addToast({ type: 'error', title: error.message || 'Failed to update sub-event' });
        }
      }
    } catch (error) {
      console.error('Error updating sub-event:', error);
      addToast({ type: 'error', title: 'An error occurred while updating the sub-event' });
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

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

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
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Edit Sub-Event
          </h1>
          <p className="text-gray-600">
            Update sub-event details and settings
          </p>
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
                  placeholder="e.g., Seminar Hall A"
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
                  placeholder="Max participants"
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
                  placeholder="Describe the sub-event..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.description}
                  </p>
                )}
              </div>

              {/* Image Upload */}
              <ImageUploadManager
                initialPreviewUrl={imagePreview}
                onChange={handleLocalUploadChange}
              />

              {/* OR URL Input */}
              {!localImageFile && !localImagePreview && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or paste image URL
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={handleImageUrlChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="https://example.com/image.jpg"
                  />
                  {imageLoading && (
                    <div className="mt-2 flex items-center gap-2 text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading image...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Team Event Settings */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Team Event Settings
            </h3>
            
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="isTeamEvent"
                checked={isTeamEvent}
                onChange={(e) => setIsTeamEvent(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="isTeamEvent" className="text-sm font-medium text-gray-700">
                This is a team event
              </label>
            </div>

            {isTeamEvent && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-purple-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Team Size
                  </label>
                  <input
                    type="number"
                    min="2"
                    value={minTeamSize}
                    onChange={(e) => setMinTeamSize(parseInt(e.target.value) || 2)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Minimum team members"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Team Size
                  </label>
                  <input
                    type="number"
                    min={minTeamSize}
                    value={maxTeamSize}
                    onChange={(e) => setMaxTeamSize(parseInt(e.target.value) || 4)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Maximum team members"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Requirements */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirements</h3>
            <div className="space-y-3">
              {formData.requirements.map((req, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={req}
                    onChange={(e) => updateRequirement(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter requirement"
                  />
                  <button
                    type="button"
                    onClick={() => removeRequirement(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove requirement"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addRequirement}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Requirement
              </button>
            </div>
          </div>

          {/* Prizes */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Prizes
            </h3>
            <div className="space-y-3">
              {formData.prizes.map((prize, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={prize}
                    onChange={(e) => updatePrize(index, e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`${index + 1}st place prize`}
                  />
                  <button
                    type="button"
                    onClick={() => removePrize(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove prize"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPrize}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Prize
              </button>
            </div>
          </div>

          {/* Access Control */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Access Control</h3>
            <AccessControlForm
              value={accessControl}
              onChange={setAccessControl}
            />
          </div>

          {/* Submit Button */}
          <div className="mt-10 flex gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

          {/* Upload Progress */}
          {uploadProgress !== null && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Uploading image...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </form>
      </div>
    </motion.div>
  );
};

export default EditSubEvent;
