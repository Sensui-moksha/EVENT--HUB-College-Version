import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEvents } from '../contexts/EventContext.tsx';
import { useToast } from '../components/ui/Toast';
import {
  Calendar,
  MapPin,
  Users,
  Trophy,
  FileText,
  Image,
  ArrowLeft,
  Plus,
  X,
  Shield,
  Bell,
  Eye,
  BellOff,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { pageVariants } from '../utils/animations';
import AccessControlForm from '../components/AccessControlForm';
import ImageUploadManager from '../components/ImageUploadManager';
import TimePicker from '../components/TimePicker';
import { AccessControl } from '../types/subEvent';
import { uploadFormDataWithProgress } from '../utils/upload';
import { API_BASE_URL } from '../utils/api';
import { DEFAULT_COLLEGE } from '../config/college';

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

const CreateEvent: React.FC = () => {
  const { user } = useAuth();
  const { events, createEvent, updateEvent, loading } = useEvents();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Check if we're in edit mode (either from URL params or location state)
  const isEditMode = !!id || !!location.state?.event;
  const editingEvent = location.state?.event || (id ? events.find(e => e.id === id || (e as any)._id === id) : null);

  const [showCalendar, setShowCalendar] = useState(false);

  // State for form data
  interface CreateEventForm {
    title: string;
    description: string;
    category: string;
    customCategory: string;
    date: string;
    time: string;
    endTime: string;
    venue: string;
    maxParticipants: number;
    image: string;
    requirements: string[];
    prizes: string[];
    registrationDeadline: string;
    registrationDeadlineTime: string;
    status: string;
  }

  const [formData, setFormData] = useState<CreateEventForm>({
    title: editingEvent?.title || '',
    description: editingEvent?.description || '',
    // If editingEvent has a category not in the known list we'll set category to 'other'
    category: ((): string => {
      const known = ['technical', 'cultural', 'sports', 'workshop', 'seminar', 'other'];
      const c = (editingEvent?.category as string) || '';
      if (!c) return 'technical';
      return known.includes(c.toLowerCase()) ? c.toLowerCase() : 'other';
    })(),
    customCategory: ((): string => {
      const c = (editingEvent?.category as string) || '';
      const known = ['technical', 'cultural', 'sports', 'workshop', 'seminar', 'other'];
      return c && !known.includes(c.toLowerCase()) ? c : '';
    })(),
    date: editingEvent?.date ? new Date(editingEvent.date).toISOString().slice(0, 10) : '',
    time: editingEvent?.time || '',
    endTime: (editingEvent as any)?.endTime || '',
    venue: editingEvent?.venue || '',
    maxParticipants: editingEvent?.maxParticipants || 50,
    image: editingEvent?.image || '',
    requirements: editingEvent?.requirements || [''],
    prizes: editingEvent?.prizes || [''],
    registrationDeadline: editingEvent?.registrationDeadline ? new Date(editingEvent.registrationDeadline).toISOString().slice(0, 10) : '',
    registrationDeadlineTime: editingEvent?.registrationDeadline ? (() => {
      const d = new Date(editingEvent.registrationDeadline);
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    })() : '23:59',
    status: editingEvent?.status || 'upcoming',
  });

  const [imagePreview, setImagePreview] = useState<string>('');
  // Loading state for URL image
  const [imageLoading, setImageLoading] = useState<boolean>(false);
  // Local upload state (unlimited size). If file set, we use multipart flow.
  const [localImageFile, setLocalImageFile] = useState<File | undefined>();
  const [localImagePreview, setLocalImagePreview] = useState<string | undefined>();
  const [localImageMeta, setLocalImageMeta] = useState<{ width?: number; height?: number; originalName?: string }>({});
  const [localImageDeleted, setLocalImageDeleted] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Access Control state
  const [accessControl, setAccessControl] = useState<AccessControl>({
    type: (editingEvent as any)?.accessControl?.type || 'everyone',
    allowedDepartments: (editingEvent as any)?.accessControl?.allowedDepartments || [],
    allowedYears: (editingEvent as any)?.accessControl?.allowedYears || [],
    allowedRoles: (editingEvent as any)?.accessControl?.allowedRoles || []
  });

  // Auto Approval state
  const [autoApproval, setAutoApproval] = useState<boolean>(
    (editingEvent as any)?.autoApproval ?? true
  );

  // College-specific settings
  const COLLEGE_NAME = DEFAULT_COLLEGE;
  // allowOtherColleges: OFF = only college students can register (default), ON = anyone can register
  const [allowOtherColleges, setAllowOtherColleges] = useState<boolean>(
    (editingEvent as any)?.allowOtherColleges ?? false
  );
  // notifyAllUsers: OFF = notify only college students (default), ON = notify all users
  const [notifyAllUsers, setNotifyAllUsers] = useState<boolean>(
    (editingEvent as any)?.notifyAllUsers ?? false
  );
  const [visibleToOthers, setVisibleToOthers] = useState<boolean>(
    (editingEvent as any)?.visibleToOthers ?? false
  );
  // Silent Release: OFF = send notifications when event created (default), ON = no notifications
  const [silentRelease, setSilentRelease] = useState<boolean>(
    (editingEvent as any)?.silentRelease ?? false
  );

  // Already Completed: allows creating past/completed events for gallery media uploads
  const [isAlreadyCompleted, setIsAlreadyCompleted] = useState<boolean>(false);

  // Team event settings
  const [isTeamEvent, setIsTeamEvent] = useState<boolean>(
    (editingEvent as any)?.isTeamEvent ?? false
  );
  const [minTeamSize, setMinTeamSize] = useState<number>(
    (editingEvent as any)?.minTeamSize ?? 2
  );
  const [maxTeamSize, setMaxTeamSize] = useState<number>(
    (editingEvent as any)?.maxTeamSize ?? 4
  );

  // Helper function to get events for a specific date
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  // Helper function to format date for display
  const formatDateForDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const today = new Date();
    const currentDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const firstDayOfWeek = currentDate.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), day));
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();

  // Load event data if editing via URL parameter
  useEffect(() => {
    if (id && !editingEvent && events.length > 0) {
      const event = events.find(e => e.id === id || (e as any)._id === id);
      if (event) {
          // If event.category is unknown, move it to customCategory and set category to 'other'
          const known = ['technical', 'cultural', 'sports', 'workshop', 'seminar', 'other'];
          const cat = (event.category as string) || '';
          const isKnown = !!cat && known.includes(cat.toLowerCase());
          setFormData({
            title: event.title,
            description: event.description,
            category: isKnown ? cat.toLowerCase() : 'other',
            customCategory: isKnown ? '' : cat,
            date: new Date(event.date).toISOString().slice(0, 10),
            time: event.time,
            endTime: (event as any).endTime || '',
            venue: event.venue,
            maxParticipants: event.maxParticipants,
            image: event.image || '',
            requirements: event.requirements || [''],
            prizes: event.prizes || [''],
            registrationDeadline: new Date(event.registrationDeadline).toISOString().slice(0, 10),
            registrationDeadlineTime: (() => {
              const d = new Date(event.registrationDeadline);
              const hours = d.getHours().toString().padStart(2, '0');
              const minutes = d.getMinutes().toString().padStart(2, '0');
              return `${hours}:${minutes}`;
            })(),
            status: event.status,
          });
        if (event.image) {
          setImagePreview(event.image);
        }
      }
    }
  }, [id, editingEvent, events]);

  // If we're in edit mode via URL but haven't found the event yet, show loading
  if (id && !editingEvent && events.length === 0 && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  // If we're in edit mode but the event doesn't exist
  if (id && !editingEvent && events.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-4">The event you're trying to edit doesn't exist or may have been deleted.</p>
          <button
            onClick={() => navigate('/events')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const categories = [
    { value: 'technical', label: 'Technical' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'sports', label: 'Sports' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'seminar', label: 'Seminar' },
    { value: 'other', label: 'Other' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    // Skip date validations entirely for already-completed events
    if (!isAlreadyCompleted) {
      // Skip date validation in edit mode if date hasn't changed (event might be happening soon)
      const isDateChanged = isEditMode ? new Date(formData.date).getTime() !== new Date(editingEvent?.date || '').getTime() : true;
      if (isDateChanged && new Date(formData.date) <= new Date()) {
        addToast({
          type: 'error',
          title: 'Invalid Date',
          message: 'Event date must be in the future.',
        });
        return;
      }
      
      // Validate registration deadline is before event date/time
      const regDeadlineDateTime = new Date(`${formData.registrationDeadline}T${formData.registrationDeadlineTime || '23:59'}:00`);
      const eventDateTime = new Date(`${formData.date}T${formData.time}:00`);
      
      if (regDeadlineDateTime >= eventDateTime) {
        addToast({
          type: 'error',
          title: 'Invalid Registration Deadline',
          message: 'Registration deadline must be before the event starts.',
        });
        return;
      }
    }

    // Determine image dimensions (from local upload or URL)
    const imageDimensions = localImageFile && !localImageDeleted 
      ? { imageWidth: localImageMeta.width, imageHeight: localImageMeta.height }
      : formData.image && urlImageDimensions.width 
        ? { imageWidth: urlImageDimensions.width, imageHeight: urlImageDimensions.height }
        : {};

    const eventData = {
      ...formData,
      // If user selected 'other' and provided a custom category, prefer it
      category: formData.category === 'other' && formData.customCategory ? formData.customCategory : formData.category,
      date: new Date(formData.date),
      registrationDeadline: isAlreadyCompleted
        ? new Date(`${formData.date}T${formData.time || '23:59'}:00`)
        : new Date(`${formData.registrationDeadline}T${formData.registrationDeadlineTime || '23:59'}:00`),
      organizerId: user.id ?? user._id ?? '',
      requirements: formData.requirements.filter((req: string) => req.trim() !== ''),
      prizes: formData.prizes.filter((prize: string) => prize.trim() !== ''),
      status: isAlreadyCompleted ? 'completed' : formData.status,
      accessControl: accessControl,
      autoApproval: autoApproval,
      allowOtherColleges: allowOtherColleges,
      notifyAllUsers: notifyAllUsers,
      visibleToOthers: visibleToOthers,
      silentRelease: isAlreadyCompleted ? true : silentRelease,
      collegeName: COLLEGE_NAME,
      isTeamEvent: isTeamEvent,
      isAlreadyCompleted: isAlreadyCompleted,
      minTeamSize: isTeamEvent ? minTeamSize : 1,
      maxTeamSize: isTeamEvent ? maxTeamSize : 1,
      ...imageDimensions,
    };
    // ...removed console logs for production...

    let success = false;
    let errorMsg = '';
    
    // Prefer to map category to known union if it matches one of them
    const knownCategories = ['technical', 'cultural', 'sports', 'workshop', 'seminar'];
    let categoryForPayload = eventData.category;
    if (typeof categoryForPayload === 'string' && knownCategories.includes(categoryForPayload.toLowerCase())) {
      categoryForPayload = categoryForPayload.toLowerCase();
    } else if (typeof categoryForPayload === 'string' && !knownCategories.includes(categoryForPayload.toLowerCase())) {
      // Custom category: keep original string (no-op assignment removed)
      // If backend validation becomes strict, consider mapping unknown to 'technical'.
    }

    // Branch: local upload vs URL
    if (localImageFile && !localImageDeleted) {
      try {
        if (isEditMode) {
          // Replace existing image first (multipart PATCH)
            const patchId = editingEvent?.id || editingEvent?._id || id;
            if (patchId) {
              const fd = new FormData();
              fd.append('image', localImageFile);
              // Optionally pass dimensions
              if (localImageMeta.width) fd.append('imageWidth', String(localImageMeta.width));
              if (localImageMeta.height) fd.append('imageHeight', String(localImageMeta.height));
              setUploadProgress(0);
              const replaceRes = await uploadFormDataWithProgress(`/api/events/${patchId}/image`, fd, (p) => setUploadProgress(p), 'PATCH');
              const replaceData = await replaceRes.json();
              if (!replaceRes.ok) throw new Error(replaceData?.error || 'Image replace failed');
              setUploadProgress(null);
            }
          // Then update other event fields (JSON PUT) — do NOT override image set by PATCH
          const eventId = editingEvent?.id || editingEvent?._id || id;
          if (eventId) {
            const { image: _omitImage, ...rest } = eventData as any;
            success = await updateEvent(eventId, { ...rest, category: categoryForPayload } as any);
          }
        } else {
          // Multipart create new event with file
          const fd = new FormData();
          fd.append('title', eventData.title);
          fd.append('description', eventData.description);
          fd.append('category', categoryForPayload as string);
          fd.append('date', eventData.date.toISOString());
          fd.append('time', eventData.time);
          if (eventData.endTime) fd.append('endTime', eventData.endTime);
          fd.append('venue', eventData.venue);
          fd.append('maxParticipants', String(eventData.maxParticipants));
          fd.append('organizerId', eventData.organizerId);
          fd.append('registrationDeadline', eventData.registrationDeadline.toISOString());
          fd.append('autoApproval', String(eventData.autoApproval));
          fd.append('allowOtherColleges', String(eventData.allowOtherColleges));
          fd.append('notifyAllUsers', String(eventData.notifyAllUsers));
          fd.append('visibleToOthers', String(eventData.visibleToOthers));
          fd.append('silentRelease', String(eventData.silentRelease));
          fd.append('collegeName', eventData.collegeName);
          fd.append('isTeamEvent', String(eventData.isTeamEvent));
          fd.append('isAlreadyCompleted', String(eventData.isAlreadyCompleted));
          fd.append('status', eventData.status);
          fd.append('minTeamSize', String(eventData.minTeamSize));
          fd.append('maxTeamSize', String(eventData.maxTeamSize));
          fd.append('accessControl', JSON.stringify(eventData.accessControl));
          eventData.requirements.forEach((r: string) => fd.append('requirements', r));
          eventData.prizes.forEach((p: string) => fd.append('prizes', p));
          fd.append('image', localImageFile);
          if (localImageMeta.width) fd.append('imageWidth', String(localImageMeta.width));
          if (localImageMeta.height) fd.append('imageHeight', String(localImageMeta.height));
          setUploadProgress(0);
          const createRes = await uploadFormDataWithProgress('/api/events/create', fd, (p) => setUploadProgress(p), 'POST');
          const createData = await createRes.json();
          if (!createRes.ok) throw new Error(createData?.error || 'Event creation failed');
          setUploadProgress(null);
          success = !!createData.event;
          if (success) {
            // Invalidate cache and refresh to show new event immediately
            const cacheManager = (await import('../utils/cacheManager')).default;
            cacheManager.invalidateAll();
          }
        }
      } catch (err: any) {
        errorMsg = err?.message || 'Upload failed';
        console.error('Local image workflow error:', err);
        success = false;
        setUploadProgress(null);
      }
    } else if (localImageDeleted && isEditMode) {
      // Delete existing uploaded image if requested
      try {
        const delId = editingEvent?.id || editingEvent?._id || id;
        if (delId) {
          const delRes = await fetch(`/api/events/${delId}/image`, { method: 'DELETE' });
          if (!delRes.ok) {
            const delData = await delRes.json();
            console.warn('Image deletion failed', delData);
          }
        }
        // Proceed with updating other fields
        const eventId = editingEvent?.id || editingEvent?._id || id;
        if (eventId) {
          success = await updateEvent(eventId, { ...eventData, category: categoryForPayload, image: '' } as any);
        }
      } catch (err: any) {
        errorMsg = err?.message || 'Image delete failed';
        success = false;
      }
    } else {
      // Original URL-only workflow
      if (isEditMode) {
        const eventId = editingEvent?.id || editingEvent?._id || id;
        if (eventId) {
          success = await updateEvent(eventId, { ...eventData, category: categoryForPayload } as any);
        }
      } else {
        try {
          success = await createEvent({ ...eventData, category: categoryForPayload } as any);
        } catch (err: any) {
          errorMsg = err?.message || '';
          console.error('Backend event creation error:', err);
        }
      }
    }

    if (success) {
      addToast({
        type: 'success',
        title: isEditMode ? 'Event Updated!' : 'Event Created!',
        message: isEditMode ? 'Your event has been updated successfully.' : 'Your event has been created successfully.',
      });
      navigate(isEditMode ? `/events/${id || editingEvent?.id || editingEvent?._id}` : '/dashboard');
    } else {
      addToast({
        type: 'error',
        title: isEditMode ? 'Update Failed' : 'Creation Failed',
        message: errorMsg ? errorMsg : 'Please try again later.',
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxParticipants' ? parseInt(value) || 0 : value,
    }));
  };

  // Store URL image dimensions
  const [urlImageDimensions, setUrlImageDimensions] = useState<{ width?: number; height?: number }>({});

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData(prev => ({ ...prev, image: url }));
    if (!url) {
      setImagePreview('');
      setImageLoading(false);
      setUrlImageDimensions({});
      return;
    }
    // Start loading
    setImageLoading(true);
    setImagePreview('');
    // Try to load image (accept any address)
    const img = new window.Image();
    img.onload = () => {
      setImagePreview(url);
      setImageLoading(false);
      // Store the image dimensions
      setUrlImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      addToast({
        type: 'error',
        title: 'Image Not Reachable',
        message: 'Could not load image from the provided address.',
      });
      setImagePreview('');
      setImageLoading(false);
      setUrlImageDimensions({});
    };
    img.src = url;
  };

  // Handle local upload manager events
  const handleLocalUploadChange = (payload: { mode: 'none' | 'upload'; file?: File; blob?: Blob; previewUrl?: string; width?: number; height?: number; originalName?: string; deleted?: boolean; }) => {
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

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, ''],
    }));
  };

  const removeRequirement = (index: number) => {
    setFormData(prev => ({
      ...prev,
  requirements: prev.requirements.filter((_: string, i: number) => i !== index),
    }));
  };

  const updateRequirement = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
  requirements: prev.requirements.map((req: string, i: number) => i === index ? value : req),
    }));
  };

  const addPrize = () => {
    setFormData(prev => ({
      ...prev,
      prizes: [...prev.prizes, ''],
    }));
  };

  const removePrize = (index: number) => {
    setFormData(prev => ({
      ...prev,
  prizes: prev.prizes.filter((_: string, i: number) => i !== index),
    }));
  };

  const updatePrize = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
  prizes: prev.prizes.map((prize: string, i: number) => i === index ? value : prize),
    }));
  };

  // Check user permissions
  if (!user || (user.role !== 'admin' && user.role !== 'organizer')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Only admins and organizers can create or edit events.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Additional check for editing: ensure user can edit this event
  if (isEditMode && editingEvent && user.role !== 'admin') {
    const eventOrgId = editingEvent.organizerId || editingEvent.organizer?.id || editingEvent.organizer?._id;
    const userId = user.id || user._id;
    
    if (eventOrgId !== userId) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">You can only edit events that you created.</p>
            <button
              onClick={() => navigate('/events')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Events
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <motion.div 
      className="min-h-screen pt-24 pb-8"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Image URL (original logic preserved) */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center space-x-2 text-gray-600 hover:text-blue-600 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isEditMode ? 'Edit Event' : 'Create New Event'}
          </h1>
          <p className="text-gray-600">
            {editingEvent ? 'Update the details below to edit your event.' : 'Fill in the details below to create an amazing event for your college community.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg xs:rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 p-4 xs:p-6 sm:p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {/* Left Column */}
            <div className="space-y-4 xs:space-y-5 sm:space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Enter event title"
                />
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
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
                {formData.category === 'other' && (
                  <div className="mt-3">
                    <label htmlFor="customCategory" className="block text-sm font-medium text-gray-700 mb-2">Custom Category *</label>
                    <input
                      id="customCategory"
                      name="customCategory"
                      type="text"
                      required
                      value={formData.customCategory}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Enter custom category"
                    />
                  </div>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      id="date"
                      name="date"
                      type="date"
                      required
                      value={formData.date}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
                <TimePicker
                  label="Start Time"
                  value={formData.time}
                  onChange={(time) => setFormData(prev => ({ ...prev, time }))}
                  required
                />
                <TimePicker
                  label="End Time (optional)"
                  value={formData.endTime}
                  onChange={(endTime) => setFormData(prev => ({ ...prev, endTime }))}
                />
              </div>
              <p className="text-xs text-gray-500 -mt-2">If end time is set, event auto-completes when end time is reached</p>

              {/* Event Calendar View */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Event Calendar - {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
                  </button>
                </div>

                {showCalendar && (
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    {/* Calendar Header */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, index) => {
                        if (!day) {
                          return <div key={index} className="h-10"></div>;
                        }
                        
                        const dayEvents = getEventsForDate(day);
                        const isToday = day.toDateString() === new Date().toDateString();
                        const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                        const hasEvents = dayEvents.length > 0;
                        
                        return (
                          <div
                            key={index}
                            className={`h-10 flex items-center justify-center text-sm relative rounded-md
                              ${isToday ? 'bg-blue-100 text-blue-800 font-semibold' : ''}
                              ${isPast ? 'text-gray-400' : 'text-gray-700'}
                              ${hasEvents ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'}
                            `}
                            title={hasEvents ? `${dayEvents.length} event(s): ${dayEvents.map(e => e.title).join(', ')}` : ''}
                          >
                            {day.getDate()}
                            {hasEvents && (
                              <div className="absolute bottom-0 right-0 w-2 h-2 bg-red-500 rounded-full -mb-1 -mr-1"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                        <span>Today</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-50 border border-red-200 rounded relative">
                          <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full -mb-0.5 -mr-0.5"></div>
                        </div>
                        <span>Has Events</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Month Event List */}
                <div className="mt-4">
                  <h4 className="text-md font-medium text-gray-800 mb-2">Upcoming Events This Month</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {events
                      .filter(event => {
                        const eventDate = new Date(event.date);
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        return eventDate.getMonth() === currentMonth && 
                               eventDate.getFullYear() === currentYear &&
                               eventDate >= new Date();
                      })
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .slice(0, 5)
                      .map(event => (
                        <div key={event.id || (event as any)._id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                          <div>
                            <p className="font-medium text-sm text-gray-900">{event.title}</p>
                            <p className="text-xs text-gray-500">
                              {formatDateForDisplay(new Date(event.date))} at {event.time}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            event.category === 'technical' ? 'bg-blue-100 text-blue-800' :
                            event.category === 'cultural' ? 'bg-purple-100 text-purple-800' :
                            event.category === 'sports' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.category}
                          </span>
                        </div>
                      ))}
                    {events.filter(event => {
                      const eventDate = new Date(event.date);
                      const currentMonth = new Date().getMonth();
                      const currentYear = new Date().getFullYear();
                      return eventDate.getMonth() === currentMonth && 
                             eventDate.getFullYear() === currentYear &&
                             eventDate >= new Date();
                    }).length === 0 && (
                      <p className="text-sm text-gray-500 italic">No upcoming events this month</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Venue */}
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
                  Venue *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="venue"
                    name="venue"
                    type="text"
                    required
                    value={formData.venue}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter venue location"
                  />
                </div>
              </div>

              {/* Max Participants */}
              <div>
                <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Participants *
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    id="maxParticipants"
                    name="maxParticipants"
                    type="number"
                    required
                    min="1"
                    value={formData.maxParticipants}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter maximum participants"
                  />
                </div>
              </div>

              {/* Registration Deadline */}
              {isAlreadyCompleted ? (
                <div className="opacity-60">
                  <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-400 mb-2">
                    Registration Deadline (auto-set for completed events)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      id="registrationDeadline"
                      name="registrationDeadline"
                      type="date"
                      value={formData.registrationDeadline || formData.date}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                    <TimePicker
                      value={formData.registrationDeadlineTime || formData.time || '23:59'}
                      onChange={() => {}}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Registration deadline is automatically set for completed events</p>
                </div>
              ) : (
                <div>
                  <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-2">
                    Registration Deadline *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      id="registrationDeadline"
                      name="registrationDeadline"
                      type="date"
                      required
                      value={formData.registrationDeadline}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    <TimePicker
                      value={formData.registrationDeadlineTime}
                      onChange={(time) => setFormData(prev => ({ ...prev, registrationDeadlineTime: time }))}
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Registration closes at this exact time</p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    id="description"
                    name="description"
                    required
                    rows={4}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                    placeholder="Describe your event..."
                  />
                </div>
              </div>

              {/* Image URL + Local Upload Unified Container */}
              <div>
                <label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Image URL
                </label>
                <div className="space-y-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  {/* URL Input Row */}
                  <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1 relative min-w-0">
                      <Image className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        id="image"
                        name="image"
                        type="text"
                        value={formData.image}
                        onChange={handleImageChange}
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
                          const uploadSection = document.getElementById('local-upload-manager');
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
                            const ev = new CustomEvent('trigger-edit-external-image', { detail: { url: formData.image } });
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
                  <div id="local-upload-manager" className="mt-2">
                    <ImageUploadManager
                      initialPreviewUrl={localImagePreview}
                      editingEventId={isEditMode ? (editingEvent?.id || (editingEvent as any)?._id) : undefined}
                      embeddedMode={true}
                      externalImageUrl={formData.image}
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
              </div>

              {/* Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Requirements
                </label>
                <div className="space-y-2">
                  {formData.requirements.map((requirement: string, index: number) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={requirement}
                        onChange={(e) => updateRequirement(index, e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter requirement"
                      />
                      {formData.requirements.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Remove requirement"
                          title="Remove this requirement"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRequirement}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Requirement</span>
                  </button>
                </div>
              </div>

              {/* Prizes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prizes
                </label>
                <div className="space-y-2">
                  {formData.prizes.map((prize: string, index: number) => (
                    <div key={index} className="flex space-x-2">
                      <div className="relative flex-1">
                        <Trophy className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                          type="text"
                          value={prize}
                          onChange={(e) => updatePrize(index, e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder={`${index + 1}${index === 0 ? 'st' : index === 1 ? 'nd' : index === 2 ? 'rd' : 'th'} Prize`}
                        />
                      </div>
                      {formData.prizes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePrize(index)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                          aria-label="Remove prize"
                          title="Remove this prize"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addPrize}
                    className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Prize</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Already Completed Checkbox — only for new events */}
          {!isEditMode && (
            <div className="mt-8">
              <div className="border-t border-gray-200 pt-6">
                <label className="flex items-start gap-3 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={isAlreadyCompleted}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsAlreadyCompleted(checked);
                      if (checked) {
                        setSilentRelease(true);
                        // Auto-fill registration deadline to match event date if not already set
                        if (formData.date && !formData.registrationDeadline) {
                          setFormData(prev => ({
                            ...prev,
                            registrationDeadline: prev.date,
                            registrationDeadlineTime: prev.time || '23:59',
                          }));
                        }
                      }
                    }}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 accent-amber-600 transition"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-5 h-5 text-amber-500" />
                      <span className="text-lg font-semibold text-gray-900">This event is already completed</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Enable this to create a past event that has already taken place. Date restrictions will be removed so you can enter the original event date. The event will be marked as <strong>completed</strong> and no notifications will be sent.
                    </p>
                  </div>
                </label>
                {isAlreadyCompleted && (
                  <div className="mt-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>📋 Completed Event Mode</strong>
                      <br />
                      This event will be created with status <strong>"completed"</strong>. You can upload gallery media to it after creation. Past dates are allowed and notifications are silenced.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Access Control Section */}
          <div className="mt-8">
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-gray-900">Access Control</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Set who can view and register for this event based on department, year, and role.
              </p>
              <AccessControlForm value={accessControl} onChange={setAccessControl} />
            </div>
          </div>

          {/* Auto Approval Section */}
          <div className="mt-8">
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-green-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Auto Approval</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {autoApproval 
                      ? "Students are automatically approved when they register. QR codes are generated instantly."
                      : "Students must wait for manual approval. Registrations go to a waiting list until approved by organizers."
                    }
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
                    onClick={() => setAutoApproval(!autoApproval)}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      autoApproval ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <motion.span
                      layout
                      className="inline-block h-6 w-6 rounded-full bg-white"
                      animate={{ x: autoApproval ? 28 : 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    />
                  </button>
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>{autoApproval ? '✓ Auto Approval ON' : '⏳ Manual Approval Required'}</strong>
                  <br />
                  {autoApproval 
                    ? "Users will be immediately registered and can access their QR codes for event entry."
                    : "Organizers and admins must manually approve each registration from the waiting list before users can access QR codes."
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Team Event Section */}
          <div className="mt-8">
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-gray-900">Team Event</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {isTeamEvent 
                      ? "This is a team-based event. Participants must form teams to register."
                      : "This is an individual event. Each participant registers separately."
                    }
                  </p>
                </div>
                <div className="ml-4">
                  <button
                    type="button"
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
                          <label className="block text-sm font-medium text-gray-700 mb-1" id="min-team-label">
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
                            aria-labelledby="min-team-label"
                            title="Select minimum team size"
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                              <option key={n} value={n}>{n} members</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1" id="max-team-label">
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
                            aria-labelledby="max-team-label"
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
          </div>

          {/* College-Specific Settings Section */}
          <div className="mt-8">
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-gray-900">College Settings</h3>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                Configure how this event interacts with your college ({COLLEGE_NAME}).
              </p>

              {/* Toggle 1: Other College Registrations */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="w-5 h-5 text-purple-500" />
                      <h3 className="text-lg font-semibold text-gray-900">Other College Registrations</h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      {allowOtherColleges 
                        ? 'Anyone from any college can register for this event.'
                        : <>Only students from <strong>{COLLEGE_NAME}</strong> can register for this event.</>}
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      type="button"
                      title="Toggle other college registrations"
                      onClick={() => {
                        const newValue = !allowOtherColleges;
                        setAllowOtherColleges(newValue);
                        if (newValue) {
                          // When enabling other college registrations, auto-enable notify all users and make visible (turn off hide)
                          setNotifyAllUsers(true);
                          setVisibleToOthers(false); // false = visible to all, true = hidden
                        }
                      }}
                      className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                        allowOtherColleges ? 'bg-purple-500' : 'bg-gray-300'
                      }`}
                    >
                      <motion.span
                        layout
                        className="inline-block h-6 w-6 rounded-full bg-white"
                        animate={{ x: allowOtherColleges ? 28 : 4 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      />
                    </button>
                  </div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800">
                    <strong>{allowOtherColleges ? '🌍 Open Registration' : '🔒 College Only'}</strong>
                    <br />
                    {allowOtherColleges 
                      ? "Students from any college can register for this event."
                      : "Only students from your college can register. Others will be blocked."}
                  </p>
                </div>

                {/* Toggle 2: Notify All Users */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-semibold text-gray-900">Notify All Users</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {notifyAllUsers
                          ? 'Event notifications will be sent to all users.'
                          : <>Event notifications will only be sent to students of <strong>{COLLEGE_NAME}</strong>.</>}
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        type="button"
                        title="Toggle notify all users"
                        onClick={() => setNotifyAllUsers(!notifyAllUsers)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          notifyAllUsers ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <motion.span
                          layout
                          className="inline-block h-6 w-6 rounded-full bg-white"
                          animate={{ x: notifyAllUsers ? 28 : 4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{notifyAllUsers ? '📢 Notify Everyone' : '🔔 College Only'}</strong>
                      <br />
                      {notifyAllUsers 
                        ? "All users will receive notifications about this event."
                        : "Only students from your college will be notified about this event."}
                    </p>
                  </div>
                </div>

                {/* Toggle 3: Hide from Other Colleges */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Eye className="w-5 h-5 text-green-500" />
                        <h3 className="text-lg font-semibold text-gray-900">Hide from Other Colleges</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {visibleToOthers
                          ? 'This event is hidden from students of other colleges.'
                          : <>All users can see this event, but only <strong>{COLLEGE_NAME}</strong> students can register (if registration is restricted).</>}
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        type="button"
                        title="Toggle hide from other colleges"
                        onClick={() => {
                          const newValue = !visibleToOthers;
                          setVisibleToOthers(newValue);
                          // If hiding from other colleges when other college registrations is on, also turn off other college registrations
                          if (newValue && allowOtherColleges) {
                            setAllowOtherColleges(false);
                          }
                        }}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                          visibleToOthers ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <motion.span
                          layout
                          className="inline-block h-6 w-6 rounded-full bg-white"
                          animate={{ x: visibleToOthers ? 28 : 4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>{visibleToOthers ? '🙈 Hidden from Others' : '👁️ Visible to All'}</strong>
                      <br />
                      {visibleToOthers 
                        ? "Only students from your college can see this event in their feed."
                        : "All users can view this event. Registration depends on 'Other College Registrations' setting."}
                    </p>
                  </div>
                </div>

                {/* Toggle 4: Silent Event Release */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <BellOff className="w-5 h-5 text-orange-500" />
                        <h3 className="text-lg font-semibold text-gray-900">Silent Event Release</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {silentRelease
                          ? 'No notifications or emails will be sent when this event is created.'
                          : 'Users will receive notifications and emails about this new event.'}
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        type="button"
                        title="Toggle silent event release"
                        onClick={() => setSilentRelease(!silentRelease)}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                          silentRelease ? 'bg-orange-500' : 'bg-gray-300'
                        }`}
                      >
                        <motion.span
                          layout
                          className="inline-block h-6 w-6 rounded-full bg-white"
                          animate={{ x: silentRelease ? 28 : 4 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-800">
                      <strong>{silentRelease ? '🔇 Silent Mode' : '🔔 Notifications Enabled'}</strong>
                      <br />
                      {silentRelease 
                        ? "This event will be created silently without sending any notifications or emails to users."
                        : "Users will be notified via app notifications and emails when this event is created."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadProgress !== null}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {loading ? (isEditMode ? 'Updating Event...' : 'Creating Event...') : (isEditMode ? 'Update Event' : 'Create Event')}
            </button>
            <AnimatePresence>
              {uploadProgress !== null && (
                <motion.div
                  key="upload-progress"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="flex items-center gap-4 min-w-[240px]" aria-live="polite" aria-label="Upload progress"
                >
                  <div className="relative w-40 sm:w-56 h-4 bg-gray-200/70 backdrop-blur-sm rounded-full overflow-hidden shadow-inner">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 animate-[progressStripes_1.2s_linear_infinite] bg-[length:200%_100%] transition-[width] duration-200"
                      style={{ width: `${uploadProgress}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[11px] font-medium text-white drop-shadow-sm">{uploadProgress}%</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 select-none">Uploading...</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default CreateEvent;